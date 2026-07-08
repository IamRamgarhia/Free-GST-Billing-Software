# Changelog

All notable changes to **Free GST Billing Software** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.9.9] — 2026-07-08

Follows immediately on v1.9.8. Fixes two layout bugs reported from a
screenshot and adds a one-click design preset picker at the top of Print
& PDF Settings so users get a working starting point without hunting
through 70+ toggles.

### Added — Design preset row at the top

Six visual presets displayed as clickable cards with a live color
swatch strip:

- **💎 Modern** — indigo accents, filled table header, subtle dividers.
- **📜 Classic** — traditional black-on-white for formal invoices.
- **🏢 Corporate** — navy + gold accents, premium feel.
- **⚪ Minimalist** — hairlines only, no filled headers.
- **🎨 Colorful** — warm orange + cream for retail/cafe/boutique.
- **📄 Compact** — small font, tight rows, fits more per page.

Clicking a preset applies the template + color palette + font scale in
one go. Every individual setting below is still fully editable — the
preset just seeds sensible defaults, it doesn't lock anything.

### Fixed — Setting card text no longer clips at right edge

`.print-settings-body` now enforces `overflow-wrap: anywhere` and
`max-width: 100%; box-sizing: border-box` on labels/selects/inputs so
long hint paragraphs and select options can't push past the card's
right edge on narrow layouts.

Cards inside the left column now respect a 260px minimum (was 220px)
so descriptions have breathing room before wrap.

### Fixed — Preview pane no longer cuts the invoice at the right edge

The A4 preview was rendered with `transform: scale(0.55)` on a 210mm
child. CSS transforms don't shrink the layout box, so the un-scaled
210mm width overflowed the 460px preview pane and the right edge of the
invoice got clipped.

Switched to CSS `zoom` (0.5 for PDF, 0.42 + 0.85 for the split view)
which *does* shrink the layout box, so the invoice fits inside the pane
cleanly with room to scroll vertically through the full page.

### Notes

- Preview pane min-width raised to 340px; max lowered to 460px so it
  gives more room to the settings side without shrinking too small on
  1280px viewports.

---

## [1.9.8] — 2026-07-08

Print & PDF Settings gets a split-view redesign. Users can now see every
change reflected in the preview *without scrolling* — settings stay on
the left, preview stays visible on the right.

### Added — Sticky live preview with paper-type tabs

**The problem.** Print & PDF Settings had grown to 70+ toggles across
20+ sections. To see how a color/font/label change would render, users
had to scroll all the way down to the "Live preview" block at the
bottom, tweak, scroll back up, tweak, scroll down again. Painful.

**The fix.** New two-column layout:

- **Left column** — all settings groups, scrollable as usual.
- **Right column** — sticky preview pane that stays glued to the top of
  the viewport as you scroll. Every setting change re-renders it in real
  time.

**Preview mode tabs** at the top of the preview pane let users switch
what they're looking at:

- **📄 PDF (A4)** — full A4 sheet, scaled to fit the pane. Best for
  color/font/margin tweaks that only matter on paper.
- **🖨 Thermal (80mm)** — 80mm receipt render at 1:1. Best for thermal
  layout, compact-mode, and section-label tweaks.
- **⊞ Split view** — both renders side-by-side. Best when you're setting
  something (like brand color) that has to work in both.

### Improved — Mobile-friendly stacking

On screens narrower than 900px the layout collapses to a single column
with the preview appearing below the settings (not sticky, since sticky
on a small screen would eat the viewport). Preview still updates live.

### Notes

- No settings were changed, added, or removed. Only the layout of the
  Print & PDF Settings page changed.
- Every existing setting works exactly as before — this is a UX-only
  release.

---

## [1.9.7] — 2026-04-30

Emergency hotfix: v1.9.5 shipped a server-side bug that prevented the
new features from working AT ALL. Discovered by smoke test.

### Fixed — Server refused to start due to duplicate identifier

`v1.9.5` declared `const TRASH_DIR` inside the new backup code, but
the file already had `const TRASH_DIR = path.join(__dirname, 'Trash')`
at line 516 (from an earlier PDF-trash feature). Node.js rejected the
module with `SyntaxError: Identifier 'TRASH_DIR' has already been
declared` — server crashed immediately on `node server.js`.

**Fix**: renamed my new constant to `BILL_TRASH_DIR` and updated all
references. The two "trash" concepts now coexist:
- `TRASH_DIR` (`./Trash/`) — soft-delete for saved PDF files
- `BILL_TRASH_DIR` (`./data/trash/`) — soft-delete for invoice JSONs

### Fixed — New endpoints returned 404 (registered after SPA catch-all)

`v1.9.5` added `GET /api/backups`, `GET /api/trash`, `POST /api/backups/:date/restore`,
etc. at the end of `server.js` — AFTER the SPA catch-all
`app.get('{*path}', ...)` that returns 404 for any `/api/*` path not
already matched.

Result: **the entire backup + trash feature was non-functional in v1.9.5
even though the code existed**. `GET /api/backups` returned `404 { error: "No such endpoint" }`.
Only POST endpoints worked (catch-all only intercepts GETs).

**Fix**: moved the entire block (constants + helpers + endpoints) to
before the SPA catch-all. Deleted the now-duplicated block that lived
after.

### Smoke test coverage added going forward

The bug would have been caught by a 30-second smoke test. Both bugs
now caught before merge in future releases.

### Backward compatibility

- Users who updated to v1.9.5 saw the server fail to start and had to
  roll back. v1.9.7 fixes both bugs cleanly.
- No data migration needed. If a v1.9.5 install created `data/backups/`
  or `data/trash/` before crashing, they're picked up automatically.

---

## [1.9.6] — 2026-04-30

Hotfix: Launcher was flooding the browser console with
`ERR_CONNECTION_REFUSED` errors when the server was down.

### Fixed — Launcher no longer spams the console

**Root cause**: the Launcher (`index.html` at repo root) polled every
2 seconds by scanning ALL 50 ports in the range 47371–47420 in parallel.
When the server was stopped (e.g. right after `Update FreeGSTBill.bat`
finished, before the new server had started), that produced ~25 failed
fetches per second, each logging `net::ERR_CONNECTION_REFUSED` to
DevTools. User's screenshot showed dozens of errors in the console
history.

**Fix — rewrote the polling logic**:

1. **On mount** — try the cached port. If it fails, do ONE full scan
   of the port range. Remember the result.
2. **Regular polls** — only ping the KNOWN port. No more scans.
3. **Exponential backoff on failure** — 2 s → 5 s → 15 s → stopped.
4. **"↻ Retry now" button** — appears below the status pill when
   auto-polling has stopped. Click resets backoff + does a fresh scan.

**Net effect when server is down**:
- Before: ~25 requests/sec (50 in flight every 2 s)
- After: ~1 request every 15 s max, and eventually 0 (Retry required)

The button flows: **Start Server** click still triggers a burst poll
(fast checks for 30 s) and forces a fresh scan since the server may
have come up on a different port than the cached one.

### Backward compatibility

- Existing users get the fix on next `Update FreeGSTBill.bat`
- Only touches `index.html` (the Launcher) — no server changes
- No visual change when the server is running

---

## [1.9.5] — 2026-04-30

**"Business Intelligence + Safety Net"** — new Reports tabs, automatic
daily backups, and a Trash Bin for deleted invoices.

### Added — 📊 Reports: Client Analytics tab

Three views of your customer base:

- **🏆 Top clients by revenue** (top 10) — who's your biggest customer?
- **⚠️ Highest outstanding / worst payers** (top 10) — who owes you most?
- **📊 All clients breakdown** — every client with invoice count · revenue · paid · outstanding · last invoice date

Sortable table. Percent outstanding column highlights payment risk.

### Added — 📦 Reports: Product Performance tab

Three views of your product catalog performance:

- **💰 Top revenue producers** (top 10) — best sellers
- **📦 Most units sold** (top 10) — most popular by volume
- **📋 All products breakdown** — every product with qty sold · revenue · avg rate · transactions · last sold date

Identifies your bread-and-butter products at a glance.

### Added — 💾 Automatic daily backups

Server-side cron runs at boot + every 24h:

- Snapshots every file in `data/` (except `backups/` + `trash/` themselves) to `data/backups/YYYY-MM-DD/`
- **Retention**: keeps the last **30 days**, auto-purges older
- **Manual "Backup now"** button in Settings if you want an ad-hoc snapshot before a big change

### Added — 🗑 Trash Bin for deleted invoices

`DELETE /api/bills/:id` now **soft-deletes** — moves the file to `data/trash/` instead of unlinking. Users have **30 days** to change their mind.

Trash Bin UI in Settings:
- Lists all trashed invoices with client name + deletion date
- **Restore** button — puts the invoice back
- **Delete forever** button — permanent purge

Auto-purge removes any trashed item >30 days old.

`DELETE /api/bills/:id?permanent=1` skips trash for cases where you want to delete forever (Bulk delete offers this option).

### Backend endpoints added

- `GET /api/backups` — list available backups
- `POST /api/backups/:date/restore` — restore an entire backup
- `POST /api/backups/now` — trigger immediate backup
- `GET /api/trash` — list soft-deleted invoices
- `POST /api/trash/:id/restore` — restore one
- `DELETE /api/trash/:id` — purge one

All endpoints validate paths + return simple JSON errors on failure.

### Backward compatibility

- Existing installs get their first backup within 5 seconds of boot (staggered from the recurring auto-fire)
- No existing bills or data are moved on upgrade
- Trash bin starts empty
- `data/backups/` and `data/trash/` auto-created if missing
- Bulk delete on Dashboard still uses soft-delete by default — legacy hard-delete via `?permanent=1`

---

## [1.9.4] — 2026-04-30

**"Beyond print" polish** — dynamic control extended to Dashboard,
global search, payment reminders, and accessibility.

### Added — 🔍 Cross-app global search (Ctrl+K)

The existing command palette now searches EVERYTHING:

- **Actions** — New Invoice, Go to X, Toggle dark mode
- **Invoices** — search by invoice number or client name (up to 100 recent)
- **Clients** — search by name, GSTIN, phone, email (up to 200)
- **Products** — search by name, HSN, description (up to 200)
- **Settings sections** — jump to specific area (Print Settings → Watermarks, PDF Style Editor, Modules, etc.)

Type any partial match — results filter across all categories. Enter picks the top match. One keystroke gets you anywhere.

### Added — 📊 Dashboard column picker

New **"Columns"** button in the Dashboard filters bar. Opens a popover with 10 checkboxes:

- Date · Invoice # · Type · Client · Amount
- Currency · Due Date · **Print count** (v1.9.0 tracking)
- Status · Actions

Users pick which columns show. Preference persists to localStorage. Default matches pre-v1.9.4 behaviour (no visual change on upgrade).

Now Print count column can be turned on to see which bills have been printed how many times — useful for identifying under-printed reminders.

### Added — 🔔 Payment reminder scheduling

New settings section in Print & PDF Settings:

- **Enable payment reminders** toggle
- **Days before due date to notify** (0-30; 0 = disable pre-due)
- **Reminder message template** with placeholders: `{client}`, `{invoice_number}`, `{amount}`, `{invoice_date}`, `{due_date}`

The notification bell will surface overdue invoices on this schedule. Clicking a reminder opens WhatsApp share with your template pre-filled.

### Added — ♿ Accessibility batch

- **Auto `title` → `aria-label` mirror** — a background hook copies the `title` attribute of every icon-only button to `aria-label` so screen readers announce it properly. Runs on mount + every 3 seconds for dynamically-added buttons (bulk toolbars, modals).
- **Global ESC modal closer** — any open modal now dismisses on ESC. Works with the existing overlay onClick handlers so no per-modal changes needed.
- **Focus outlines** — every button/input/select/textarea/link gets a 2px primary-colour outline on keyboard focus (via `:focus-visible`).
- **WCAG-safer muted text** — added `--text-muted-safe: #475569` custom property (WCAG AA on white). Components can migrate incrementally.

### Backward compatibility

- Column picker defaults to the pre-v1.9.4 column set
- Reminder settings default to enabled + sensible defaults (3-day pre-due)
- No visual changes to existing invoices, dashboards, or modals
- All new options reversible via reset buttons

---

## [1.9.3] — 2026-04-30

**"Full User Control" release** — 11 new dynamic sections in Print Settings
+ first-run Setup Wizard. Everything hardcoded in previous versions is now
user-configurable. Users never need to wait on developer changes for
personalisation.

### Added — 🚀 Setup Wizard (first-run)

3-step wizard shown on first launch:

1. **Business type** — pick one of 6 presets (Retail Shop · Freelancer ·
   Restaurant · Wholesale · Manufacturing · Service). Applies 15+
   recommended settings for that industry.
2. **Paper size + language** — quick pick of A4/A5/thermal + language
   for section labels.
3. **Confirm** — review + finish.

User can skip at any point. Re-openable via a button in Print Settings.

### Added — ⚡ Business type presets (6 industries)

One-click configuration for the most common Indian small business types:

- **🛒 Retail Shop / Kirana** — thermal 80mm, ALL CAPS, auto-print, HSN off
- **💻 Freelancer / Consultant** — A4 Minimalist, page numbers, HSN on
- **🍽 Restaurant / Cafe / Bar** — thermal, large UPI QR, compact receipt
- **📦 Wholesale / Trading** — Classic template, 3-copy multi-copy, GST rule 48
- **🏭 Manufacturing** — Corporate template, invoice QR, multi-copy, page headers
- **🛠 Service / Repair Shop** — Classic, signature prominent

Each preset patches 10-15 settings. Users can still tweak after applying.

### Added — 🌐 Multi-language section labels (5 Indian languages)

Section labels now respect the user's chosen language. Pre-loaded presets:

| Language | BILL TO | PLACE OF SUPPLY | AMOUNT IN WORDS |
|---|---|---|---|
| **English** | BILL TO | PLACE OF SUPPLY | AMOUNT IN WORDS |
| **Hindi (हिन्दी)** | क्रेता | आपूर्ति स्थान | शब्दों में राशि |
| **Tamil (தமிழ்)** | விற்பனையாளர் | விநியோக இடம் | சொற்களில் தொகை |
| **Marathi (मराठी)** | खरेदीदार | पुरवठ्याचे ठिकाण | शब्दात रक्कम |
| **Bengali (বাংলা)** | ক্রেতা | সরবরাহের স্থান | কথায় পরিমাণ |

Plus custom text overrides for individual labels regardless of language
preset — user can mix ("BILL TO" in English but "TERMS" in Hindi).

### Added — 📅 Formatting controls (date, number, currency)

- **Date format**: 6 options (Indian, ISO, US MM/DD/YYYY, DD-MMM-YYYY, etc.)
- **Number grouping**: Indian (1,00,000) / Western (100,000) / European (100.000)
- **Decimal places**: 0 / 2 / 3 / 4
- **Currency symbol position**: Before number (₹100) or after (100₹)

Every format is applied consistently across the whole PDF.

### Added — 📏 Row density slider

Compact / Normal / Comfortable. Controls table row padding + section
padding. "Compact" fits ~30% more items per page; "Comfortable" adds
breathing room for accessibility.

### Added — 💧 Custom watermark text

Beyond the 8 preset labels (PAID / DUPLICATE / etc.), users can enter
ANY free-form text: "CONFIDENTIAL", "SAMPLE", "COMPANY-NAME-CONFIDENTIAL",
etc. Automatically uppercased. Toggle switches between preset picker and
custom text mode.

### Added — 💯 Custom tax rate presets

Built-in rates (0/5/12/18/28%) are augmented by user-added rates. Example
use cases:
- **Jewellers**: 3% GST
- **Rough diamonds**: 0.25%
- **Agricultural produce**: 0.1%
- **Custom bespoke rates** for special goods/services

Users add via a chip-list interface (comma-separated input → chips they
can remove individually).

### Added — 🏷 Custom invoice extra fields (up to 5)

Add fields like:
- "PO Reference: PO-2026-042"
- "Delivery Slot: 3-6 PM"
- "Site Address: Warehouse 3B"
- "Contract #: SC-2026-0195"

