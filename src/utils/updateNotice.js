// v1.10.84 - a Windows notification when an update comes out, once per
// version, besides the "Update to vX" button in the menu. The browser's
// Notification API (allowed on http://localhost). Permission is asked once,
// only when the person clicks the offer in the update window - never by itself.
const SHOWN_KEY = 'freegstbill_notifiedUpdate';
const ASKED_KEY = 'freegstbill_notifyAsked';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

export const canAskToNotify = () => supported() && Notification.permission === 'default' && get(ASKED_KEY) !== '1';

export function notifyUpdate(latest) {
  if (!supported() || !latest || Notification.permission !== 'granted' || get(SHOWN_KEY) === latest) return;
  try {
    const n = new Notification(`Free GST Billing ${latest} is available`, {
      body: 'Open the app and click "Update to v' + latest + '". Your books are kept.',
      icon: '/icons/icon-192.png',
      tag: 'freegstbill-update',
    });
    n.onclick = () => { window.focus(); n.close(); };
    set(SHOWN_KEY, latest);
  } catch { /* notifications blocked by Windows: the menu button still shows it */ }
}

export async function askToNotify(latest) {
  if (!supported()) return;
  set(ASKED_KEY, '1');
  try {
    if (await Notification.requestPermission() === 'granted') notifyUpdate(latest);
  } catch { /* the browser refused to ask */ }
}
