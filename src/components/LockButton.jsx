// v1.10.80 (#98) - a Lock button where it is always at hand (the sidebar and
// the Dashboard), shown only when a PIN is set. It does what Settings > App
// lock > Lock now does. Requested: "Lock button should be visible on the front
// page so it can easily be locked."
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getLockStatus } from '../store';
import { lockNow, LOCK_CHANGED_EVENT } from '../utils/appLock';
import { BarButton } from './PageHeader';

// v1.10.86 - an icon in the Dashboard's top bar (its name stays "Lock").
export default function LockButton() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const load = () => getLockStatus().then((s) => setEnabled(!!s?.enabled)).catch(() => setEnabled(false));
    load();
    window.addEventListener(LOCK_CHANGED_EVENT, load);
    return () => window.removeEventListener(LOCK_CHANGED_EVENT, load);
  }, []);
  if (!enabled) return null;
  return (
    <BarButton icon={Lock} label="Lock" onClick={lockNow} title="Lock the app now (Ctrl+Shift+L). Your PIN opens it again." />
  );
}
