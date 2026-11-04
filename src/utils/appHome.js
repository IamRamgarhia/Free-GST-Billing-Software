// v1.10.84 - where the books are: data/, Saved Invoices/ and Trash/ always
// live together in one "home" folder, chosen by (first that is set):
//   1. the FGSB_HOME environment variable (Linux packages, the NAS image);
//   2. home.txt next to server.js (the Windows Setup writes the folder the
//      user chose: Documents\Free GST Billing, or their earlier copy's folder);
//   3. server.js's own folder - as it always was, so the ZIP is unchanged.
//
// Standalone on purpose (Node built-ins only): server.js imports it and the
// release ZIP ships it (build-release-zip.mjs).
import fs from 'fs';
import path from 'path';

export const HOME_ENV = 'FGSB_HOME';
export const HOME_FILE = 'home.txt';

// Throws with a sentence for the user when the named folder is not there (a
// USB drive not plugged in, a folder deleted by hand): starting with an empty
// data folder there would look as if every invoice was gone.
export function resolveAppHome(appDir, env = process.env) {
  let home = String(env[HOME_ENV] || '').trim();
  let from = HOME_ENV;
  if (!home) {
    from = HOME_FILE;
    try {
      home = fs.readFileSync(path.join(appDir, HOME_FILE), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)[0].trim();
    } catch { home = ''; }
  }
  if (!home) {
    // A copy installed by the Windows Setup never keeps books in its program
    // folder: starting there would show an empty app as if the books were gone.
    if (fs.existsSync(path.join(appDir, 'installed.txt'))) {
      throw new Error(`${HOME_FILE} is missing or empty in ${appDir}, so the app does not know where your books are. Run Free-GST-Billing-Windows-Setup.exe again to repair it (your books are not changed).`);
    }
    return appDir;
  }
  // The environment variable may be relative to the folder the app is started
  // in (the Linux launcher and the tests use that); home.txt, written by the
  // Windows Setup, must be a full path.
  if (from === HOME_ENV) home = path.resolve(home);
  if (!path.isAbsolute(home)) throw new Error(`${from} must be a full folder path, but it is "${home}".`);
  let isDir = false;
  try { isDir = fs.statSync(home).isDirectory(); } catch { isDir = false; }
  if (!isDir) throw new Error(`The folder with your books is not there: ${home} (from ${from}). If it is on a USB or network drive, connect it and open the app again.`);
  return path.resolve(home);
}
