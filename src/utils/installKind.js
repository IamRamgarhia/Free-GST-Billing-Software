// Copies that update by installing the new package, never with the ZIP's
// updater: install-kind.txt next to server.js names the kind. The Linux
// packages and the Docker image write "deb", "appimage" or "docker"; the Mac
// app (v1.10.85, scripts/build-mac-app.sh) writes "macapp" - replacing files
// inside a signed .app would break its signature, so its user downloads the
// new DMG instead.
//
// Standalone on purpose (no imports): server.js imports it and the release
// ZIP ships it (build-release-zip.mjs).

export const MAC_DMG_NAME = 'Free-GST-Billing-Mac.dmg';
export const MAC_DMG_URL = `https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/${MAC_DMG_NAME}`;

// What to tell the user instead of running the updater, or null (the ZIP).
export function updateHintFor(kind, latest) {
  const v = latest || '<version>';
  return ({
    deb: `This copy was installed from the .deb package. To update, download free-gst-billing_${v}_amd64.deb from the release page and open it (or run: sudo apt install ./free-gst-billing_${v}_amd64.deb). Your invoices are kept.`,
    appimage: 'This copy is the AppImage. To update, download the new Free-GST-Billing-Linux-x86_64.AppImage from the release page and use it instead of the old file. Your invoices are kept.',
    docker: 'This copy runs in Docker. To update, put the new version in the image: line of docker-compose.yml and run: docker compose pull, then docker compose up -d. Your invoices stay in the /data volume.',
    macapp: `This copy is the Mac app. Download the new Mac app (${MAC_DMG_NAME}), open it and drag Free GST Billing to Applications (replace). Your books are in Application Support and are kept.`,
  })[kind] || null;
}

// The file to download for the update, when there is one link for it.
export function updateDownloadUrlFor(kind) {
  return kind === 'macapp' ? MAC_DMG_URL : null;
}

// v1.10.86 - the ZIP updaters' own lines (update-windows.ps1, update-unix.sh)
// as a step for the page's progress bar: { step, pct }, or null for a line
// that is not a step. The two scripts print their steps in different orders,
// so the server never lets the bar go backwards.
const UPDATE_STEPS = [
  [/putting the previous version back/i, 'The update did not finish. Putting the previous version back...', 90],
  [/Backing up your data/i, 'Backing up your books...', 10],
  [/Checking (the )?latest release/i, 'Checking GitHub for the new version...', 20],
  [/Downloading update|Latest release:|Using the local package|no download needed/i, 'Downloading the new version...', 35],
  [/Extracting/i, 'Unpacking the new version...', 55],
  [/Applying (the )?update/i, 'Putting the new version in place...', 70],
  [/Re-?installing dependencies/i, 'Installing the parts it needs (this can take a few minutes)...', 85],
  [/Update complete|Nothing to do/i, 'Done. Starting the new version...', 95],
];
export function updateStepFromLine(line) {
  const hit = UPDATE_STEPS.find(([re]) => re.test(String(line || '')));
  return hit ? { step: hit[1], pct: hit[2] } : null;
}
