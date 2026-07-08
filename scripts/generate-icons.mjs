// v1.10.7 — Regenerates the PNG icon set from `public/favicon.svg`.
//
// Why this exists: the PWA manifest declares 192/512/maskable/apple
// PNGs but the corresponding files were never shipped (see v1.10.2
// changelog "⚠ Action required"). Without them:
//   • Android "Add to Home Screen" falls back to the SVG (works,
//     but no adaptive-icon safe zone → the icon can get cropped).
//   • iOS silently ignores SVG apple-touch-icons and renders a
//     generated screenshot tile of the current page.
// This script eliminates the "queued follow-up" note.
//
// Run: `npm run icons`
//
// Uses `sharp` (native binary with prebuilt Windows/macOS/Linux
// tarballs — no build step). Output PNGs are ~1-4 KB each because
// the source SVG is line-art + solid fills.

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_SVG = path.join(ROOT, 'public', 'favicon.svg');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

if (!fs.existsSync(SRC_SVG)) {
  console.error(`FATAL: source SVG missing at ${SRC_SVG}`);
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const svgBuffer = fs.readFileSync(SRC_SVG);

// Maskable icons need a solid-color safe zone around the artwork
// because Android's adaptive-icon shape (circle, squircle, teardrop…)
// masks the outer 40%. So the "logo" is inset ~62% into a full-bleed
// background rectangle in the same colour as the SVG's outer chip.
async function renderPng(size, purpose) {
  if (purpose === 'maskable') {
    // Pre-render the SVG at 62% inside a solid #1e40af background.
    const inner = Math.round(size * 0.62);
    const innerPng = await sharp(svgBuffer).resize(inner, inner).png().toBuffer();
    const gap = Math.round((size - inner) / 2);
    return sharp({
      create: { width: size, height: size, channels: 4, background: '#1e40af' },
    })
      .composite([{ input: innerPng, top: gap, left: gap }])
      .png()
      .toBuffer();
  }
  return sharp(svgBuffer).resize(size, size).png().toBuffer();
}

const targets = [
  { name: 'icon-192.png',      size: 192, purpose: 'any' },
  { name: 'icon-512.png',      size: 512, purpose: 'any' },
  { name: 'maskable-192.png',  size: 192, purpose: 'maskable' },
  { name: 'maskable-512.png',  size: 512, purpose: 'maskable' },
  { name: 'apple-touch-180.png', size: 180, purpose: 'any' },
];

let total = 0;
for (const t of targets) {
  const buf = await renderPng(t.size, t.purpose);
  const outPath = path.join(OUT_DIR, t.name);
  fs.writeFileSync(outPath, buf);
  total += buf.length;
  console.log(`  ${t.name.padEnd(24)} ${String(t.size + '×' + t.size).padEnd(9)} ${(buf.length / 1024).toFixed(1)} KB  ${t.purpose}`);
}
console.log(`\nWrote ${targets.length} PNGs to ${path.relative(ROOT, OUT_DIR)}/ (${(total / 1024).toFixed(1)} KB total)`);
