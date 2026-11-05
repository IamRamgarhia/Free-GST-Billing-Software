// ERR-082 / ERR-083 - Node's fs.mkdirSync(dir, { recursive: true }) never
// returns on Windows when "Controlled folder access" refuses the write (a
// plain mkdir fails at once). The server is single-threaded, so one such call
// froze the whole app. Make the missing folders one level at a time instead:
// a refusal is a fast, catchable error.
import fs from 'node:fs';
import path from 'node:path';

export function makeDir(dir) {
  const missing = [];
  let d = path.resolve(dir);
  while (!fs.existsSync(d)) {
    missing.unshift(d);
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  for (const m of missing) {
    try { fs.mkdirSync(m); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}

// The same for async code (a recursive fs.promises.mkdir that is refused
// never settles: the caller waits for ever).
export async function makeDirAsync(dir) {
  const missing = [];
  let d = path.resolve(dir);
  while (!(await fs.promises.access(d).then(() => true, () => false))) {
    missing.unshift(d);
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  for (const m of missing) {
    try { await fs.promises.mkdir(m); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}
