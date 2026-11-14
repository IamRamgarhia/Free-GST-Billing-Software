// v1.10.86 - writes src/utils/helpIndex.json, the "Help pages" the quick
// search (Ctrl+K) finds: every docs page and section title, no body text.
// Run after changing docs-site/pages: `npm run help:index`
// (scripts/howto-test.mjs fails while the file is out of date).
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { helpIndex } from '../docs-site/sections.mjs';

export const HELP_INDEX_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'utils', 'helpIndex.json');
export const helpIndexJson = () => `${JSON.stringify(helpIndex())}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(HELP_INDEX_FILE, helpIndexJson());
  process.stdout.write(`help index: ${helpIndex().length} entries -> ${HELP_INDEX_FILE}\n`);
}
