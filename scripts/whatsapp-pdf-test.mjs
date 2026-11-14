// v1.10.86 - WhatsApp with the PDF: on the PC the server copies the PDF file
// to the clipboard (src/utils/pdfClipboard.js, POST /api/control-panel/copy-pdf)
// and the page opens the chat (src/utils/share.js sendPdfOnWhatsApp).
//
// Run: `node scripts/whatsapp-pdf-test.mjs`

import fs from 'fs';
import os from 'os';
import path from 'path';
import { sanitizePdfName, isPdfBytes, cleanShareTmp, clipboardCommand, PDF_CLIP_MAX } from '../src/utils/pdfClipboard.js';
import { isPcOnly } from '../src/utils/phoneAccess.js';
import { sendPdfOnWhatsApp } from '../src/utils/share.js';

let passed = 0, failed = 0;
function ok(cond, label, got) {
  if (cond) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n${got}`); }
}

// --- file names
const n = (x) => sanitizePdfName(x);
ok(n('Invoice INV/2026-27/0012.pdf') === 'Invoice INV-2026-27-0012.pdf', 'slashes become dashes, .pdf kept', n('Invoice INV/2026-27/0012.pdf'));
ok(n('INV-1') === 'INV-1.pdf', '.pdf added', n('INV-1'));
ok(n('..\\..\\Windows\\evil.exe') === 'Windows-evil.exe.pdf', 'no folder part, always .pdf', n('..\\..\\Windows\\evil.exe'));
ok(n('a<b>c|d"e*f?.PDF') === 'abcdef.pdf', 'other characters dropped', n('a<b>c|d"e*f?.PDF'));
ok(n('') === 'Invoice.pdf' && n(undefined) === 'Invoice.pdf' && n('../..') === 'Invoice.pdf', 'empty or dots only: default name', n('../..'));
ok(n('CON') === 'File CON.pdf', 'Windows reserved names are not used', n('CON'));
ok(n('x'.repeat(300)).length <= 104, 'long names cut', n('x'.repeat(300)).length);
ok(/^[A-Za-z0-9 _.-]+\.pdf$/.test(n('Bill \u20B9 \u0928\u092E\u0938\u094D\u0924\u0947 #5')), 'only letters, digits, space - _ .', n('Bill \u20B9 \u0928\u092E\u0938\u094D\u0924\u0947 #5'));

// --- %PDF- check and size cap
ok(isPdfBytes(Buffer.from('%PDF-1.7\n...')), 'a PDF is a PDF');
ok(!isPdfBytes(Buffer.from('MZ\x90\x00 not a pdf')) && !isPdfBytes(Buffer.from('%PDF')) && !isPdfBytes({}) && !isPdfBytes(null), 'anything else is refused');
ok(PDF_CLIP_MAX === 25 * 1024 * 1024, 'size cap 25 MB', PDF_CLIP_MAX);

// --- old files cleaned
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fgsb-share-test-'));
const oldF = path.join(dir, 'old.pdf'), newF = path.join(dir, 'new.pdf');
fs.writeFileSync(oldF, '%PDF-old'); fs.writeFileSync(newF, '%PDF-new');
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
fs.utimesSync(oldF, twoDaysAgo, twoDaysAgo);
ok(cleanShareTmp(dir) === 1 && !fs.existsSync(oldF) && fs.existsSync(newF), 'files older than a day removed, new ones kept');
ok(cleanShareTmp(path.join(dir, 'missing')) === 0, 'a missing folder is fine');
fs.rmSync(dir, { recursive: true, force: true });

// --- clipboard commands: the path only in the environment
const file = 'C:\\Temp\\a b\'; Remove-Item x.pdf';
const win = clipboardCommand('win32', file);
ok(win.cmd === 'powershell.exe' && win.args.join(' ').includes('Set-Clipboard -LiteralPath $env:FGSB_CLIP_FILE') && !win.args.join(' ').includes(file) && win.env.FGSB_CLIP_FILE === file, 'Windows: Set-Clipboard, path via env', JSON.stringify(win));
const mac = clipboardCommand('darwin', '/tmp/a.pdf');
ok(mac.cmd === 'osascript' && mac.args[1].includes('system attribute "FGSB_CLIP_FILE"') && !mac.args[1].includes('/tmp/a.pdf'), 'Mac: osascript, path via env', JSON.stringify(mac));
const lin = clipboardCommand('linux', '/tmp/a b.pdf');
ok(lin.cmd === 'xclip' && lin.args.includes('text/uri-list') && /^file:\/\/\/.*tmp\/a%20b\.pdf\r\n$/.test(lin.input), 'Linux: xclip with a file URI', JSON.stringify(lin));

// --- a paired phone may not use it
ok(isPcOnly({ path: '/api/control-panel/copy-pdf', method: 'POST' }), 'copy-pdf is PC-only');
ok(isPcOnly({ path: '/API/Control-Panel/Copy-PDF/', method: 'POST' }), 'copy-pdf is PC-only in any case / trailing slash');

// --- the page side (browser globals stubbed)
const toasts = [];
const toast = (m, t, d, a) => toasts.push({ m, t, d, a });
const blob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
const opened = [];
const fakeTab = { location: { href: '' }, document: { title: '', body: {} }, close() { this.closed = true; } };
let fetchOk = true, fetched = null, downloads = 0;
const setGlobal = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
setGlobal('window', { open: (u, t, f) => { opened.push(u); return u === '' ? fakeTab : null; } });
setGlobal('location', { protocol: 'http:' });
setGlobal('navigator', { platform: 'Win32' });
setGlobal('fetch', async (url, opts) => { fetched = { url, opts }; return { ok: true, json: async () => ({ ok: fetchOk }) }; });
setGlobal('document', { createElement: () => ({ click: () => { downloads++; }, remove() {} }), body: { appendChild() {} } });
URL.createObjectURL = () => 'blob:x'; URL.revokeObjectURL = () => {};

const prepare = async () => ({ blob, fileName: 'Invoice INV-1.pdf', message: 'Hi' });
let r = await sendPdfOnWhatsApp({ phone: '+91 98765 43210', prepare, toast });
ok(r === 'copied' && fetched.url === '/api/control-panel/copy-pdf?name=Invoice%20INV-1.pdf' && fetched.opts.body === blob, 'PC: the PDF is sent to be copied', JSON.stringify(fetched));
ok(opened[0] === '' && fakeTab.location.href === 'https://api.whatsapp.com/send?phone=919876543210&text=Hi', 'PC: the tab opened at the click goes to the chat', fakeTab.location.href);
ok(/PDF copied\. In the WhatsApp chat press Ctrl\+V, then Send\./.test(toasts.at(-1).m) && toasts.at(-1).d >= 8000 && downloads === 0, 'PC: Ctrl+V notice, long enough, no download', JSON.stringify(toasts.at(-1)));

fetchOk = false;
r = await sendPdfOnWhatsApp({ phone: '', prepare, toast });
ok(r === 'downloaded' && downloads === 1 && /PDF downloaded/.test(toasts.at(-1).m), 'copy failed: the PDF is downloaded instead', JSON.stringify(toasts.at(-1)));

fakeTab.closed = false;
r = await sendPdfOnWhatsApp({ phone: '', prepare: async () => null, toast });
ok(r === 'failed' && fakeTab.closed, 'prepare stopped (save failed): the tab is closed', r);

// Phone: the Share sheet with the file.
setGlobal('location', { protocol: 'https:' });
let shared = null;
setGlobal('navigator', { platform: 'Linux armv8l', canShare: () => true, share: async (d) => { shared = d; } });
r = await sendPdfOnWhatsApp({ phone: '', prepare, toast });
ok(r === 'shared' && shared.files[0].name === 'Invoice INV-1.pdf' && shared.text === 'Hi', 'phone: the Share sheet gets the PDF', JSON.stringify(shared));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
