import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const runsRoot = path.resolve(scriptDir, "live_runs");
const WIDTH = 640;
const HEIGHT = 400;
const GLYPHS = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};

function parseOutputDir(argv) {
  const index = argv.indexOf("--output-dir");
  const value = index >= 0 ? argv[index + 1] : null;
  if (!value || value.startsWith("--")) {
    throw new Error("Usage: node create_live_verification_fixtures_20260912.mjs --output-dir <new-directory>");
  }
  const outputDir = path.resolve(value);
  const relative = path.relative(runsRoot, outputDir);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Output directory must be a new child of ${runsRoot}`);
  }
  if (!/^\d{8}T\d{6}Z(?:-[A-Za-z0-9_-]+)?$/.test(path.basename(outputDir))) {
    throw new Error("Output directory name must begin with a UTC basic timestamp such as 20260912T070000Z");
  }
  return outputDir;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function encodePng(pixels) {
  const scanlines = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const target = y * (WIDTH * 3 + 1);
    scanlines[target] = 0;
    pixels.copy(scanlines, target + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 0 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createCanvas(background) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let offset = 0; offset < pixels.length; offset += 3) {
    pixels[offset] = background[0];
    pixels[offset + 1] = background[1];
    pixels[offset + 2] = background[2];
  }
  return pixels;
}

function setPixel(pixels, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 3;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
}

function fillRect(pixels, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(pixels, column, row, color);
    }
  }
}

function fillCircle(pixels, centerX, centerY, radius, color) {
  const radiusSquared = radius * radius;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSquared) setPixel(pixels, x, y, color);
    }
  }
}

function drawText(pixels, text, centerX, top, scale, color) {
  const normalized = text.toUpperCase();
  const glyphWidth = 5 * scale;
  const spacing = scale;
  const totalWidth = normalized.length * glyphWidth + (normalized.length - 1) * spacing;
  let left = Math.round(centerX - totalWidth / 2);
  for (const character of normalized) {
    const glyph = GLYPHS[character];
    if (!glyph) throw new Error(`Unsupported fixture glyph: ${character}`);
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] === "1") {
          fillRect(pixels, left + column * scale, top + row * scale, scale, scale, color);
        }
      }
    }
    left += glyphWidth + spacing;
  }
}

function makeUploadFixture() {
  const pixels = createCanvas([250, 252, 246]);
  fillCircle(pixels, 175, 165, 82, [47, 125, 123]);
  fillRect(pixels, 300, 95, 190, 140, [242, 184, 75]);
  fillCircle(pixels, 395, 165, 70, [250, 252, 246]);
  drawText(pixels, "WILD BLOOM", WIDTH / 2, 315, 7, [39, 49, 59]);
  return encodePng(pixels);
}

function makeIdentityFixture() {
  const pixels = createCanvas([255, 250, 244]);
  fillCircle(pixels, WIDTH / 2, 135, 82, [107, 143, 113]);
  drawText(pixels, "ALEX", WIDTH / 2, 112, 7, [255, 255, 255]);
  drawText(pixels, "BIRTHDAY CREW", WIDTH / 2, 285, 5, [39, 49, 59]);
  return encodePng(pixels);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const outputDir = parseOutputDir(process.argv.slice(2));
await mkdir(runsRoot, { recursive: true });
await mkdir(outputDir, { recursive: false });

const fixtures = [
  { name: "vision_upload_fixture.png", purpose: "non-identity upload path", bytes: makeUploadFixture() },
  { name: "vision_identity_fixture.png", purpose: "printed-name and birthday identity boundary", bytes: makeIdentityFixture() },
];

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  generator: path.basename(new URL(import.meta.url).pathname),
  renderer: "dependency-free RGB PNG with embedded 5x7 bitmap glyphs",
  dimensions: { width: WIDTH, height: HEIGHT },
  files: [],
};

for (const fixture of fixtures) {
  await writeFile(path.join(outputDir, fixture.name), fixture.bytes, { flag: "wx" });
  manifest.files.push({
    name: fixture.name,
    purpose: fixture.purpose,
    byteLength: fixture.bytes.length,
    sha256: sha256(fixture.bytes),
  });
}

await writeFile(
  path.join(outputDir, "fixture_manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" },
);
console.log(JSON.stringify({ outputDir, ...manifest }, null, 2));
