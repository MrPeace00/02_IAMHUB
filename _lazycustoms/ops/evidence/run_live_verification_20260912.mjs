import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../../..");
const runsRoot = path.resolve(scriptDir, "live_runs");
const execFileAsync = promisify(execFile);
const baseUrl = "https://ai.lazycustoms.com";
const origin = "https://lazycustoms.com";
const sessionId = `live-${randomUUID().replaceAll("-", "")}`;
const conversationId = `live-verify-${randomUUID()}`;
const expectedIdentityCopy = {
  description: "Custom artwork featuring customer-provided personalization, ready to adapt to a suitable product.",
  tags: ["customizable", "personalized", "custom-design", "gift-ready"],
  altText: "Custom artwork with customer-provided personalized details",
  caption: "A design made personal for the occasion",
};
const forbiddenIdentityTerms = ["alex", "birthday", "birthday crew"];

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  return value && !value.startsWith("--") ? value : null;
}

const runDirArgument = option("--run-dir");
const expectedSourceCommit = option("--expected-source-commit");
if (!runDirArgument || !expectedSourceCommit) {
  throw new Error("Usage: node run_live_verification_20260912.mjs --run-dir <fixture-directory> --expected-source-commit <sha>");
}
const runDir = path.resolve(runDirArgument);
const relativeRunDir = path.relative(runsRoot, runDir);
if (!relativeRunDir || relativeRunDir.startsWith("..") || path.isAbsolute(relativeRunDir)) {
  throw new Error(`Run directory must be an existing child of ${runsRoot}`);
}
if (!/^\d{8}T\d{6}Z(?:-[A-Za-z0-9_-]+)?$/.test(path.basename(runDir))) {
  throw new Error("Run directory name must begin with a UTC basic timestamp such as 20260912T070000Z");
}
if (!/^[0-9a-f]{7,40}$/i.test(expectedSourceCommit)) {
  throw new Error("Expected source commit must be a 7-40 character hexadecimal Git object ID");
}

function timestamp() {
  return new Date().toISOString();
}

function runPath(name) {
  return path.join(runDir, name);
}

async function writeOnce(name, value, encoding) {
  await writeFile(runPath(name), value, { ...(encoding ? { encoding } : {}), flag: "wx" });
}

async function saveText(name, value) {
  await writeOnce(name, value, "utf8");
}

