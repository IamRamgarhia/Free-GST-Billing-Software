// v1.10.86 - Settings -> Appearance: App colour, Text size and Compact lists
// (utils/appLook.js). They change only the app's screens on this computer;
// invoices, PDFs and prints keep Print & PDF's own colour, font scale and
// row density. Each choice applies and is remembered at once (no Save).
import { useState } from 'react';
import { Check, RotateCcw, Moon } from 'lucide-react';
import HelpButton from './HelpButton';
import {
  APP_COLOURS, DEFAULT_COLOUR, getAppColour, setAppColour,
  TEXT_SIZES, getTextSize, setTextSize, getCompact, setCompact,
} from '../utils/appLook';
import { getMenuDots, setMenuDots } from '../store';

export default function AppearanceSettings() {
  const [colour, setColour] = useState(getAppColour);
  const [size, setSize] = useState(getTextSize);
  const [compact, setCompactState] = useState(getCompact);
  const [dots, setDots] = useState(getMenuDots);
  const preset = APP_COLOURS.some((c) => c.hex === colour);
  const changed = colour !== DEFAULT_COLOUR || size !== 'md' || compact;

  const pickColour = (hex) => setColour(setAppColour(hex));
  const resetAll = () => {
    setColour(setAppColour(DEFAULT_COLOUR));
    setSize(setTextSize('md'));
    setCompactState(setCompact(false));
  };

  return (
    <>
      <h3 className="section-title" style={{ marginTop: 0 }}>Appearance <HelpButton title="Appearance" doc="settings#appearance" size={16} style={{ marginLeft: 6 }} /></h3>
      <p className="page-subtitle" style={{ margin: '0 0 1rem', maxWidth: '72ch' }}>
        How the app looks on this computer. Your invoices, PDFs and prints do not change: their colour and size are in Print &amp; PDF.
      </p>

      <div className="look-row">
        <div className="look-row-label">
          <b id="look-colour">App colour</b>
          <span>Buttons, the open menu item, links and progress bars.</span>
        </div>
        <div className="colour-swatches" role="radiogroup" aria-labelledby="look-colour">
          {APP_COLOURS.map((c) => (
            <button key={c.hex} type="button" role="radio" aria-checked={colour === c.hex} aria-label={c.name} title={c.name}
              className={`colour-swatch${colour === c.hex ? ' on' : ''}`} style={{ background: c.hex }} onClick={() => pickColour(c.hex)}>
              {colour === c.hex && <Check size={16} strokeWidth={3} aria-hidden="true" />}
            </button>
          ))}
          <label className={`colour-swatch colour-swatch-custom${preset ? '' : ' on'}`} title="Your own colour"
            style={preset ? undefined : { background: colour }}>
            {!preset && <Check size={16} strokeWidth={3} aria-hidden="true" />}
            <input type="color" value={colour} aria-label="Your own colour" onChange={(e) => pickColour(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="look-row">
        <div className="look-row-label">
          <b id="look-size">Text size</b>
          <span>Makes everything on the screens bigger or smaller: menu, lists, forms and windows.</span>
        </div>
        <div className="seg" role="group" aria-labelledby="look-size">
          {TEXT_SIZES.map((t) => (
            <button key={t.id} type="button" className="btn btn-secondary" aria-pressed={size === t.id} onClick={() => setSize(setTextSize(t.id))}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="look-row">
        <label className="look-row-label" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={compact} onChange={(e) => setCompactState(setCompact(e.target.checked))}
            style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
          <span style={{ margin: 0 }}>
            <b style={{ color: 'var(--text)', fontSize: '0.92rem' }}>Compact lists</b>
            <span>Shorter rows in the Invoices, Purchases, Expenses and Products lists and smaller client cards, so more fit on the screen.</span>
          </span>
        </label>
      </div>

      {/* v1.10.86 - the red dots in the menu (utils/attention.js); the bell stays. */}
      <div className="look-row">
        <label className="look-row-label" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={dots} onChange={(e) => { setMenuDots(e.target.checked); setDots(e.target.checked); }}
            style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }} />
          <span style={{ margin: 0 }}>
            <b style={{ color: 'var(--text)', fontSize: '0.92rem' }}>Red dots in the menu</b>
            <span>A red dot on a menu item when something there needs you: overdue invoices, low stock, a GST return due, a recurring invoice, an update, or a screen with something new. Point at a dot to see why. The bell at the top keeps working when this is off.</span>
          </span>
        </label>
      </div>

      <div className="look-row">
        <div className="look-row-label">
          <b>Dark mode</b>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            The <Moon size={14} aria-label="moon" /> button at the top right of every screen switches it on and off.
          </span>
        </div>
      </div>

      {changed && (
        <div className="look-row">
          <button type="button" className="btn btn-secondary" onClick={resetAll}>
            <RotateCcw size={15} /> Back to the default look
          </button>
        </div>
      )}
    </>
  );
}
