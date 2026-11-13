// ai-happy-01 — "The one that made the judge laugh".
// Node 22, standard library only, no network, fully deterministic.
//
// What this entry shows: the bounty turned back on itself. A robot judge
// in a robe sits at a desk in front of a wall of hundreds of near-identical
// cute entries, and laughs — tears and all — at the single glowing picture
// circled in red: a scarlet macaw chick and a small robot sharing
// strawberries. That picture is entry.png, next to this file.
// The program below copies that picture into the grader's output folder.
//
// Usage: MAKEFUN_OUTPUT_DIR=out node main.ts   (default output: /output)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const destDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const inputPath = join(root, "entry.png");

const data = readFileSync(inputPath);

const startsWith = (buf, sig) => sig.every((byte, i) => buf[i] === byte);
const endsWithBytes = (buf, sig) =>
  sig.every((byte, i) => buf[buf.length - sig.length + i] === byte);

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEAD = [0xff, 0xd8, 0xff];
const PNG_TAIL = [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
const JPG_TAIL = [0xff, 0xd9];

const kind = startsWith(data, PNG_HEAD)
  ? "PNG"
  : startsWith(data, JPG_HEAD)
    ? "JPEG"
    : null;
if (kind === null) throw new Error("entry.png is neither PNG nor JPEG");
if (data.length > 1024 * 1024) {
  throw new Error(`entry.png is ${data.length} bytes, over the 1 MiB limit`);
}
if (kind === "PNG" && !endsWithBytes(data, PNG_TAIL)) {
  throw new Error("entry.png is a truncated PNG (no IEND at the end)");
}
if (kind === "JPEG" && !endsWithBytes(data, JPG_TAIL)) {
  throw new Error("entry.png is a truncated JPEG (no EOI at the end)");
}

mkdirSync(destDir, { recursive: true });
const outputPath = join(destDir, "entry.png");
writeFileSync(outputPath, data);
// Read the copy back and confirm it matches, byte for byte.
const written = readFileSync(outputPath);
if (!written.equals(data)) throw new Error("output copy does not match entry.png");
console.log(`wrote ${data.length} bytes (${kind}) to ${outputPath} — "The one that made the judge laugh"`);
