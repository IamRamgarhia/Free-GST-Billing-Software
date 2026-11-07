import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency, SALES_INVOICE_TYPES } from '../utils';
import { clientAccount, creditLimitCheck, thisInvoiceDue, missingRateNote } from '../utils/clientLedger';
import { baseCurrencyOf } from '../utils/fx';
import HelpButton from './HelpButton';

// v1.10.85 - New Invoice: a warning (never a block) when what the client
// already owes this business plus what is still due on this invoice goes over
// their credit limit (Client form -> Credit limit). Nothing shows for a client
// without a limit, or for a quotation, challan or credit note.
// `paid`: already paid on the invoice being edited; `creditApplied`: the
// client credit being used on it. Amounts in another currency are converted at
// each invoice's saved exchange rate; one without a rate is left out and named.
export default function CreditLimitWarning({ savedClient, bills, profile, excludeId, invoiceType, totals, currency, exchangeRate, paid = 0, creditApplied = 0 }) {
  const limit = Number(savedClient?.creditLimit) || 0;
  const isSale = SALES_INVOICE_TYPES.includes(invoiceType || 'tax-invoice');
  const name = savedClient?.name || '';
  const account = useMemo(
    () => (limit > 0 && isSale ? clientAccount(name, bills, profile, excludeId) : null),
    [limit, isSale, name, bills, profile, excludeId],
  );
  if (!account) return null;
  const thisOne = thisInvoiceDue({ totals, currency, exchangeRate, paid, creditApplied }, profile);
  const check = creditLimitCheck(limit, account.owed, thisOne.amount);
  if (!check.over) return null;
  const fmt = (n) => formatCurrency(n, baseCurrencyOf(profile));
  const leftOut = missingRateNote([...account.missing, ...(thisOne.missing ? [thisOne.missing] : [])]);
  return (
    <div className="notice notice-warn" role="alert" data-testid="credit-limit-warning"
      style={{ marginTop: '0.75rem', fontSize: '0.82rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Over the credit limit by {fmt(check.by)}.</strong>{' '}
        {name} owes {fmt(account.owed)}; with this invoice it is {fmt(check.after)}, and their limit is {fmt(limit)}.
        {' '}You can still save it. <HelpButton title="Credit limit" doc="clients#credit-limit" size={14} />
        {leftOut && <div style={{ fontSize: '0.75rem', marginTop: 2 }}>({leftOut}.)</div>}
      </div>
    </div>
  );
}