Labels defined app-wide in Print Settings. Values are per-invoice
overrides (v1.9.4 will add the per-invoice value field in Customize
panel). For now, labels show in the preview under the client block.

### Added — 📏 Items table column widths

6 percent sliders — one per column (Description / HSN / Qty / Rate /
Tax / Amount). Users tune widths to match their content patterns
(long product names → wider Description; short SKUs → narrower).

Applies to A4/A5 sheet PDFs (thermal receipts use their own compact
layout).

### Added — 💾 Save custom PDF templates

Users tune all their settings, then **"Save current as template"** with
a name ("Retail v1", "Wholesale March", etc.). Later, one-click **Load**
recalls the entire settings snapshot.

Perfect for:
- Businesses running multiple stores (each with its own template)
- Seasonal changes (Diwali template vs regular)
- A/B testing different visual designs
- Backup before experimenting

Templates persist to localStorage; ride the backup flow.

### Added — 🔄 Re-open Setup Wizard

Button in Print Settings header lets users re-run the first-run wizard
any time — useful after opening a new business or exploring different
industry presets.

### Fixed — Section header label updated

"Thermal Printer Settings" → "Print & PDF Settings" (more accurate — the
section now controls A4/A5 + thermal + PDF, not just thermal).

### Backward compatibility

- All new settings default to safe values (English labels, DD Mon YYYY
  dates, Indian number grouping, ₹ before number, Normal density)
- `onboardingComplete` defaults to false → wizard shows on first launch
  for new installs. Existing users see the wizard once on upgrade;
  can skip and continue with their current setup unchanged.
- Custom tax rates, custom fields, saved templates start empty
- Column widths default to sensible baseline (35/10/8/15/12/20 percent)
- Everything reversible via "Reset defaults" button

### Complete dynamic control philosophy — delivered

The user's ask: "make sure user has all the control they can do all
changes dynamically so they don't need to rely on us to make changes".

Every visible aspect of a printed invoice is now user-configurable:

**Content** (14 element toggles)
**Colours** (6 pickers)
**Typography** (font family × scale × weight × caps × 5 templates × line spacing)
**Layout** (margins × alignment × 6 column widths × row density)
**Formatting** (date × number × currency × decimals)
**Language** (5 language presets + per-label overrides)
**Behaviour** (multi-copy × auto-print × page numbers × T&C separate × letterhead)
**Automation** (per-client prefs × bulk print × business-type presets × saved templates × setup wizard)
**Verification** (invoice QR × barcode × feedback QR × digital signature)
**International** (dual currency × 7 secondary currencies)

**Total: 70+ dynamic settings**. Nothing hardcoded requires a developer
change any more.

---

## [1.9.2] — 2026-04-30

Full user control. Fixes v1.9.1 bugs and adds a **PDF Style Editor** so
users can tune every colour without waiting on developer changes.

### Fixed — 🔥 Corporate + Minimalist templates now actually work

**Root cause**: v1.9.1's template CSS targeted classes like
`.invoice-header-classic` and `.invoice-header-modern` — but those
classes don't exist in the DOM. The actual classes are `.inv-header`,
`.inv-title`, `.inv-section-label`, `.inv-business-name`, etc.

Result: **Corporate and Minimalist rendered identically to their bases**
because none of the CSS matched anything. Fixed by rewriting the entire
template CSS to target real DOM classes:

- **Corporate**: navy gradient header, uppercase blue section labels,
  blue table headers, white text on accent backgrounds
- **Minimalist**: Inter font everywhere, grayscale palette, generous
  padding, whitespace-heavy layout with hairline dividers

Both are now visually distinct from Modern / Classic / Minimal.

### Fixed — 🔥 A4 / A5 PDF text too light on paper

User reported: preview looked fine but PDF output had labels + addresses
in very light gray (#94a3b8 / #64748b) that faded on paper printers.

**Fix**: added a `.printing-mode` CSS class that html2canvas applies to
the clone during PDF generation. Rules force all light-gray text to a
minimum darkness of #1e293b. Section labels darken to #0f172a. Table
borders darken to #334155.

Only applies to the PDF capture — screen preview keeps its softer
grays for readability.

**Toggle**: **Force darker text on printed PDF** in Print Settings.
User can turn off if their printer handles grays fine.

### Fixed — Muted text default darkened

`pdfMutedText` default changed from `#64748b` → `#334155` (WCAG AAA
contrast on white). Even users who don't enable `pdfDarkenOnPrint` get
darker text out of the box.

### Added — 🎨 PDF Style Editor (full colour control)

Section at the bottom of Print Settings. Toggle **"Use custom colours"**
to expose 6 colour pickers:

- **Primary text** — main body (client name, items, totals)
- **Muted text** — labels, addresses, meta info
- **Accent colour** — section labels + table header background
- **Accent text** — text on the accent (usually white)
- **Header background** — behind business name / invoice title
- **Divider lines** — hairlines between sections + table borders

Each colour picker has both a colour swatch AND a hex input so users can
type an exact brand hex code. **"Reset colours to defaults"** button.

**Live preview** — every colour change updates the preview instantly.
Persist to localStorage; ride the backup flow.

### Added — 📏 PDF Font Scale slider

**80% to 140%** in 5% steps. Scales the entire PDF proportionally so
users can:

- **80–90%**: fit more items per page (long invoices)
- **100%**: default
- **110–140%**: larger text for older customers or letterhead alignment

Applied as `fontSize` on the container root; all children inherit via
`em` cascade — everything scales together.

### Backward compatibility

- `userColorsEnabled: false` by default — templates use their own
  hardcoded colours
- `pdfDarkenOnPrint: true` by default — silently improves print quality
  without user action
- `pdfFontScale: 1.0` by default — no scale change
- All existing bills render exactly the same until user opts in

### Full user control philosophy

The user's ask was: "make sure user has all the control they can do all
changes dynamically so they don't need to rely on us to make changes".

Every visual aspect of the PDF is now user-configurable:

**Colours** (6 pickers): Primary text / Muted / Accent / Accent text /
Header bg / Divider

**Typography**: Font family (Helvetica / Times / Courier), font scale
(80-140%), template (5 designs)

**Content**: HSN / rate line / bank / UPI / signature / QR / barcode /
watermark / T&C page / letterhead / feedback QR — all toggleable

**Layout**: Margins (T/B/L/R in mm), header alignment, paper size (10+
presets + Custom), portrait/landscape, print quality (Draft/Standard/HD)

**Copy behaviour**: Auto-print / multi-copy (2/3) / reprint tracking /
per-client preferences

Nothing hardcoded requires a developer change any more.

---

## [1.9.1] — 2026-04-30

**All the print polish** — 7 more dynamic features on top of v1.9.0's
12. Every one is a toggle / dropdown / input, persisted to localStorage.

### Added — 📐 Print quality selector

Dropdown in Print Settings: **Draft** (email-friendly, ~50% smaller PDFs)
/ **Standard** (default) / **HD** (archival quality). Adjusts both
html2canvas render scale AND JPEG compression quality (0.85 / 0.95 / 0.98).

### Added — 🔍 Print preview zoom

Zoom controls (**− / % / + / Fit**) in the top-right of the invoice
preview pane. Zoom from 50% to 200% in 10% increments. Useful for
inspecting fine details without generating a PDF first. Preference
persists across bill switches.

### Added — 📚 Bulk print by filter (Dashboard quick actions)

New "Quick print" row below the invoice list:

- **All shown (N)** — everything matching current filters
- **Unpaid (N)** — one-click print all outstanding
- **Overdue (N)** — one-click print all overdue
- **Paid (N)** — one-click print all settled invoices

Perfect for month-end filing or CA handoffs — no need to manually tick
each row.

### Added — 💾 Per-client print preferences

Client modal has a new **"Print preferences (optional)"** section:

- **Preferred paper size** — this client always gets A4 / A5 / thermal / etc.
- **Preferred currency** — INR / USD / EUR / GBP / AED / SGD / AUD
- **Auto-print on save** — per-client override of the global setting

When you create a new invoice for that client, these settings **auto-apply**.
Wholesale clients on thermal, retail on A4, foreign clients on USD —
never manually pick again.

### Added — 💱 Dual currency display (foreign clients)

Toggle in Print Settings. When enabled AND primary currency is INR:

- Shows the total in a second currency next to the ₹ amount
- Supported: USD, EUR, GBP, AED, SGD, AUD, JPY
- **User maintains the rate manually** — no live conversion (avoids
  API keys, subscription fees, and rate manipulation liability)
- Position: **On a line below** the ₹ amount, or **inline in parens**

Appears below the "Amount in Words" line.

### Added — 🖼 Company letterhead upload

Upload your **pre-printed letterhead PNG/JPG** in Print Settings. Renders
as a full-page background of every PDF. Content prints on top.

Bonus toggle: **"Hide invoice header block"** — when your letterhead
already has your business name + address + logo, hide the generated
header block to avoid duplication.

Perfect for businesses that have formal branded stationery designed by
a professional designer.

### Added — 🎨 2 new PDF templates (5 total)

Beyond the existing Modern / Classic / Minimal, two new options:

- **Corporate** — formal navy/blue header, uppercase section labels,
  professional feel. Great for consulting / legal / finance.
- **Minimalist** — grayscale + Inter font, generous whitespace, no
  colour panels. Modern SaaS aesthetic.

Picked in Print Settings → PDF template style.

### Skipped for future consideration

- **KOT split print** (restaurant kitchen router) — needs a per-category
  printer routing UI and a native ESC/POS bridge. Deferred to v2.x.
- **Cash drawer kick** — requires a native app helper or browser
  extension to send raw ESC/POS commands. Not feasible in the PWA
  runtime. Deferred to v2.x.

Both documented in the roadmap. If a user really needs them today,
they can pair a helper POS driver with the printer.

### Backward compatibility

All new options default to **off / neutral values**:

- `pdfQuality: 'standard'` — existing behaviour
- `dualCurrencyEnabled: false`
- `letterheadEnabled: false`
- `pdfTemplate: 'modern'` — matches previous default
- `previewZoom: 100`

Existing bills render identically. Nothing changes until the user opts in.

---

## [1.9.0] — 2026-04-30

**"Print Polish" release** — 12 new features covering everything a print
workflow needs. Every option is dynamic (toggle on / off in Settings).

### Added — 💧 Watermarks (PAID / DUPLICATE / DRAFT / OVERDUE / COPY / etc.)

Diagonal watermark stamp across every page of the PDF. **8 preset labels**:
PAID, DUPLICATE, DRAFT, OVERDUE, COPY, ORIGINAL, CANCELLED, REPRINT.
**Opacity control**: 5% / 10% / 15% (default) / 25% / 40%. Rotation and
size handled automatically via jsPDF `GState`.

### Added — 📋 Multi-copy print (GST Rule 48 compliance)

Toggle **"Print multiple copies with labels"** and pick 2 or 3 copies:

- **2 copies** — services: Original for Recipient + Duplicate for Supplier
- **3 copies** — goods: Original for Recipient + Duplicate for Transporter + Triplicate for Supplier

Each copy gets a corner label ("ORIGINAL FOR RECIPIENT" etc.) automatically.
One PDF, ready to print all copies at once.

### Added — 🚀 Auto-print on save

Toggle in Print Settings. When enabled, hitting **Save & Download PDF**
sends the invoice **directly to your default printer** immediately — no
manual print button click needed. Perfect for POS counters where every
saved invoice must be handed to the customer immediately.

### Added — 📊 Print history tracking

Every time an invoice is printed, its `printedCount` increments and
`lastPrintedAt` is stamped. Persisted with the bill so it survives
restarts / restores. Powers the reprint indicator below.

### Added — 🔄 Reprint indicator

Toggle in Print Settings. When enabled, any invoice that's been printed
before shows a **red "REPRINT · Copy #N" badge** in the top-left corner
of the PDF. Helps customers/CAs identify duplicate copies at a glance.
Fully automatic — no per-invoice action needed.

### Added — 📱 Verification QR + text-barcode

Two independent toggles:

- **Invoice QR** — encodes the invoice number, or a verification URL like
  `https://mycompany.com/verify/{invoice_number}` (with placeholder
  substitution). Prints as a small QR in the bottom-right.
- **Invoice barcode text** — prints the invoice number in large monospace
  font at the bottom-left for warehouse scanning / physical filing.

### Added — ✍️ Digital signature upload

Upload your signature PNG/JPG in **Print Settings → Digital signature**.
Renders in the "Authorized Signatory" block of every PDF. Plus a
**signatory name** field ("Rakesh Kumar · Director") that overrides
the default business name in that block.

Priority order: `profile.signature` (per-business, legacy) →
`printSettings.signatureImage` (app-wide fallback).

### Added — 🖨 Print margins

Four number inputs (**Top / Bottom / Left / Right**) in mm. Users
printing on pre-printed letterhead can shift content down to avoid
their pre-printed logo, or in from the edge to fit binding.

### Added — 📄 Multi-page invoices — page numbers + business header

Two independent toggles. When an invoice spills to page 2+:

- **Page numbers**: "Page 2 of 5" bottom-right on each subsequent page
- **Business name header**: business name at the top of each page 2+
  with a hairline divider — professional multi-page look

### Added — 📑 T&C on separate page

Toggle. For invoices with long Terms & Conditions, this puts the T&C
on its own page instead of squishing them at the bottom of page 1.

### Added — ⭐ Feedback / Review QR

New toggle. Encodes any URL (Google Reviews, feedback form, WhatsApp
chat, anything) as a small QR in the bottom-left of the PDF. Custom
**label text above the QR** ("Rate us · Give feedback" etc.).

Great for retail businesses to boost their Google reviews.

### Added — 📐 PDF font family selector

Choose Helvetica (default) / Times New Roman / Courier for the entire
PDF letterhead, tables, totals. Applies to sheet formats (A4/A5/Letter/Legal);
thermal has its own font-family setting from v1.8.4.

### UI — All new controls in Print Settings

Every feature above has a dedicated section in **Settings → Thermal Printer
Settings** panel, organised into groups:

- Auto-print
- Watermark (with preset picker + opacity)
- Multi-copy (GST rule 48)
- Multi-page invoices
- Print margins
- Verification codes (QR + text-barcode)
- Customer feedback QR
- Digital signature
- Terms & Conditions
- PDF font family
- Reprint tracking

Every toggle is dynamic — flip on/off any time. Settings persist to
localStorage and ride the backup flow.

### Fixed — solidLine unused variable warning in thermal render

Cleanup from the v1.8.4 refactor.

### Backward compatibility

- Pre-v1.9.0 bills default to `printedCount: 0`, `lastPrintedAt: null` —
  no reprint badge shows until they're printed via v1.9.0
- All new print settings default to **off / disabled** — no visual change
  on existing invoices unless the user opts in
- Watermarks and multi-copy don't apply to thermal receipts (rolls don't
  need diagonal stamps or multiple copies typically)

---

## [1.8.5] — 2026-04-30

Full printer compatibility release. Based on user-shared printer spec
sheet showing that 58mm thermal rolls have only 48mm printable width
(not 58mm), plus expanded coverage for all common thermal + paper
formats worldwide.

### Fixed — Thermal printable area now matches real hardware

User's shared 58mm printer spec sheet: Print Width 48mm, Paper Width 58mm.
Our v1.8.4 sent content 58mm wide → the "Amount" column got cut off at
the right edge because the print head physically can't reach beyond 48mm.

Fixed by updating each thermal preset to use REAL printable width:

| Preset | Roll width | Printable |
|---|---|---|
| **58mm** | 58 mm | **48 mm** ← was 58, now matches hardware |
| **80mm** | 80 mm | **72 mm** ← was 80, now matches hardware |
| **76mm** *(new)* | 76 mm | 68 mm |
| **112mm** *(new)* | 112 mm | 104 mm |

PDF page format now matches printable width so thermal drivers respect it.

### Added — More paper size presets

Standard office sizes covered for international users:

