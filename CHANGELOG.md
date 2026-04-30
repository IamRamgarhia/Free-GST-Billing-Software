# Changelog

All notable changes to **Free GST Billing Software** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
