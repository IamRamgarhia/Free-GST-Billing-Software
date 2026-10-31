/* Free GST Billing - start-up guard (v1.10.83). A plain script, loaded before
   the app, so it runs even when the app's code cannot load.

   After an update, the browser's offline cache can still hold the previous
   version's page, which asks for code files the update removed. The app then
   cannot start and the window stays blank until a second refresh. When that
   happens, clear the app's offline cache once and load again. Only the cached
   app files are cleared: invoices, clients and settings live in the data
   folder and are never touched. */
(function () {
  var KEY = 'fgsb-boot-retry';
  // v1.10.84 - only when the app's server answers. With the server stopped a
  // file fails to load for that reason alone; clearing the offline copy then
  // left only the browser's "can't be reached" page instead of the app's own
  // "Needs a Quick Start". HEAD, because the offline copy only answers GET.
  function recover() {
    fetch('/api/profile', { method: 'HEAD', cache: 'no-store' })
      .then(function (r) { if (r.ok) clearAndReload(); })
      .catch(function () { /* server not running: the app says so itself */ });
  }
  function clearAndReload() {
    try {
      if (sessionStorage.getItem(KEY)) return; // tried once this session: do not loop
      sessionStorage.setItem(KEY, '1');
    } catch { return; }
    var jobs = [];
    if (navigator.serviceWorker) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }));
    }
    if (window.caches) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }));
    }
    Promise.all(jobs).catch(function () {}).then(function () { location.reload(); });
  }
  // The app's code (or a file it needs) failed to load.
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'SCRIPT' && t.type === 'module') recover();
  }, true);
  // Belt and braces: main.jsx sets __fgsbBooted as soon as it runs.
  window.addEventListener('load', function () {
    setTimeout(function () { if (!window.__fgsbBooted) recover(); }, 3000);
  });
})();
