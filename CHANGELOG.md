# Changelog

All notable changes to **Free GST Billing Software** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
[COMPETITOR_GAPS.md](./COMPETITOR_GAPS.md): TDS/TCS, GSTR-2B reconciliation,
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
  [USER_GUIDE.md](./USER_GUIDE.md) — covers the blue "Windows protected
  your PC" screen, the right-click → Properties → Unblock workaround for
  Mark-of-the-Web, and antivirus exclusion paths.

### Notes for the income-tax helper

[TAX_HELPER_PLAN.md](./TAX_HELPER_PLAN.md) remains the planning doc for
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

- **[USER_GUIDE.md](./USER_GUIDE.md)** — plain-language handbook covering
  daily use, backup, migration to a new computer, FAQ, troubleshooting.
- **[COMPETITOR_GAPS.md](./COMPETITOR_GAPS.md)** — gap analysis vs the top
  5 GitHub OSS projects (ERPNext, Akaunting, Invoice Ninja, Crater,
  InvoiceShelf) and top 5 commercial Indian tools (Tally, Vyapar, Zoho,
  ClearTax, Marg). Includes the prioritized post-1.3 roadmap (e-Invoice
  IRN, RCM, Cess, GSTR-2B reconciliation, Tally export, payment-gateway
  links, mobile app).
- **[TAX_HELPER_PLAN.md](./TAX_HELPER_PLAN.md)** — proposal for the v1.4.0
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
