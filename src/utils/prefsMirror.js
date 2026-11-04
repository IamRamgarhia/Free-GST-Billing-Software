// v1.10.77 (#84) - settings that lived ONLY in this browser's storage are now
// also kept in the app's data folder, and put back if the browser loses them.
//
// Reported: "Welcome to Free GST Billing pops up repeatedly" and "Region
// Preference saved as India is back to Both/Auto after a restart". Print &
// PDF settings (including "setup finished"), Region, Features, custom units,
// GST "filed" marks and the income-tax inputs were stored only in the
// browser. A browser that clears site data on exit (Brave can), a cleared
// cache, or the app starting on another port (a new origin, so an empty
// storage) lost them all: the wizard came back and everything reset.
//
// Kept local AND mirrored: reads stay instant and offline; the copy in the
// data folder (data/local-prefs.json, server.js /api/local-prefs) is restored
// before the app first renders, for keys the browser no longer has.

//
// v1.10.84 - the Windows Setup's own window (WebView2) has a storage of its
// own, empty after moving from Edge or a browser: custom field names, text
// size, preview open/closed, the last bank account used, dismissed notices
// and update reminders are mirrored too, so they come along.
const MIRRORED = /^(gst_printSettings|gst_regionMode|gst_enabledModules|gst_businessType|gst_offlineMode|gst_menuOrder|gst_customUnits|gst_dashboardColumns|gst_filing_status(_.*)?|gst_itr[A-Za-z]*|freegstbill_onboarded|freegstbill_theme|freegstbill_startedDismissed|freegstbill_supportNudge|freegstbill_welcomeCard|freegstbill_starBanner|freegstbill_sidebarAutoHide|fgsb_customFieldLabels|fgsb_sizeStep|fgsb_previewCollapsed|fgsb_dismissedNotifs|gst_lastUsedAccountId_.*|gst_settingsTab|freegstbill_dismissedUpdate|freegstbill_notifiedUpdate|freegstbill_notifyAsked)$/;
const ENDPOINT = '/api/local-prefs';

export const isMirrored = (key) => MIRRORED.test(String(key));

// Missing keys come back from the data folder; keys the browser has win.
// Returns true only when the data-folder copy was read.
export async function restorePrefs() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500); // never hold up start-up
    const res = await fetch(ENDPOINT, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const { value } = await res.json();
    for (const [k, v] of Object.entries(value || {})) {
      if (isMirrored(k) && typeof v === 'string' && localStorage.getItem(k) === null) localStorage.setItem(k, v);
    }
    return true;
  } catch {
    return false; // server not reachable yet: the browser copy is used as is
  }
}

// Changed keys since the last write; only these are sent, and the server
// merges them, so nothing this browser did not touch is ever replaced.
const dirty = new Set();
let timer = null;
const push = () => {
  const set = {};
  const remove = [];
  try {
    for (const k of dirty) {
      const v = localStorage.getItem(k);
      if (v === null) remove.push(k); else set[k] = v;
    }
  } catch { return; }
  dirty.clear();
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set, remove }) }).catch(() => {});
};
const touch = (k) => { dirty.add(k); clearTimeout(timer); timer = setTimeout(push, 600); };

// Every write or removal of a mirrored key, from anywhere in the app, updates
// the copy in the data folder (one write per burst of changes). Only after a
// successful restore: had the server been unreachable at start, this browser
// may hold first-run defaults, which must never replace the saved copy.
export function startMirroring(restored) {
  if (!restored) return;
  try {
    const proto = Object.getPrototypeOf(localStorage);
    const set = proto.setItem;
    const remove = proto.removeItem;
    proto.setItem = function setItem(k, v) { set.call(this, k, v); if (this === window.localStorage && isMirrored(k)) touch(k); };
    proto.removeItem = function removeItem(k) { remove.call(this, k); if (this === window.localStorage && isMirrored(k)) touch(k); };
    // Seed the data-folder copy with what this browser has now (after the
    // restore it holds everything the copy had, plus its own newer values).
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isMirrored(k)) touch(k);
    }
  } catch { /* storage blocked: nothing to mirror */ }
}
