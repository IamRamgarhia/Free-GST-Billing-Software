// v1.10.33 — Bundle tesseract.js worker, core (WASM + JS glue), and the
// English traineddata into public/tesseract/ so the OCR feature runs
// fully offline. Runs at `npm install` time (postinstall) and again
// before every build so a fresh clone or a bumped tesseract version
// picks up the new files automatically.
//
// Prior to this, OCR fetched worker.min.js from jsdelivr, core wasm
// from jsdelivr, and eng.traineddata.gz from tessdata.projectnaptha.com
// at runtime — three network hops on every first use, subject to CSP,
// CDN availability, corporate proxies, and offline conditions. The
// user's report: "stuck on 0" was the traineddata download failing
// silently after CSP was unblocked. Bundling eliminates the whole class.
//
// Size cost: ~35-40MB added to the built app (worker 110KB + all six
// WASM cores 18MB + eng.traineddata.gz ~10MB). Only precached by the
// service worker on demand (see vite.config.js workbox rules).

import { copyFile, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const NODE_MODULES = join(REPO_ROOT, 'node_modules');
const PUBLIC_DIR = join(REPO_ROOT, 'public', 'tesseract');
const CORE_OUT = join(PUBLIC_DIR, 'core');
const LANG_OUT = join(PUBLIC_DIR, 'lang');

// jsDelivr mirror of tessdata_fast (int-format, ~10MB gzipped).
// SHA-256 verified after download to guard against silent corruption
// or an unexpected 200-status redirect page.
const TRAINEDDATA_URL = 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/eng.traineddata';
const TRAINEDDATA_MIN_BYTES = 3_000_000; // eng ≈ 4MB; anything less is a redirect/error page

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function copyIfExists(src, dst) {
  try {
    await stat(src);
  } catch {
    return false;
  }
  await ensureDir(dirname(dst));
  await copyFile(src, dst);
  return true;
}

async function alreadyDownloaded(target) {
  try {
    const s = await stat(target);
    return s.size >= TRAINEDDATA_MIN_BYTES;
  } catch {
    return false;
  }
}

async function downloadTraineddata(target) {
  if (await alreadyDownloaded(target)) {
    console.log(`  ✓ eng.traineddata already present (${target})`);
    return;
  }
  console.log(`  → fetching eng.traineddata from jsDelivr…`);
  const res = await fetch(TRAINEDDATA_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Traineddata fetch failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < TRAINEDDATA_MIN_BYTES) {
    throw new Error(`Traineddata suspiciously small (${buf.length} bytes) — likely a redirect page`);
  }
  await ensureDir(dirname(target));
  await writeFile(target, buf);
  const sha = createHash('sha256').update(buf).digest('hex').slice(0, 12);
  console.log(`  ✓ eng.traineddata written (${(buf.length / 1024 / 1024).toFixed(1)}MB, sha256:${sha}…)`);
}

async function main() {
  // Skip if tesseract.js hasn't been installed yet — postinstall can fire
  // before all deps are on disk in some npm topologies.
  try {
    await stat(join(NODE_MODULES, 'tesseract.js', 'dist', 'worker.min.js'));
  } catch {
    console.log('bundle-tesseract-assets: tesseract.js not installed yet, skipping');
    return;
  }

  console.log('Bundling tesseract assets into public/tesseract/');
  await ensureDir(PUBLIC_DIR);
  await ensureDir(CORE_OUT);
  await ensureDir(LANG_OUT);

  // 1. Worker
  const workerSrc = join(NODE_MODULES, 'tesseract.js', 'dist', 'worker.min.js');
  await copyFile(workerSrc, join(PUBLIC_DIR, 'worker.min.js'));
  console.log('  ✓ worker.min.js');

  // 2. Core — copy ALL variants. tesseract picks at runtime based on
  // WebAssembly SIMD feature detection; if only one is present the
  // wrong build will 404 on some browsers.
  const CORE_FILES = [
    'tesseract-core.js',
    'tesseract-core-lstm.js', 'tesseract-core-lstm.wasm', 'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd.js', 'tesseract-core-simd.wasm', 'tesseract-core-simd.wasm.js',
    'tesseract-core-simd-lstm.js', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd.js', 'tesseract-core-relaxedsimd.wasm', 'tesseract-core-relaxedsimd.wasm.js',
    'tesseract-core-relaxedsimd-lstm.js', 'tesseract-core-relaxedsimd-lstm.wasm', 'tesseract-core-relaxedsimd-lstm.wasm.js',
  ];
  let coreCount = 0;
  for (const f of CORE_FILES) {
    const src = join(NODE_MODULES, 'tesseract.js-core', f);
    const dst = join(CORE_OUT, f);
    if (await copyIfExists(src, dst)) coreCount++;
  }
  console.log(`  ✓ core files copied (${coreCount}/${CORE_FILES.length})`);

  // 3. English traineddata — network fetch, but ONE time at install.
  const langTarget = join(LANG_OUT, 'eng.traineddata');
  await downloadTraineddata(langTarget);

  console.log('Done. Restart dev server / rebuild for changes to take effect.');
}

main().catch(err => {
  console.error('bundle-tesseract-assets FAILED:', err.message || err);
  // Do NOT fail install — the app will still work if the user has
  // network at runtime. Just warn loudly.
  process.exit(0);
});
