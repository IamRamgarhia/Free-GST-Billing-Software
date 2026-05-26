# Changelog

All notable changes to **Free GST Billing Software** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
