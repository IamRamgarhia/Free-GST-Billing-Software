// Unit checks for what an installed package says on Update (src/utils/installKind.js),
// above all the Mac app: it must never run the ZIP updater (that would change
// files inside the signed .app), and must point at the new DMG instead.
// The app itself is built and started on a Mac by .github/workflows/mac-app.yml.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAC_DMG_NAME, MAC_DMG_URL, updateDownloadUrlFor, updateHintFor, updateStepFromLine } from '../src/utils/installKind.js';

// The ZIP (no install-kind.txt) keeps its updater: no hint, no download link.
assert.equal(updateHintFor('', '1.10.86'), null);
assert.equal(updateDownloadUrlFor(''), null);
assert.equal(updateHintFor('something-else'), null);

// The Mac app: a new DMG from the latest release, books kept.
const mac = updateHintFor('macapp', '1.10.86');
assert.match(mac, /Download the new Mac app/);
assert.match(mac, /drag Free GST Billing to Applications \(replace\)/);
assert.match(mac, /Application Support/);
assert.ok(mac.includes(MAC_DMG_NAME));
assert.equal(MAC_DMG_NAME, 'Free-GST-Billing-Mac.dmg', 'the name the workflow uploads');
assert.equal(updateDownloadUrlFor('macapp'), 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing-Mac.dmg');
assert.equal(MAC_DMG_URL, updateDownloadUrlFor('macapp'));

// The Linux packages and Docker keep their words; only one link for the Mac.
assert.match(updateHintFor('deb', '1.10.86'), /free-gst-billing_1\.10\.86_amd64\.deb/);
assert.match(updateHintFor('deb'), /free-gst-billing_<version>_amd64\.deb/);
assert.match(updateHintFor('appimage'), /AppImage/);
assert.match(updateHintFor('docker'), /docker compose up -d/);
for (const k of ['deb', 'appimage', 'docker']) assert.equal(updateDownloadUrlFor(k), null);

// The build marks the app as "macapp", and the workflow uploads that DMG name.
const build = readFileSync(new URL('./build-mac-app.sh', import.meta.url), 'utf8');
assert.match(build, /echo macapp > "\$APP_RES\/app\/install-kind\.txt"/);
assert.ok(build.includes(MAC_DMG_NAME));
assert.ok(readFileSync(new URL('../.github/workflows/mac-app.yml', import.meta.url), 'utf8').includes(MAC_DMG_NAME));

// v1.10.86 - the ZIP updaters' lines become the progress window's steps. Read
// from the scripts themselves, so a reworded line fails here, not on a PC.
assert.equal(updateStepFromLine(''), null);
assert.equal(updateStepFromLine('  ============'), null);
const tmpl = (f) => readFileSync(new URL(`../release-templates/_system-scripts/${f}`, import.meta.url), 'utf8');
const stepsOf = (text) => [...new Set(text.split(/\r?\n/).map(updateStepFromLine).filter(Boolean).map((s) => s.step))];
const winSteps = stepsOf(tmpl('update-windows.ps1'));
const unixSteps = stepsOf(tmpl('update-unix.sh'));
for (const s of ['Backing up your books...', 'Checking GitHub for the new version...', 'Downloading the new version...', 'Unpacking the new version...', 'Putting the new version in place...', 'Installing the parts it needs (this can take a few minutes)...', 'Done. Starting the new version...']) {
  assert.ok(winSteps.includes(s), `update-windows.ps1 prints a line for: ${s}`);
  assert.ok(unixSteps.includes(s), `update-unix.sh prints a line for: ${s}`);
}
assert.ok(unixSteps.includes('The update did not finish. Putting the previous version back...'));
assert.equal(updateStepFromLine('  Reinstalling the previous dependencies...'), null, 'the roll-back is not "installing the parts"');
assert.equal(updateStepFromLine('  [OK] Update complete!').pct, 95);

console.log('mac-app-test: all checks passed');