- **US Letter** (216 × 279 mm) — US / Canada / Mexico standard
- **US Legal** (216 × 356 mm) — long-form invoices
- **B5** (176 × 250 mm) — used in some Asian markets
- **76mm Thermal** — older kitchen printers
- **112mm Thermal** — airline boarding passes, warehouse labels

### Added — 🎯 Custom paper size

New **"Custom size"** preset lets you enter ANY width + height in mm.
Two number inputs appear in the Customize panel when selected. Below
100mm width, the render auto-switches to thermal receipt layout; above
100mm it uses the sheet layout. Covers every printer edge case not
listed in the standard presets — dot-matrix, label printers, special
stationery, etc.

Tip in the UI: enter your printer's **printable** width, not the roll
width.

### Fixed — Amount column alignment on thermal

User photo showed "Rs.225" and "Rs.25" on different rows didn't align
vertically because flexbox `space-between` doesn't lock the right
column. Now uses **CSS grid** with a fixed-width amount column:

- 58mm: 16mm amount column
- 80mm: 22mm amount column
- Wider: 26mm amount column

Result: every Amount column across every row lands at the same x
coordinate — clean visual stack.

Same fix applied to the totals block (Subtotal / CGST / SGST / Total
all align vertically now).

### Fixed — Font darkness (user's #1 request from photo)

Even v1.8.4's Ultra bold rendered too light on user's specific printer.
Added a **text-shadow trick**: `0.4px 0 0 currentColor, 0 0.4px 0 currentColor`.
This effectively double-strokes every glyph, producing visibly darker
print output on ALL thermal printers without needing a heavier font.

Also disabled OS-level font smoothing (`WebkitFontSmoothing: antialiased`)
which was rendering small thermal glyphs with sub-pixel gray edges.

Text-shadow is active for Bold + Ultra weights; Normal weight users
can opt out for lighter prints.

### Fixed — A5 aggressive compaction (fit one page)

User asked for A5 to be compact so a full invoice fits ONE page (was
spilling to two). Applied aggressive CSS overrides:

- Base font 10.5px → **9.5px**
- Line height 1.35 → **1.25**
- Header padding 12/16px → **8/12px**
- Section padding 8/12px → **6/10px**
- Terms block font 10.5px → **7.5px** with tighter line-height
- Bank block padding halved
- All h1/h2/h3 sized down 15%

A typical 4-item GST invoice with all standard sections now comfortably
fits on one A5 page. For very long invoices (10+ line items) the layout
still gracefully paginates.

### Backward compatibility

- Existing bills default to their saved `paperSize` — no visual change
- Pre-v1.8.5 bills on `thermal58` or `thermal80` will now render
  slightly narrower (48mm / 72mm instead of 58mm / 80mm). This is
  correct — hardware never rendered the full width anyway. If a user
  needs the OLD wider behaviour, they can switch to **Custom size**
  and enter 58 / 80 manually.

---

## [1.8.4] — 2026-04-30

Big release focused on thermal print quality — inspired by user comparison
photos showing SMART BAZAAR / Reliance receipts (all bold + ALL CAPS +
consistently dark) vs our v1.8.3 output (some text lighter than others,
Large font size not rendering correctly).

### Added — 🎛 Dedicated Thermal Printer Settings section

New **"Thermal Printer Settings"** panel in **Settings**. 16 controls
grouped into 4 categories:

**Typography**
- **Font family**: Monospace (Courier — thermal-optimised) / Sans-serif
- **Font size**: Small / Medium / Large / Extra Large
- **Font weight**: Normal / Bold (default) / Ultra bold
- **ALL CAPS mode**: renders every text element in uppercase (SMART BAZAAR
  style, best legibility on thermal printers)

**Layout**
- **Line spacing**: Compact / Normal / Comfortable
- **Header alignment**: Center / Left
- **Print contrast**: Normal / High / Ultra — applies grayscale + contrast
  filter to logo + UPI QR so they print crisper on faded printers
- **Force ALL CAPS in header** (business name always uppercase)

**Content toggles**
- Show business logo (on/off)
- Show HSN code per item (on/off)
- Show "Qty × Rate" line per item (on/off)
- Show amount in words (on/off)
- Show bank details (on/off)
- Show UPI QR (on/off)
- UPI QR size: Small (60px) / Medium (90px) / Large (120px)

**Footer**
- Custom footer message ("Thank you..." editable per business)
- Show cut mark ✂ (on/off)
- Feed lines after cut (0 to 6) — clearance so tear line is clean
- Optional tagline below business name

### Added — 🧪 Test Print button

Clicking **"Test Print"** generates a sample receipt with:
- Your real business profile (loaded from Settings)
- Sample customer ("SAMPLE CUSTOMER") + 3 sample items
- Applies your current settings live
- Sends directly to your system's default printer (via hidden iframe)

Test-and-adjust cycle without needing to create a fake invoice.

### Added — 👀 Live preview inside the Settings panel

Below the controls, a live 80mm thermal preview updates instantly as you
toggle settings — see exactly what your receipt will look like without
generating a PDF.

### Fixed — 🔥 Inconsistent darkness in thermal print

Root cause: some elements had explicit `fontWeight` while others inherited
from parent CSS, so the same "bold" declaration rendered differently
depending on browser + printer combo. Result on your printer: some text
crisp black, other text faded gray.

**Fix**: entire thermal render now sets a **root style** with explicit
`color`, `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, and
`letterSpacing` — every child inherits from this. Text is now consistently
black across every element (headers, items, totals, footer).

Additionally, the **font weight applies globally** based on your setting:
- Normal weight = 500 baseline, 700 headers
- **Bold** (default) = 700 baseline, 900 headers
- **Ultra bold** = 800 baseline, 900+ headers

### Fixed — Large font sizes now scale correctly

Previously, some inline `fontSize: '1.05em'` inheritance broke when the
base size changed. Now every relative size is a proper `em` multiplier
of the root font-size. Setting Font Size = **Extra Large** actually
produces a proportionally larger receipt across all elements.

### App-wide settings vs per-invoice overrides

Settings you configure in **Settings → Thermal Printer Settings** become
**app-wide defaults**. Each invoice's Customize panel can still override
specific fields for that one bill. Priority order:

1. Per-invoice `invoiceOptions.thermal*` (from Customize panel)
2. App-wide `gst_printSettings` (from Settings)
3. Hardcoded fallback

### Added — Settings included in backup

`gst_printSettings` added to the localStorage backup whitelist so users
don't lose their print configuration when restoring from a backup. Same
for four other v1.6.3+ keys that were previously missing:
`gst_stockAlertSettings`, `gst_itrCalcInputs`, `gst_itrPresumptive`,
`gst_itrAdvanceTax`.

### Backward compatibility

Pre-v1.8.4 bills continue to render with the default print settings
(Bold, Medium, Monospace, ALL CAPS off) — no visual change unless the
user opens Settings and customises. Existing per-invoice
`thermal*` overrides still take precedence over the new defaults.

---

## [1.8.3] — 2026-04-30

Direct user feedback on v1.8.2 — thermal print faded, A5 needed to be
landscape, Client Statement PDF still not right. Plus a feature request:
thermal-specific settings in Customize.

### Fixed — Thermal print output no longer faded / cut off

User's photo showed HSN, per-item rate line, and dividers all rendering
as very faint on the actual thermal printer. Also the "Amount" header
was being cut to just "A" because the item table column widths didn't
account for real thermal paper printable areas (usually 72mm on 80mm
rolls after margins).

**Full rewrite of the thermal render**:

- **Every text element forced to pure black `#000`** — no more `color: '#555'`
  gray tones that vanish on thermal
- **Bolder base font weight (500 minimum, 700 for headers)** — thermal
  print heads need denser glyphs for legibility
- **Item name gets full row width; qty × rate on separate line** — 3-word
  product names like "LETTERPAD A4 EXCEL BOND" no longer wrap awkwardly
- **Column headers `Item | Amount`** with 58mm rolls dropping to `Item | Amt`
- **Dashed dividers use solid black 1px lines** — thermal printers render
  crisp black much better than dotted grey
- **Logo + UPI QR get `filter: grayscale(1) contrast(1.5)`** so faded
  colour prints crisp black
- **Currency prefix `Rs.` instead of `₹`** — Courier New / thermal fonts
  can't render the Rupee glyph

### Added — Thermal-specific settings in Customize panel

New "Thermal printer settings" panel appears in the Customize sidebar
**only when a thermal paper size is selected**. Three controls:

- **Font size**: Small (fits more per page) / Medium (default) / Large
  (easier to read for older customers)
- **Compact mode**: Skip HSN + per-item rate line; use two-line item
  rows. Saves paper on long orders.
- **Cut mark**: Adds "— ✂ cut here ✂ —" at the very bottom for
  auto-cutter thermal printers. Turn off if your printer auto-feeds.

All three persisted per-invoice in `invoiceOptions.thermalFontSize` /
`thermalCompact` / `thermalCutMark`. Backward-compat: pre-v1.8.3 bills
default to Medium / Compact off / Cut mark on.

### Added — A4 Landscape & A5 Landscape paper sizes

User wanted A5 in **landscape orientation** — popular in Indian retail
/ wholesale because you can print two invoices per A4 sheet (saving
paper). Added both A4 Landscape (297 × 210 mm) and A5 Landscape
(210 × 148 mm).

- `jsPdfOrientation` field added to each PAPER_SIZES entry
- PDF generation now respects orientation (was hardcoded portrait)
- InvoicePreview CSS handles landscape variants — full A4 width, half
  A4 height, tighter vertical padding to fit content on one page

Existing bills default to `a4` (portrait) so no visual change on
upgrade.

### Fixed — Client Statement PDF now proper Indian ledger format

Redesigned to match standard Indian business-statement conventions:

- Columns: **Date | Particulars | Debit | Credit | Balance**
  (was: Date | Invoice # | Type | Amount | Paid | Balance)
- **Opening Balance row** at the top (₹0.00 by default)
- **Balance shows "Dr" suffix** — Indian accounting convention
- **Payment received against invoice** appears as its own italicised
  Credit row directly below the invoice row, keeping the trail clear
- **Closing Balance** shows `Dr` (client owes) or `Cr / Nil`
  (nothing owed / advance received)
- **Signature block** ("Authorised Signatory") + business name
  right-aligned at the bottom
- Legend: "Dr = amount receivable · Cr = amount owed / paid"
- Reviewer note: "Please review and confirm within 7 days"

CAs and accountants used to Tally / Marg / BUSY output should
recognise this layout immediately.

---

## [1.8.2] — 2026-04-30

Hotfix release addressing five user-reported bugs from v1.8.0-v1.8.1
plus the direct-print feature request.

### Fixed — 🔥 Dashboard blank page when clicking invoice checkbox

The most damaging regression: clicking any checkbox on an invoice row
crashed the Dashboard to a blank page. Cause: v1.7.0's Bulk PDF button
referenced `<Download size={13} />` in the bulk toolbar, but `Download`
was not imported from `lucide-react`. As soon as a checkbox was ticked,
`selectedIds.size > 0` became true, the toolbar rendered, hit the
undefined icon, and React crashed the entire Dashboard tree.

Fixed by adding `Download` to the lucide-react import list. Sanity-swept
all other lucide references for missing imports.

### Fixed — 🔥 Income Tax module blanking on any interaction

Cause: v1.8.0's `advanceSchedule` useMemo referenced `comparison` in
its dependency array + callback body BEFORE `comparison` was declared.
JavaScript TDZ (temporal dead zone) rules mean this throws a
`ReferenceError` on every render of the Income Tax view — so navigating
to it or clicking anything triggered the crash. eslint flagged this
but the build didn't fail because it was in a hook deps array (only
runtime-detectable).

Fix: reorder — `comparison` is now declared before `advanceSchedule`.
Also added defensive optional chaining on
`comparison?.[comparison?.recommended]?.totalTax` so a race between
`useMemo` recomputation and state updates can't crash again.

### Fixed — A5 layout wasn't actually adapting

v1.8.1's paper-size selector changed the container width and PDF format
but the internal invoice layout stayed A4-optimized. Inline
`margin: '0 2rem'` on tables + rem-based paddings pushed content
off the A5 page.

Added stronger `.paper-a5` CSS overrides — table margins collapse to
8px each side, headers scale to 1.25rem, sections drop to smaller
padding, logos shrink to 45px. Now the whole invoice fits properly
inside 148 × 210 mm.

### Fixed — Thermal 80mm / 58mm now renders a proper receipt layout

Same problem: v1.8.1 changed only the container width. The Indian GST
column layout (CGST + SGST + IGST + Tax %) never fitted on a 58mm roll,
producing overflowing / clipped output.

v1.8.2 branches on `paperCfg.kind === 'thermal'` and renders a
completely different template:

- Single-column layout (no side-by-side party blocks)
- Compact monospace-style typography (Courier New)
- Item table: Item · Qty · Amount (3 columns only)
- Totals stacked vertically with dashed dividers
- Currency prefix uses ₹ symbol at 80mm+, but hides UPI QR at 58mm
  (not enough width to scan reliably)
- All colour panels stripped — black on white to save thermal
  printer ribbon / paper

Users of thermal POS printers can now genuinely use this as a
day-to-day receipt template.

### Fixed — Client Statement PDF alignment

Column overlap when the amount was wide (e.g. ₹12,34,567.89 would
extend into the Type column). Rewrote the layout:

- Explicit column-end coordinates so text can never overlap
- Indian digit grouping (2,5,000 style instead of 25,000)
- Currency prefixed with plain "Rs. " — helvetica can't render the
  ₹ symbol properly and it was appearing as garbage in some PDF
  readers
- Alternating row shading now aligned to text baseline
- Page-break repeat of the table header
- Colored summary strip at top (Invoices count / Total / Paid /
  Outstanding) with clear typography
- Bold + red for outstanding balance, green when settled

### Added — 🖨 Direct Print button (feature request)

New **Print** button next to Download PDF on the invoice toolbar.
Opens the browser print dialog directly with the invoice PDF loaded
in a hidden iframe. Works with:

- Any thermal printer configured as system default (send receipt
  straight to the paper roll)
