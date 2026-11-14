import { promptAction } from './ConfirmModal';

// v1.10.85 (#184) - "Paid" chosen from a status list records a payment for
// the balance. It used to be recorded as mode "other", so a cash payment never
// reached the Cash book. Now the user says how it was paid (the last answer is
// offered first). null = cancelled: the status is left as it was.
export const PAID_MODES = [
  ['cash', 'Cash'], ['upi', 'UPI'], ['bank-transfer', 'Bank transfer'],
  ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other'],
];
const LAST_MODE_KEY = 'fgsb_lastPaidMode';

export async function askPaidMode(title = 'How was it paid?') {
  let last = 'cash';
  try { last = localStorage.getItem(LAST_MODE_KEY) || 'cash'; } catch { /* storage blocked */ }
  const mode = await promptAction({
    title,
    message: 'A payment for the balance is recorded with today\'s date. Cash payments also go into the Cash book.',
    options: PAID_MODES,
    defaultValue: PAID_MODES.some(([v]) => v === last) ? last : 'cash',
    confirmLabel: 'Mark paid',
  });
  if (!mode) return null;
  try { localStorage.setItem(LAST_MODE_KEY, mode); } catch { /* storage blocked */ }
  return mode;
}
