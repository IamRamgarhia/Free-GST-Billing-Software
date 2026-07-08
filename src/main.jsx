import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// v1.10.2 — Deferred SW update. Prior code called `updateSW(true)`
// inside `onNeedRefresh` which triggers `location.reload()` immediately.
// If the user was mid-invoice (typing line items, editing terms), that
// state was blown away on every deploy. Now:
//
//   1. onNeedRefresh: stash the "update ready" flag on window.
//   2. A window-level 'fgsb-sw-update-ready' event fires so any UI
//      component (App.jsx) can render an "Update available" toast.
//   3. reload only happens on window blur / route change / user click —
//      never mid-form.
//
// The registerType was also flipped from 'autoUpdate' to 'prompt' in
// vite.config.js so the SW doesn't skipWaiting on its own.
let __updateSW = null;
window.__fgsbSwUpdateReady = false;

__updateSW = registerSW({
  onNeedRefresh() {
    window.__fgsbSwUpdateReady = true;
    window.dispatchEvent(new CustomEvent('fgsb-sw-update-ready'));
  },
  onOfflineReady() {
    // Prior console.log removed — production hygiene (v1.9.15 audit L1).
    window.dispatchEvent(new CustomEvent('fgsb-sw-offline-ready'));
  },
});

// Called by whichever UI component (or auto-defer logic) decides now is
// the right moment to activate the pending SW and reload.
window.__fgsbApplyUpdate = () => {
  window.__fgsbSwUpdateReady = false;
  if (__updateSW) __updateSW(true);
};

// Auto-apply on blur (user tabbed away from the app) — safe moment.
window.addEventListener('blur', () => {
  if (window.__fgsbSwUpdateReady) window.__fgsbApplyUpdate();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