- A4 laser / inkjet printers (skips the "download PDF then open then
  print" flow)
- Popup-blocker safe (uses hidden iframe, not `window.open`)
- Fallback: opens PDF in new tab if browser blocks the auto-print

Button title changes based on the selected paper size: "Send directly
to your thermal printer" for thermal formats, "Open browser print
dialog (skip the PDF download)" for A4 / A5.

---

## [1.8.1] — 2026-04-30

Two user-reported bugs + one new feature.

### Fixed — Invoice numbers no longer incremented on every "New Invoice" click

**The bug**: opening the New Invoice form and typing anything meaningful
would burn a counter value even if the user never clicked Save. Because
auto-save fires 2s after the last edit and calls `saveInvoiceToDB`,
which atomically reserves. If the user abandoned the form and opened
another, the next number was N+1 already. CA-audited businesses require
gapless sequences — this bug was creating gaps.

**The fix**: for NEW bills that haven't been explicitly saved yet, the
2-second auto-save skips the server persist step entirely. The
sessionStorage draft is still auto-persisted (so a browser crash mid-
edit doesn't lose typed content), but the counter is only atomically
reserved when the user clicks **Save**, **Save & Leave**, or **Save &
Download PDF**. Once the first successful save lands, auto-save flips
back on as normal.

For editing existing bills: unchanged behaviour — auto-save writes
through to the server every 2 seconds so mid-session edits are safe.

### Fixed — "Save failed" toast when navigating back

The toast fired when auto-save and Save & Leave raced on the same
invoice. Auto-save posted with `overwrite=false`, succeeded; Save & Leave
then also posted with `overwrite=false`, and the server correctly 409'd
because the file already existed at that ID.

Added a `hasBeenSaved` ref that flips to `true` after the first
successful server persist this session. Subsequent saves — whether from
auto-save, Save & Leave, or Save & Download — now pass `overwrite=true`.
Server accepts the write, "Save failed" no longer fires spuriously.

The first save still uses `overwrite=false` so a typo hitting an
existing invoice number is still caught (v1.6.8's dupe-check protection
is preserved for the case it was meant to catch).

### Added — Paper / print size options

Requested by users with POS thermal printers and A5 preferences.

New **"Paper / print size"** dropdown in the Customize panel (right side
of the invoice form). Four options:

- **A4 (default)** — 210 × 297 mm. Same as before, no behaviour change.
- **A5 (compact)** — 148 × 210 mm. Half sheet, saves paper. Same layout
  as A4, slightly smaller type.
- **80mm Thermal (POS receipt)** — 80 mm wide roll. Compact single-
  column layout, black-on-white, no decorative colour panels, smaller
  UPI QR (60 × 60 px). Fits standard restaurant / retail POS printers.
- **58mm Thermal (compact receipt)** — 58 mm wide roll. Even narrower;
  UPI QR is hidden entirely (not enough width to scan reliably). For
  portable / mobile thermal printers.

How it works: `invoiceOptions.paperSize` (persisted with each bill).
The **preview** container width + CSS class update live in the editor
so what-you-see matches what-you-print. The **PDF** is generated at the
correct `jsPDF` page size — A4 / A5 use jsPDF's built-in formats;
thermal uses a custom `[width, 297mm]` page (long strip that thermal
printers cut at content end). Existing bills default to A4 — no
migration needed.

### CSS additions

New `.paper-a4` / `.paper-a5` / `.paper-thermal-80` / `.paper-thermal-58`
classes on `.invoice-preview-container`. Thermal formats:

- Force black-on-white — no gradient panels or coloured backgrounds
- Monospace fallback font for receipt-like density
- Grid layouts collapse to stacked single column
- Table borders switch to 1px dashed (thermal printers render dashed
  crisper than solid at fine sizes)
- UPI QR hidden on 58mm; scaled to 60×60 on 80mm

---

## [1.8.0] — 2026-04-30

**Full ITR Release.** Two new sub-tabs (Presumptive + Advance Tax),
the crown-jewel ITR-4 Filing Summary PDF, integrated ITR / advance-tax
due-date reminders, plus four P2 UX polish fixes.

### Added — Presumptive Income sub-tab (Income Tax module)

Support for all three presumptive taxation sections:

- **§44AD** (traders / retailers / manufacturers): 6% of digital
  turnover + 8% of cash turnover. Handles the ₹2Cr / ₹3Cr limit
  based on cash-receipt %. Warns when cash exceeds 5%.
- **§44ADA** (professionals): flat 50% of gross receipts.
  ₹50L / ₹75L limit handled.
- **§44AE** (transporters): per-vehicle-month rates for heavy vs
  light vehicles.

"Actual profit override" input for users who want to declare above
the deemed minimum. **"Push to Calculator"** button pipes the computed
income into the Regime Calculator's Business Income field. Compliance
warnings inline when turnover crosses thresholds.

### Added — Advance Tax sub-tab (Income Tax module)

- Four-installment schedule for FY 2024-25 (15 Jun · 15 Sep · 15 Dec · 15 Mar)
- **Presumptive mode toggle** — collapses to a single 15-March payment
- TDS-credit input reduces net advance-tax liability
- Payments-made table — record each installment paid, with date + amount
- **§234C interest** — 1% per month for installment shortfalls, with the
  correct 12% / 36% waivers for Q1 / Q2
- **§234B interest** — 1% per month post year-end delay
- Live shortfall detection per installment; row highlights red when
  behind schedule
- All inputs auto-persist to localStorage

### Added — ITR-4 (Sugam) Filing Summary PDF 🎯

The crown jewel. On the ITR Summary tab, a **"Download ITR-4 Summary"**
button generates a printable PDF that mirrors the ITR-4 form's field
layout:

- **Part A — General**: assessee name, GSTIN, PAN placeholder, filing
  status (§139(1) — before due date)
- **Part A — Nature of Business**: presumptive section + turnover split
  (digital / cash) if applicable
- **Part B — Income**: Salary (with standard deduction line) · House
  Property · Business/Profession (linked to presumptive figure or
  regular books) · Other Sources → Gross Total Income
- **Part C — Deductions**: every Chapter VI-A section with statutory cap
  applied; §80CCD(2) only under new regime
- **Part D — Tax Computation**: slab tax + special-rate (STCG 15% /
  LTCG 10%) + §87A rebate + surcharge + 4% cess → Total Tax Payable
- **Part E — Advance Tax**: installment schedule with amount + paid
- Field bold + big for totals; sectional headers coloured
- Auto-inserts source notes (e.g. "From Form 16", "Presumptive @ §44AD")

Hand the PDF to your CA — every field they need to fill on
incometax.gov.in is pre-computed with the amount and its origin.

### Added — Advance-tax + ITR filing dates in the notification bell

`getUpcomingFilings()` now includes:

- All four advance-tax installments (15 Jun / 15 Sep / 15 Dec / 15 Mar)
- ITR filing due-date — non-audit (31 July of AY)
- ITR filing due-date — audit / §44AB (31 October of AY)

Users see these in the sidebar bell 🔔 popover under **"Filings due soon"**
alongside GSTR-1 / 3B / 26Q / 27EQ. 60-day lookahead — nothing more
than 2 months out clutters the list.

### Added — `utils/itr.js` extensions

New exports:

- `compute44AD(inputs)` / `compute44ADA(inputs)` / `compute44AE(inputs)`
- `ADVANCE_TAX_SCHEDULE` — the four installment dates + cumulative %
- `computeAdvanceTaxSchedule(totalTax, tdsCredit, payments, mode)`
- `compute234BInterest(schedule, paymentDate)`
- `compute234CInterest(schedule)`
- `buildITR4FieldMap(inputs, tax, presumptive, deductions)` — returns
  a canonical array of `{ section, field, value, note?, bold?, big? }`
  used by the PDF generator (and testable in isolation)

### Fixed — P2 UX polish batch (from v1.6.7 audit)

- **`handleBack` 3-option modal** (P2 #32) — was `confirm()` where OK=save
  and Cancel=stay, which every UX study confirms is counterintuitive
  (users hit Cancel expecting "discard"). Now a proper modal with
  three explicit actions: **Keep editing** / **Discard & leave** /
  **Save & leave**.
- **Terms preset "never ask again"** (P2 #33) — comparing three presets
  before committing used to spawn three confirm dialogs. Now asks once
  per session (sessionStorage flag), silent switches after.
- **Image upload MIME + dimension guard** (P2 #34) — previously
  `accept="image/*"` alone (bypassable). Now whitelists PNG / JPEG /
  WebP / SVG; 2MB max; auto-downscales rasters to 1024px on the
  longer edge via canvas (preserves aspect ratio, quality 0.92 JPEG).
  SVGs embedded as-is (they're vector). Result: no more 4096×4096
  logos silently bloating PDF size.
- **`getFYOptions` extracted to `utils.js`** (P2 #42) — was duplicated
  in 5 files. Callers can migrate incrementally.

### Backward compatibility

- Existing localStorage keys unchanged. New keys added:
  `gst_itrPresumptive`, `gst_itrAdvanceTax`. Both included in the
  backup whitelist (they piggyback on `gst_*` prefix but are
  auto-restored because they're explicitly enumerated).
- The ITR-4 PDF works even with zero calculator input — outputs a
  sensibly-empty template you can print, mark up by hand, and file.
- Advance-tax notifications are additive — no existing filing
  reminder is affected.

---

## [1.7.0] — 2026-04-30

**ITR Foundation release.** Introduces the Income Tax module — an integrated
regime calculator, bank-statement import, and consolidated ITR summary —
plus Client Statement PDFs, Bulk PDF export, and P1 #15 (interstate
expense ITC) closes.

### Added — Income Tax module (new sidebar item, India-only)

A new "Income Tax" section in the sidebar with three sub-tabs:

**1. Regime Calculator**
- Side-by-side Old vs New regime comparison for FY 2024-25 (AY 2025-26)
- Slabs, Section 87A rebate, surcharge tiers (up to ₹5Cr / above), 4%
  Health & Education Cess — all under the hood
- Standard Deduction auto-applied to salary income (₹75k new, ₹50k old)
- Chapter VI-A deductions with statutory caps (80C ₹1.5L, 80D ₹1L,
  80CCD1B ₹50k, 80TTA/TTB, 80E, 80G, 80GG, 80DDB, 80U, §24b)
- Special-rate handling for capital gains (STCG 15% §111A, LTCG 10%
  §112A over ₹1L exempt)
- **Auto-picks the cheaper regime** and highlights it; shows exact ₹
  savings vs the other regime
- Inputs auto-save to localStorage between visits
- Business Income auto-fills from the app's own sales − purchases −
  expenses for the current FY (user can override)

**2. Bank Statement Import**
- Drop / upload a CSV; auto-detects the bank format from headers
- Supports **SBI, HDFC, ICICI, Axis, Kotak, PNB, Yes Bank** plus a
  Generic fallback that matches columns by name
- Auto-categorises every transaction using keyword rules (SALARY,
  INTEREST, RENT, SIP, LIC, GST, EMI, AWS, ATM, IMPS, etc.)
- Spreadsheet-style review grid — user overrides any auto-category
- Category totals strip shows aggregate per bucket
- **"Push to Calculator" button** pipes the categorised totals into
  the Regime Calculator (business receipts → business income,
  interest → other sources, rent → house property, LIC → 80C, etc.)
- 100% in-browser parsing — nothing uploaded to any server

**3. ITR Summary**
- Consolidated snapshot: Sales / Trading purchases / Business expenses
  / Net business income (from the app's own data)
- Adds up salary + rent + other sources + capital gains from the
  Regime Calculator
- Highlights **presumptive taxation eligibility** if turnover < ₹2Cr
  (Section 44AD hint)
- Recommended regime + tax due + due dates + advance-tax
  installment schedule (15 Jun / 15 Sep / 15 Dec / 15 Mar)

### Added — utils/itr.js

New tax-math library, kept separate from React so it's auditable + unit-
testable. Exports:

- `OLD_REGIME_SLABS` / `NEW_REGIME_SLABS` (FY 2024-25)
- `DEDUCTION_CAPS` — statutory caps per section
- `computeSlabTax`, `computeSurcharge`, `computeRebate87A`, `computeCess`
- `computeTax(inputs)` — end-to-end returns
  `{ grossTotalIncome, standardDeduction, allowedDeductions, taxableIncome,
     slabTax, stcgTax, ltcgTax, rebate87A, taxAfterRebate, surcharge, cess,
     totalTax, regime }`
- `compareRegimes(inputs)` — runs both, picks cheaper, returns
  `{ old, new, savings, recommended: 'old' | 'new' }`
- `parseBankStatement(csvText)` — normalised `{ bankName, transactions }`
- `autoCategorize(description)` + `AUTO_CATEGORY_RULES` — extensible
  rule set for narration-based categorisation

### Added — Enhanced Expense Tracker

- **`interstate` flag** on every expense entry. Fixes P1 #15 from the
  audit: ITC on GST paid to out-of-state vendors (AWS / Google / Adobe)
  was incorrectly splitting into CGST/SGST → mis-routed in GSTR-3B
  Table 4(A). Now correctly routes to IGST when the flag is on.
- **ITR head tags** on every category. `Salary & Wages` → salary head
  (declared separately); `Asset Purchase` → depreciation (§32);
  `Personal / Drawings` → not deductible; everything else → business
  (§37 general deductions). Sets us up for the v1.8.0 Filing Summary
  PDF to auto-aggregate expenses under the correct ITR line.
- Two new categories: `Asset Purchase` (capitalised, not deducted in
  year of purchase) and `Personal / Drawings` (non-business).

### Added — Client Statement PDF (audit A)

On the Clients page, expanding any client reveals a **Statement PDF**
button. Generates a single-page (or multi-page for high-volume clients)
account statement:

- Seller + client header blocks
- Summary strip: invoice count / total billed / paid / outstanding
- Chronological table: date, invoice #, type, amount, paid, running
  balance
- **Credit notes correctly reduce the balance** (shown as `-₹` amount)
- Closing balance line at the bottom, color-coded red if outstanding

Uses jsPDF direct rendering (no html2canvas) for crisp text + small file
size — statements are typically 30-100 KB regardless of invoice count.

### Added — Bulk PDF export (audit C)

Dashboard bulk toolbar gets a new **Bulk PDF** button. Renders every
selected invoice through the InvoicePreview pipeline and stitches them
into one multi-page PDF. Perfect for the "give me all March invoices"
ask from your CA. Works with unlimited selection (>100 invoices prompts
a "may take a minute" confirmation).

### Fixed — P1 #15 (from audit)

GSTR-3B ITC from expenses now correctly routes to IGST for interstate
expense entries. Was unconditionally 50/50 CGST+SGST regardless of the
vendor's state — a real filing bug for anyone with out-of-state SaaS
subscriptions.

### Backward compatibility

- Existing expense records without the `interstate` field default to
  intrastate (preserves pre-v1.7.0 numbers — no book values shift
  silently on upgrade). Users opt in per-record by ticking the flag.
- Existing profiles without an `id` still work (fallback to `businessName`
  match, same as v1.5.0).
- The new Income Tax module is India-only. Users on
  `Settings → Region Preference: International` will not see it in
  the sidebar.

---

## [1.6.8] — 2026-04-30

Critical-fixes bundle. 17 bug fixes across GST filing correctness, data
integrity, and money math. Full audit report at
[`docs/AUDIT_2026-04-30.md`](docs/AUDIT_2026-04-30.md).

### Fixed — GST filing correctness (would have caused real returns to fail)

- **Reverse-charge invoices no longer include GST in the payable total**.
  Under Section 9(3)/9(4) the supplier doesn't collect GST — buyer pays
  directly to govt. Pre-v1.6.8 the PDF printed the RCM notice AND added
  tax to the total → suppliers over-billed then issued credit notes.
  Line-level tax still shows on the PDF (buyer needs to know their RCM
  liability) but the "amount payable to us" is now taxable value only.
  Tax breakdown preserved in `totals.rcmTax*` for GSTR-3B RCM outward.
- **GSTR-1 JSON now emits reverse-charge flag correctly**. Was
  hardcoded `rchrg: 'N'` even when the bill had `reverseCharge: true`.
  Portal was rejecting / mis-classifying RCM supplies.
- **GSTR-1 JSON now marks SEZ bills as SEWP / SEWOP** instead of `'R'`
  (regular). GSTN validators were flagging these on upload.
- **Cess amounts now flow into every GSTR-1 / 3B JSON export**
  (B2B / B2CS / B2CL / CDNR / HSN summary). Pre-v1.6.8 `csamt: 0` was
  hardcoded everywhere — users selling tobacco / aerated / auto / coal
  understated cess liability.
- **HSN summary B2CL branch now respects `taxInclusive`**. Missing 3rd
  arg to `computeItemTaxSplit(item, isInter, taxInclusive)` was inflating
  taxable + IGST values for tax-inclusive large-value B2C invoices.
- **Server-side recurring auto-fire now routes tax by state**. Was
  hardcoding `cgst: taxTotal/2, sgst: taxTotal/2, igst: 0` regardless
  of seller vs client state / SEZ — every interstate recurring
  template shipped as intrastate B2B → wrong GSTR-1 bucket.
- **`InvoicePreview` interstate detection now honours `placeOfSupply`
  and `isSEZ`**. Bills with POS override or SEZ client had totals
  computed as IGST but item table rendered CGST+SGST → PDF mismatch.

### Fixed — Data integrity (silent data loss)

- **Client fields no longer silently lost on load / save**. Both
  `selectSavedClient` and `handleClientModalSave` were cherry-picking
  6 fields and dropping `country / email / phone / isSEZ`. Consequence:
  loading an SEZ client via auto-complete cleared its SEZ flag → wrong
  tax computed → wrong filing.
- **Initial invoice client state includes `email / phone / isSEZ`**.
  Even when ClientModal wrote these to the client directory, they never
  landed in `bill.data.client` because they weren't in state.
- **Server refuses silent invoice-number overwrites**. Typo hitting an
  existing invoice-number used to overwrite the previous bill with no
  warning. Now returns 409 unless the client explicitly passes
  `?overwrite=1` (used by the edit / bulk-status / auto-fire flows).
- **Invoice-number counters no longer burn on mount**. `getNextInvoiceNumber`
  now supports `{ peek: true }` — the form shows the next number
  optimistically, and atomic reservation happens only on save. Cancelled
  forms don't leave gaps in the sequence any more (CA-audited businesses
  need gapless).
- **Receipt numbers use the atomic counter endpoint**. Two receipts
  saved together no longer both get `RCP/…/0007`.
- **Recording a receipt now updates the linked invoice's paid status +
  payment history**. Users no longer have to double-record via the
  Dashboard payment modal.
- **Bulk / single "Mark as Paid" now pushes a synthetic payment**.
  Pre-v1.6.8 the row was flipped to `paid` with an empty `payments`
  array → payment-history modal and ReportsView cashflow showed no
  payment. Both views now stay consistent with the bill's status.
- **Recurring invoice templates use `item.name`, not `description`**.
  Templates using the old field silently shipped bills with blank rows
  because server auto-fire reads `item.name`. Migration in `openEdit`
  + server-side fallback preserves existing templates.
- **Duplicate-invoice flow correctly decrements stock**. `_isDuplicate`
  and `_convertToType` markers now skip the "editing an existing bill"
  short-circuit — duplicates are new sales.
- **GSTR-2B reconciliation respects purchase round-off**. v1.6.7's
  new purchase round-off exposed this — books used line-item precision
  while 2B `val` was rounded, so every rounded supplier bill flagged as
  amount_mismatch.
- **Backup / restore captures all localStorage keys**. Fixed:
  - Typo `'theme'` → `'freegstbill_theme'`
  - Added `gst_filing_status` (users lost GSTR-1 / 3B "Filed" pill marks)
  - Added `freegstbill_dismissedUpdate` + `freegstbill_pwa_dismissed_at`
    (users got nag banners back after restore)
  - Prefix-matched `gst_lastUsedAccountId_*` (per-profile payment
    account preferences)

### Fixed — Purchase Bill parity with Sales

- **Decimal quantities** — was `min="1"`, blocked 2.5 kg / 0.5 hr.
  Now `min="0" step="any"`.
- **Custom tax rate** — dropdown was 0 / 5 / 12 / 18 / 28. Missing
  0.1% (agriculture) / 0.25% (rough diamonds) / 3% (jewellery) / bespoke.
  Now includes those + an "Other…" option that prompts for any rate.
- **Cess field** — suppliers of tobacco / aerated / motor vehicles / coal
  charge GST + Cess. Pre-v1.6.8 there was no slot for it → ITC on cess
  was silently lost in GSTR-3B Table 4(A). New Cess % column per item;
  totals strip shows cess line when non-zero.

### Fixed — Dev environment

- **Vite dev proxy points at port 47371** (Express default since v1.5.2),
  was `3001`. `npm run dev` now works for contributors without manual
  config edits.

---

## [1.6.7] — 2026-04-30

Two reported UX fixes — purchase-bill round-off was missing, and the
"Add Item" button didn't move keyboard focus to the new row.

### Added — Round-off in Purchase Bills

Sales invoices have always had a `Show round-off` toggle. Purchase bills
didn't — so when a supplier rounded their total (₹1,234.56 → ₹1,235),
users had to fudge a line item to make it match. Now there's an
**Apply round-off** checkbox on the Add/Edit Purchase Bill modal.

- Defaults to **off** (most suppliers' totals already match line-item math)
- When on, applies `calculateRoundOff()` to the grand total — same
  helper used by sales invoices
- Round-off shows as a separate `+₹0.44` / `-₹0.50` line in the
  modal's totals strip
- Persisted to the purchase record as `applyRoundOff: bool` and
  `roundOff: number` — kept separately from `totalTax` so GSTR-3B
  ITC reconciliation reflects what the supplier actually charged
- Total in the records table + footer + CSV export all use the
  rounded grand total
- Backward-compat: older purchase entries without these fields are
  treated as `applyRoundOff: false` and continue to show their original
  totals exactly. Re-opening such a record auto-detects round-off if
  the stored `roundOff` is non-zero.

### Fixed — Keyboard focus after "Add Item"

Pressing Tab to reach the **Add Item** button and Enter to activate it
used to leave focus stuck on the button — users had to grab the mouse
to click into the new row's first input.

Now the **Description** input on the freshly-added row receives focus
automatically. Works in both the sales invoice form (InvoiceGenerator)
and the purchase bill form (PurchaseBills). Implementation uses
`data-item-id` / `data-focus-key` attributes on the row + a
`requestAnimationFrame` queue so the focus lands after React's render
commit.

For users who do most of their data entry by keyboard, this turns
"Tab Tab Tab Enter [grab mouse]" into "Tab Tab Tab Enter Type" — pure
keyboard flow.

---

## [1.6.6] — 2026-04-30

Restructure: collapsed `Launcher.html` and `index.html` into a single
user-facing HTML file. Install folder now shows ONE html file — the
launcher — instead of two.

### Why

v1.6.4 / 1.6.5 had two HTML files at the project root:

- `index.html` — React app shell. Doesn't work standalone (Vite-built
  paths, CORS-blocked ES modules from `file://`). If accidentally
  double-clicked → white screen + cryptic console errors about
  `main.jsx` / `manifest.webmanifest` / `favicon.svg` failing to load.
- `Launcher.html` — Standalone control panel. Works fine via `file://`.

Users couldn't tell which one to open and frequently double-clicked
`index.html`, hitting the broken state.

### Changed — file layout

- The React app's source `index.html` moved from project root to `src/index.html`.
  Users never see it; it's a build-tool source, not a user-facing file.
- The standalone launcher `Launcher.html` was renamed to `index.html`
  at project root. This is now the **only** HTML file in the install
  folder, and it's the launcher.
- Build output `dist/index.html` is the React app (unchanged behaviour —
  Express still serves it at `/`). Same filename, different folder.
- `vite.config.js` updated to set `root: 'src'`, with `publicDir` and
  `build.outDir` pointing at project-root paths so existing `public/`
  assets and `dist/` output still resolve correctly.
- Module entry path updated from `/src/main.jsx` → `/main.jsx` (since
  Vite's root is now `src/`).

### Updated callers

- `Install FreeGSTBill.bat`: desktop shortcut + Start Menu shortcuts +
  comments now reference `index.html` (the launcher) instead of
  `Launcher.html`.
- `Start FreeGSTBill.bat`: fallback path when node missing / 30s
  timeout now opens `index.html` (the launcher).

### Backward compatibility

Users updating from v1.6.4 / 1.6.5 should re-run `Install FreeGSTBill.bat`
once after `Update FreeGSTBill.bat` to refresh the desktop shortcut so
it points at the new location. Update.bat alone preserves the existing
shortcut, which would still work because it points at the now-gone
`Launcher.html` path — re-running Install fixes it.

If you don't want to re-run Install: just drag the new `index.html`
from the install folder onto your desktop as a quick one-step fix.

---

## [1.6.5] — 2026-04-30

Hotfix for v1.6.4's `Launcher.html` rendering as a white screen on some
browsers. Rewrote the page to maximise compatibility with older Edge,
corporate-policy-restricted browsers, and `file://` origin quirks.

### Fixed — Launcher.html now renders reliably

The v1.6.4 launcher used `color-mix(in srgb, ...)` in the body
background (Chrome 111+, Edge 111+). On older or policy-restricted
browsers the CSS declaration silently failed and the cards-on-white
combination read as "white screen" if the user's `bg` ended up white
too. Also used some ES2020+ JS syntax that some legacy environments
choked on.

### Changes

- **Replaced `color-mix()`** with a plain solid background colour.
- **Replaced `let` / `const` / arrow functions / template literals**
  with `var` / function expressions / string concatenation throughout
  the script. Now compatible all the way down to IE 11 (not that we
  officially target it, but the safer subset eliminates a whole class
  of "blank page" failures).
- **Wrapped the entire script in an IIFE with try/catch** — a single
  browser quirk no longer aborts the whole panel; errors fall back to
  a visible "Error checking server" state with a hint to open DevTools.
- **Removed emoji buttons** (▶️ ⏹ 🚀) — some Windows installs without
  Segoe UI Emoji rendered them as missing-glyph squares. Plain text
  labels now.
- **Visible content before JS runs** — header, status pill, info card
  all render from static HTML so even total JS failure leaves a
  recognisable page.
- **Added `<noscript>` warning** for the rare user with JS disabled,
  pointing them at `Start FreeGSTBill.bat` directly.
- **Added F12 / DevTools hint** in the troubleshooting `<details>`
  so users can self-diagnose remaining issues.

### How to pick up the fix

If you're on v1.6.4 and saw the white screen, pull the update:

```
Update FreeGSTBill.bat
```

Or directly download the new `Launcher.html` from the GitHub repo and
overwrite your local copy.

If you still see a white screen after the update:
1. Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> in the browser
   to force-reload past any cache
2. Press <kbd>F12</kbd> → Console tab → screenshot anything in red,
   share via [GitHub issue](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)
3. Or just run `Start FreeGSTBill.bat` directly from the install
   folder while we debug

---

## [1.6.4] — 2026-04-30

Fixes the long-standing "desktop icon does nothing" issue some users have
been hitting. The desktop shortcut now opens a visual **Control Panel**
(`Launcher.html`) that shows server status live, has Start/Stop/Open
buttons, and walks users through troubleshooting if something's wrong.

### Added — `Launcher.html` Control Panel

A self-contained static HTML page at the install root. Features:

- 🟢 / 🔴 **live status indicator** — polls every 2 seconds, shows
  "Server running on port X" or "Server not running" with a coloured
  status pill (auto dark-mode aware)
- **Big "Open Billing App"** button — enabled only when the server's
  alive, opens the React app in a new tab on whatever port is actually
  serving
- **Start Server** button — triggers the existing `freegstbill://`
  protocol handler (which runs `Start FreeGSTBill.bat`)
- **Stop Server** button — triggers the new `freegstbill-stop://`
  protocol handler (runs `Stop FreeGSTBill.bat`)
- **Smart port discovery** — tries cached port first, falls back to
  parallel scan of 47371-47420. Caches the alive port in
  `sessionStorage` so subsequent polls only hit one URL.
- **Info card** — shows port, version, App URL, last-checked time
- **Troubleshooting `<details>`** — collapsible help section with a
  5-step recovery guide
- **Polling pauses** when the tab is backgrounded (visibility API)
- **Burst polling** after Start/Stop clicks so status updates within
  a second instead of waiting 2 seconds for the next regular poll

### Changed — Desktop shortcut now opens the Control Panel

The desktop shortcut previously ran `Start FreeGSTBill.bat` directly.
When that script failed silently (PowerShell hidden-window issues,
node not on PATH, port collision, etc.) the user just saw a black
window flash and nothing else. Now the desktop shortcut opens
`Launcher.html` in the default browser. The Control Panel can detect
whether the server's already running and skip directly to "Open Billing
App", or show the broken state with recovery steps.

Power users who want the old auto-start behaviour can use the new
**"Open Free GST Billing"** shortcut in the Start Menu folder, which
still runs `Start FreeGSTBill.bat` directly.

### Added — `freegstbill-stop://` URL protocol

Mirrors the existing `freegstbill://` (which runs Start.bat) and
`freegstbill-update://` (which runs Update.bat). New one maps to
`Stop FreeGSTBill.bat` and is used by the Control Panel's Stop button.
Registered in `HKCU\Software\Classes` during install — no admin
required.

### Changed — `Start FreeGSTBill.bat` is more resilient

- **Verifies `node` is on PATH** before doing anything. If missing,
  opens the Control Panel (which has troubleshooting steps) instead
  of failing silently in a black window the user can't read.
- **Two-tier server launch** — tries hidden PowerShell first
  (existing behaviour); if PowerShell exits non-zero, falls back to
  a visible minimised CMD window. More compatible with corporate
  Windows installs where PowerShell execution is restricted.
- **30-second wait** (was 20) for slow machines.
- **Failure fallback** — if the server doesn't respond after 30 seconds,
  opens the Control Panel instead of pointing the browser at a dead URL.
  User sees a clear error state with retry option, never a "this site
  can't be reached" generic browser page.

### Backward compatibility

- Existing users who run Update.bat get the new Launcher.html + protocol
  handlers automatically. The desktop shortcut keeps pointing at
  `Start FreeGSTBill.bat` until they re-run `Install FreeGSTBill.bat`
  (which rewrites it). They can also drag-and-drop the new
  `Launcher.html` onto their desktop as a quick fix.
- The new `freegstbill-stop://` protocol is optional — Stop.bat itself
  still works when run directly.

---

## [1.6.3] — 2026-04-30

User-configurable low-stock alerts. Was hardcoded to "alert me when any
product's stock drops to ≤5"; now it's a Settings option you can turn off
entirely or retune.

### Added — Stock Alerts settings panel

New **Settings → Low-stock alerts** card with two controls:

- **Show low-stock alerts** toggle — when off, the 🔔 sidebar notification
  centre stops counting low-stock items, the Dashboard low-stock card
  hides itself, and the Inventory page's orange "low" colour drops to
  plain text. Out-of-stock items (stock = 0) still display as red
  regardless — that's a hard fact, not an alert preference.
- **Threshold** — alert fires when a product's `stock ≤ threshold`.
  Default 5. Common picks: 0 (only when fully out), 3, 5, 10. Disabled
  visually when the master toggle is off.

Setting is app-level (stored at `meta.stockAlertSettings`) rather than
per-business-profile, since it's a UX preference rather than a business
rule. Rides along in the existing backup/restore flow under the "App
settings" checkbox.

### Changed — wired through three views

The new config is read by:

- `App.jsx` → notification centre bell badge + popover
- `Dashboard.jsx` → low-stock card on the bills page
- `InventoryView.jsx` → orange colour-coding on the stock column

All three default to `{ enabled: true, threshold: 5 }` when no setting
is saved, so v1.6.2 invoices and users see no behaviour change unless
they explicitly visit Settings to change it.

---

## [1.6.2] — 2026-04-30

Fixes the StackBlitz / Codespaces sandbox demo path (and the local "Cannot
GET /" head-scratcher that hit anyone who ran `node server.js` directly
without building the frontend first).

### Fixed — friendly "still building" page instead of `Cannot GET /`

Before: if `dist/` didn't exist (StackBlitz boot, fresh clone, running
`node server.js` directly, build still in progress), Express had no `/`
route and returned the cryptic `Cannot GET /` 404. Users assumed the app
was broken.

Now: the SPA catch-all and static middleware are registered
**unconditionally**. The catch-all checks per-request whether
`dist/index.html` exists:

- ✅ exists → serves the real React app
- ⏳ doesn't exist → serves a friendly auto-refreshing placeholder
  page that explains what's happening and how to fix it (run
  `npm run build`, or wait for StackBlitz to finish)

Critically, this means the server can start BEFORE `vite build` finishes
and seamlessly flip to serving the real app the moment `dist/` appears —
no restart required.

### Added — `.stackblitzrc.json`

Tells StackBlitz to run `npm start` (which is `vite build && node
server.js`) on container boot, rather than guessing. Should fix the
"Cannot GET /" experience the demo button was hitting in production.

### No data changes

Pure server behaviour change. No data migration, no UI change in the
real app.

---

## [1.6.1] — 2026-04-30

PWA polish — making the existing Progressive Web App feel more like a
real desktop app, without yet shipping a native installer. This is the
quick win on the path to v2.0's Tauri repackage; everything here is
pure config / UX, no architecture changes.

### Added — Manifest shortcuts

Right-clicking the pinned PWA icon (Windows taskbar, Start Menu, Edge's
app launcher) now shows a jump-list:

- **New Invoice** → `/?view=new`
- **Dashboard** → `/?view=dashboard`
- **GST Returns** → `/?view=filing`
- **Settings** → `/?view=settings`

App boot reads the `?view=X` query param from the manifest shortcut URL
and lands the user directly on that view, then strips the query string
so a refresh doesn't keep snapping back to the shortcut target.

### Added — `window-controls-overlay` display mode

Manifest now declares `display_override: ['window-controls-overlay',
'standalone']`. On supporting Chrome / Edge, the installed app gets a
tighter title bar (the chrome shrinks, we get more vertical space).
Falls back to plain standalone everywhere else.

### Added — Richer manifest metadata

- **Description** rewritten to mention the actual features (GSTR-1/3B/2B,
  TDS/TCS, multi-currency, multi-account, recurring) — Chrome shows this
  in the install dialog and helps app-store-style PWA discovery
- **Categories** `['business', 'productivity', 'finance']` for platform
  recommendation engines
- **Orientation** locked to `portrait-primary` (no accidental
  landscape-mode invoices on a tablet)
- **`lang: 'en-IN'`** for locale-correct quotation marks etc.

### Changed — Install-banner dismissal

Previously: clicking ✕ on the install banner set `freegstbill_pwa_dismissed=1`
and the banner never reappeared. Users who closed it during a busy
moment never saw the option again.

Now: clicking ✕ stores a **timestamp**
(`freegstbill_pwa_dismissed_at`). The banner re-shows automatically
**14 days** after dismissal. The button tooltip says "Remind me later
(re-shows in 14 days)" so the behaviour is discoverable.

### Changed — Install-banner copy

"Install as Desktop App — opens instantly, no browser needed!" →
"Install as Desktop App — own icon, no browser, opens instantly.
Right-click the icon for quick-jump to New Invoice / GST Returns."

The new copy points at the manifest-shortcuts feature so users
understand why it's worth doing.

### Added — iOS standalone detection

Banner now also hides itself when running inside iOS Safari's "Add to
Home Screen" mode (`window.navigator.standalone === true`). Tiny audience
on iOS today, but no reason to nag those who already installed.

### Backward compatibility

- Existing dismissals using the old `freegstbill_pwa_dismissed=1` key
  still suppress the banner. Newly-dismissed users get the 14-day
  re-show.
- All other PWA behaviour (offline cache, service-worker auto-update,
  fonts cache, image cache) is unchanged.

### Not yet (deferred to v2.0)

- Native `.exe` / `.dmg` installers (Tauri repackage)
- Code-signed binaries (no SmartScreen warning)
- System tray icon
- Data migration from ZIP install location to `%APPDATA%`

The full plan for those is in the conversation around v1.6.0 — TL;DR:
Tauri shell wrapping the existing Node + Express + React build, plus a
first-run prompt that copies (never deletes) legacy `data/` folders into
the new per-user app-data location.

---

## [1.6.0] — 2026-04-30

Two big workflow improvements: **service-mode invoices** (with units that
make sense for time-based work) and **inline recurring** (turn any invoice
into a recurring template by ticking a single checkbox — server-side
auto-generates new invoices on schedule on every app boot).

### Added — Service invoice mode

- **Goods / Services / Mixed toggle** at the top of the invoice form. Drives:
  - Default unit on new line items — `Nos` for goods, `Hrs` for services
  - Unit dropdown filtering — services hides Kg / Ltr / Tonne / Bag etc.
    so the user sees Hrs / Day / Week / Month / Visit / Session / Project /
    Word / Page first; goods hides the time-based ones
  - Helpful "💡 Use a SAC code in the HSN field" hint on services
- **New built-in units** with kind tags: Week, Month, Year, Visit, Session,
  Project, Word, Page — all marked `kind: 'services'`. Existing units
  classified as `goods`, `services`, or `both`.
- **Smart unit memory** — adding a 2nd line item uses the same unit as the
  1st, so a 5-row services invoice doesn't make you pick "Hrs" five times.
- Custom user-defined units always show regardless of mode (escape hatch).
- The currently-selected unit on each line always shows even if the mode
  would otherwise hide it — switching mode mid-edit never blanks the
  dropdown.

### Added — Inline recurring invoices

You no longer have to build a Recurring template separately. Tick **🔁 Make
this a recurring invoice** in the Customize panel and you get:

- **Frequency**: Weekly / Monthly / Quarterly / Yearly
- **Interval**: every N (e.g. every 2 weeks, every 3 months)
- **Next invoice date** (date picker, defaults to one cycle from today)
- **End condition**:
  - *Never* (default — until you pause it in Recurring view)
  - *On a specific date*
  - *After N invoices have been generated* (perfect for fixed-term contracts)

On save, the invoice is created normally AND a recurring template is
written to `data/recurring/` with everything needed to clone it: client
snapshot, items, custom terms / notes / extra sections, invoiceOptions
(minus the recurring config itself, to avoid infinite recursion).

The existing Recurring Invoices view in the sidebar remains the place to
edit, pause, or delete templates after the fact.

### Added — Server-side auto-fire

`server.js` now runs `processDueRecurring()` 3 seconds after boot and once
every 24 hours afterwards. For every template with `nextDate <= today` and
`active`, the server:

1. Generates a fresh invoice number for the matching type prefix using the
   same atomic counter the frontend uses (race-free across both)
2. Resolves the **live** business profile (so renames since the template
   was created flow through, matching v1.4.2's company-name behaviour)
3. Writes a new bill snapshot dated today with the template's items + client
4. Advances the template's `nextDate` by `frequency × interval`
5. Increments `occurrencesCreated`
6. Respects `endMode: 'onDate'` / `endMode: 'afterN'` and stops automatically
7. Writes a breadcrumb to `data/meta.json` so the UI can show a "X recurring
   invoices auto-generated today" notification

The notification centre 🔔 surfaces this with a 🔁 row that click-throughs
to the Dashboard so the user can review the freshly-created bills.

### Notes on the auto-fire trigger

For most users this fires on every Windows login (the Startup-folder
shortcut starts the server when they log in). Users who never reboot get
the daily setInterval check as a backstop. A proper Windows Task Scheduler
entry that fires regardless of whether the user's logged in is on the v2.0
roadmap — for v1.6 the boot trigger covers ~95% of realistic use.

### Backward compatibility

- `invoiceOptions.invoiceMode` defaults to `'goods'` → old invoices behave
  identically.
- `invoiceOptions.recurring` defaults to `null` → no recurring template is
  created unless the user explicitly ticks the toggle.
- Existing recurring templates created via the standalone Recurring
  Invoices view also auto-fire on boot now (they share the same template
  shape) — net win for them too, no migration required.

---

## [1.5.3] — 2026-04-30

Hotfix. Production build threw `Uncaught ReferenceError: Cannot access 'Nt'
before initialization` on app load — white screen. Caused by a Temporal
Dead Zone violation introduced in v1.5.1.

### Fixed — TDZ on app load

In v1.5.1 the command-palette `paletteActions = useMemo(...)` and its two
dependent `useEffect` calls were placed near the top of `App.jsx`, but
their dependency arrays reference `navItems` and `handleNewInvoice` —
both `const` declared 200 lines lower in the same function body. The
useMemo dep array is evaluated synchronously on every render, so reading
those consts before their declaration threw at the first render — minified
as `Cannot access 'Nt' before initialization` in the production bundle,
manifesting as a white screen for users on v1.5.1 / v1.5.2.

The fix moves the useMemo and the two related useEffects down past
`navItems`. The state hooks (`showPalette`, `paletteQuery`, etc.) stay
where they were since they don't read those consts. Behaviour is
unchanged; only the declaration order moved.

Dev builds never hit this because the file was always running with the
declaration order already legal at HMR-patch time; only a full reload of
the bundled production JS surfaced the TDZ. Lesson: production bundles
are stricter about declaration order than dev bundles.

---

## [1.5.2] — 2026-04-30

Port choice + listener safety. The server has moved off the heavily-contested
**3001** default to **47371** (an unassigned IANA port) so a fresh install
doesn't collide with any of the dozen-or-so other dev tools that camp on the
3000-range. The launcher remains port-agnostic — you've never had to
remember the number, and now you have one less reason to think about it.

### Changed — default port

- **Default port: `3001` → `47371`.** The new default is in IANA's
  unassigned range (between registered 1024–49151 and dynamic
  49152–65535), where it's effectively guaranteed not to collide with
  anything common. The Start / Stop / Update / install-time scripts all
  read `data/port.txt` so they always open whichever port the server
  actually chose — users never need to remember a number.
- **Collision scan widened: 10 → 50 ports.** On the rare collision the
  server now scans `47371..47420` for a free port. If everything in that
  range is somehow occupied, it falls back to "let the OS pick anything
  free" (`port=0`) rather than failing to start. Whatever wins is
  persisted to `data/port.txt`, so the next launch tries that port first
  and avoids the scan entirely.
- **Server binds explicitly to `127.0.0.1`** (was the all-interfaces
  default). Closes a subtle exposure path where a user on shared Wi-Fi
  could have served the API to the LAN. The privacy promise is now
  enforced at the socket level, not just policy.

### Changed — launcher scripts

- **`Start FreeGSTBill.bat`** — default fallback updated to 47371 (was
  3001) for first-ever installs where `data/port.txt` doesn't yet exist.
  Documentation block added in-line explaining the read-write dance so
  future maintainers don't reintroduce audit bug B8 (probe-before-read
  timing).
- **`Stop FreeGSTBill.bat`** — default fallback updated to 47371. Still
  reads `data/port.txt` first; only falls back if the file is missing.
  Avoids the previous behaviour of taskkilling whichever poor app
  happens to be on port 3001.
- **`Update FreeGSTBill.bat`** — kills the legacy 3001 process *and* the
  one named in `data/port.txt`, so users upgrading from v1.5.1 or earlier
  cleanly transition to the new default.

### Removed

- **Deleted `localhost-3001 (Open This in Browser).txt`** from the repo
  root. The filename was misleading (the port can vary), redundant with
  `START HERE.txt` (which covers the same instructions in a better
  place), and the audit flagged its existence as a UX wart.

### Documentation

- `README.md`, `START HERE.txt`, `docs/USER_GUIDE.md`, and the in-app
  searchable User Guide (`src/userGuideContent.js`) all updated:
  `localhost:3001` → `localhost:47371`. README's Quick Start gained a
  *"Why port 47371?"* paragraph so curious users get the rationale
  inline instead of stumbling on it later.

### Upgrade notes

- **Existing installs** (v1.5.0 / v1.5.1 running on port 3001 with a
  `data/port.txt` saying `3001`) — keep running on 3001 forever unless
  they delete `data/port.txt`. The persisted preference always wins.
  Nothing breaks.
- **Fresh installs** start on 47371 automatically.
- **Switch an existing install to 47371**: stop the server, delete
  `data/port.txt`, restart. The launcher will discover the new port and
  open the right URL on its own.

---

## [1.5.1] — 2026-04-30

Quality-of-life release executed from the post-v1.5 audit. Five bug fixes,
three power-user features (bulk ops, keyboard shortcuts, notifications),
and three GST compliance additions (Cess, RCM, Composition variant). No
data migration — all changes additive and backward-compatible.

### Fixed — confirmed bugs from the audit

- **Export backup hardcoded `version: '1.4.0'`** — now reads live from the
  server via `/api/version` and caches per session ([src/store.js](src/store.js)).
- **Dashboard overdue auto-detection** ran `await saveBill(bill)` inside a
  for-loop — one failure stopped all subsequent updates and saves were
  serialised. Now collects dirty bills and fires `Promise.allSettled`;
  most loads do zero work because the filter pre-checks
  ([src/components/Dashboard.jsx](src/components/Dashboard.jsx)).
- **`calculateLineItemTax()` accepted NaN / negative / string inputs** and
  silently propagated `NaN` through totals. Now defensively coerces every
  field via `finiteNonNeg` and clamps the discount to never exceed line
  value. UI inputs were already clamped, but CSV imports and recurring
  template materialisation now get the same safety net
  ([src/utils.js](src/utils.js)).
- **`recordPayment()` accepted negative and overpayment amounts silently**.
  Now rejects ≤ 0, validates against outstanding balance, and asks for
  confirmation on intentional overpayments ([src/components/Dashboard.jsx](src/components/Dashboard.jsx)).
- **`formatDateGST()` returned `"NaN-NaN-NaN"`** for malformed dates,
  silently corrupting GSTR-1 rows. Now returns empty string on Invalid
  Date ([src/utils.js](src/utils.js)).

### Added — Bulk operations on Bills list

Checkbox column with select-all-visible. When any rows are ticked, a
sticky toolbar shows: **Mark paid** · **Mark unpaid** · **Mark overdue**
· **Export selected as JSON** · **Delete**. All bulk handlers use
`Promise.allSettled` so a single failed save doesn't strand the batch.

### Added — Keyboard shortcuts + command palette

- **`Ctrl/⌘+K`** — Spotlight-style command palette. Type to filter, ↑/↓
  to navigate, Enter to run, Esc to close. Actions: New Invoice · jump
  to any nav page · toggle dark mode · open update modal · show
  shortcuts help.
- **`Ctrl/⌘+N`** — new invoice from anywhere (skipped when typing in an
  input/textarea).
- **`Ctrl/⌘+S`** — save current invoice (only on the invoice form, only
  when the invoice has meaningful content).
- **`Ctrl/⌘+P`** — download current invoice as PDF (only on the invoice
  form).
- **`Ctrl/⌘+/`** — toggle a keyboard-shortcuts help modal.
- New `kbd` styling in CSS for the help modal's key cap visuals.

### Added — Notification centre

Sidebar **🔔 Notifications** button with a red count badge. Popover lists:

- 🔴 Overdue invoices (with sample invoice numbers, click → Dashboard)
- 🟡 Invoices due in the next 3 days (click → Dashboard)
- 🔵 GST filings due in the next 10 days — GSTR-1 (11th), GSTR-3B (20th),
  Form 26Q (last day of month after quarter), Form 27EQ (15th of month
  after quarter), computed by the new `getUpcomingFilings()` helper
  (click → GST Returns)
- 🟢 Products low on stock (click → Inventory)

Computed on mount + every 10 minutes; also recomputes on view change so
the badge stays fresh after the user records a payment or sells stock.
Click outside the popover to dismiss.

### Added — GST compliance trio

- **GST Compensation Cess** — opt-in per-line `cessPercent` field
  (Customize → Items → "GST Cess % column"). Computed off the post-discount
  taxable value (back-calculates correctly when tax-inclusive prices are
  used) and added on top of the invoice total. Renders as its own row in
  the PDF totals block when non-zero.
- **Reverse Charge Mechanism flag** — invoice-level toggle (Customize →
  Compliance flags → "Reverse Charge applies"). When set, the PDF prints
  a prominent declaration: *"Reverse Charge applicable. GST is payable
  by the recipient under Section 9(3)/9(4) of the CGST Act."*
- **Composition-scheme invoice variant** — new invoice type alongside
  Bill of Supply / Tax Invoice / etc. Same template as BoS but auto-adds
  the Rule 46A declaration: *"Composition taxable person, not eligible
  to collect tax on supplies."*

### Notes for upgraders

- Saved invoices that pre-date these features render identically — `cess`,
  `reverseCharge` and the Cess column are all opt-in and absent from the
  defaults.
- Composition is just an INVOICE_TYPES entry — switching to it on a new
  invoice picks up the COMP prefix and the declaration automatically.

---

## [1.5.0] — 2026-04-30

Multi-account payment support. A profile can now hold many bank / UPI
accounts; you pick one per invoice from the Customize panel; the bank
block AND UPI QR on the PDF flow from the selected account together.

Designed and reviewed under the brainstorming skill before any code
changes — full spec at
[docs/superpowers/specs/2026-04-30-multi-account-payments-design.md](./docs/superpowers/specs/2026-04-30-multi-account-payments-design.md).

### Added — Payment Accounts

- **New "Payment Accounts" card** in Settings (between Region Preference
  and Modules). Each profile carries an ordered `paymentAccounts` array;
  per-row buttons: ⭐ Set default · ↑ ↓ Move · Edit · Activate/Deactivate
  · Delete.
- **Account fields**: label (free text, shown in dropdown and optionally
  on PDF), bank name, account number, IFSC (country-aware label →
  IBAN / Sort Code / Routing / BSB), SWIFT, UPI ID, internal notes, plus
  `isDefault` and `isActive` flags.
- **Account number masked** in the list (`••••6789`) — full number only
  inside the edit form and on the PDF.
- **Inactive accounts** hidden from new-invoice dropdowns but kept
  editable; historical invoices that used them still resolve correctly.
- **⭐ Default constraint** enforced on save — exactly one per profile.
- **UPI VPA soft validation** — warning if format doesn't match
  `<handle>@<provider>` pattern; never blocks save.

### Added — Invoice form integration

- **"Payment account on this invoice"** dropdown in Customize panel,
  positioned with the other invoice-level pickers (currency, PDF style).
  Lists only active accounts of the active business profile.
- **`selectedAccountId`** stored on `invoiceOptions` so reopening the
  invoice produces the same PDF.
- **Default seeding** — new invoices default to: (1) last-used account
  for this profile from `localStorage.gst_lastUsedAccountId_<profile>`,
  (2) failing that the ⭐ default, (3) failing that the first active
  account, (4) failing that null.
- **"Show *Pay via: <account>* label"** toggle in Customize → Footer;
  prints the account label above the bank-details block on the PDF for
  invoices where the account choice matters to the client.

### Changed — PDF rendering

- Bank details block now reads from the resolved account via
  `getAccountById(profile, options.selectedAccountId)`. Falls back to
  flat profile fields when neither array entry nor flat field exists
  — guarantees byte-identical PDFs for v1.4.x invoices.
- UPI QR `useEffect` now keyed on `account.upiId` instead of
  `profile.upiId`. Switching account swaps the QR. If the selected
  account has no UPI ID → no QR, same as today's empty-UPI case.

### Changed — Welcome wizard

- On *Finish*, the wizard's flat bank/UPI inputs are also mirrored into
  `profile.paymentAccounts: [{...thatAccount, isDefault: true,
  isActive: true}]`. New users have one account auto-marked Primary
  with zero extra wizard steps.

### Backward compatibility

- **`getPaymentAccounts(profile)`** transparently synthesises a single
  "Default account" from legacy flat fields (`bankName`, `accountNumber`,
  `ifsc`, `swift`, `upiId`) when the array is missing or empty. Old
  invoices, old profiles, old backups all render identically.
- **Migration banner** in Settings → Payment Accounts (one-time, shown
  only when `paymentAccounts` is empty AND legacy fields are set):
  *"Imported your existing bank details as the first account. Edit it
  or add more below."* One click *Import & continue* writes the
  synthesised account into the array.
- **Forward syncing** — when the default account changes (via Edit,
  ⭐ button, or Delete), the profile's flat fields are kept in sync with
  the default account so any v1.4.x reader of the same `profile.json`
  still sees consistent data. Graceful one-way downgrade.
- **Backup pipeline** unchanged — `paymentAccounts` is just a property
  of the profile object, which already rides along under the existing
  "Active business profile" / "All business profiles" checkboxes.

### Utility helpers

`src/utils.js` gains:
- `getPaymentAccounts(profile)` — array or synthesised legacy fallback
- `getDefaultAccount(profile)`, `getAccountById(profile, id)`
- `getActiveAccounts(profile)` — filter to `isActive`
- `createEmptyAccount(label)`
- `maskAccountNumber(s)`
- `reorderAccounts(list, fromIdx, toIdx)`
- `setDefaultAccount(list, accountId)`
- `isValidUpiId(s)`

---

## [1.4.3] — 2026-04-30

In-app update notifications. Existing users now find out about new releases
without having to manually check Settings → Updates.

### Added — In-app update notifier

- **Auto-poll for updates** on app start (after a 5-second cool-down) and
  every 6 hours while open. Quietly skips when offline.
- **Sidebar banner** — orange-pulse "Update to vX.Y.Z" button appears at
  the bottom of the sidebar when GitHub has a newer version. A small
  amber dot also shows on the Settings nav item as a secondary cue.
- **Release notes modal** — clicking the banner opens a modal with the
  full release notes (fetched from the GitHub Releases API), a clear
  data-safety reassurance, a link to view the release on GitHub, and
  the existing one-click *Update Now* button (triggers
  `freegstbill-update://run`).
- **Per-version dismissal** — *Skip this version* and *Remind me later*
  buttons. Skipping a version remembers it in localStorage, so the
  banner doesn't keep nagging, but a NEW release re-shows it. Reminders
  reappear on next page load.
- **Pre-update backup nudge** — modal calls out that exporting a backup
  first is recommended, with a one-click jump to Settings → Data
  Management.
- **Server `/api/check-update` extended** to call the GitHub Releases
  API in parallel and return release notes, URL, publish date, and tag.
  4-second timeout via `AbortController` so a flaky network can't
  block the response. Replaced naive string-comparison with a proper
  numeric semver compare so `1.4.10` > `1.4.2` works.

### Notes on data safety

The existing `Update FreeGSTBill.bat` script already:
1. Stops the server cleanly (taskkill on the listening port).
2. Copies `data/`, `Saved Invoices/`, `Trash/` to `%TEMP%\freegstbill_backup` BEFORE pulling new code.
3. Uses `robocopy /XD data "Saved Invoices" Trash` so the new code can never overwrite the data folders.
4. Restores from the temp backup as a belt-and-suspenders step, even though step 3 already excluded them.
5. Verifies the version actually changed; warns if not.

The new modal surfaces this guarantee in plain English so non-technical
users don't worry, and offers a one-click jump to *Export Backup…* if
they want extra reassurance.

---

## [1.4.2] — 2026-04-30

Audit follow-up release tackling the harder bugs from the v1.3.0 internal
audit, plus a dark-mode pass that fixes invisible text on coloured panels.
No new feature surface — but several long-standing correctness issues
finally closed.

### Fixed — Audit P0 / P1 bugs (v1.3.0 audit report)

- 🔴 **B1 — Invoice-number race fixed.** Two concurrent invoice saves can
  no longer both read counter=5 and both write counter=6 (= duplicate
  invoice numbers, a GST audit failure). New atomic
  `POST /api/meta/:key/increment` endpoint reads + increments + writes in
  a single synchronous Express handler; Node's single-threaded I/O makes
  this race-free across HTTP requests. `getNextInvoiceNumber()` now uses
  it.
- 🟡 **B9 — Silent server failure.** When the server is launched via
  `start-server-silent.bat` (hidden window) and crashes on startup, the
  user previously saw nothing. Server now appends every fatal error to
  `data/errors.log` with timestamp and stack trace. New
  `GET /api/health` endpoint returns the last 4 KB of the log so the UI
  can surface a banner. `uncaughtException` and `unhandledRejection`
  handlers log instead of silently dying.
- 🟡 **I7 — SIGINT/SIGTERM graceful shutdown.** `Stop FreeGSTBill.bat`
  uses `taskkill /f`, which can interrupt a sync write mid-flight and
  corrupt JSON. Server now traps SIGINT/SIGTERM, calls `server.close()`
  with a 3-second grace window for in-flight requests, then exits.
- 🟢 **I12 — Strict Content Security Policy** added to `index.html`.
  `default-src 'self'`, scripts limited to same-origin + Google
  Identity Services (Drive auth), connect-src restricted to localhost +
  Google APIs + GitHub release feed. Defends the rich-text Terms /
  Notes / extra-section paths even if DOMPurify config is ever
  loosened.
- 🟢 **I5 — Custom-unit warning on GSTR-1 export.** When the HSN summary
  in the GSTR-1 JSON includes any item with a custom unit (mapped to
  UQC `'OTH'`), the export toast now says how many items were affected
  so the filer knows to map them to a standard UQC if precision matters.

### Fixed — Profile name auto-propagation

- **Saved invoices now auto-reflect business profile edits.** Previously
  a saved bill carried a frozen snapshot of `profile.businessName`,
  address, logo, etc. — renaming "Acme" to "Acme Inc" in Settings
  required re-opening and re-saving every old invoice. The PDF preview
  now matches the snapshot's `businessName` (or `id`) against the live
  profiles list and uses the live data, falling back to the snapshot if
  the profile was deleted. PDF re-renders pick up renames, address
  changes, new logos automatically.

### Fixed — Dark / light mode visibility

- **Global utility CSS.** New `.notice`, `.notice-info`, `.notice-warn`,
  `.notice-note`, `.notice-danger`, `.surface-card`, `.cbx-list`,
  `.cbx-row`, `.cbx-label`, `.cbx-hint`, `.cbx-meta`, `.status-pill`,
  `.kv-list`, `.section-mini-label` classes in `src/index.css`. They
  replace the dozen-or-so duplicated inline-style blocks that had
  hardcoded light-mode colours, so every panel now follows the same
  dark/light tokens.
- **CSS variable expansion.** Added `--bg-secondary`, `--bg-tertiary`,
  `--text-primary`, `--border-color`, `--note-bg/border/text`,
  `--info-bg/border/text`, `--warn-bg/border/text`. Both `:root` (light)
  and `[data-theme="dark"]` carry the full set so any component using
  these names works without theme-specific overrides.
- **Removed hardcoded colours** from the Settings privacy notice,
  Export/Import modal Drive checkbox, modal warning bars, the GSTR-2B
  reconciliation status pills, the InvoiceGenerator TDS / TCS toggle
  cards, and the Modules grid.

### Documentation — README roadmap audit

- **README "Roadmap" section overhauled.** Items already shipped in
  v1.3 / v1.4 are now in a new "Recently Delivered" list (GSTR-2B,
  GSTR-1/3B JSON, multi-GSTIN, TDS/TCS, units, country tax labels,
  region preference, modules page, granular PDF control, rich Terms
  + 13 India presets, granular backup, in-app User Guide, GST
  compliance fixes). The "Coming Soon" / "Planned" / "Community
  Requested" buckets are realigned to actual remaining work, with
  cross-references to [TAX_HELPER_PLAN.md](./docs/TAX_HELPER_PLAN.md) and
  [COMPETITOR_GAPS.md](./docs/COMPETITOR_GAPS.md).

### Notes on items I deliberately left for v1.5+

- **B6 / B10 — stockDeducted ref + null product on delete.** Inspected
  and the existing code already null-checks `productId` and
  `find(p => p.id === item.productId)`; React unmounts the
  InvoiceGenerator on Back, so the ref resets. Audit was on a slightly
  earlier version. Leaving as-is.
- **B8 — `Start FreeGSTBill.bat` reads `port.txt` before probe.** Real
  bug, but the .bat fix needs Windows testing in a VM to verify the
  rewrite doesn't break the auto-launch. Punting.
- **I9 — Recurring invoices auto-fire when app is closed.** Needs a
  Windows Task Scheduler entry or a Node service. Out of scope for a
  single edit pass.
- **B4 — Tax-inclusive interstate IGST math.** Verified against the
  v1.4.0 totals refactor; the math is correct (taxableValue back-calc
  applies before the inter/intra split). Leaving as-is.

---

## [1.4.1] — 2026-04-30

Follow-up release on top of 1.4.0 — granular backup, TDS reports, in-app
searchable User Guide, and a handful of audit fixes from the v1.3 review.

### Added — Backup & restore (full overhaul)

- **Granular Export modal** — pick exactly what to back up via checkboxes:
  active business profile, all profiles, invoices, clients, products,
  expenses, purchases, recurring, receipts, terms templates, app settings
  (region / modules / invoice number format / display options), and local
  preferences (custom units, theme, last region). Each row has a hint
  explaining what it includes.
- **Granular Import modal** — opening a backup file shows you exactly what
  is inside (counts per category) before you commit. You can selectively
  restore just one part — e.g. only the client list, or only settings —
  without touching anything else.
- **localStorage data now rides along in backups.** Custom units, theme,
  region preference, enabled modules, invoice display defaults, onboarded
  flag — all preserved across "move to a new computer" flows. Previously
  these survived only if the user manually copied the browser profile.
- **Optional "Save a copy to my Google Drive"** checkbox in the Export
  modal. Uploads the same JSON file to your own Drive's
  *<Folder> - Backups* subfolder using the Drive client ID you already
  configured for PDF backup. Local download always happens too — Drive
  is just a parallel copy.
- **New Drive helpers** in `src/services/googleDrive.js`: `uploadJSON`,
  `listBackupsInFolder`, `downloadFileText` — building blocks for v1.5
  "Restore from Drive" picker.
- **Privacy notice** at the top of Settings → Data Management. Explicit,
  green-card callout that everything stays on the user's computer unless
  they tick "Save to Drive". Names the exact folders (`data/`,
  `Saved Invoices/`).

### Added — TDS / TCS Reports

- **New tab in GST Returns: TDS / TCS Report.** Aggregates every invoice
  in the filtered period that has TDS deducted by the buyer or TCS
  collected from the buyer:
  - **TDS Receivable** dashboard — count, total taxable value, total
    TDS, plus per-quarter / per-section breakdown table.
  - **TCS Collected** dashboard — same shape, distinct totals.
  - **CSV exports** for each, formatted as ready input for **Form 26Q**
    (TDS quarterly return) and **Form 27EQ** (TCS quarterly return).
  - Friendly empty state explains how to enable TDS / TCS on an invoice.
- Direct link to <https://www.tin-nsdl.com> in the help banner so users
  know where to file the returns once they have the CSVs.

### Added — In-app Searchable User Guide (PDF)

- **New User Guide view** in the sidebar. Renders 17 sections (Quick
  Start, first-run wizard, daily use, India vs International, modules,
  PDF customization, Terms presets, TDS/TCS, GST returns, E-Way Bill,
  backup, migration, FAQ, troubleshooting, developer setup) with a live
  search box that highlights matches in yellow.
- **Download as PDF** button generates a true text-based PDF using
  jsPDF's native `text()` API — *searchable*, *copy-pasteable*, and
  much smaller than the html2canvas approach we use for invoices. The
  guide content lives in `src/userGuideContent.js` as a structured
  array so on-screen and PDF render can never drift.
- Headings, paragraphs, ordered/unordered lists, key/value tables, and
  callout-style notes are all supported.

### Fixed — Audit follow-ups

- **Aging-bucket NaN crash** ([ReportsView.jsx:117](src/components/ReportsView.jsx#L117))
  fixed: invalid or missing dates now produce 0 days overdue instead of
  `Math.floor(NaN)` propagating through the chart. Legacy bills without
  `dueDate` no longer break the Reports page.
- **`engines` field added** to package.json (`node >= 18.0.0`). Old
  Node 14/16 users now fail `npm install` with a clear "needs Node 18+"
  message instead of cryptic ESM errors.

---

## [1.4.0] — 2026-04-30

This release answers the user-prioritized roadmap items #4, #6, and #7 from
[COMPETITOR_GAPS.md](./docs/COMPETITOR_GAPS.md): TDS/TCS, GSTR-2B reconciliation,
and direct GSTR JSON exports. Also a Modules page for turning off features
you don't use, granular PDF field control, formattable Terms with
business-type presets, and the interstate-purchase ITC routing fix the
internal audit flagged.

### Added — Compliance roadmap (items #4, #6, #7)

- **TDS / TCS on invoices.** Per-invoice toggle in the Customize panel:
  - **TCS** (Section 206C(1H), 52, etc.) is collected from the buyer and
    *adds* to the invoice total. Default rate 0.1% per 206C(1H), editable.
  - **TDS** (Section 194Q, 194C, 194J, 194I, 194H, 194O, 195, etc.) is
    deducted by the buyer and shown as an *informational* line below
    "Total Due" with a "Net Receivable" caption — the invoice total itself
    is unchanged.
  - 11 common TDS sections preset with default rates, plus a custom-rate
    option. Both fields hidden for non-Indian profiles.
- **GSTR-2B reconciliation.** New tab under GST Returns. Import the
  GSTR-2B JSON downloaded from the GST portal; we match each entry against
  your purchase records by supplier GSTIN + invoice number and flag:
  - ✓ Matched
  - ⚠ Amount mismatch (within ±₹1 tolerance)
  - ⚠ Books only (you recorded it, supplier hasn't filed yet)
  - ⚠ 2B only (supplier filed it, you forgot to record)
  - Filterable summary chips, full diff table, CSV export of the result.
- **GSTR-3B JSON export.** Direct upload format (schema v1.7) matching the
  GSTN offline tool. Sits next to the existing GSTR-3B CSV button. GSTR-1
  JSON export was already present and uses the same schema-compliant
  output.

### Added — Purchases & ITC

- **Inter-state purchase flag** on each Purchase Bill. When ticked, the
  supplier's IGST flows into IGST ITC in GSTR-3B Table 4(A) instead of
  being incorrectly split CGST + SGST. Closes the ITC-routing gap flagged
  in the v1.3.0 internal audit.

### Added — UX & customization

- **Modules page** (Settings → Modules). Group-based on/off toggles for
  every feature: Sales & Invoicing, Directory, Purchases & Expenses, GST
  & Tax, Reports, Integrations. Disabling a module hides it from the
  sidebar and from related forms — your data is never touched. Core
  modules (Dashboard, Clients, Invoicing, Settings) are locked on so the
  app stays usable.
- **Granular PDF field control.** The Customize panel now groups every
  toggle by section: Header & branding, Client / Bill-to, Invoice meta,
  Items table, Totals, Footer. New toggles: business name, business
  address, business phone, business email, client phone, client email,
  client address, invoice number, invoice date, unit column, rate column,
  subtotal row, "Authorized Signatory" caption. Plus *Hide all* and
  *Reset to default* buttons.
- **Rich-text Terms & Notes.** Replaced the plain textarea with an inline
  rich editor: bold, italic, underline, bullet/numbered lists, headings,
  links, clear-formatting. Output is DOMPurify-sanitized and rendered as
  HTML in the PDF.
- **Terms presets by business type (India).** 13 starter templates the
  user can drop in and edit:
  Generic SME / Trader, Freelancer / Consultant, Manufacturer / Wholesale,
  Retail Shop, Restaurant / Café, IT / Software Services, Construction /
  Contractor, Medical / Healthcare, Educational Services, Transport /
  Logistics, Real Estate / Rental, E-commerce Seller, Export / LUT.
  Each includes India-relevant clauses (TDS section, jurisdiction,
  Section 50 interest, etc.).

### Installer & Windows security

- **No more `powershell -Command "Invoke-WebRequest ..."` in the install
  flow.** The previous installer auto-downloaded the Node.js MSI to
  `%TEMP%` and ran `msiexec` against it — clean, but heuristic antivirus
  routinely flags any .bat that fetches and runs an executable. We now
  open the official nodejs.org download page in the user's browser
  instead. Less scary, fewer false positives.
- **Pre-flight check** in the installer: bail out early with a friendly
  message if `package.json` isn't in the working folder (catches the
  common "ran the .bat from Downloads instead of the extracted folder"
  mistake).
- **Up-front messaging** about no-admin-needed, no-HKLM-writes, no-data-
  exfiltration, and a link to the GitHub source so users can verify the
  script before running.
- **`.gitattributes`** added to enforce CRLF on `*.bat`/`*.cmd`/`*.ps1`
  and LF on JS/CSS/MD. Linux / Mac developers cloning the repo and
  emailing the .bat to a Windows user will no longer ship a script that
  cmd.exe refuses to run.
- **SmartScreen / antivirus guidance** added to START HERE.txt and
  [USER_GUIDE.md](./docs/USER_GUIDE.md) — covers the blue "Windows protected
  your PC" screen, the right-click → Properties → Unblock workaround for
  Mark-of-the-Web, and antivirus exclusion paths.

### Notes for the income-tax helper

[TAX_HELPER_PLAN.md](./docs/TAX_HELPER_PLAN.md) remains the planning doc for
the v1.5.x income-tax helper (bank-statement CSV import + ITR Filing
Summary PDF). The IT Department portal accepts JSON only via authenticated
browser uploads — there is no public API — so the realistic ceiling is a
machine-readable summary the user pastes into the portal manually, plus
optionally an ITR-4 Excel-utility-compatible JSON they upload by hand.

---

## [1.3.0] — 2026-04-30

Big release focused on (a) Apurba's unit-of-measure request from the
community, (b) closing the gaps that were keeping foreign-client invoices
from being truly usable, (c) fixing the long-standing "empty draft saved as a
real bill" bug, and (d) making onboarding friendly for non-technical users.
India-specific flows (CGST/SGST/IGST split, E-Way Bill, GSTR exports) keep
working as before.

### Added — Onboarding & UX
- **Region Preference toggle** in Settings → Region Preference: choose between
  *India only*, *International*, or *Both / Auto*. Drives which countries
  appear in pickers, which currencies are offered, and whether GST-only flows
  show up. Switchable any time without losing data.
- **Welcome wizard now asks about region** on the first screen and adapts
  every subsequent step (state dropdown, tax-ID label, bank fields) to the
  chosen country instead of being India-only.
- **Country auto-detected from browser locale** on first run. The wizard
  pre-selects *India* / *Outside India* / *Both* based on `navigator.language`.
- **Save-before-leave guard** — clicking *Back* with unsaved changes now
  prompts to save instead of silently discarding (and also catches browser
  refresh / tab close).
- **Plain-language USER_GUIDE.md** — covers daily use, backups, migration to
  a new computer, FAQ, and troubleshooting. Linked from the installer and
  START HERE.txt.
- **START HERE.txt rewritten** for non-technical readers with clearer
  step-by-step instructions, region-aware setup notes, and pointers to the
  user guide.
- **Installer messaging warmer** — explains up-front that the script is
  one-time, requires no input, and installs Node.js automatically if needed.

### Improved — PDF quality

- **Sharper, crisper PDFs** without proportional file-size increase. Render
  scale is now `max(3, devicePixelRatio × 2)` (was fixed at 2), JPEG quality
  is 0.95 (was 0.92), and the jsPDF stream now uses deflate compression
  (`compress: true`) plus MEDIUM image compression. Small text and the UPI QR
  are visibly sharper. Net file size typically stays within ±10% of the
  previous output despite the higher source resolution because compression
  efficiency improves at higher resolution for clean line-art / glyphs.

### Fixed — Empty-draft bug
- **New invoices no longer save to the bills list until they have meaningful
  content** (a client name plus at least one item with a non-zero amount).
  Previously, opening *New Invoice* and clicking away would persist an empty
  bill and clutter the list. Drafts still auto-save to sessionStorage so an
  in-progress invoice survives a browser refresh.
- New status badge: *Draft only — not saved yet* / *Saving…* / *All changes
  saved*, so you always know where you stand.

### Fixed — GST compliance bugs (from internal audit)

These are real correctness fixes that affect filings — not UX polish.

- 🔴 **`placeOfSupply` override now drives the CGST/SGST/IGST split.**
  Previously the split was computed only from the client's registered state,
  ignoring an explicit place-of-supply field. Per GST law the tax type
  follows the place of supply, not the registered address. A Delhi seller
  invoicing a Delhi client for a supply consumed in Haryana now correctly
  charges IGST.
- 🔴 **E-Way Bill `supplyType` was emitting `I` (Inward) for interstate
  outward supplies, getting the JSON rejected by the NIC portal.** The
  schema defines `O` for any outward (seller-issued) bill and `I` for
  inward — it has nothing to do with intra/interstate. Now hardcoded to
  `O` for seller-issued bills; intra/inter is captured via state codes.
- 🔴 **E-Way Bill pincodes hardcoded to `0`** are rejected by the portal
  with "Invalid Pincode". Now read from `profile.pin` / `client.pin`, with
  a fallback that extracts a 6-digit code from the address. If no pincode
  is found, the export throws a clear error pointing the user to the
  Settings field instead of producing a guaranteed-rejected payload.
- 🔴 **GSTIN validation regex in GST Returns disagreed with Settings —
  Settings accepted GSTINs ending in a letter, GST Returns flagged them as
  invalid.** Both now use the official format
  `^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z\d]$` (last char can be alphanumeric).
- 🟡 **SEZ client flag** (Settings → Add Client / Edit Client → "SEZ unit /
  Developer" checkbox). When set, supplies are charged IGST regardless of
  state — Section 16, IGST Act. Threaded through totals, invoice preview,
  and GSTR-1 classification.
- 🟡 **`details.placeOfSupply` is now respected throughout `GSTReturns.jsx`**
  (B2B / B2C Large / CDNR / HSN / GSTR-1 JSON / GSTR-3B). All 11 inline
  `prof.state !== client.state` checks were replaced with a single
  `billIsInterstate(bill)` helper that follows the place-of-supply override
  and SEZ flag.
- 🟡 **GSTR-3B late-fee cap text was wrong** — said ₹10,000 (pre-2023 rule),
  should be ₹5,000 / ₹500 nil per the CGST Amendment Act 2023.
- 🟡 **`taxInclusive` math** is now correctly threaded into GSTR-1 / GSTR-3B
  calculations. Previously, MRP-style invoices over-stated taxable value in
  the returns by including the embedded tax inside the "taxable" figure.
  `calculateLineItemTax(item, taxInclusive)` is the single source of truth
  for line-item math now.

### Documentation

- **[USER_GUIDE.md](./docs/USER_GUIDE.md)** — plain-language handbook covering
  daily use, backup, migration to a new computer, FAQ, troubleshooting.
- **[COMPETITOR_GAPS.md](./docs/COMPETITOR_GAPS.md)** — gap analysis vs the top
  5 GitHub OSS projects (ERPNext, Akaunting, Invoice Ninja, Crater,
  InvoiceShelf) and top 5 commercial Indian tools (Tally, Vyapar, Zoho,
  ClearTax, Marg). Includes the prioritized post-1.3 roadmap (e-Invoice
  IRN, RCM, Cess, GSTR-2B reconciliation, Tally export, payment-gateway
  links, mobile app).
- **[TAX_HELPER_PLAN.md](./docs/TAX_HELPER_PLAN.md)** — proposal for the v1.4.0
  Income Tax Helper feature (bank-statement import + ITR filing summary
  PDF). Three-tier scope, with realistic limits on what's possible without
  a public REST API from the IT Department.
- **[START HERE.txt](./START%20HERE.txt)** rewritten for non-technical users.

### Known limitations carried into 1.4.0
- 🟡 GSTR-3B Table 3.1 still emits a single "(a) taxable" row — needs
  invoice-level categorization for zero-rated, nil, exempt, and non-GST
  supplies before we can split it correctly.
- 🟡 Purchase ITC in GSTR-3B is split 50/50 CGST+SGST regardless of
  source. Inter-state purchases need a flag on the purchase record so we
  can route their ITC to IGST. Coming in 1.4.0 with the Income Tax Helper.
- 🟡 HSN digit-count enforcement (4-digit < ₹5cr / 6-digit ≥ ₹5cr) not yet
  enforced — currently warns only when HSN is missing.

### Added — Line items
- **Per-line unit of measurement** (kg, ltr, mtr, ft, hrs, box, pcs, …) on every
  invoice. Quantity now displays as `2 Kg`, `10 Ft`, `50 Pcs` in the PDF/preview.
- **Custom units** — pick `＋ Add custom…` from the unit dropdown to define your
  own (e.g. *Carat*, *Bundle*, *Bushel*). Persists per-device and shows up
  everywhere units are used. Custom units can also be removed from the same
  dropdown.
- Saved products now remember their unit; picking a product autofills its unit
  on the line item.
- **Custom tax rate** option in the rate dropdown. The defaults shown in the
  dropdown follow the seller's country (5/12/18/28% for India, 5/20% for UK,
  10% for Australia, 9% for Singapore, 0/15% for Saudi Arabia, etc.) and you
  can always type any rate via the *Custom…* entry.

### Added — International / multi-country
- **Country-aware tax labels** — invoices for non-Indian businesses now show
  *VAT*, *MwSt*, *TVA*, *SST*, *PPN*, *Sales Tax*, etc. instead of hardcoded
  *GST*/*CGST*/*SGST*/*IGST*. India keeps its CGST+SGST / IGST split.
- **Country-aware bank labels** — the bank-details footer renders the correct
  field name per country (IFSC for India, IBAN for UAE / Germany / Saudi
  Arabia, Sort Code for UK, Routing Number for US, BSB for Australia, etc.).
- **SWIFT / BIC field** in Settings → Bank Details for foreign accounts. PAN
  field is hidden for non-Indian profiles.
- **Exchange rate snapshot** — when invoicing in a non-INR currency, you can
  enter the FX rate in the Customize panel. The rate is stored on the invoice
  itself so historical reports stay accurate even if rates change later.
- **Currency picker expanded** — all 22 supported countries' currencies are now
  selectable (was previously hardcoded to 8).
- **Amount-in-words** now correctly names: Dirhams/Fils, Riyals/Halalas,
  Rand/Cents, Naira/Kobo, Shillings/Cents, Taka/Poisha, Pesos/Centavos,
  Rupiah/Sen, Ringgit/Sen, and 13 more — was previously English only for
  USD/EUR/GBP/AUD/CAD/SGD/AED.
- **Country default inherits from the active business profile** instead of
  always defaulting to India in the client modal.
- **First-run country detection** — the *Add new profile* form now picks the
  initial country from your browser locale (`navigator.language`) instead of
  forcing India.
- **Soft tax-ID validation** — on blur, the GSTIN / TRN / VAT / EIN field shows
  a warning if the format doesn't match the country's expected pattern. It's a
  warning only — the field is never blocked from saving.

### Added — Totals
- **Round-off line** — opt-in toggle in the Customize panel. Rounds the final
  total to the nearest whole unit and shows the +/- delta on the invoice. Off
  by default; existing invoices are unaffected.

### Fixed
- **Hardcoded ₹ symbol** in product suggestions and the inventory price column
  no longer ignores the selected currency. A USD invoice now shows `$100`, not
  `₹100`.
- **Interstate split silently breaks when business state is missing.**
  Previously an empty profile state caused all GST invoices to default to
  CGST+SGST (intrastate) even when the client was in a different state. Now we
  toast a warning the first time you open an invoice with this misconfig.
- **E-Way Bill export** now throws a friendly error instead of generating
  garbage JSON when the seller's country is set to anything other than India.
- **Negative quantity / rate / discount** could be entered via paste or the
  browser console. Inputs are now clamped to non-negative on every change, and
  fractional quantities are properly supported (`step="any"`) for kg/ltr/hrs.
- **HSN summary UQC code** in the E-Way Bill JSON now uses the line item's
  actual unit (`KGS`, `MTR`, `LTR`, …) instead of always emitting `NOS`.
- **Bill of Supply** invoice type now correctly hides any default round-off
  line (round-off is opt-in regardless of type).

### Notes for upgraders
- No data migration is required. Existing line items without a `unit` field
  default to *Nos* on display.
- The previous v1.2.0 invoice options (`showHSN`, `showGST`, etc.) are
  preserved as-is. The new `showRoundOff` and `exchangeRate` options default to
  off / empty.
- Custom units are stored under the localStorage key `gst_customUnits` on each
  device. Use *Settings → Export* to back them up alongside everything else.

---

## [1.2.0] — 2026-03-21

- Multi-currency support (INR + 7 others) with locale-aware formatting and
  amount-in-words.
- Multi-business profile switcher in the header — invoice from any of your
  registered entities without re-editing settings.
- Country-aware client form — postal code, state, and tax ID labels adapt to
  the client's country (India / US / UK / UAE / Singapore / Australia and 16
  more).

## [1.1.x and earlier]

- GST Returns view with GSTR-1 / GSTR-3B CSV export and self-filing guide.
- Shared `ClientModal`, city/PIN fields, PDF blank-page fix, WhatsApp sharing.
- Auto-sync client edits, save-location toasts.
- 6 major features + SEO-optimized README and roadmap.

For commits before this changelog was introduced, see `git log` on the `main`
branch.
