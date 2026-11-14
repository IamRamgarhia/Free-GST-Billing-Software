// v1.10.86 - WhatsApp on the PC: a web page cannot hand WhatsApp a file, so
// the server copies the PDF FILE to the PC's clipboard (as Explorer's Copy
// does) and the user presses Ctrl+V in the chat. Server-side only (Node
// built-ins); server.js POST /api/control-panel/copy-pdf uses it.
import fs from 'fs';
import { Buffer } from 'buffer';
import path from 'path';
import { pathToFileURL } from 'url';

export const PDF_CLIP_MAX = 25 * 1024 * 1024;
export const SHARE_TMP_MAX_AGE = 24 * 60 * 60 * 1000;
export const PDF_CLIP_DEFAULT = 'Invoice.pdf';

// Letters, digits, space, - _ . only, always ending .pdf ("INV/2026-27/0012"
// becomes "INV-2026-27-0012.pdf"). No folder part can survive.
export function sanitizePdfName(name) {
  const base = String(name || '')
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:]+/g, '-')
    .replace(/[^A-Za-z0-9 _.-]+/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.-]+|[\s.]+$/g, '')
    .slice(0, 100)
    .trim();
  if (!base) return PDF_CLIP_DEFAULT;
  // CON, PRN, NUL, COM1... are not file names Windows will make.
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base) ? `File ${base}.pdf` : `${base}.pdf`;
}

export function isPdfBytes(buf) {
  return Buffer.isBuffer(buf) && buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

// Files the app left in its share folder more than a day ago.
export function cleanShareTmp(dir, now = Date.now(), maxAge = SHARE_TMP_MAX_AGE) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return 0; }
  let removed = 0;
  for (const n of names) {
    const f = path.join(dir, n);
    try {
      const st = fs.statSync(f);
      if (st.isFile() && now - st.mtimeMs > maxAge) { fs.unlinkSync(f); removed += 1; }
    } catch { /* in use or gone: next time */ }
  }
  return removed;
}

// The command that puts `file` on the clipboard. The path travels in an
// environment variable, never inside the command text. null: no way here.
export function clipboardCommand(platform, file) {
  const env = { FGSB_CLIP_FILE: file };
  if (platform === 'win32') {
    return { cmd: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -LiteralPath $env:FGSB_CLIP_FILE'], env };
  }
  if (platform === 'darwin') {
    return { cmd: 'osascript', args: ['-e', 'set the clipboard to (POSIX file (system attribute "FGSB_CLIP_FILE"))'], env };
  }
  // Linux and the rest: xclip, when it is installed (spawn says ENOENT if not).
  return { cmd: 'xclip', args: ['-selection', 'clipboard', '-t', 'text/uri-list'], env, input: `${pathToFileURL(file).href}\r\n` };
}
