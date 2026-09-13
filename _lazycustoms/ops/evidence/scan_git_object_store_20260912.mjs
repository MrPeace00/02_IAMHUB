import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MAX_BUFFER = 128 * 1024 * 1024;

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.encoding ?? "utf8",
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
}

function parseArgs(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex === -1 || !argv[outputIndex + 1]) {
    throw new Error("Usage: node scan_git_object_store_20260912.mjs --output <report.json>");
  }
  return { output: resolve(argv[outputIndex + 1]) };
}

function parseObjectListing(output) {
  return output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [objectId, objectType, objectSize] = line.split(" ");
      return { objectId, objectType, objectSize: Number(objectSize) };
    });
}

function parseRevisionObjects(output) {
  const objects = new Map();
  for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf(" ");
    const objectId = separator === -1 ? line : line.slice(0, separator);
    const path = separator === -1 ? null : line.slice(separator + 1);
    if (!objects.has(objectId)) objects.set(objectId, new Set());
    if (path) objects.get(objectId).add(path);
  }
  return objects;
}

function mapAllTreePaths(objects) {
  const mapped = new Map();
  for (const object of objects) {
    if (object.objectType !== "tree") continue;
    const listing = git(["ls-tree", "-r", "--full-tree", object.objectId]);
    for (const line of listing.trim().split(/\r?\n/).filter(Boolean)) {
      const match = line.match(/^\d+\s+\w+\s+([0-9a-f]{40})\t(.+)$/);
      if (!match) continue;
      if (!mapped.has(match[1])) mapped.set(match[1], new Set());
      mapped.get(match[1]).add(match[2]);
    }
  }
  return mapped;
}

function locationFor(text, index, binary) {
  if (binary) return { byteOffset: index };
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function findingId(objectId, detector, index, length) {
  return createHash("sha256")
    .update(`${objectId}:${detector}:${index}:${length}`)
    .digest("hex")
    .slice(0, 16);
}

function reachabilityFor(objectId) {
  if (reachableObjects.has(objectId)) return "reachable-from-ref";
  if (reflogObjects.has(objectId)) return "reflog-only";
  return "unreachable";
}

function pathsFor(objectId) {
  return [
    ...new Set([
      ...(reachableObjects.get(objectId) ?? []),
      ...(reflogObjects.get(objectId) ?? []),
      ...(allTreePaths.get(objectId) ?? []),
    ]),
  ].sort();
}

function addFinding({ detector, severity, object, index, length, metadata = {} }) {
  const key = `${object.objectId}:${detector}:${index}:${length}`;
  if (findingKeys.has(key)) return;
  findingKeys.add(key);
  findings.push({
    id: findingId(object.objectId, detector, index, length),
    detector,
    severity,
    objectId: object.objectId,
    objectType: object.objectType,
    objectSize: object.objectSize,
    reachability: reachabilityFor(object.objectId),
    paths: pathsFor(object.objectId),
    location: locationFor(currentText, index, currentBinary),
    matchedLength: length,
    ...metadata,
  });
}

function scanRegex(object, detector) {
  detector.pattern.lastIndex = 0;
  let match;
  while ((match = detector.pattern.exec(currentText)) !== null) {
    addFinding({
      detector: detector.id,
      severity: detector.severity,
      object,
      index: match.index,
      length: match[0].length,
      metadata: detector.metadata ? detector.metadata(match) : {},
    });
    if (match[0].length === 0) detector.pattern.lastIndex += 1;
  }
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return (
    /^(?:true|false|null|undefined|required|none)$/.test(normalized) ||
    /^[A-Z][A-Z0-9_]+$/.test(value) ||
    normalized.startsWith("process.env") ||
    normalized.startsWith("import.meta.env") ||
    normalized.startsWith("env.") ||
    normalized.startsWith("${") ||
    normalized.startsWith("<") ||
    normalized.startsWith("[") ||
    /(?:example|placeholder|change.?me|replace.?me|redacted|your.?|dummy|fake|sample|test.?only|not.?set|x{3,}|\*{3,})/.test(normalized)
  );
}

function scanGenericAssignments(object) {
  const pattern = /\b([A-Za-z][A-Za-z0-9_.-]{1,80}(?:key|secret|token|password|credential)[A-Za-z0-9_.-]{0,40})\b[ \t]*[:=][ \t]*["'`]?([A-Za-z0-9+/_=.$-]{8,})/gi;
  let match;
  while ((match = pattern.exec(currentText)) !== null) {
    const value = match[2];
    if (isPlaceholder(value)) continue;
    const valueIndex = match.index + match[0].lastIndexOf(value);
    addFinding({
      detector: "generic-credential-assignment",
      severity: "review",
      object,
      index: valueIndex,
      length: value.length,
      metadata: { variableName: match[1] },
    });
  }
}

function countKeywords(object) {
  const groups = {
    credentialTerms: /\b(?:api[_ -]?key|secret|token|password|credential|authorization|bearer)\b/gi,
    transcriptTerms: /\b(?:session transcript|conversation export|chat transcript)\b/gi,
    identityTerms: /\b(?:email|phone|address|customer id|conversation id|session id)\b/gi,
  };
  for (const [group, pattern] of Object.entries(groups)) {
    const count = [...currentText.matchAll(pattern)].length;
    if (!count) continue;
    keywordInventory[group].occurrences += count;
    keywordInventory[group].objects.add(object.objectId);
  }
}

function pngContextAt(index) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!currentBuffer.subarray(0, 8).equals(signature)) return {};
  let offset = 8;
  while (offset + 12 <= currentBuffer.length) {
    const length = currentBuffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > currentBuffer.length) return { pngStructure: "invalid" };
    if (index >= offset && index < end) {
      const type = currentBuffer.toString("ascii", offset + 4, offset + 8);
      const nearby = currentBuffer
        .subarray(Math.max(offset + 8, index - 256), Math.min(offset + 8 + length, index + 256))
        .toString("latin1")
        .toLowerCase();
      const labels = ["c2pa", "xmp", "manifest", "instanceid", "documentid", "openai"]
        .filter((label) => nearby.includes(label));
      return {
        pngChunkType: type,
        pngChunkClass: /^[a-z]/.test(type) ? "ancillary" : "critical",
        nearbyKnownLabels: labels,
      };
    }
    offset = end;
    if (currentBuffer.toString("ascii", offset - length - 8, offset - length - 4) === "IEND") break;
  }
  return { pngStructure: "offset-not-in-chunk" };
}

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
  windowsHide: true,
}).trim();
const args = parseArgs(process.argv.slice(2));
const head = git(["rev-parse", "HEAD"]).trim();
const originMain = git(["rev-parse", "origin/main"]).trim();

