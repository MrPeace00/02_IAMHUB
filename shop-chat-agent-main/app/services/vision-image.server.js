import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

export const MAX_VISION_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VISION_IMAGE_DIMENSION = 4096;
export const MAX_VISION_IMAGE_PIXELS = 16 * 1024 * 1024;

const GENERATED_IMAGE_TTL_MS = 15 * 60 * 1000;
const MAX_GENERATED_IMAGES = 100;
const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_PRESERVED_CHUNKS = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
const WEBP_IMAGE_CHUNKS = new Set(["VP8X", "ALPH", "VP8 ", "VP8L"]);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const generatedImages = new Map();

function imageError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sessionDigest(sessionId) {
  return createHash("sha256").update(sessionId).digest("hex");
}

function assertDimensions(width, height) {
  if (!width || !height) throw imageError("The image dimensions could not be read");
  if (
    width > MAX_VISION_IMAGE_DIMENSION
    || height > MAX_VISION_IMAGE_DIMENSION
    || width * height > MAX_VISION_IMAGE_PIXELS
  ) {
    throw imageError(
      `Image dimensions must not exceed ${MAX_VISION_IMAGE_DIMENSION} pixels or ${MAX_VISION_IMAGE_PIXELS / (1024 * 1024)} megapixels`,
      413,
    );
  }
}

function detectMediaType(input) {
  if (input.length >= PNG_SIGNATURE.length && input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }
  if (input.length >= 2 && input[0] === 0xff && input[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    input.length >= 12
    && input.toString("ascii", 0, 4) === "RIFF"
    && input.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

function stripPngMetadata(input) {
  const chunks = [PNG_SIGNATURE];
  let offset = 8;
  let width;
  let height;
  let hasImageData = false;
  let ended = false;

  while (offset < input.length) {
    if (offset + 12 > input.length) throw imageError("The PNG structure is invalid");
    const length = input.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > input.length) throw imageError("The PNG structure is invalid");
    const type = input.toString("ascii", offset + 4, offset + 8);

    if (type === "IHDR") {
      if (length !== 13 || width) throw imageError("The PNG header is invalid");
      width = input.readUInt32BE(offset + 8);
      height = input.readUInt32BE(offset + 12);
    }
    if (type === "acTL" || type === "fcTL" || type === "fdAT") {
      throw imageError("Animated images are not supported");
    }
    if (type === "IDAT") hasImageData = true;

    if (PNG_PRESERVED_CHUNKS.has(type)) {
      chunks.push(input.subarray(offset, chunkEnd));
    } else if (/^[A-Z]/.test(type)) {
      throw imageError("The PNG contains an unsupported critical chunk");
    }

    offset = chunkEnd;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }

  if (!ended || !hasImageData) throw imageError("The PNG structure is incomplete");
  assertDimensions(width, height);
  return Buffer.concat(chunks);
}

function isStandaloneJpegMarker(marker) {
  return marker === 0x01 || marker === 0xd8 || marker === 0xd9
    || (marker >= 0xd0 && marker <= 0xd7);
}

function isJpegMetadataMarker(marker) {
  return marker === 0xfe || (marker >= 0xe0 && marker <= 0xef);
}

function findNextJpegMarker(input, start) {
  let offset = start;
  while (offset + 1 < input.length) {
    if (input[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset + 1;
    while (markerOffset < input.length && input[markerOffset] === 0xff) markerOffset += 1;
    const marker = input[markerOffset];
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }
    return offset;
  }
  return -1;
}

function stripJpegMetadata(input) {
  const parts = [input.subarray(0, 2)];
  let offset = 2;
  let width;
  let height;
  let ended = false;

  while (offset < input.length) {
    const markerStart = offset;
    if (input[offset] !== 0xff) throw imageError("The JPEG structure is invalid");
    while (offset < input.length && input[offset] === 0xff) offset += 1;
    if (offset >= input.length) throw imageError("The JPEG structure is invalid");
    const marker = input[offset];
    offset += 1;

    if (marker === 0xd9) {
      parts.push(Buffer.from([0xff, 0xd9]));
      ended = true;
      break;
    }
    if (isStandaloneJpegMarker(marker)) {
      parts.push(input.subarray(markerStart, offset));
      continue;
    }
    if (offset + 2 > input.length) throw imageError("The JPEG structure is invalid");
    const length = input.readUInt16BE(offset);
    if (length < 2 || offset + length > input.length) throw imageError("The JPEG structure is invalid");
    const segmentEnd = offset + length;

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (length < 8) throw imageError("The JPEG frame header is invalid");
      height = input.readUInt16BE(offset + 3);
      width = input.readUInt16BE(offset + 5);
      const components = input[offset + 7];
      if (components !== 1 && components !== 3) {
        throw imageError("Only grayscale or RGB JPEG images are supported");
      }
    }

    if (!isJpegMetadataMarker(marker)) {
      parts.push(input.subarray(markerStart, segmentEnd));
    }
    offset = segmentEnd;

    if (marker === 0xda) {
      const nextMarker = findNextJpegMarker(input, offset);
      if (nextMarker < 0) throw imageError("The JPEG image data is incomplete");
      parts.push(input.subarray(offset, nextMarker));
      offset = nextMarker;
    }
  }

  if (!ended) throw imageError("The JPEG structure is incomplete");
  assertDimensions(width, height);
  return Buffer.concat(parts);
}

function webpDimensions(type, input, dataOffset, size) {
  if (type === "VP8X") {
    if (size < 10) throw imageError("The WebP header is invalid");
    return {
      width: 1 + input.readUIntLE(dataOffset + 4, 3),
      height: 1 + input.readUIntLE(dataOffset + 7, 3),
    };
  }
  if (type === "VP8 ") {
    if (
      size < 10
      || input[dataOffset + 3] !== 0x9d
      || input[dataOffset + 4] !== 0x01
      || input[dataOffset + 5] !== 0x2a
    ) {
      throw imageError("The WebP frame header is invalid");
    }
    return {
      width: input.readUInt16LE(dataOffset + 6) & 0x3fff,
      height: input.readUInt16LE(dataOffset + 8) & 0x3fff,
    };
  }
  if (type === "VP8L") {
    if (size < 5 || input[dataOffset] !== 0x2f) throw imageError("The WebP lossless header is invalid");
    const bits = input.readUInt32LE(dataOffset + 1);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >>> 14) & 0x3fff),
    };
  }
  return null;
}

