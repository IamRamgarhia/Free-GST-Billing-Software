// v1.10.85 - the price-level boxes on three screens (see utils/priceLevels.js).
// Each is shown only while Settings -> Features -> Price levels is on.

const muted = { fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 };

// Settings -> Features, under the switch: the names of the (up to 3) levels.
export function PriceLevelNames({ names, onChange }) {
  const set = (i, v) => onChange(names.map((n, j) => (j === i ? v : n)));
  return (
    <div style={{ margin: '0.35rem 0 0 1.4rem' }}>
      <div style={muted}>Level names (leave one blank to use fewer):</div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
        {names.map((n, i) => (
          <input key={i} type="text" className="form-input" value={n} maxLength={30}
            aria-label={`Price level ${i + 1} name`} placeholder={`Level ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
            style={{ width: 110, fontSize: '0.78rem', padding: '0.3rem 0.45rem' }} />
        ))}
      </div>
    </div>
  );
}

// Product form: a price for each level, besides the selling price.
export function PriceLevelPrices({ levels, prices, onChange }) {
  if (!levels.length) return null;
  return (
    <div className="form-group" style={{ gridColumn: 'span 2' }}>
      <span className="form-label">Price for each level (optional)</span>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))`, gap: '0.5rem' }}>
        {levels.map((l) => (
          <label key={l.id} style={{ fontSize: '0.75rem' }}>
            {l.name}
            <input type="number" className="form-input" min="0" step="any" placeholder="Selling price"
              aria-label={`${l.name} price`} value={prices?.[l.id] ?? ''}
              onChange={(e) => onChange({ ...(prices || {}), [l.id]: e.target.value })} />
          </label>
        ))}
      </div>
      <span style={muted}>Blank = the selling price is used for clients on that level.</span>
    </div>
  );
}

// Client form: the level the client buys at.
export function PriceLevelSelect({ levels, value, onChange }) {
  if (!levels.length) return null;
  return (
    <div>
      <label htmlFor="client-price-level" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 3 }}>Price level</label>
      <select id="client-price-level" className="form-input" style={{ fontSize: '0.8rem', padding: '0.35rem' }}
        value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selling price (no level)</option>
        {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </div>
  );
}
