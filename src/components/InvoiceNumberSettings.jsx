// Settings → Invoice Number Format (moved out of SettingsView in v1.10.79).
//
// v1.10.79 (#95) - with more than one business, a business can number with
// the shared series or have its own (own prefix, start and counters). Invoices
// are stored under their number, so an own series must print a prefix no other
// series uses (ownPrefixProblem). The rules live in src/utils.js and are the
// same ones the editor and the server's recurring invoices use.
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Hash, Save } from 'lucide-react';
import { getInvoiceNumberSettings, saveInvoiceNumberSettings, getNumberSeriesMap, saveNumberSeriesMap } from '../store';
import {
  getFinancialYearLabel, nextCounterValue, MAX_START_NUMBER, DEFAULT_NUMBER_SETTINGS,
  formatDocNumber, counterKeyFor, ownPrefixProblem, prefixClashWarning, numberFormatProblem,
} from '../utils';
import { getPrintSettings } from '../utils/printSettings';
import { toast } from './Toast';
import { confirmAction } from './ConfirmModal';
import HelpButton from './HelpButton';

const cleanStart = (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 ? Number(v) : 1);

const InvoiceNumberSettings = forwardRef(function InvoiceNumberSettings(
  { businessKey, businessName, showScope, businesses = [], onDirtyChange, onSavingChange }, ref,
) {
  const [shared, setShared] = useState(null); // saved shared settings
  const [seriesMap, setSeriesMap] = useState({}); // saved own series
  const [scope, setScope] = useState('shared'); // what the form is editing
  const [draft, setDraft] = useState({ ...DEFAULT_NUMBER_SETTINGS });
  const [counter, setCounter] = useState(0); // last tax invoice number in this series
  const [saving, setSaving] = useState(false);

  const savedScope = businessKey && seriesMap[businessKey] ? 'own' : 'shared';
  const savedSettings = savedScope === 'own' ? { ...DEFAULT_NUMBER_SETTINGS, ...seriesMap[businessKey] } : shared;
  const dirty = !!shared && (scope !== savedScope || JSON.stringify(draft) !== JSON.stringify(savedSettings));
  const override = (getPrintSettings().customPrefixes?.['tax-invoice'] || '').trim();
  // v1.10.80 (#99) - the businesses on the shared numbering. Changing it
  // changes all of their numbers, which was not said anywhere: editing
  // "Firm 1" visibly changed "Firm 2".
  const sharingNames = [...new Set(businesses.filter((b) => b.key && !seriesMap[b.key]).map((b) => b.name))];

  const load = async () => {
    const [s, map] = await Promise.all([getInvoiceNumberSettings(), getNumberSeriesMap().catch(() => ({}))]);
    const own = businessKey && map[businessKey];
    setShared(s);
    setSeriesMap(map);
    setScope(own ? 'own' : 'shared');
    setDraft(own ? { ...DEFAULT_NUMBER_SETTINGS, ...map[businessKey] } : s);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => {}); }, [businessKey]);

  // The last tax invoice number of the series being edited, for the preview
  // and the "are you sure" before jumping forward.
  useEffect(() => {
    const key = scope === 'own' ? counterKeyFor('INV', { own: true }, businessKey) : `counter_${override || 'INV'}`;
    fetch(`/api/meta/${encodeURIComponent(key)}`)
      .then((r) => r.json()).then((j) => setCounter(Number(j?.value) || 0)).catch(() => {});
  }, [scope, businessKey, override]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onSavingChange?.(saving); }, [saving, onSavingChange]);

  const change = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const pickScope = (next) => {
    if (next === scope) return;
    setScope(next);
    if (next === 'shared') setDraft(shared || { ...DEFAULT_NUMBER_SETTINGS });
    else setDraft(businessKey && seriesMap[businessKey]
      ? { ...DEFAULT_NUMBER_SETTINGS, ...seriesMap[businessKey] }
      // Short year by default: with its own prefix, a credit note such as
      // KS-CN/2026-27/0001 would pass the GST portal's 16 characters.
      : { ...(shared || DEFAULT_NUMBER_SETTINGS), brandPrefix: '', startNumber: 1, showFinYear: true, fyStyle: 'short' });
  };

  const preview = (typePrefix) => {
    const explicit = scope !== 'own' && typePrefix === 'INV' && !!override;
    const settings = draft.format === 'random' ? { ...draft, format: 'branded', showFinYear: false } : draft;
    const n = formatDocNumber({
      settings, typePrefix: explicit ? override : typePrefix, explicitPrefix: explicit,
      next: typePrefix === 'INV' ? nextCounterValue(counter, draft.startNumber) : 1, fyLabel: getFinancialYearLabel(),
    });
    return draft.format === 'random' ? n.replace(/[^/#-]+$/, 'A3X9K2') : n;
  };

  // GST allows invoice and credit-note numbers of 16 characters at most
  // (GSTR-1 refuses longer ones), so a format that makes them longer is
  // flagged as you type and cannot be saved.
  const lengthProblem = numberFormatProblem(draft, {
    nextInvoice: nextCounterValue(counter, draft.startNumber), own: scope === 'own',
    customPrefixes: getPrintSettings().customPrefixes, fyLabel: getFinancialYearLabel(),
  });

  const save = async () => {
    if (!shared) return false;
    let settings = { ...draft };
    if (settings.format === 'random') settings.startNumber = cleanStart(settings.startNumber); // field hidden
    else {
      const start = Number(settings.startNumber);
      if (!Number.isInteger(start) || start < 1 || start > MAX_START_NUMBER) {
        toast(`Start numbering from: a whole number from 1 to ${MAX_START_NUMBER}`, 'warning');
        return false;
      }
      settings.startNumber = start;
    }
    if (scope === 'own') {
      settings.brandPrefix = String(settings.brandPrefix || '').trim().toUpperCase();
      const problem = ownPrefixProblem(settings.brandPrefix, { shared, seriesMap, businessKey, customPrefixes: getPrintSettings().customPrefixes });
      if (problem) { toast(problem, 'warning'); return false; }
      // v1.10.85 - an old SO / DN prefix still saves, with a word of warning.
      const clash = prefixClashWarning(settings.brandPrefix);
      if (clash) toast(clash, 'warning', 12000);
    } else {
      // The shared prefix may not be one a business numbers with on its own.
      const brand = String(settings.brandPrefix || '').trim().toUpperCase();
      if (brand && Object.values(seriesMap).some((v) => String(v?.brandPrefix || '').trim().toUpperCase() === brand)) {
        toast(`A business already numbers with ${brand} on its own. Choose another shared prefix.`, 'warning');
        return false;
      }
    }
    if (lengthProblem) { toast(lengthProblem, 'warning', 9000); return false; }
    // Shared numbering used by more than one business: say who else it changes.
    if (scope === 'shared' && savedScope === 'shared' && sharingNames.length > 1
      && JSON.stringify(settings) !== JSON.stringify(shared)) {
      const ok = await confirmAction({
        title: `Change numbering for all ${sharingNames.length} businesses?`,
        message: `${sharingNames.join(', ')} all use the shared numbering, so this changes their invoice numbers too.\n\nTo change only ${businessName || 'this business'}, choose Cancel, then "Own numbering for this business".`,
        confirmLabel: 'Change for all', cancelLabel: 'Cancel',
      });
      if (!ok) return false;
    }
    if (savedScope === 'own' && scope === 'shared') {
      const ok = await confirmAction({
        title: 'Use the shared numbering?',
        message: `${businessName || 'This business'} will stop numbering on its own and continue the shared series. Invoices it has already made keep their numbers.`,
        confirmLabel: 'Yes, use shared', cancelLabel: 'No',
      });
      if (!ok) return false;
    }
    // Numbers never go back down, so moving the next tax invoice forward is
    // asked first (a typo like 10001 would otherwise stick).
    if (settings.format !== 'random') {
      const now = nextCounterValue(counter, scope === savedScope ? cleanStart(savedSettings?.startNumber) : 1);
      const then = nextCounterValue(counter, settings.startNumber);
      if (then > now) {
        const ok = await confirmAction({
          title: `Start tax invoices from ${then}?`,
          message: `Your next tax invoice will be number ${then} (it would have been ${now}). Numbers never go back down, so the ones skipped can't be used later.`,
          confirmLabel: `Yes, start from ${then}`, cancelLabel: 'No',
        });
        if (!ok) return false;
      }
    }
    setSaving(true);
    try {
      if (scope === 'own') {
        const map = { ...seriesMap, [businessKey]: settings };
        await saveNumberSeriesMap(map);
        setSeriesMap(map);
      } else {
        await saveInvoiceNumberSettings(settings);
        setShared(settings);
        if (savedScope === 'own') {
          const map = { ...seriesMap };
          delete map[businessKey];
          await saveNumberSeriesMap(map);
          setSeriesMap(map);
        }
      }
      setDraft(settings);
      toast('Invoice number settings saved!', 'success');
      return true;
    } catch {
      toast('Failed to save settings', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    setScope(savedScope);
    if (savedSettings) setDraft(savedSettings);
  };
  useImperativeHandle(ref, () => ({ save, discard }));

  const brand = String(draft.brandPrefix || '').trim();
  return (
    <>
      <h3 className="section-title mt-8"><Hash size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Invoice Number Format <HelpButton title="Invoice Number Format" doc="settings#invoice-numbers" size={16} style={{ marginLeft: 6 }} /></h3>
      {(showScope || savedScope === 'own') && (
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Numbering for {businessName || 'this business'} <HelpButton title="Shared or own numbering" doc="settings#own-numbering" size={16} style={{ marginLeft: 6 }} /></label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className={`type-chip ${scope === 'shared' ? 'type-chip-active' : ''}`} onClick={() => pickScope('shared')}>
              Shared numbering
            </button>
            <button type="button" className={`type-chip ${scope === 'own' ? 'type-chip-active' : ''}`} onClick={() => pickScope('own')}>
              Own numbering for this business
            </button>
          </div>
          <p className="field-hint">
            {scope === 'own'
              ? 'This business counts on its own, with its own prefix, so its invoice numbers never mix with another business\'s.'
              : (sharingNames.length > 1
                ? `Shared by ${sharingNames.join(', ')}: a change here changes all of their numbers. To keep ${businessName || 'this business'} separate, choose "Own numbering for this business".`
                : 'Shared by every business that has no numbering of its own.')}
          </p>
        </div>
      )}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Next tax invoice:</p>
        <p data-testid="inv-number-preview" style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)', margin: 0 }}>{preview('INV')}</p>
        {lengthProblem && (
          <p role="alert" style={{ fontSize: '0.8rem', color: 'var(--danger)', margin: '0.45rem 0 0' }}>{lengthProblem}</p>
        )}
        {brand && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
            Other documents count on their own: quotation {preview('QUO')}, delivery challan {preview('DC')}, credit note {preview('CN')}.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group full-width">
          <label className="form-label">Format Style</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { id: 'branded', label: 'Branded Sequential' },
              { id: 'sequential', label: 'Simple Sequential' },
              { id: 'random', label: 'Random' },
            ].map((f) => (
              <button key={f.id} type="button"
                className={`type-chip ${draft.format === f.id ? 'type-chip-active' : ''}`}
                onClick={() => setDraft((prev) => ({
                  ...prev, format: f.id,
                  ...(f.id === 'sequential' ? { showFinYear: false } : f.id === 'branded' ? { showFinYear: true } : {}),
                }))}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {scope === 'own' && (
          <div className="form-group">
            <label className="form-label" htmlFor="inv-own-prefix">Prefix for this business</label>
            <input id="inv-own-prefix" type="text" className="form-input" style={{ maxWidth: 180 }} value={draft.brandPrefix || ''} maxLength={10}
              placeholder="e.g. KS" onChange={(e) => change('brandPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            <p className="field-hint">Required, and different from every other business, such as its initials.</p>
          </div>
        )}
        {/* v1.10.78 (#93) - carry on from a paper bill book (e.g. 1001). */}
        {draft.format !== 'random' && (
          <div className="form-group">
            <label className="form-label" htmlFor="inv-start-number">Start numbering from</label>
            <input id="inv-start-number" type="number" min={1} max={MAX_START_NUMBER} step={1} className="form-input" style={{ maxWidth: 180 }}
              value={draft.startNumber ?? 1}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => change('startNumber', e.target.value === '' ? '' : Number(e.target.value))} />
            <p className="field-hint">For tax invoices: the next one gets this number (carry on from your paper bill book), or the next unused one if you have already gone past it. A number already used is never given again. Quotations, challans, credit notes and other types keep their own count.</p>
          </div>
        )}
      </div>

      {/* v1.10.36 - progressive disclosure: most businesses keep the defaults. */}
      <details style={{ marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
        <summary style={{ padding: '0.65rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ⚙ Customize {scope === 'own' ? '' : 'prefix, '}separator &amp; padding
          <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>
            (defaults are fine for most businesses)
          </span>
          <HelpButton title="Prefix, separator and padding" doc="settings#number-customize" size={16} style={{ marginLeft: 'auto' }} />
        </summary>
        <div className="grid grid-cols-2 gap-4" style={{ padding: '0.75rem 0.85rem 0.85rem' }}>
          {scope !== 'own' && (
            <div className="form-group">
              <label className="form-label">Brand Prefix</label>
              <input type="text" className="form-input" value={draft.brandPrefix || ''}
                onChange={(e) => change('brandPrefix', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. ACME, BK (leave empty for INV/QUO/EST/BOS/COMP/CN/DC)" maxLength={10} />
              <p className="field-hint">Your brand name or abbreviation. Tax invoices print it alone (ACME/...); other documents add their type (ACME-QUO/..., ACME-DC/...). Leave empty to use the type prefixes (INV, QUO, EST, BOS, COMP, CN, DC).</p>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Separator</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['/', '-', '#'].map((sep) => (
                <button key={sep} type="button"
                  className={`type-chip ${draft.separator === sep ? 'type-chip-active' : ''}`}
                  style={{ minWidth: 44, fontFamily: 'monospace', fontWeight: 700 }}
                  onClick={() => change('separator', sep)}>
                  {sep}
                </button>
              ))}
            </div>
          </div>
          {draft.format !== 'random' && (
            <>
              <div className="form-group">
                <label className="form-label">Include Financial Year</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap' }}>
                  <button type="button" className={`type-chip ${draft.showFinYear && draft.fyStyle !== 'short' ? 'type-chip-active' : ''}`}
                    onClick={() => setDraft((prev) => ({ ...prev, showFinYear: true, fyStyle: 'full' }))}>Yes ({getFinancialYearLabel()})</button>
                  <button type="button" className={`type-chip ${draft.showFinYear && draft.fyStyle === 'short' ? 'type-chip-active' : ''}`}
                    onClick={() => setDraft((prev) => ({ ...prev, showFinYear: true, fyStyle: 'short' }))}>Short ({getFinancialYearLabel().replace(/^\d\d(?=\d\d-)/, '')})</button>
                  <button type="button" className={`type-chip ${!draft.showFinYear ? 'type-chip-active' : ''}`}
                    onClick={() => change('showFinYear', false)}>No</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Number Padding</label>
                <select className="form-input" value={draft.padDigits} onChange={(e) => change('padDigits', Number(e.target.value))}>
                  <option value={3}>3 digits (001)</option>
                  <option value={4}>4 digits (0001)</option>
                  <option value={5}>5 digits (00001)</option>
                  <option value={6}>6 digits (000001)</option>
                </select>
              </div>
            </>
          )}
        </div>
      </details>
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Number Format'}
        </button>
      </div>
    </>
  );
});

export default InvoiceNumberSettings;
