// v1.10.84 - what the in-app updater of a Windows Setup copy accepts before it
// runs a downloaded Setup (server.js updateWithSetup). The Setup is not signed
// yet (Authenticode signing is planned), so these checks are what stands
// between a download and running it:
//   - https only, and only from GitHub's release hosts (every redirect too);
//   - the asset of THIS repository's latest release, by its exact name;
//   - the size GitHub's API gives for that asset;
//   - the SHA-256 GitHub publishes for it (asset "digest"), when it does;
//   - a Windows program ("MZ").
//
// Standalone on purpose (Node built-ins only): server.js imports it and the
// release ZIP ships it (build-release-zip.mjs).
import crypto from 'crypto';

export const SETUP_NAME = 'Free-GST-Billing-Windows-Setup.exe';
const REPO_DOWNLOADS = 'https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/download/';
export const DOWNLOAD_HOSTS = ['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'];

export function allowedDownloadUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && DOWNLOAD_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

// The Setup asset in a GitHub "latest release" API answer: { url, size, sha256 }
// or null. sha256 is '' when GitHub gives no digest for it.
export function setupAssetFrom(release) {
  const a = (release?.assets || []).find((x) => x?.name === SETUP_NAME);
  if (!a || typeof a.browser_download_url !== 'string' || !a.browser_download_url.startsWith(REPO_DOWNLOADS)) return null;
  const digest = /^sha256:([0-9a-f]{64})$/i.exec(String(a.digest || ''));
  return { url: a.browser_download_url, size: Number(a.size) || 0, sha256: digest ? digest[1].toLowerCase() : '' };
}

export function checkSetupBytes(buf, { size, sha256 } = {}) {
  if (!buf || buf.length < 2 || buf.toString('latin1', 0, 2) !== 'MZ') return { ok: false, problem: 'The download is not a Windows program.' };
  if (size && buf.length !== size) return { ok: false, problem: `The download is ${buf.length} bytes; GitHub says ${size}.` };
  if (sha256) {
    const got = crypto.createHash('sha256').update(buf).digest('hex');
    if (got !== sha256.toLowerCase()) return { ok: false, problem: 'The download does not match the SHA-256 published with the release.' };
    return { ok: true, checked: 'size and SHA-256' };
  }
  return { ok: true, checked: size ? 'size only (no SHA-256 published)' : 'nothing published to check against' };
}
