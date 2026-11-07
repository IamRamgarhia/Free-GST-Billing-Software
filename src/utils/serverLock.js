// v1.10.84 - one server per books folder. Two servers on one data folder (an
// old ZIP launcher and the installed app pointed at the same books, or two
// copies of the ZIP) would both write the same JSON files, and the last write
// wins. data/server.lock holds the running server's process id, port, the
// PC's name and a random id:
//   - a second server that finds a live lock does not start. Its launcher
//     then opens the running one (its port is in port.txt);
//   - a lock whose process is gone (killed, PC switched off) is taken over;
//   - a lock written by ANOTHER PC (books on a shared drive) is never taken
//     over: its process id means nothing here.
//
// Standalone on purpose (Node built-ins only): server.js imports it and the
// release ZIP ships it (build-release-zip.mjs).
import fs from 'fs';
import net from 'net';

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

const sameHost = (a, b) => !a || !b || String(a).toLowerCase() === String(b).toLowerCase();

// Is the lock held by ANOTHER server? 'other-host' (another PC's lock),
// 'running' (its port answers AS that server: same process id or lock id),
// 'starting' (took the lock moments ago) - or false: free to take over (its
// process is gone, or a reused process id / hung server never answers).
export async function lockIsLive(lock, { selfPid, selfHost, isAlive = pidAlive, identify, isListening = portOpen, now = Date.now() }) {
  if (!lock) return false;
  if (!sameHost(lock.host, selfHost)) return 'other-host';
  if (lock.pid === selfPid || !isAlive(lock.pid)) return false;
  if (lock.port) {
    const who = await identify(lock.port);
    if (who && (who.pid === lock.pid || (lock.id && who.lockId === lock.id))) return 'running';
    // Review H1 (7 Nov): a BUSY server (a big backup or restore blocks its one
    // thread) does not answer /api/version, but its port still takes the
    // connection. Its process is alive, so it is running - never taken over
    // (two servers on one books folder). Answering as another server = stale.
    // ponytail: a dead server whose pid AND port were both reused by other
    // programs would read as running; the user restarts the PC.
    if (!who && await isListening(lock.port)) return 'running';
  }
  return now - (Number(lock.at) || 0) < STARTING_GRACE_MS ? 'starting' : false;
}

// Does something accept a connection on this PC's port? (No HTTP: a server
// whose thread is blocked still accepts.)
export function portOpen(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(timeoutMs, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

// { ok: true } = this server holds the lock now; { ok: false, held, reason }
// = another server holds it. Taking it is checked by reading it back (two
// servers taking over one stale lock at the same moment: only one id stays).
// A lock that cannot be written at all (read-only folder) never stops the
// app: the data folder check after this says why.
export async function acquireLock(file, { pid, host, id, identify, isAlive = pidAlive, now }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid, port: 0, at: Date.now(), host, id }), { flag: 'wx' });
      if (readLock(file)?.id === id) return { ok: true };
      continue;
    } catch (e) {
      if (e.code !== 'EEXIST') return { ok: true, warning: e.message };
    }
    let raw = '';
    try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const held = readLock(file);
    const reason = held ? await lockIsLive(held, { selfPid: pid, selfHost: host, isAlive, identify, now }) : false;
    if (reason) return { ok: false, held, reason };
    // Stale: remove it only if it is still the very lock judged stale.
    try { if (fs.readFileSync(file, 'utf8') === raw) fs.unlinkSync(file); } catch { /* gone already */ }
  }
  return { ok: false, held: readLock(file), reason: 'starting' };
}

// Only while the lock is still ours (true when written).
export function writeLock(file, lock) {
  if (readLock(file)?.id !== lock.id) return false;
  try { fs.writeFileSync(file, JSON.stringify(lock)); return true; } catch { return false; }
}

// Only our own lock: a server that refused to start must not remove the
// running server's.
export function releaseLock(file, id) {
  if (!id || readLock(file)?.id !== id) return;
  try { fs.unlinkSync(file); } catch { /* gone already */ }
}

// Who answers on this port of this PC: { pid, lockId } from /api/version, or
// null (nothing, or something that is not this app).
export async function portIdentity(port, timeoutMs = 1500) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/version`, { signal: AbortSignal.timeout(timeoutMs) });
    const j = await res.json();
    return j && typeof j === 'object' && j.current ? { pid: j.pid, lockId: j.lockId } : null;
  } catch {
    return null;
  }
}
