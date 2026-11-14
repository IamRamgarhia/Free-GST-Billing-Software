// v1.10.86 - a text box with the app's own suggestion list, in place of the
// browser's <datalist> (Edge and Chrome on Windows drew it as a black bar).
// Requested: "instead of this black bar give a proper white box like normal,
// and if things are more we can have a search at the top".
//
// Use it like an <input>: the same value / onChange / onKeyDown, any text can
// still be typed, plus `options` (strings, or { value, label } where the label
// is shown under the value). The list opens on a click or tap, on typing, or on
// the down arrow; Up / Down move, Enter picks, Esc closes, Tab moves on. More
// than 10 options get a search box at the top. The list is drawn on <body>
// (position: fixed), so a table or a window that scrolls cannot clip it, and
// opens above the box when there is no room below.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { filterOptions, isExactOption, normaliseOptions } from '../utils/combo';

const SEARCH_FROM = 11; // more than 10 options
// ponytail: a list stops at 200 lines; typing narrows it. Virtualise if a
// catalogue of thousands needs scrolling through.
const MAX_SHOWN = 200;
const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;

// Where the list goes: under the box, or above it near the bottom of the window.
function placeFor(el, rows, hasSearch) {
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const want = Math.min(320, rows * 38 + (hasSearch ? 50 : 0) + 12);
  const below = vh - r.bottom - 12, above = r.top - 12;
  // Above only when there is not even room for a few lines below.
  const up = below < Math.min(want, 240) && above > below;
  const width = Math.min(Math.max(r.width, 220), vw - 16);
  const left = Math.min(Math.max(8, r.left), vw - 8 - width);
  // The app is zoomed by Settings -> Appearance -> Text size (--ui-zoom on <html>,
  // zoom on #root); the list is outside #root, so it zooms itself the same way.
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const px = (n) => n / z;
  return {
    zoom: z === 1 ? undefined : z, left: px(left), width: px(width), maxHeight: px(Math.max(140, Math.min(320, up ? above : below))),
    ...(up ? { bottom: px(vh - r.top + 4) } : { top: px(r.bottom + 4) }),
  };
}

export default function ComboInput({ options, listId, listLabel = 'Suggestions', value, onChange, onKeyDown, onClick, ref, ...rest }) {
  const autoId = useId();
  const id = listId || `combo${autoId.replace(/:/g, '')}`;
  const inputRef = useRef(null);
  const popRef = useRef(null);
  const skipOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false); // opened by a click: every option, not just the matching ones
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);

  const all = useMemo(() => normaliseOptions(options), [options]);
  const hasSearch = all.length >= SEARCH_FROM;
  const text = String(value ?? '');
  const matches = useMemo(() => (search.trim() ? filterOptions(all, search) : showAll ? all : filterOptions(all, text)), [all, search, showAll, text]);
  // Typed in full: nothing more to suggest.
  const typedInFull = !showAll && !search.trim() && matches.length === 1 && matches[0].value.toLowerCase() === text.trim().toLowerCase();
  const shown = typedInFull ? [] : matches.slice(0, MAX_SHOWN);
  const visible = open && (shown.length > 0 || !!search.trim());

  const setRef = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  const close = () => { setOpen(false); setSearch(''); setActive(-1); };
  const openList = () => {
    if (rest.disabled || rest.readOnly || !all.length) return;
    // Every option when the box is empty, holds one of them, or matches none.
    setShowAll(!text.trim() || isExactOption(all, text) || !filterOptions(all, text).length);
    setSearch('');
    setActive(-1);
    setOpen(true);
  };

  // Puts the value in the box as if typed, so the field's own onChange runs.
  const pick = (v) => {
    const el = inputRef.current;
    if (!el) return;
    skipOpen.current = true;
    setNativeValue.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    skipOpen.current = false;
    close();
    el.focus();
  };

  useLayoutEffect(() => {
    if (!visible) return undefined;
    const place = () => {
      const p = inputRef.current && placeFor(inputRef.current, shown.length, hasSearch);
      if (p) setPos(p); else close();
    };
    place();
    const onScroll = (e) => { if (!popRef.current?.contains(e.target)) place(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shown.length, hasSearch]);

  // A click, tap or focus anywhere else closes the list.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (inputRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('focusin', away, true);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('focusin', away, true); };
  }, [open]);

  // On opening, a long list scrolls to the one in the box (shown in bold).
  const placed = !!pos;
  useEffect(() => {
    if (visible && placed) popRef.current?.querySelector('.combo-opt.is-current')?.scrollIntoView({ block: 'nearest' });
  }, [visible, placed]);

  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);

  // Up / Down / Enter / Esc, from the box or the search box. True when used.
  const listKeys = (e, fromSearch) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!visible) { openList(); return true; }
      const n = shown.length;
      if (n) setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
      return true;
    }
    if (e.key === 'Enter' && visible) {
      const i = active >= 0 ? active : fromSearch ? 0 : -1;
      if (i >= 0 && shown[i]) { e.preventDefault(); pick(shown[i].value); return true; }
      if (fromSearch) { e.preventDefault(); return true; }
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation(); // only the list closes, not the window it is in
      close();
      if (fromSearch) inputRef.current?.focus();
      return true;
    }
    if (e.key === 'Tab' && fromSearch) { close(); inputRef.current?.focus(); }
    return false;
  };

  const activeId = visible && active >= 0 && shown[active] ? `${id}-${active}` : undefined;

  return (
    <>
      <input
        autoComplete="off"
        {...rest}
        ref={setRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        aria-activedescendant={activeId}
        data-list={listId}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          if (skipOpen.current || !all.length) return;
          setShowAll(false); setSearch(''); setActive(-1); setOpen(true);
        }}
        onClick={(e) => { onClick?.(e); if (!open) openList(); }}
        onKeyDown={(e) => { if (!listKeys(e, false)) onKeyDown?.(e); }}
      />
      {visible && pos && createPortal(
        <div ref={popRef} className="combo-pop" style={pos}
          // Clicking the list keeps the typing in the box (the search box takes its own clicks).
          onMouseDown={(e) => { if (!e.target.closest('.combo-search')) e.preventDefault(); }}>
          {hasSearch && (
            <label className="combo-search">
              <Search size={15} aria-hidden="true" />
              <input type="text" value={search} placeholder="Search the list" aria-label="Search the list" autoComplete="off"
                aria-controls={id} aria-activedescendant={activeId}
                onChange={(e) => { setSearch(e.target.value); setActive(e.target.value.trim() ? 0 : -1); }}
                onKeyDown={(e) => listKeys(e, true)} />
            </label>
          )}
          {shown.length ? (
            <ul id={id} role="listbox" aria-label={listLabel} className="combo-list">
              {shown.map((o, i) => (
                <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={i === active} data-value={o.value}
                  className={`combo-opt${i === active ? ' is-active' : ''}${o.value === text.trim() ? ' is-current' : ''}`}
                  onMouseMove={() => { if (i !== active) setActive(i); }}
                  onClick={() => pick(o.value)}>
                  <span className="combo-opt-value">{o.value}</span>
                  {o.label && <span className="combo-opt-label">{o.label}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="combo-empty">Nothing in the list matches. You can still type your own.</div>
          )}
          {matches.length > shown.length && <div className="combo-more">Showing {shown.length} of {matches.length}. Type to narrow the list.</div>}
        </div>,
        document.body,
      )}
    </>
  );
}
