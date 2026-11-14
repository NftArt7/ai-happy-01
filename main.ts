// ai-happy-01 entry (Node 22, standard library only): it validates the image
// bundled beside it and copies it to /output/entry.png. The image is an
// original illustration: an old man and a small robot sharing one umbrella
// in soft evening rain, both smiling at each other.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Gate rules enforced here before copying (the sealed scorer checks the
// same): PNG or JPEG by first bytes, at most 1 MiB, at most 1024x1024
// pixels, and a whole image (PNG chunks through IEND, JPEG through the
// end-of-image marker).

import { copyFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const SOURCE = join(dirname(fileURLToPath(import.meta.url)), 'entry.png');
const MAX_BYTES = 1048576;
const MAX_DIMENSION = 1024;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

function fail(message: string): never {
  throw new Error(`entry.png failed validation: ${message}`);
}

function pngDimensions(buf: Buffer): { width: number; height: number } {
  // IHDR is the first chunk: 8-byte signature, 4-byte length, 4-byte type,
  // then width and height as 4-byte big-endian integers.
  if (buf.length < 24 || buf.subarray(12, 16).toString('latin1') !== 'IHDR') {
    fail('PNG header is truncated or has no IHDR chunk');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function checkPngWhole(buf: Buffer): void {
  // Walk every chunk: 4-byte length, 4-byte type, data, 4-byte CRC. The
  // file must end exactly on the IEND chunk, so a truncated PNG is caught.
  let offset = 8;
  let sawIend = false;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('latin1');
    if (offset + 12 + length > buf.length) {
      fail(`PNG chunk ${type} runs past the end of the file`);
    }
    offset += 12 + length;
    if (type === 'IEND') {
      sawIend = true;
      break;
    }
  }
  if (!sawIend || offset !== buf.length) {
    fail('PNG does not end cleanly on its IEND chunk');
  }
}

function jpegDimensions(buf: Buffer): { width: number; height: number } {
  // Scan JPEG markers for a start-of-frame segment (SOF0/1/2), which
  // carries height then width as 2-byte big-endian integers. Fill bytes
  // (repeated 0xFF) between segments are skipped, as the format allows.
  let offset = 2;
  while (offset + 9 <= buf.length) {
    while (offset < buf.length && buf[offset] === 0xff && buf[offset + 1] === 0xff) {
      offset += 1; // skip one fill byte
    }
    if (offset + 9 > buf.length || buf[offset] !== 0xff) {
      fail('JPEG marker stream is malformed');
    }
    const marker = buf[offset + 1];
    if (marker === 0xd9) {
      break; // end of image before any frame: no dimensions found
    }
    if (marker === 0xda) {
      break; // start of scan: frame data follows, no SOF after this
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buf.length) {
      fail('JPEG segment runs past the end of the file');
    }
    offset += 2 + length;
  }
  fail('JPEG has no start-of-frame segment');
}

function checkJpegWhole(buf: Buffer): void {
  // A whole JPEG ends with the end-of-image marker 0xFFD9.
  if (buf.length < 2 || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) {
    fail('JPEG does not end with its end-of-image marker');
  }
}

const size = statSync(SOURCE).size;
if (size > MAX_BYTES) {
  fail(`file is ${size} bytes, over the 1048576 byte limit`);
}

const bytes = readFileSync(SOURCE);
const isPng = bytes.subarray(0, 8).equals(PNG_MAGIC);
const isJpeg = bytes.subarray(0, 3).equals(JPEG_MAGIC);
if (!isPng && !isJpeg) {
  fail('first bytes are neither PNG nor JPEG magic');
}

let dimensions: { width: number; height: number };
if (isPng) {
  dimensions = pngDimensions(bytes);
  checkPngWhole(bytes);
} else {
  dimensions = jpegDimensions(bytes);
  checkJpegWhole(bytes);
}
if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
  fail(`image is ${dimensions.width}x${dimensions.height}, over the 1024x1024 limit`);
}

copyFileSync(SOURCE, join(OUTPUT_DIR, 'entry.png'));
