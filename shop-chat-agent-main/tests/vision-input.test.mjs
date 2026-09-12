import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import {
  MAX_VISION_IMAGE_BYTES,
  prepareVisionImage,
  resolveGeneratedVisionImage,
  storeGeneratedVisionImage,
} from "../app/services/vision-image.server.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z",
  "base64",
);
const ONE_PIXEL_WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);

function loadVisionCopySource() {
  const source = readFileSync(new URL("../app/services/vision-copy.server.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "")
    .replace(/export const VISION_TASKS/, "const VISION_TASKS")
    .replace(/export function parseVisionCopy/, "function parseVisionCopy")
    .replace(/export function parseVisionGuidance/, "function parseVisionGuidance")
    .replace(/export function buildVisionRequest/, "function buildVisionRequest")
    .replace(/export async function generateVisionCopy/, "async function generateVisionCopy")
    .replace(/export async function generateVisionGuidance/, "async function generateVisionGuidance");
  const context = vm.createContext({ createAnthropicService: () => ({}) });
  vm.runInContext(
    `${source}\nglobalThis.parseVisionCopy = parseVisionCopy;\nglobalThis.parseVisionGuidance = parseVisionGuidance;\nglobalThis.buildVisionRequest = buildVisionRequest;`,
    context,
  );
  return context;
}

test("vision image preparation rejects oversized and unreadable uploads", async () => {
  await assert.rejects(
    prepareVisionImage(Buffer.alloc(MAX_VISION_IMAGE_BYTES + 1), "image/png"),
    (error) => error.status === 413,
  );
  await assert.rejects(
    prepareVisionImage(Buffer.from("not an image"), "image/png"),
    /do not match a supported file type/,
  );

  const tooWide = Buffer.from(ONE_PIXEL_PNG);
  tooWide.writeUInt32BE(4097, 16);
  await assert.rejects(prepareVisionImage(tooWide, "image/png"), (error) => error.status === 413);
});

test("vision image preparation strips metadata while preserving image data", async () => {
  const pngMetadata = Buffer.concat([
    Buffer.from([0, 0, 0, 4]),
    Buffer.from("tEXtNote", "ascii"),
    Buffer.alloc(4),
  ]);
  const pngTransparency = Buffer.concat([
    Buffer.from([0, 0, 0, 6]),
    Buffer.from("tRNS", "ascii"),
    Buffer.alloc(10),
  ]);
  const imageWithMetadata = Buffer.concat([
    ONE_PIXEL_PNG.subarray(0, 33),
    pngMetadata,
    pngTransparency,
    ONE_PIXEL_PNG.subarray(33),
  ]);
  const prepared = await prepareVisionImage(imageWithMetadata, "image/png");
  const output = Buffer.from(prepared.data, "base64");

  assert.equal(prepared.mediaType, "image/png");
  assert.equal(output.includes(Buffer.from("tEXt", "ascii")), false);
  assert.equal(output.includes(Buffer.from("tRNS", "ascii")), true);
  assert.equal(output.includes(Buffer.from("IDAT", "ascii")), true);
  assert.ok(output.length < imageWithMetadata.length);

  const jpeg = await prepareVisionImage(ONE_PIXEL_JPEG, "image/jpeg");
  assert.equal(jpeg.mediaType, "image/jpeg");
  assert.equal(Buffer.from(jpeg.data, "base64").includes(Buffer.from("JFIF", "ascii")), false);

  const webpMetadata = Buffer.concat([
    Buffer.from("EXIF", "ascii"),
    Buffer.from([4, 0, 0, 0]),
    Buffer.from("Note", "ascii"),
  ]);
  const webpWithMetadata = Buffer.concat([
    ONE_PIXEL_WEBP.subarray(0, 12),
    webpMetadata,
    ONE_PIXEL_WEBP.subarray(12),
  ]);
  webpWithMetadata.writeUInt32LE(webpWithMetadata.length - 8, 4);
  const webp = await prepareVisionImage(webpWithMetadata, "image/webp");
  assert.equal(webp.mediaType, "image/webp");
  assert.equal(Buffer.from(webp.data, "base64").includes(Buffer.from("EXIF", "ascii")), false);
});

test("generated image references are opaque and bound to one browser session", () => {
  const reference = storeGeneratedVisionImage("session-1234567890", Buffer.from("image bytes"));
  assert.match(reference, /^[a-f0-9-]{36}$/);
  assert.equal(resolveGeneratedVisionImage(reference, "session-1234567890").toString(), "image bytes");
  assert.throws(
    () => resolveGeneratedVisionImage(reference, "different-session-123"),
    (error) => error.status === 404,
  );
});

test("structured image copy parser accepts the exact schema and rejects malformed output", () => {
  const { parseVisionCopy } = loadVisionCopySource();
  const parsed = parseVisionCopy(JSON.stringify({
    description: "A bright geometric print.",
    tags: ["bright", "geometric", "modern", "print"],
    altText: "Bright geometric artwork",
    caption: "Color with clean lines",
    containsIdentityDetails: false,
  }));

  assert.equal(parsed.tags.length, 4);
  const generic = parseVisionCopy(JSON.stringify({
    description: "A birthday design for Alex, age 7.",
    tags: ["alex", "age-7", "birthday", "child"],
    altText: "Alex's seventh birthday artwork",
    caption: "Alex turns seven",
    containsIdentityDetails: true,
  }));
  assert.doesNotMatch(JSON.stringify(generic), /Alex|seven|age-7|child/i);
  assert.throws(() => parseVisionCopy("```json\n{}\n```"), /malformed image copy/);
  assert.throws(() => parseVisionCopy(JSON.stringify({ ...parsed, extra: true })), /unexpected image copy fields/);
});

test("image guidance replaces identity-bearing model output with fixed generic advice", () => {
  const { parseVisionGuidance } = loadVisionCopySource();
  assert.equal(
    parseVisionGuidance(JSON.stringify({
      guidance: "Alex should use this seventh-birthday design on a child's shirt.",
      containsIdentityDetails: true,
    })),
    "This artwork includes customer-provided personalization. Choose a product with enough printable area for the full design, keep personalized elements inside the safe zone, and confirm readability at the final print size. Use the normal shopping assistant to check current product availability.",
  );
  assert.equal(
    parseVisionGuidance(JSON.stringify({
      guidance: "Use a large front print and preserve the fine lines.",
      containsIdentityDetails: false,
    })),
    "Use a large front print and preserve the fine lines.",
  );
});

test("vision requests exclude customer identity context and prohibit identity in output", () => {
  const { buildVisionRequest } = loadVisionCopySource();
  const request = buildVisionRequest({
    task: "copy",
    image: { mediaType: "image/png", data: "image-data" },
    context: "Alex is a seven-year-old child",
  });

  assert.doesNotMatch(request.messages[0].content, /Alex|seven-year-old|child/);
  assert.match(request.systemAddon, /do not transcribe, repeat, infer, or include a person's name, age/i);
});

test("vision route and homepage expose one shared image-to-text rail", () => {
  const route = readFileSync(new URL("../app/routes/vision-copy.jsx", import.meta.url), "utf8");
  const generation = readFileSync(new URL("../app/routes/generate-image.jsx", import.meta.url), "utf8");
  const homepage = readFileSync(new URL("../extensions/chat-bubble/assets/lazy-home.js", import.meta.url), "utf8");
  const liquid = readFileSync(new URL("../extensions/chat-bubble/blocks/lazy-home.liquid", import.meta.url), "utf8");

  assert.match(route, /generateVisionCopy/);
  assert.match(route, /generateVisionGuidance/);
  assert.match(route, /enforceVisionRateLimit/);
  assert.match(route, /resolveGeneratedVisionImage/);
  assert.doesNotMatch(route, /write_products|Admin API|db\.server|prisma|shopify\.server|\bcontext\b/i);
  assert.match(generation, /X-Lazy-Image-Reference/);
  assert.match(homepage, /\/vision-copy/);
  assert.doesNotMatch(homepage, /body\.append\("context"|image_reference:[^}]*context/);
  assert.match(liquid, /Create with OpenAI/);
  assert.match(liquid, /Upload for Claude/);
});
