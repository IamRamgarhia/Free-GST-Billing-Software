#!/usr/bin/env node
// v1.10.86 - the winget manifest for a release, so Windows users can install
// with:  winget install DiceCodes.FreeGSTBilling
//
//   node scripts/winget-manifest.mjs [v1.10.85]     (default: package.json version)
//
// Reads the Setup's download address and SHA-256 from the GitHub release (the
// digest GitHub shows next to the file) and writes the three manifest files to
// release-build/winget/manifests/d/DiceCodes/FreeGSTBilling/<version>/. They are
// submitted to github.com/microsoft/winget-pkgs as a pull request (see
// packaging/winget/README.md) - only with the maintainer's go-ahead.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'IamRamgarhia/Free-GST-Billing-Software';
const ID = 'DiceCodes.FreeGSTBilling';
const SETUP = 'Free-GST-Billing-Windows-Setup.exe';
const SCHEMA = '1.28.0';

const arg = process.argv[2];
const version = (arg || JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version).replace(/^v/, '');
const fail = (msg) => { process.stderr.write(`  ${msg}\n`); process.exit(1); };

const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'free-gst-billing-release-script' } });
if (!res.ok) fail(`Release v${version} was not found on GitHub (${res.status}). Publish it first.`);
const release = await res.json();
const asset = (release.assets || []).find((a) => a.name === SETUP);
if (!asset) fail(`${SETUP} is not attached to v${version}.`);
const sha = /^sha256:([0-9a-f]{64})$/i.exec(String(asset.digest || ''))?.[1];
if (!sha) fail(`GitHub shows no SHA-256 for ${SETUP} on v${version}.`);
const date = String(release.published_at || '').slice(0, 10);

const head = (type) => `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${SCHEMA}.schema.json\n\nPackageIdentifier: ${ID}\nPackageVersion: ${version}\n`;
const files = {
  [`${ID}.yaml`]: `${head('version')}DefaultLocale: en-US\nManifestType: version\nManifestVersion: ${SCHEMA}\n`,
  [`${ID}.installer.yaml`]: `${head('installer')}InstallerType: inno
Scope: user
InstallModes:
- interactive
- silent
- silentWithProgress
UpgradeBehavior: install
ProductCode: FreeGSTBilling_is1
ReleaseDate: ${date}
MinimumOSVersion: 10.0.0.0
Installers:
- Architecture: x64
  InstallerUrl: ${asset.browser_download_url}
  InstallerSha256: ${sha.toUpperCase()}
ManifestType: installer
ManifestVersion: ${SCHEMA}
`,
  [`${ID}.locale.en-US.yaml`]: `${head('defaultLocale')}PackageLocale: en-US
Publisher: DiceCodes
PublisherUrl: https://dicecodes.com
PublisherSupportUrl: https://github.com/${REPO}/issues
PackageName: Free GST Billing
PackageUrl: https://github.com/${REPO}
License: MIT
LicenseUrl: https://github.com/${REPO}/blob/main/LICENSE
ShortDescription: Free, offline GST billing and invoicing for Indian small businesses.
Description: |-
  Make GST invoices, quotations, bills of supply, credit notes and delivery challans, and save them as PDF.
  GSTR-1 and GSTR-3B files, GSTR-2B matching, TDS / TCS, stock, purchases and reports.
  Free forever, works offline, and your books stay on your own computer.
Moniker: free-gst-billing
Tags:
- accounting
- billing
- gst
- india
- invoice
- inventory
- offline
- tally-alternative
ReleaseNotesUrl: https://github.com/${REPO}/releases/tag/v${version}
Documentations:
- DocumentLabel: User guide
  DocumentUrl: https://dicecodes.com/free-gst-software-documentation/
ManifestType: defaultLocale
ManifestVersion: ${SCHEMA}
`,
};

const out = join(ROOT, 'release-build', 'winget', 'manifests', 'd', 'DiceCodes', 'FreeGSTBilling', version);
mkdirSync(out, { recursive: true });
for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
process.stdout.write(`  winget manifest for v${version} written to:\n    ${out}\n  Setup SHA-256 ${sha}\n`);