async function saveJson(name, value) {
  await saveText(name, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function hashFile(filePath) {
  return sha256(await readFile(filePath));
}

async function gitRevParse(ref) {
  const { stdout } = await execFileAsync("git", ["rev-parse", ref], { cwd: repoRoot });
  return stdout.trim();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 180_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseSse(raw) {
  return raw
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .map((data) => {
      try {
        return JSON.parse(data);
      } catch {
        return { type: "unparsed", data };
      }
    });
}

function redactEvidenceText(value) {
  return String(value)
    .replace(
      /https:\/\/([^"\\\s)]+)\/cart\/c\/[^?"\\\s)]+(?:\?[^"\\\s)]+)?/gi,
      "https://$1/cart/c/[redacted]?credential=[redacted]",
    )
    .replace(
      /https:\/\/([^"\\\s)]+)\/checkouts?\/[^?"\\\s)]+(?:\?[^"\\\s)]+)?/gi,
      "https://$1/checkout/[redacted]?credential=[redacted]",
    );
}

function findNativeCheckoutHandoff(text) {
  const matches = String(text).match(/https:\/\/[^\s)\]]+/g) || [];
  for (const candidate of matches) {
    try {
      const url = new URL(candidate.replace(/[.,]+$/, ""));
      const approvedHost = url.hostname === "lazycustoms.com"
        || url.hostname.endsWith(".myshopify.com");
      const checkoutPath = /\/(cart(?:\/|$)|checkout(?:\/|$))/i.test(url.pathname);
      if (approvedHost && checkoutPath) {
        const redactedPath = url.pathname
          .replace(/\/cart\/c\/[^/]+/i, "/cart/c/[redacted]")
          .replace(/\/checkouts?\/[^/]+/i, "/checkout/[redacted]");
        return {
          returned: true,
          origin: url.origin,
          path: redactedPath,
          credentialPresentInLiveResponse: Boolean(url.search),
        };
      }
    } catch {
      // Ignore malformed model text that merely resembles a URL.
    }
  }
  return { returned: false };
}

function summarizeChatTurn(status, events) {
  const toolNames = events
    .filter((event) => event.type === "tool_use")
    .map((event) => String(event.tool_use_message || "").replace(/^Calling tool:\s*/, ""));
  const products = events
    .filter((event) => event.type === "product_results")
    .flatMap((event) => Array.isArray(event.products) ? event.products : []);
  const assistantText = events
    .filter((event) => event.type === "chunk")
    .map((event) => event.chunk || "")
    .join("");
  return {
    status,
    toolNames,
    productCount: products.length,
    productTitles: products.map((product) => product.title || product.name || product.id).filter(Boolean),
    authRequired: events.some((event) => event.type === "auth_required"),
    completed: events.some((event) => event.type === "end_turn"),
    assistantConfirmedCart: /successfully added to (?:a|your|the) (?:new )?cart|added to (?:a|your|the) (?:new )?cart|cart (?:was )?created/i.test(assistantText),
    checkoutHandoff: findNativeCheckoutHandoff(assistantText),
    assistantText,
  };
}

async function postChat(message, quiz, suffix) {
  const startedAt = timestamp();
  const response = await fetchWithTimeout(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Origin: origin,
      "X-Shopify-Shop-Id": "lazy-customs-2.myshopify.com",
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
      prompt_type: "customer",
      ...(quiz ? { quiz } : {}),
    }),
  });
  const raw = await response.text();
  const finishedAt = timestamp();
  const turn = summarizeChatTurn(response.status, parseSse(raw));
  const redactedAssistantText = redactEvidenceText(turn.assistantText);
  if (/[?&]key=|\/cart\/c\/(?!\[redacted\])/i.test(redactedAssistantText)) {
    throw new Error("Checkout credential redaction failed");
  }
  await saveJson(`chat_${suffix}_evidence.json`, {
    startedAt,
    finishedAt,
    status: turn.status,
    completed: turn.completed,
    toolNames: turn.toolNames,
    productCount: turn.productCount,
    productTitles: turn.productTitles,
    authRequired: turn.authRequired,
    assistantConfirmedCart: turn.assistantConfirmedCart,
    checkoutHandoff: turn.checkoutHandoff,
    assistantText: redactedAssistantText,
  });
  return { startedAt, finishedAt, ...turn, assistantText: undefined };
}

async function postVisionUpload(fileName) {
  const startedAt = timestamp();
  const bytes = await readFile(runPath(fileName));
  const form = new FormData();
  form.append("task", "copy");
  form.append("image", new Blob([bytes], { type: "image/png" }), fileName);
  const response = await fetchWithTimeout(`${baseUrl}/vision-copy`, {
    method: "POST",
    headers: { Origin: origin, "X-Lazy-Session": sessionId },
    body: form,
  });
  return { startedAt, finishedAt: timestamp(), status: response.status, body: await readJsonResponse(response) };
}

async function readJsonResponse(response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function hasCompleteCopy(result) {
  const copy = result?.body?.copy;
  return result.status === 200
    && result.body?.source === "anthropic"
    && typeof copy?.description === "string"
    && copy.description.length > 0
    && Array.isArray(copy?.tags)
    && copy.tags.length > 0
    && typeof copy?.altText === "string"
    && copy.altText.length > 0
    && typeof copy?.caption === "string"
    && copy.caption.length > 0;
}

async function generateImage() {
  const startedAt = timestamp();
  const response = await fetchWithTimeout(`${baseUrl}/generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Lazy-Session": sessionId,
    },
    body: JSON.stringify({
      prompt: "A cheerful hand-drawn wildflower bouquet with clean bold outlines and no words, centered for printing on a tote bag",
    }),
  });
  const contentType = response.headers.get("content-type") || "";
  const imageReference = response.headers.get("x-lazy-image-reference");
  if (!response.ok || !contentType.startsWith("image/png")) {
    return {
      startedAt,
      finishedAt: timestamp(),
      status: response.status,
      contentType,
      imageReference,
      error: await response.text(),
    };
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const validPngSignature = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  await writeOnce("generated_openai.png", bytes);
  return {
    startedAt,
    finishedAt: timestamp(),
    status: response.status,
    contentType,
    imageReference,
    byteLength: bytes.length,
    sha256: sha256(bytes),
    validPngSignature,
  };
}

async function postGeneratedVision(imageReference) {
  const startedAt = timestamp();
  const response = await fetchWithTimeout(`${baseUrl}/vision-copy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "X-Lazy-Session": sessionId,
    },
    body: JSON.stringify({ task: "copy", image_reference: imageReference }),
  });
  return { startedAt, finishedAt: timestamp(), status: response.status, body: await readJsonResponse(response) };
}

const reservedOutputNames = [
  "chat_search_evidence.json",
  "chat_cart_evidence.json",
  "generated_openai.png",
  "generated_openai_metadata.json",
  "vision_upload_response.json",
  "vision_generated_handoff_response.json",
  "vision_identity_response.json",
  "live_verification_summary.json",
  "evidence_manifest.json",
];
const existingNames = new Set(await readdir(runDir));
const collisions = reservedOutputNames.filter((name) => existingNames.has(name));
if (collisions.length > 0) {
  throw new Error(`Run directory already contains verification output: ${collisions.join(", ")}`);
}

const originMainAtRunStart = await gitRevParse("origin/main");
const expectedCommitMatchesOriginMain = originMainAtRunStart.startsWith(expectedSourceCommit.toLowerCase());
const summary = {
  schemaVersion: 2,
  startedAt: timestamp(),
  mode: "direct HTTPS endpoint integration; browser/widget UI not exercised",
  baseUrl,
  sourceProvenance: {
    expectedSourceCommit,
    originMainAtRunStart,
    expectedCommitMatchesOriginMain,
    exactRuntimeCommitVerified: false,
    limitation: "The health endpoint does not expose a runtime commit SHA, and Railway CLI/API attestation was unavailable.",
  },
  checks: {},
};

try {
  const fixtureManifest = JSON.parse(await readFile(runPath("fixture_manifest.json"), "utf8"));
  const fixtureHashes = Object.fromEntries(fixtureManifest.files.map((file) => [file.name, file.sha256]));
  for (const [name, expectedHash] of Object.entries(fixtureHashes)) {
    const actualHash = await hashFile(runPath(name));
    if (actualHash !== expectedHash) throw new Error(`Fixture hash mismatch: ${name}`);
  }
  summary.fixtures = fixtureManifest;

  const healthStartedAt = timestamp();
  const healthResponse = await fetchWithTimeout(`${baseUrl}/chat?health=true`);
  const healthBody = await readJsonResponse(healthResponse);
  summary.health = {
    startedAt: healthStartedAt,
    finishedAt: timestamp(),
    status: healthResponse.status,
    body: healthBody,
    headers: {
      date: healthResponse.headers.get("date"),
      server: healthResponse.headers.get("server"),
    },
  };

  const chatSearch = await postChat(
    "I need a winter gift for a woman. Use the live catalog now, show matching customizable hoodies or apparel as product cards, choose the first suitable result, create a cart with one available variant, and give me the native cart or checkout handoff.",
    {
      audience: "woman",
      season: "winter",
      category: "hoodie",
      customization: "text-on-image",
      tags: ["winter", "gift", "custom"],
    },
    "search",
  );

  let chatCart = null;
  const firstTurnComplete = chatSearch.toolNames.includes("create_cart")
    && chatSearch.checkoutHandoff.returned;
  if (!firstTurnComplete && chatSearch.status === 200) {
    chatCart = await postChat(
      "Proceed now: use the live catalog again if needed, add one available variant from the first suitable result to a Shopify cart, and provide the native cart or checkout handoff.",
      null,
      "cart",
    );
  }

  const chatTurns = [chatSearch, chatCart].filter(Boolean);
  const toolNames = chatTurns.flatMap((turn) => turn.toolNames);
  const productCardsReturned = chatTurns.reduce((total, turn) => total + turn.productCount, 0);
  const createCartInvoked = toolNames.includes("create_cart");
  const handoff = chatTurns.map((turn) => turn.checkoutHandoff).find((value) => value.returned)
    || { returned: false };
  const assistantConfirmedCart = chatTurns.some((turn) => turn.assistantConfirmedCart);
  summary.checks.chatCustomerFlow = {
    startedAt: chatTurns[0]?.startedAt,
    finishedAt: chatTurns.at(-1)?.finishedAt,
    passed: chatTurns.every((turn) => turn.status === 200 && turn.completed)
      && toolNames.includes("search_catalog")
      && productCardsReturned > 0
      && createCartInvoked
      && handoff.returned,
    observed: {
      toolNames,
      productCardsReturned,
      createCartInvoked,
      assistantConfirmedCart,
      checkoutHandoff: handoff,
    },
    limitation: "SSE exposes tool invocation but not raw Shopify tool results; create_cart invocation and a native checkout URL are observed, but no independently persisted tool-result event, browser/widget interaction, or completed checkout is claimed.",
  };

  const upload = await postVisionUpload("vision_upload_fixture.png");
  await saveJson("vision_upload_response.json", upload);
  summary.checks.visionUpload = {
    startedAt: upload.startedAt,
    finishedAt: upload.finishedAt,
    passed: hasCompleteCopy(upload),
    status: upload.status,
    source: upload.body?.source,
    completeCopyObject: hasCompleteCopy(upload),
  };

  const generated = await generateImage();
  await saveJson("generated_openai_metadata.json", {
    ...generated,
    imageReference: undefined,
    imageReferenceIssued: Boolean(generated.imageReference),
  });
  let generatedVision = null;
  if (generated.status === 200 && generated.imageReference && generated.validPngSignature) {
    generatedVision = await postGeneratedVision(generated.imageReference);
    await saveJson("vision_generated_handoff_response.json", generatedVision);
  }
  summary.checks.openAiToClaudeHandoff = {
    startedAt: generated.startedAt,
    finishedAt: generatedVision?.finishedAt || generated.finishedAt,
    passed: generated.status === 200
      && generated.validPngSignature
      && Boolean(generated.imageReference)
      && hasCompleteCopy(generatedVision),
    generation: {
      status: generated.status,
      contentType: generated.contentType,
      byteLength: generated.byteLength,
      sha256: generated.sha256,
      validPngSignature: generated.validPngSignature,
      imageReferenceIssued: Boolean(generated.imageReference),
    },
    vision: generatedVision && {
      status: generatedVision.status,
      source: generatedVision.body?.source,
      completeCopyObject: hasCompleteCopy(generatedVision),
    },
  };

  const identity = await postVisionUpload("vision_identity_fixture.png");
  await saveJson("vision_identity_response.json", identity);
  const identityCopy = identity.body?.copy;
  const normalizedOutput = JSON.stringify(identityCopy || {}).toLowerCase();
  const leakedTerms = forbiddenIdentityTerms.filter((term) => normalizedOutput.includes(term));
  const exactFallback = JSON.stringify(identityCopy) === JSON.stringify(expectedIdentityCopy);
  summary.checks.identityBoundary = {
    startedAt: identity.startedAt,
    finishedAt: identity.finishedAt,
    passed: identity.status === 200
      && identity.body?.source === "anthropic"
      && exactFallback
      && leakedTerms.length === 0,
    status: identity.status,
    source: identity.body?.source,
    exactFixedFallbackReturned: exactFallback,
    leakedFixtureTerms: leakedTerms,
  };
} catch (error) {
  summary.runnerError = { name: error?.name, message: error?.message || String(error) };
}

summary.finishedAt = timestamp();
summary.allPassed = expectedCommitMatchesOriginMain
  && summary.health?.status === 200
  && summary.health?.body?.service === "shop-chat-agent"
  && summary.health?.body?.status === "ok"
  && Object.keys(summary.checks).length === 4
  && Object.values(summary.checks).every((check) => check.passed);
await saveJson("live_verification_summary.json", summary);

const evidenceFiles = (await readdir(runDir))
  .filter((name) => name !== "evidence_manifest.json")
  .sort();
const evidenceManifest = {
  schemaVersion: 1,
  createdAt: timestamp(),
  runDirectory: path.basename(runDir),
  sourceFiles: {
    runner: { path: path.relative(scriptDir, scriptPath), sha256: await hashFile(scriptPath) },
    fixtureGenerator: {
      path: "create_live_verification_fixtures_20260912.mjs",
      sha256: await hashFile(path.join(scriptDir, "create_live_verification_fixtures_20260912.mjs")),
    },
  },
  files: [],
};
for (const name of evidenceFiles) {
  const bytes = await readFile(runPath(name));
  evidenceManifest.files.push({ name, byteLength: bytes.length, sha256: sha256(bytes) });
}
await saveJson("evidence_manifest.json", evidenceManifest);

console.log(JSON.stringify({ runDir, summary, evidenceManifest }, null, 2));
process.exitCode = summary.allPassed ? 0 : 1;
