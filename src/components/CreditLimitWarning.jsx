import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { amountDue, formatCurrency, getCountryConfig, SALES_INVOICE_TYPES } from '../utils';
import { clientOutstanding, creditLimitCheck } from '../utils/clientLedger';
import HelpButton from './HelpButton';

// v1.10.85 - New Invoice: a warning (never a block) when what the client
// already owes this business plus this invoice goes over their credit limit
// (Client form -> Credit limit). Nothing shows for a client without a limit,
// or for a quotation, challan or credit note.
export default function CreditLimitWarning({ savedClient, bills, profile, excludeId, invoiceType, totals }) {
  const limit = Number(savedClient?.creditLimit) || 0;
  const isSale = SALES_INVOICE_TYPES.includes(invoiceType || 'tax-invoice');
  const name = savedClient?.name || '';
  const outstanding = useMemo(
    () => (limit > 0 && isSale ? clientOutstanding(name, bills, profile, excludeId) : 0),
    [limit, isSale, name, bills, profile, excludeId],
  );
  if (!limit || !isSale) return null;
  // This invoice as the client will owe it (less TDS they deduct).
  const thisInvoice = amountDue({ totalAmount: totals?.total, data: { totals } });
  const check = creditLimitCheck(limit, outstanding, thisInvoice);
  if (!check.over) return null;
  const fmt = (n) => formatCurrency(n, getCountryConfig(profile?.country || 'India').currency || 'INR');
  return (
    <div className="notice notice-warn" role="alert" data-testid="credit-limit-warning"
      style={{ marginTop: '0.75rem', fontSize: '0.82rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Over the credit limit by {fmt(check.by)}.</strong>{' '}
        {name} owes {fmt(outstanding)}; with this invoice it is {fmt(check.after)}, and their limit is {fmt(limit)}.
        {' '}You can still save it. <HelpButton title="Credit limit" doc="clients#credit-limit" size={14} />
      </div>
    </div>
  );
}