function stripWebpMetadata(input) {
  const chunks = [];
  let offset = 12;
  let dimensions;
  let hasImageData = false;

  while (offset < input.length) {
    if (offset + 8 > input.length) throw imageError("The WebP structure is invalid");
    const type = input.toString("ascii", offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    const paddedSize = size + (size % 2);
    const chunkEnd = offset + 8 + paddedSize;
    if (chunkEnd > input.length) throw imageError("The WebP structure is invalid");

    if (type === "ANIM" || type === "ANMF") throw imageError("Animated images are not supported");
    const currentDimensions = webpDimensions(type, input, offset + 8, size);
    if (currentDimensions) {
      if (dimensions && (
        dimensions.width !== currentDimensions.width
        || dimensions.height !== currentDimensions.height
      )) {
        throw imageError("The WebP dimensions are inconsistent");
      }
      dimensions = currentDimensions;
    }
    if (type === "VP8 " || type === "VP8L") hasImageData = true;

    if (WEBP_IMAGE_CHUNKS.has(type)) {
      const chunk = Buffer.from(input.subarray(offset, chunkEnd));
      if (type === "VP8X") chunk[8] &= 0x10;
      chunks.push(chunk);
    }
    offset = chunkEnd;
  }

  if (!dimensions || !hasImageData) throw imageError("The WebP structure is incomplete");
  assertDimensions(dimensions.width, dimensions.height);
  const output = Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP", "binary"), ...chunks]);
  output.writeUInt32LE(output.length - 8, 4);
  return output;
}

function stripMetadata(input, mediaType) {
  if (mediaType === "image/png") return stripPngMetadata(input);
  if (mediaType === "image/jpeg") return stripJpegMetadata(input);
  if (mediaType === "image/webp") return stripWebpMetadata(input);
  throw imageError("Use a PNG, JPEG, or WebP image");
}

function purgeExpiredGeneratedImages(now = Date.now()) {
  for (const [reference, entry] of generatedImages) {
    if (entry.expiresAt <= now) generatedImages.delete(reference);
  }

  while (generatedImages.size >= MAX_GENERATED_IMAGES) {
    const oldestReference = generatedImages.keys().next().value;
    if (!oldestReference) break;
    generatedImages.delete(oldestReference);
  }
}

export function storeGeneratedVisionImage(sessionId, imageBytes) {
  if (typeof sessionId !== "string" || !Buffer.isBuffer(imageBytes) || imageBytes.length === 0) {
    throw imageError("Generated image reference is invalid");
  }

  purgeExpiredGeneratedImages();
  const reference = randomUUID();
  generatedImages.set(reference, {
    bytes: Buffer.from(imageBytes),
    expiresAt: Date.now() + GENERATED_IMAGE_TTL_MS,
    sessionDigest: sessionDigest(sessionId),
  });
  return reference;
}

export function resolveGeneratedVisionImage(reference, sessionId) {
  purgeExpiredGeneratedImages();
  if (typeof reference !== "string" || !/^[a-f0-9-]{36}$/i.test(reference)) {
    throw imageError("Generated image reference is invalid");
  }

  const entry = generatedImages.get(reference);
  if (!entry || entry.sessionDigest !== sessionDigest(sessionId)) {
    throw imageError("Generated image reference has expired or is unavailable", 404);
  }
  return Buffer.from(entry.bytes);
}

export async function prepareVisionImage(imageBytes, claimedMediaType) {
  const input = Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes || []);
  if (input.length === 0) throw imageError("Choose an image to continue");
  if (input.length > MAX_VISION_IMAGE_BYTES) {
    throw imageError(`Image must be ${MAX_VISION_IMAGE_BYTES / (1024 * 1024)} MB or smaller`, 413);
  }
  if (claimedMediaType && !SUPPORTED_MEDIA_TYPES.has(claimedMediaType)) {
    throw imageError("Use a PNG, JPEG, or WebP image");
  }

  const detectedMediaType = detectMediaType(input);
  if (!detectedMediaType || (claimedMediaType && detectedMediaType !== claimedMediaType)) {
    throw imageError("The image contents do not match a supported file type");
  }

  const sanitized = stripMetadata(input, detectedMediaType);
  return {
    data: sanitized.toString("base64"),
    mediaType: detectedMediaType,
  };
}
