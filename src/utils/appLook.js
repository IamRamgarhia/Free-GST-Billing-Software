// v1.10.86 - Settings -> Appearance: App colour, Text size and Compact lists,
// for the app's screens only. Each is remembered in this browser like dark
// mode and mirrored to the data folder (prefsMirror.js); applyAppLook() puts
// them on the page before the first render (main.jsx).
//
// App colour: the app's own accent (buttons, the open menu item, links, focus
// rings, progress bars). Printed invoices and PDFs keep their own accent (Print
// & PDF settings); index.css puts the default back inside the invoice sheet.
// The default blue puts nothing on the page: the CSS as it always was.
// A choice is stored even when it is the default, so a browser that picked
// the default is not given another's choice back from the data folder.
// Any colour is shifted lighter or darker until white text on it stays
// readable: 4.5:1 in light mode; in dark mode between 3.6:1 against white and
// 4.3:1 against the dark page, which is where the default blue sits.

export const APP_COLOUR_KEY = 'freegstbill_appColour';
export const DEFAULT_COLOUR = '#2563eb';
export const APP_COLOURS = [
  { name: 'Blue', hex: DEFAULT_COLOUR },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Green', hex: '#15803d' },
  { name: 'Orange', hex: '#c2410c' },
  { name: 'Rose', hex: '#be123c' },
  { name: 'Slate', hex: '#475569' },
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s) => HEX.test(String(s || ''));

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2; const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function fromHsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r, g, b].map((v) => (v + m) * 255));
}
// Same hue and saturation, lightness moved by `dl` (kept within 0..1).
const withLight = (hex, dl) => { const [h, s, l] = toHsl(hex); return fromHsl(h, s, Math.min(1, Math.max(0, l + dl))); };
// Step the lightness until ok(colour) holds (at most 100 small steps).
const shiftUntil = (hex, step, ok) => { let c = hex; for (let i = 0; i < 100 && !ok(c); i++) c = withLight(c, step); return c; };
// Mixed with white (t > 0) or black (t < 0): calmer tints than more lightness.
const mix = (hex, t) => toHex(toRgb(hex).map((v) => (t > 0 ? v + (255 - v) * t : v * (1 + t))));
const tintUntil = (hex, lum) => { let t = 0; while (t < 1 && luminance(mix(hex, t)) < lum) t += 0.05; return mix(hex, Math.min(t, 1)); };

const WHITE = '#ffffff';
const DARK_PAGE = '#0f172a';

// The CSS variables for one colour, for light and for dark mode.
export function palette(hex) {
  const base = isHex(hex) ? hex.toLowerCase() : DEFAULT_COLOUR;
  const light = shiftUntil(base, -0.01, (c) => contrast(c, WHITE) >= 4.5);
  let dark = shiftUntil(base, 0.01, (c) => contrast(c, DARK_PAGE) >= 4.3);
  dark = shiftUntil(dark, -0.01, (c) => contrast(c, WHITE) >= 3.6);
  const vars = (p, mode) => ({
    '--primary': p,
    '--primary-hover': withLight(p, mode === 'dark' ? -0.08 : -0.07),
    '--primary-rgb': toRgb(p).join(', '),
    '--primary-light': `rgba(${toRgb(p).join(', ')}, ${mode === 'dark' ? 0.12 : 0.08})`,
    '--primary-darker': mix(p, -0.4),
    '--primary-soft': tintUntil(p, 0.35),
    '--primary-pale': tintUntil(p, 0.55),
  });
  return { light: vars(light, 'light'), dark: vars(dark, 'dark') };
}

const css = (sel, vars) => `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;

export function getAppColour() {
  try { const v = localStorage.getItem(APP_COLOUR_KEY); return isHex(v) ? v.toLowerCase() : DEFAULT_COLOUR; } catch { return DEFAULT_COLOUR; }
}

// Puts the colour on the page (one <style> tag); the default removes it.
export function applyAppColour(hex = getAppColour()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let tag = document.getElementById('fgsb-app-colour');
  if (!isHex(hex) || hex.toLowerCase() === DEFAULT_COLOUR) {
    root.removeAttribute('data-accent');
    tag?.remove();
    return;
  }
  const p = palette(hex);
  if (!tag) { tag = document.createElement('style'); tag.id = 'fgsb-app-colour'; document.head.appendChild(tag); }
  tag.textContent = css('html[data-accent]', p.light) + css('html[data-accent][data-theme="dark"]', p.dark);
  root.setAttribute('data-accent', '');
}

export function setAppColour(hex) {
  const v = isHex(hex) ? hex.toLowerCase() : DEFAULT_COLOUR;
  try {
    localStorage.setItem(APP_COLOUR_KEY, v);
  } catch { /* storage blocked: the colour holds until the page is reloaded */ }
  applyAppColour(v);
  return v;
}

// Text size: the whole app is zoomed (CSS zoom on #root), so the sidebar,
// tables, forms, icons and modals grow together and nothing reflows. The
// invoice sheet is zoomed back (index.css), so the preview, the PDF and the
// print keep their own size and Print & PDF's font scale stays the only one.
export const TEXT_SIZE_KEY = 'freegstbill_textSize';
export const TEXT_SIZES = [
  { id: 'sm', name: 'Smaller', zoom: 0.9 },
  { id: 'md', name: 'Normal', zoom: 1 },
  { id: 'lg', name: 'Larger', zoom: 1.1 },
  { id: 'xl', name: 'Largest', zoom: 1.2 },
];
export const textZoom = (id) => (TEXT_SIZES.find((t) => t.id === id) || TEXT_SIZES[1]).zoom;

// Compact lists: less padding in the app's lists and cards (index.css,
// html[data-compact]); invoices keep Print & PDF's own row density.
export const COMPACT_KEY = 'freegstbill_compactLists';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export const getTextSize = () => (TEXT_SIZES.some((t) => t.id === read(TEXT_SIZE_KEY)) ? read(TEXT_SIZE_KEY) : 'md');
export const getCompact = () => read(COMPACT_KEY) === '1';

export function applyTextSize(id = getTextSize()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const z = textZoom(id);
  if (z === 1) { root.removeAttribute('data-text-size'); root.style.removeProperty('--ui-zoom'); return; }
  root.setAttribute('data-text-size', id);
  root.style.setProperty('--ui-zoom', String(z));
}
export function setTextSize(id) {
  const v = TEXT_SIZES.some((t) => t.id === id) ? id : 'md';
  write(TEXT_SIZE_KEY, v);
  applyTextSize(v);
  return v;
}
export function applyCompact(on = getCompact()) {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.setAttribute('data-compact', '');
  else document.documentElement.removeAttribute('data-compact');
}
export function setCompact(on) {
  write(COMPACT_KEY, on ? '1' : '0');
  applyCompact(!!on);
  return !!on;
}

export function applyAppLook() {
  applyAppColour();
  applyTextSize();
  applyCompact();
}
