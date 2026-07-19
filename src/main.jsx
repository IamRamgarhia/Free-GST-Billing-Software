import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// v1.10.2 — Deferred SW update. Prior code called `updateSW(true)`
// inside `onNeedRefresh` which triggers `location.reload()` immediately.
// If the user was mid-invoice (typing line items, editing terms), that
// state was blown away on every deploy.
//
// v1.10.33 — Reported "it work in incognito only ... it should auto
// refresh hard cache after update". Root cause: v1.10.2's deferred
// pattern only fired the update on blur, but if the user never blurred
// the tab AND the old bundle hashes stopped matching the new
// index.html assets, the tab served a broken bundle → white screen.
// Now:
//   1. onNeedRefresh: stash flag + dispatch event (existing UI hook).
//   2. Auto-apply after 20 seconds of no user activity — long enough
//      that a mid-form user can save/finish, short enough that we
//      don't wait for a browser blur that may never come.
//   3. Still auto-apply on blur (fastest safe moment).
//   4. Also auto-apply immediately if the user is on a read-only view
//      (dashboard, clients, reports). Detected via presence of ANY
//      `contenteditable`, `<input>`, or `<textarea>` with a non-empty
//      value — if none, we're not editing.
let __updateSW = null;
window.__fgsbSwUpdateReady = false;

const hasUnsavedInput = () => {
  try {
    const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    for (const el of inputs) {
      if (el.value && String(el.value).trim().length > 0) return true;
      if (el.getAttribute?.('contenteditable') === 'true' && el.textContent?.trim().length > 0) return true;
    }
    return false;
  } catch { return false; }
};

__updateSW = registerSW({
  onNeedRefresh() {
    window.__fgsbSwUpdateReady = true;
    window.dispatchEvent(new CustomEvent('fgsb-sw-update-ready'));
    // If user is on a read-only view, apply immediately — no white-screen
    // risk from stale hash-mismatched bundle.
    if (!hasUnsavedInput()) {
      setTimeout(() => window.__fgsbApplyUpdate?.(), 500);
      return;
    }
    // Otherwise wait 20s — enough to finish typing a line or two, then
    // auto-apply. User can also blur / navigate to trigger it sooner.
    setTimeout(() => window.__fgsbApplyUpdate?.(), 20_000);
  },
  onOfflineReady() {
    // Prior console.log removed — production hygiene (v1.9.15 audit L1).
    window.dispatchEvent(new CustomEvent('fgsb-sw-offline-ready'));
  },
});

// Called by whichever UI component (or auto-defer logic) decides now is
// the right moment to activate the pending SW and reload.
window.__fgsbApplyUpdate = () => {
  if (!window.__fgsbSwUpdateReady) return;
  window.__fgsbSwUpdateReady = false;
  if (__updateSW) __updateSW(true);
};

// Auto-apply on blur (user tabbed away from the app) — safe moment.
window.addEventListener('blur', () => {
  if (window.__fgsbSwUpdateReady) window.__fgsbApplyUpdate();
});

// v1.10.35 — Nuclear defensive path for the "still white screen on
// refresh after v1.10.33" report. Root cause: users' currently-running
// SW was installed BEFORE we set skipWaiting=true, so their SW still
// behaves the old way — stalls in `waiting` state and never activates
// the fresh SW that was published. Result: browser reloads → SW serves
// stale index.html + stale bundle names → the referenced JS chunks
// no longer exist → white screen.
//
// On every load:
//   1. If a `waiting` SW registration exists, force it to skipWaiting
//      via message post AND reload once it activates. One-time cost:
//      one auto-reload the first time the user hits v1.10.35.
//   2. If the loaded main bundle hits a `chunk-load` error (imports
//      referencing files the SW's cache doesn't have), auto-reload
//      once — belt-and-braces after case 1.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (!reg) return;
    // Take the waiting SW live if there is one.
    if (reg.waiting) {
      try {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch { /* ignore */ }
    }
    // Any time a fresh SW takes control, reload once so the client
    // JS matches the SW's manifest. Only fires when we didn't cause
    // it ourselves (already-mounted app).
    let alreadyReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (alreadyReloaded) return;
      alreadyReloaded = true;
      window.location.reload();
    });
  }).catch(() => { /* not registered yet — first load */ });

  // Chunk-load safety net. Vite's dynamic imports produce
  // `Failed to fetch dynamically imported module` (Chrome) or
  // `error loading dynamically imported module` (Firefox/Safari) when
  // the requested chunk name changed post-deploy. Reload once to
  // fetch the current index.html + its correct chunk map.
  let chunkReloadFired = false;
  window.addEventListener('error', (e) => {
    const msg = String(e?.message || e?.error?.message || '');
    if (!chunkReloadFired && /dynamically imported module|Loading chunk|Failed to fetch dynamically/i.test(msg)) {
      chunkReloadFired = true;
      // Small delay so we don't reload-loop on a genuine broken state.
      setTimeout(() => window.location.reload(), 200);
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String(e?.reason?.message || e?.reason || '');
    if (!chunkReloadFired && /dynamically imported module|Loading chunk|Failed to fetch dynamically/i.test(msg)) {
      chunkReloadFired = true;
      setTimeout(() => window.location.reload(), 200);
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
