// v1.10.86 - the "What's new" slides after an update and the App colour.
// Run: `node scripts/whats-new-test.mjs`

import { parseChangelog, whatsNewSlides, isNewerVersion, shouldShowWhatsNew, releaseNoteTitles } from '../src/utils/changelog.js';
import { palette, contrast, APP_COLOURS, DEFAULT_COLOUR } from '../src/utils/appLook.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

const md = [
  '## [Unreleased] - planned', '### Added', '- **Not out yet**: hidden', '',
  '## [2.0.0] - 2026-11-21', '**Summary.**', '',
  '### Changed', '- **Changed one**: x', '',
  '### Fixed', '- **Fixed one**: x', '- **Fixed two**: x', '',
  '### Added', '- **Added one**: x', '- **Added two**: x', '- **Added three**: x', '- **Added four**: x', '- **Added five**: x', '',
  '### Security', '- **Safe one**: x', '',
  '### Thanks', '- **Someone kind**', '',
  '### How to update', '- **Click Update**',
].join('\n');
const [entry] = parseChangelog(md, 1);
const { slides, more } = whatsNewSlides(entry);
eq(entry.version, '2.0.0', 'The unreleased entry is not shown');
eq(slides.map((s) => s.title), ['Added', 'Fixed', 'Changed'], 'Added first, then Fixed, then the rest; at most 3 slides');
eq(slides[0].items, ['Added one', 'Added two', 'Added three', 'Added four'], 'At most 4 titles a slide');
eq(more, 2, 'The fifth Added and the Security title are left for the full notes');
eq(whatsNewSlides({ sections: [] }), { slides: [], more: 0 }, 'No sections: no slides');

eq([isNewerVersion('1.10.86', '1.10.85'), isNewerVersion('1.10.10', '1.10.9'), isNewerVersion('1.11.0', '1.10.99')], [true, true, true], 'Versions compare as numbers');
eq([isNewerVersion('1.10.85', '1.10.85'), isNewerVersion('1.10.84', '1.10.85')], [false, false], 'Same or older is not newer');
eq(shouldShowWhatsNew(null, '1.10.86', false), false, 'A new install (nothing stored, setup not done) gets no slides');
eq(shouldShowWhatsNew(null, '1.10.86', true), true, 'Someone who used the app before this feature sees them once');
eq(shouldShowWhatsNew('1.10.85', '1.10.86', true), true, 'After an update: shown');
eq(shouldShowWhatsNew('1.10.86', '1.10.86', true), false, 'Seen already: not again');
eq(shouldShowWhatsNew('1.10.85', 'unknown', true), false, 'Unknown version: never');

// App colour: white text stays readable on every preset, in both themes,
// and on colours a person might type.
const odd = ['#facc15', '#a3e635', '#22d3ee', '#ffffff', '#000000', '#f472b6', '#808080', '#1e3a8a'];
for (const hex of [...APP_COLOURS.map((c) => c.hex), ...odd]) {
  const p = palette(hex);
  const l = p.light['--primary']; const d = p.dark['--primary'];
  eq(contrast(l, '#ffffff') >= 4.5, true, `${hex} light: white text ${contrast(l, '#ffffff').toFixed(2)}:1 on ${l}`);
  eq(contrast(d, '#ffffff') >= 3.6 && contrast(d, '#0f172a') >= 4.2, true, `${hex} dark: ${d} white ${contrast(d, '#ffffff').toFixed(2)}, page ${contrast(d, '#0f172a').toFixed(2)}`);
}
eq(palette(DEFAULT_COLOUR).light['--primary'], DEFAULT_COLOUR, 'The default blue is kept as it is in light mode');
eq(palette('nonsense').light['--primary'], DEFAULT_COLOUR, 'A bad value falls back to the default');

// v1.10.87 - the Update window: the release page's What's new bullets as plain text.
const notes = "## What's new in 1.10.86\n\n- **A tidier app:** one line\n- **Receipts:** `RCP/26-27/0001` [link](https://x)\n\n## Which file do I need?\n\n- not this";
eq(releaseNoteTitles(notes), ['A tidier app: one line', 'Receipts: RCP/26-27/0001 link'], "Update window: the What's new bullets as plain text, nothing after the next heading");
eq(releaseNoteTitles('- ' + 'word '.repeat(40))[0].length <= 121, true, 'A long bullet is cut at about 120 characters');
eq(releaseNoteTitles('Just a sentence.'), [], 'No list: nothing (the window then shows the text as it is)');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
