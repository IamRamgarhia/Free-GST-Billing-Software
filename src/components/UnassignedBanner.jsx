import { Building2 } from 'lucide-react';
import { confirmAction } from './ConfirmModal';
import { toast } from './Toast';

/**
 * Offers to attach records that predate multi-business separation to the
 * business currently selected.
 *
 * v1.10.65 (#58 item 3) — expenses, purchase bills and recurring templates
 * saved before businesses were kept apart carry no owner, so they appear
 * under every business. Hiding them would be far worse than showing them
 * twice, so they stay visible and the user is offered this instead.
 *
 * Two things this deliberately does NOT do:
 *
 *   * It does not assign anything automatically. Which business a past
 *     expense belonged to is a fact only the user knows, and guessing it
 *     would quietly file records into the wrong books.
 *   * It does not appear unless there is something to assign, so it is not
 *     a permanent banner nagging at the top of the page.
 *
 * Assigning is one-way — it names the business in the confirmation so the
 * user cannot do it while looking at the wrong company by accident.
 */
export default function UnassignedBanner({ count, businessName, noun, onAssign }) {
  if (!count || !businessName) return null;

  const label = count === 1 ? `1 ${noun}` : `${count} ${noun}s`;

  const handleClick = async () => {
    const ok = await confirmAction({
      title: `Assign ${label} to ${businessName}?`,
      message:
        `${label} ${count === 1 ? 'was' : 'were'} saved before you began keeping `
        + `businesses separate, so ${count === 1 ? 'it appears' : 'they appear'} under every business. `
        + `Assigning ${count === 1 ? 'it' : 'them'} to ${businessName} means `
        + `${count === 1 ? 'it' : 'they'} will no longer show under your other businesses. `
        + `Only do this if ${count === 1 ? 'it belongs' : 'they belong'} to ${businessName}.`,
      confirmLabel: `Assign to ${businessName}`,
    });
    if (!ok) return;
    try {
      await onAssign();
      toast(`${label} assigned to ${businessName}`, 'success');
    } catch {
      toast('Could not assign — please try again', 'error');
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap',
      padding: '0.7rem 1rem',
      marginBottom: '1rem',
      borderRadius: 10,
      border: '1px solid var(--border)',
      background: 'rgba(59, 130, 246, 0.07)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.88rem' }}>
        <Building2 size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span>
          <strong>{label}</strong> {count === 1 ? 'is' : 'are'} not assigned to a business,
          so {count === 1 ? 'it shows' : 'they show'} under all of them.
        </span>
      </span>
      <button type="button" className="btn" onClick={handleClick} style={{ fontSize: '0.85rem' }}>
        Assign to {businessName}
      </button>
    </div>
  );
}
