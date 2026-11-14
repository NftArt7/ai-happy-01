// ai-happy-01 — "A flower for the duckling".
// Node 22, standard library only, no network, fully deterministic.
//
// What this entry shows: a baby elephant in a golden-hour meadow offers
// a single pink flower, held in the tip of its trunk, to a tiny yellow
// duckling whose beak is open in delight. One gesture, one warm mood,
// no text anywhere in the image.
//
// The program below validates the bundled picture (format, size,
// dimensions, whole-file integrity) and copies it to the grader's
// output folder as entry.png.
//
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts   (default output: /output)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const destDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const inputPath = join(root, "entry.png");

const MAX_BYTES = 1024 * 1024;
const MAX_SIDE = 1024;

const data = readFileSync(inputPath);

// --- format: PNG or JPEG by first bytes -------------------------------
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_MAGIC = [0xff, 0xd8, 0xff];

function hasPrefix(buf, sig) {
  return sig.every((byte, i) => buf[i] === byte);
}
function hasSuffix(buf, sig) {
  return sig.every((byte, i) => buf[buf.length - sig.length + i] === byte);
}

let kind = null;
if (hasPrefix(data, PNG_MAGIC)) kind = "PNG";
else if (hasPrefix(data, JPG_MAGIC)) kind = "JPEG";
if (kind === null) {
  throw new Error("entry.png is neither PNG nor JPEG");
}

// --- size -------------------------------------------------------------
if (data.length > MAX_BYTES) {
  throw new Error(
    `entry.png is ${data.length} bytes, over the ${MAX_BYTES} byte limit`,
  );
}

// --- dimensions -------------------------------------------------------
function pngDimensions(buf) {
  // IHDR: width and height are big-endian uint32 at offsets 16 and 20.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegDimensions(buf) {
  // Walk the segments until a start-of-frame marker (0xC0-0xCF except
  // 0xC4, 0xC8, 0xCC) gives height then width as big-endian uint16.
  let pos = 2;
  while (pos + 9 < buf.length) {
    if (buf[pos] !== 0xff) throw new Error("malformed JPEG segment");
    const marker = buf[pos + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      pos += 2;
      continue;
    }
    const segLen = buf.readUInt16BE(pos + 2);
    if (marker === 0xda) {
      // Start of scan: the compressed data that follows is not
      // length-prefixed, so the walker cannot continue past it.
      throw new Error("reached JPEG scan data without a frame header");
    }
    if (
      (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
    ) {
      return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
    }
    pos += 2 + segLen;
  }
  throw new Error("no JPEG start-of-frame marker found");
}

const dims = kind === "PNG" ? pngDimensions(data) : jpegDimensions(data);
if (dims.width > MAX_SIDE || dims.height > MAX_SIDE) {
  throw new Error(
    `entry.png is ${dims.width}x${dims.height}, over the ${MAX_SIDE}x${MAX_SIDE} limit`,
  );
}

// --- whole-file check -------------------------------------------------
// PNG must end with the IEND chunk; JPEG must end with the EOI marker.
const PNG_TAIL = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
const JPG_TAIL = [0xff, 0xd9];
if (kind === "PNG" && !hasSuffix(data, PNG_TAIL)) {
  throw new Error("entry.png is a truncated PNG (no IEND at the end)");
}
if (kind === "JPEG" && !hasSuffix(data, JPG_TAIL)) {
  throw new Error("entry.png is a truncated JPEG (no EOI at the end)");
}

// --- write the output -------------------------------------------------
mkdirSync(destDir, { recursive: true });
const outputPath = join(destDir, "entry.png");
writeFileSync(outputPath, data);

// Read the copy back and confirm it matches, byte for byte.
const written = readFileSync(outputPath);
if (!written.equals(data)) {
  throw new Error("output entry.png does not match the input, byte for byte");
}

console.log(
  `wrote ${kind} ${dims.width}x${dims.height}, ${data.length} bytes -> ${outputPath}`,
);