const allObjects = parseObjectListing(
  git(["cat-file", "--batch-all-objects", "--batch-check=%(objectname) %(objecttype) %(objectsize)"]),
);
const reachableObjects = parseRevisionObjects(git(["rev-list", "--objects", "--all"]));
const reflogObjects = parseRevisionObjects(git(["rev-list", "--objects", "--all", "--reflog"]));
const allTreePaths = mapAllTreePaths(allObjects);

const detectors = [
  { id: "private-key", severity: "critical", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { id: "openai-api-key", severity: "critical", pattern: /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: "anthropic-api-key", severity: "critical", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: "shopify-access-token", severity: "critical", pattern: /\b(?:shpat|shpca|shppa|shpss)_[A-Za-z0-9]{16,}\b/g },
  { id: "github-token", severity: "critical", pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g },
  { id: "aws-access-key-id", severity: "critical", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: "google-api-key", severity: "critical", pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/g },
  { id: "slack-token", severity: "critical", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: "slack-webhook", severity: "critical", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{20,}/g },
  { id: "stripe-secret-key", severity: "critical", pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { id: "jwt", severity: "high", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  {
    id: "url-basic-auth",
    severity: "critical",
    pattern: /https?:\/\/([^\s/:@]+):([^\s/@]+)@([^\s/]+)/g,
    metadata: (match) => ({
      host: match[3],
      appearsPlaceholder:
        /^(?:user|username|example)$/i.test(match[1]) &&
        /^(?:pass|password|example)$/i.test(match[2]),
    }),
  },
  {
    id: "query-credential",
    severity: "critical",
    pattern: /[?&](api[_-]?key|key|secret|token|password|access_token)=([^\s&#"']{6,})/gi,
    metadata: (match) => ({
      parameterName: match[1],
      appearsPlaceholder: isPlaceholder(match[2]),
    }),
  },
  { id: "bearer-token", severity: "critical", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}\b/g },
  { id: "shopify-cart-token", severity: "high", pattern: /\/cart\/c\/[A-Za-z0-9_-]{8,}/g },
  {
    id: "email-address",
    severity: "personal-data",
    pattern: /\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
    metadata: (match) => {
      const domain = match[1].toLowerCase();
      const lineStart = currentText.lastIndexOf("\n", match.index) + 1;
      const lineEnd = currentText.indexOf("\n", match.index);
      const line = currentText.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      return {
        domain,
        classification:
          /(?:^|\.)(?:example\.(?:com|org|net)|test|invalid)$/.test(domain)
            ? "reserved-example"
            : domain === "lazycustoms.com"
              ? "project-domain"
              : objectInScan.objectType === "commit" && /^(?:author|committer) /.test(line)
                ? "git-metadata"
                : "review-required",
      };
    },
  },
  {
    id: "us-phone-number",
    severity: "personal-data",
    pattern: /(?<!\d)(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[ .-](\d{3})[ .-]\d{4}(?!\d)/g,
    metadata: (match) => ({ classification: match[1] === "555" ? "reserved-example" : "review-required" }),
  },
  {
    id: "uuid",
    severity: "internal-identifier",
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    metadata: (match) => pngContextAt(match.index),
  },
  { id: "chat-transcript-structure", severity: "review", pattern: /["']role["']\s*:\s*["'](?:user|assistant|system|developer)["']/gi },
];

const findings = [];
const findingKeys = new Set();
const keywordInventory = {
  credentialTerms: { occurrences: 0, objects: new Set() },
  transcriptTerms: { occurrences: 0, objects: new Set() },
  identityTerms: { occurrences: 0, objects: new Set() },
};
let currentText = "";
let currentBinary = false;
let currentBuffer = Buffer.alloc(0);
let objectInScan = null;
let scannedBytes = 0;

for (const object of allObjects) {
  if (!["blob", "commit", "tag"].includes(object.objectType)) continue;
  objectInScan = object;
  const content = git(["cat-file", object.objectType, object.objectId], { encoding: "buffer" });
  currentBuffer = content;
  scannedBytes += content.length;
  currentBinary = object.objectType === "blob" && content.subarray(0, 8192).includes(0);
  currentText = content.toString(currentBinary ? "latin1" : "utf8");
  for (const detector of detectors) scanRegex(object, detector);
  scanGenericAssignments(object);
  countKeywords(object);
}

const sensitivePathCandidates = new Map();
const sensitivePathPattern = /(?:^|\/)(?:\.env(?:\.[^/]*)?|[^/]*(?:secret|credential|transcript|conversation|session|backup|dump)[^/]*|[^/]+\.(?:pem|key|p12|pfx))$/i;
for (const [objectId, paths] of reflogObjects.entries()) {
  for (const path of paths) {
    if (!sensitivePathPattern.test(path.replaceAll("\\", "/"))) continue;
    const key = `${objectId}:${path}`;
    sensitivePathCandidates.set(key, {
      objectId,
      reachability: reachabilityFor(objectId),
      path,
    });
  }
}

const countsByType = Object.fromEntries(
  [...new Set(allObjects.map((object) => object.objectType))]
    .sort()
    .map((type) => [type, allObjects.filter((object) => object.objectType === type).length]),
);
const countsByReachability = {
  "reachable-from-ref": allObjects.filter((object) => reachableObjects.has(object.objectId)).length,
  "reflog-only": allObjects.filter(
    (object) => !reachableObjects.has(object.objectId) && reflogObjects.has(object.objectId),
  ).length,
  unreachable: allObjects.filter(
    (object) => !reachableObjects.has(object.objectId) && !reflogObjects.has(object.objectId),
  ).length,
};
const findingsByDetector = Object.fromEntries(
  [...new Set(findings.map((finding) => finding.detector))]
    .sort()
    .map((detector) => [detector, findings.filter((finding) => finding.detector === detector).length]),
);
const findingsBySeverity = Object.fromEntries(
  [...new Set(findings.map((finding) => finding.severity))]
    .sort()
    .map((severity) => [severity, findings.filter((finding) => finding.severity === severity).length]),
);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scanner: {
    name: "scan_git_object_store_20260912.mjs",
    sourceSha256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"),
    enumeration: "git cat-file --batch-all-objects",
    scope: ["all blobs", "all commits", "all annotated tags", "reachable", "reflog-only", "unreachable"],
    valueRetention: "No matched values or value-derived hashes are retained.",
    limitations: [
      "Pattern-based detection can produce false positives and false negatives.",
      "Compressed or encrypted payloads are not decompressed or decrypted.",
      "Binary blobs are scanned as byte-preserving Latin-1 text for recognizable token strings.",
      "This is a repository-local detector, not a gitleaks or trufflehog execution.",
    ],
  },
  repository: {
    root: repoRoot,
    head,
    originMain,
    headAheadOfOriginMain: Number(git(["rev-list", "--count", "origin/main..HEAD"]).trim()),
  },
  coverage: {
    totalObjects: allObjects.length,
    countsByType,
    countsByReachability,
    scannedObjectTypes: ["blob", "commit", "tag"],
    scannedBytes,
  },
  result: {
    findingCount: findings.length,
    findingsBySeverity,
    findingsByDetector,
    sensitivePathCandidateCount: sensitivePathCandidates.size,
  },
  keywordInventory: Object.fromEntries(
    Object.entries(keywordInventory).map(([key, value]) => [
      key,
      { occurrences: value.occurrences, objectCount: value.objects.size },
    ]),
  ),
  sensitivePathCandidates: [...sensitivePathCandidates.values()].sort((a, b) =>
    `${a.path}:${a.objectId}`.localeCompare(`${b.path}:${b.objectId}`),
  ),
  findings: findings.sort((a, b) =>
    `${a.severity}:${a.detector}:${a.objectId}:${JSON.stringify(a.location)}`.localeCompare(
      `${b.severity}:${b.detector}:${b.objectId}:${JSON.stringify(b.location)}`,
    ),
  ),
};

mkdirSync(dirname(args.output), { recursive: true });
writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
process.stdout.write(
  `${JSON.stringify({ output: args.output, coverage: report.coverage, result: report.result }, null, 2)}\n`,
);
