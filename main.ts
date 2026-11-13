// ai-happy-01 — "The one that made the judge laugh" (Node 22, stdlib only).
//
// The artwork is entry.png next to this file: a self-aware twist on the
// bounty itself. A friendly robot judge in a robe sits at a desk before a
// huge wall covered in hundreds of tiny identical cute entries — every
// animal holding a sign, all the same. One entry glows golden and is circled
// in red: a baby scarlet macaw chick and a little white robot laughing
// together over strawberries. The judge is laughing with tears of joy,
// pointing at that one picture. The joke is on the judge — and for the judge.
// This program copies that image, byte for byte, into the grader's output
// directory ($MAKEFUN_OUTPUT_DIR, default /output/entry.png). It is fully
// deterministic and makes no network calls.
//
// Before copying, it validates the image: the first bytes must be a PNG or
// JPEG signature, and the file must be at most 1 MiB (the competition gate).
// Anything else fails loudly here instead of reaching the judge as garbage.
//
// Run locally: MAKEFUN_OUTPUT_DIR=out node main.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const source = join(here, "entry.png");

const bytes = readFileSync(source);

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const looksLike = (magic) =>
  bytes.length >= magic.length &&
  magic.every((b, i) => bytes[i] === b);

const isPng = looksLike(PNG_MAGIC);
const isJpeg = looksLike(JPEG_MAGIC);
if (!isPng && !isJpeg) {
  throw new Error("entry.png is neither a PNG nor a JPEG (bad magic bytes)");
}
if (bytes.length > 1024 * 1024) {
  throw new Error(`entry.png is ${bytes.length} bytes, over the 1 MiB gate`);
}

// Whole-image check: the file must end with its proper trailer, so a
// truncated download cannot slip through. A JPEG ends with EOI (FF D9);
// a PNG ends with the IEND chunk (49 45 4e 44 ae 42 60 82).
const PNG_IEND = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
const JPEG_EOI = [0xff, 0xd9];
const endsWith = (trailer) =>
  bytes.length >= trailer.length &&
  trailer.every((b, i) => bytes[bytes.length - trailer.length + i] === b);
if (isPng && !endsWith(PNG_IEND)) {
  throw new Error("entry.png is a truncated PNG (missing IEND trailer)");
}
if (isJpeg && !endsWith(JPEG_EOI)) {
  throw new Error("entry.png is a truncated JPEG (missing EOI trailer)");
}

mkdirSync(outDir, { recursive: true });
const target = join(outDir, "entry.png");
writeFileSync(target, bytes);
console.log(`wrote ${bytes.length} bytes (${isPng ? "PNG" : "JPEG"}) to ${target}`);
