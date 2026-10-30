// npm run app:refresh - put the app running on this PC from this folder (the
// copy on data/port.txt) onto the code here: rebuild the screens, then restart
// its server with its own Control Panel restart, and wait until it answers.
// For the maintainer, who uses the app from the repo while it is developed.
// Never starts a second copy: if the app is not running, it only rebuilds,
// and the next start from the Desktop icon opens the new code.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const say = (s) => process.stdout.write(`  ${s}\n`);

say('Building the screens...');
try { execSync('npm run -s build', { cwd: ROOT, stdio: 'ignore' }); } catch {
  say('The build failed: the running app was left as it was. Run "npm run build" to see why.');
  process.exit(1);
}
const html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');
const built = (/assets\/index-[\w-]+\.js/.exec(html) || [])[0];

let port = '';
try { port = readFileSync(join(ROOT, 'data', 'port.txt'), 'utf8').replace(/\D/g, ''); } catch { /* not started yet */ }
const base = `http://127.0.0.1:${port || 47371}`;
const up = async () => { try { return (await fetch(`${base}/api/profile`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };

if (!(await up())) {
  say(`Built. The app is not running; it opens on the new code next time (${built}).`);
  process.exit(0);
}
say('Restarting the app...');
const r = await fetch(`${base}/api/control-panel/restart`, { method: 'POST' }).then((x) => x.json()).catch(() => ({}));
if (!r.ok) { say(`The app did not restart (${r.error || 'no answer'}). Use Control Panel → Restart.`); process.exit(1); }
for (let i = 0; i < 60; i++) {
  await new Promise((res) => setTimeout(res, 500));
  if (await up()) {
    const served = (/assets\/index-[\w-]+\.js/.exec(await (await fetch(base)).text()) || [])[0];
    say(served === built ? `Done: the app on port ${port} runs the new code. Reload its window.` : `Restarted, but it sends ${served} instead of ${built}.`);
    process.exit(served === built ? 0 : 1);
  }
}
say('The app did not come back within 30 seconds. Open it from the Desktop icon.');
process.exit(1);
