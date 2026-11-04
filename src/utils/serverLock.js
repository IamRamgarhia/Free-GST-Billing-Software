// v1.10.84 - one server per books folder. Two servers on one data folder (an
// old ZIP launcher and the installed app pointed at the same books, or two
// copies of the ZIP) would both write the same JSON files, and the last write
// wins. data/server.lock holds the running server's process id and port:
//   - a second server that finds a live lock does not start. Its launcher
//     then opens the running one (its port is in port.txt);
//   - a lock whose process is gone (killed, PC switched off) is taken over.
//
// Standalone on purpose (Node built-ins only): server.js imports it and the
// release ZIP ships it (build-release-zip.mjs).
import fs from 'fs';

export const LOCK_NAME = 'server.lock';
// A server takes the lock before it listens; until its port answers, a lock
// this young counts as "still starting", not as stale.
export const STARTING_GRACE_MS = 30_000;

export function readLock(file) {
  try {
    const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Number.isInteger(lock?.pid) && lock.pid > 0 ? lock : null;
  } catch {
    return null;
  }
}

export function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// Is the lock held by ANOTHER server that is running? The process must be
// there, and either answer on its port or have taken the lock moments ago. A
// live process that does not answer long after taking the lock is a reused
// process id (after a restart of the PC) or a hung server: stale.
export async function lockIsLive(lock, { selfPid, isAlive = pidAlive, answers, now = Date.now() }) {
  if (!lock || lock.pid === selfPid || !isAlive(lock.pid)) return false;
  if (lock.port && await answers(lock.port)) return true;
  return now - (Number(lock.at) || 0) < STARTING_GRACE_MS;
}

// { ok: true } = this server holds the lock now; { ok: false, held } = another
// running server holds it. A lock that cannot be written at all (read-only
// folder) never stops the app: the data folder check after this says why.
export async function acquireLock(file, { pid, answers, isAlive = pidAlive, now }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid, port: 0, at: Date.now() }), { flag: 'wx' });
      return { ok: true };
    } catch (e) {
      if (e.code !== 'EEXIST') return { ok: true, warning: e.message };
    }
    const held = readLock(file);
    if (held && await lockIsLive(held, { selfPid: pid, isAlive, answers, now })) return { ok: false, held };
    try { fs.unlinkSync(file); } catch { /* another server took it over first: look again */ }
  }
  return { ok: true };
}

export function writeLock(file, lock) {
  try { fs.writeFileSync(file, JSON.stringify(lock)); } catch { /* read-only: see acquireLock */ }
}

// Only our own lock: a server that refused to start must not remove the
// running server's.
export function releaseLock(file, pid) {
  if (readLock(file)?.pid !== pid) return;
  try { fs.unlinkSync(file); } catch { /* gone already */ }
}

// Does anything answer HTTP on this port of this PC? Any answer counts (a PIN
// lock answers 401/423, and that is still the running app).
export async function portAnswers(port, timeoutMs = 1500) {
  try {
    await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
}
