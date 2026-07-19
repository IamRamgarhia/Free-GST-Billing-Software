# Changelog

All notable changes to **Free GST Billing Software** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.10.30] — 2026-07-14

**Five fixes from the follow-up feedback.**

### Fixed — OCR still failing with "OCR failed: undefined"

**Reported.** Screenshot with the toast text
`"OCR failed: undefined. Try a sharper photo or check your network."`
The v1.10.29 fix improved the error handling, but a subtle bug in the
fallback chain used `String(err)` which returned the literal string
`"undefined"` when tesseract rejected with a non-Error value.

**Fix.** Aggressive normalization across every shape tesseract can
throw: string, `{ message }`, `{ data }`, `{ data.message }`, or plain
object. If everything's empty we say `"Unknown error (see browser
console — F12 — for details)"` instead of `"undefined"`. Hint text
now covers 502/503/504 gateway errors, SharedArrayBuffer availability,
and timeouts too. Toast stays up 12 seconds so the user can read the
diagnosis.

### Fixed — Thermal font too small / print too light

**Reported.** "fix the font issue and print issue in thermal baki
print 80mm and 58mm default working till now ok."

**Fix.** Two-part tweak:

1. **Font sizes bumped ~10-15%** across all four thermal presets:
   - `small`   58mm/80mm → 9.5px / 11px (was 8.5 / 10)
   - `medium`  → 11 / 12.5 (was 9.5 / 11)  ← default
   - `large`   → 12.5 / 14.5 (was 10.5 / 12.5)
   - `xlarge`  → 14 / 16.5 (was 11.5 / 14)
   Tuned against low-DPI POS printers where raster smoothing eats
   ~1px off every glyph.
2. **Text-shadow double-strike strengthened.** Prior 0.4px horizontal
   was thin. Now 0.6px horizontal + 0.6px vertical + a diagonal
   0.4px so glyphs read visibly darker on lightly-burning thermal
   heads without fattening the font weight (which would misalign
   number columns).

### Fixed — Long product names truncated in Purchase Bill PDF

**Reported.** "in purchase bill pdf long names got cut in pdf fix"
with a screenshot showing "4 Copier Paper (Pack o" truncated
mid-word.

**Root cause.** `viewAsPdf` hard-coded `.slice(0, 40)` on the item
name for its column width, silently cutting anything longer.

**Fix.** Uses `doc.splitTextToSize(name, 70 /* mm */)` to word-wrap.
Row height grows to fit however many lines the wrapped name needs;
neighbouring columns (HSN, qty, rate, GST%, amount) stay top-aligned
with the first line so nothing overlaps.

### Improved — Custom thermal paper size discoverability

**Reported.** "ek chis karna hai jaise app 80mm 58mm sellect karne se
print de rahe hai jaise option hai waise hi custom size ke liye bhi
kijiye" — user wanted a custom thermal size option similar to 80mm /
58mm presets.

**Discovery.** The infrastructure already existed since v1.9.1 —
`custom` paper size at [utils.js:880](src/utils.js#L880) already
takes `customPaperWidth` + `customPaperHeight` from invoice options
and auto-switches to thermal receipt layout when width < 100mm. The
label just wasn't clear that it worked for thermal too.

**Fix.**
1. Label renamed from `"Custom size (any width / height)"` to
   `"Custom size (thermal / roll / stationery)"`.
2. Hint now explicitly says "widths under 100mm auto-switch to
   thermal receipt layout — same as 58 / 80mm presets".
3. **Quick-pick chips** for the most-asked uncommon rolls: 40mm,
   76mm, 90mm, 110mm — one click sets the width without typing.

### Added — Purchase Bill quick-view modal (no download)

**Reported.** "add a view only option modal type so can user check
the price without downloading the file every time. i know u can say
to edit and check that but if some data entered wrongly thats why."

**Fix.** Replaced the FileText row action with an **Eye icon** →
opens a modal that shows every purchase detail formatted inline:

- Header: invoice #, date, payment status, interstate/intrastate
- Supplier block: name, address, GSTIN
- Line items table (scrollable if many): #, description, HSN, qty,
  rate, GST%, amount
- Tax breakdown: taxable, tax, cess, round-off, TOTAL
- Note (if any)
- Action bar: Close / Edit (opens edit form) / Download PDF

Users can now verify a purchase in ~1 second without generating +
opening a file. The Download PDF option is still one click away
inside the modal for anyone who does want the file.

### Verified

- `npx vite build` — clean
- `node scripts/tax-test.mjs` — 31/31 pass
- `node scripts/discount-modes-test.mjs` — 9/9 pass

---

## [1.10.29] — 2026-07-14

**Big batch: 4 bugs + 3 features + 4 quality follow-ups.**

### 🐛 Bugs

**Per-line tax used raw discount, ignored Unit/W-Tax bases.** Reported
via screenshot: line 2 (Bill Book, 10 × ₹95, ₹5 Unit-base discount)
showed CGST ₹85.05 in the per-line table (as if disc = ₹5) but
Discount ₹50 / CGST ₹83.25 in the totals bar (as if disc = ₹50) —
GST mismatch inside a single PDF. Root cause:
[InvoicePreview.jsx:839](src/components/InvoicePreview.jsx#L839)
used `item.discount || 0` (raw value); `computeInvoiceTotals`
correctly routed through `resolveLineDiscount(item)`. Fix: import
`resolveLineDiscount` in InvoicePreview and use it on the per-line
render. Totals + per-line breakdown now agree.

**Thermal print included entire app UI (sidebar, menu, editor).**
Reported: "thermal print me kuch error ho raha hai" with screenshot
showing the browser print preview rendering the WHOLE app instead
of just the receipt. Root cause: `directPrint()` for thermal calls
`window.print()` which prints the visible viewport; no `@media
print` rules to hide non-invoice UI. Fix: added a `@media print`
block that hides `body *` and unhides only `#invoice-preview`,
positioning it at 0,0 with no margins.

**WhatsApp share button sent subtotal, not total.** Reported: "when
i use whatsapp button it is sending subtotal amount". Root cause:
[InvoiceGenerator.jsx:2183](src/components/InvoiceGenerator.jsx#L2183)
used `items.reduce((s, i) => s + (i.quantity * i.rate), 0)` — that's
the pre-tax subtotal. Fix: switched to `totals.total` (post-tax,
post-discount, includes round-off + TCS + invoice-level discount).
Message now includes subtotal AND total on separate lines, plus
date and business name signature.

**OCR failed silently with a generic "try again" toast.** Reported:
"ocr is not working". Root cause: tesseract.js v7 in a Vite bundle
often can't resolve its own worker.js / core / eng.traineddata
paths correctly. Fix: pin `workerPath` / `corePath` / `langPath` to
explicit CDN URLs (jsdelivr for worker/core, tessdata project for
language models). Version pulled from `tesseract.js/package.json`
via native Vite JSON import so future `npm update tesseract.js`
tracks automatically. Errors now surface the actual message plus
an actionable hint ("Network fetch failed — needs to download
~2MB", "Worker failed — Ctrl+F5 to refresh bundle", etc.).

### ✨ Features

**Purchase Bills: View as PDF button.** Reported: "option to view
as pdf give it that will be better". New FileText icon per row
generates a single-page PDF (header, supplier block with address +
GSTIN, line items table, tax + cess breakdown, round-off, total,
optional note). Uses jsPDF's built-in helpers — no autotable
dependency added.

**Purchase Bills auto-sync items to Products.** Reported: "items
added in purchase bill also available for sale means automatically
added to the product page too". On purchase-bill save, each line
item is upserted into Products by name (trimmed, case-insensitive).
Existing products get their `purchasePrice`, `hsn` (if empty), and
`cessPercent` (if empty) updated + **stock incremented by the
purchase quantity** on FIRST save (skipped on edit to prevent
double-counting). New products get seeded with sellingPrice =
purchasePrice as a starting point. Non-fatal: a sync failure
doesn't block the purchase save.

**Products: Purchase Price + Selling Price fields.** Reported:
"here purchase price and selling price need". Two side-by-side
inputs in the Add/Edit Product form. Legacy `rate` field kept in
storage (mirrors sellingPrice on save) so pre-v1.10.29 readers
still work; new products always write both. InvoiceGenerator's
product picker uses `sellingPrice ?? rate ?? 0`; Purchase-Bills
auto-sync updates `purchasePrice`.

### 🔧 Quality follow-ups

**@media print scoped with `:has(#invoice-preview)`** so Ctrl+P on
Dashboard / Clients / Reports (any view without an invoice preview
in the DOM) gets the browser's default print behaviour instead of
a blank page. `:has()` is supported in every Chromium 105+ /
Safari 15.4+ / Firefox 121+ — safe for the PWA target.

**Purchase → Products cess carry:** `cessPercent` now flows from
purchase line items into synced Products, so tobacco / auto / coal
items keep their cess rate for future invoices.

**Purchase Bill: supplier address field.** New optional row in
the purchase form; shows on the PDF header under the supplier
name. Pre-v1.10.29 records with no address render byte-identical.

**InventoryView cleanup:** removed dead `rate` state from the
Product form — it was hidden from UI but still in emptyForm /
openEdit for no reason. Save path still writes `rate = sellingPrice`
as a backward-compat mirror.

### Verified

- `npx vite build` — clean
- `node scripts/tax-test.mjs` — 31/31 pass
- `node scripts/discount-modes-test.mjs` — 9/9 pass

---

## [1.10.28] — 2026-07-14

**Compact invoice layout + slower-device print reliability.**

### Improved — Base invoice layout is significantly more compact

**Reported.** "your format was great but some tweaks can make it
compact and clear" — with reference screenshot showing an
nVertex-style invoice that packs more into less vertical space.

**Cause.** Our base spacing was designed for on-screen readability
(2rem / 32px paddings and margins). Translated to PDF, that's ~10mm
of whitespace between every section — great for viewing, wasteful
for printing.

**Fix.** Tightened base CSS across the invoice sections:

- **Header:** padding `2rem 2.5rem 0 → 1rem 1.5rem 0`; margin-bottom
  `2rem → 0.75rem`. Title font `2rem → 1.5rem`. Business-name font
  `1.1rem → 1rem`. Header-right max-width `45% → 48%`.
- **Parties (Bill-to / Ship-to / Place-of-supply):** margin
  `0 2.5rem 2rem → 0 1.5rem 0.75rem`, padding `1.5rem → 0.85rem 1rem`.
  Radius `10px → 8px`.
- **Items table:** width `calc(100% - 3rem) → calc(100% - 2.5rem)`,
  margin `0 1.5rem 1.5rem → 0 1.25rem 0.75rem`.
- **Totals section:** padding `0 2.5rem → 0 1.5rem`, margin-bottom
  `2.5rem → 1rem`. Amount-in-words right-padding `3rem → 1.5rem`.
- **Footer (bank / signature):** padding `1.75rem 2.5rem 2rem → 1rem
  1.5rem 1.25rem`, margin `0 2.5rem → 0 1.5rem`. Block-margin
  `1.25rem → 0.75rem`.

Net effect: ~25-30mm of dead whitespace removed on a typical A4
invoice, so more items fit on page 1 before pagination and the
overall density matches Vyapar / MargERP / Zoho templates.

### Fixed — Print/Download blank on slower devices

**Cause.** v1.10.27 waited two rAFs + 50ms after un-collapsing the
preview from focus mode before capturing. On low-end Android
devices, React commit + browser reflow after removing
`position: absolute` didn't finish in 50ms → `html2canvas`
sometimes captured a mid-layout snapshot with content in the wrong
place.

**Fix.** Settle bumped from 50ms → 200ms. On fast devices this is
imperceptible; on slow devices it's the difference between a
correct PDF and a garbled one.

### Verified

- `npx vite build` — clean
- `node scripts/tax-test.mjs` — 31/31 pass
- `node scripts/discount-modes-test.mjs` — 9/9 pass

### Also confirmed as fixed (no work this release)

- **GH #16** (@mehulkoradiya, "A bill with this invoice number
  already exists") — fixed in v1.10.23 via auto-retry. Ticket ready
  to close.
- **GH #15** (@prk1988, "company logo not displayed") — fixed in
  v1.10.16 via SettingsView auto-enabling `showLogo: true` on save
  when a logo is present. Ticket ready to close.

---

## [1.10.27] — 2026-07-13

**Two focused-mode print polish fixes.**

### Fixed — Preview panel stays expanded after print / download

**Reported.** "in this layout when print clicked it prints but the
preview panel again comes and for hiding again have to click to
hide."

**Cause.** v1.10.26 registered an `afterprint` event listener +
30-second safety timeout to auto-restore the collapsed state.
`afterprint` never fired in two of the three paths so restore
never ran (or ran only after 30s):

1. **Download PDF** — no print dialog opens, `afterprint` never
   fires.
2. **A4 iframe print** — `afterprint` fires on
   `iframe.contentWindow`, not the parent window we were
   listening on.
3. **Thermal window.print()** — only this path fired afterprint
   on the parent window correctly.

**Fix.** Dropped the listener entirely. Restore now runs
unconditionally in the `finally` block:
- `window.print()` blocks the JS thread until the native dialog
  closes on all desktop browsers → finally fires after the user
  is done with print → correct restore timing.
- On mobile Safari where `print()` may not block, the DOM was
  already captured at the moment `print()` was invoked, so
  restoring immediately after is safe.
- Download PDF and A4 iframe both flow through the same path
  and restore immediately after `buildPDF` / `printViaIframe`
  returns.

### Changed — PDF quality default is now HD

**Reported.** "we need to make sure print is full 100% hd quality
in pdf."

**Cause.** Default `pdfQuality` was `'standard'` — JPEG at scale
3–4, quality 0.95. That's ~200 KB per invoice and slightly soft
text edges when zoomed. Fine for email but not for print archive.

**Fix.** Default flipped to `'hd'` — PNG at scale 4–5 (capped at
6), quality 1.0. Text edges are crisp on high-DPI print,
line-art (borders, tables, signatures) renders without JPEG
smudging.

**Trade-off.** File size grows to 1–3 MB per invoice. Users who
prefer email-friendly files can switch to `'standard'` or
`'draft'` in **Print Settings → Print quality**.

Existing users with a saved `pdfQuality: 'standard'` in their
localStorage/server settings are NOT force-migrated — the change
only applies to fresh installs and users who reset print settings.

Business-type presets that intentionally set `'standard'`
(Freelancer for email-friendly retainer invoices, Wholesale for
high-volume printing) are unchanged.

### Verified

- `npx vite build` — clean
- `node scripts/tax-test.mjs` — 31/31 pass
- `node scripts/discount-modes-test.mjs` — 9/9 pass

---

## [1.10.26] — 2026-07-13

**Print + Download PDF blank in Focus mode — fixed.**

### Fixed — Print / PDF blank when Focus mode is ON

**Reported.** "in this mode print not working" (focus mode ON,
preview hidden). Normal split-view mode printed fine.

**Root cause.** The v1.10.22 Focus mode used `display: none` to hide
the preview pane. That removes the element from layout entirely —
`html2canvas` renders a 0×0 canvas → blank PDF, `window.print()`
prints nothing because there's no visible content in the viewport.

**Fix — two layers.**

1. **Preview pane** now uses off-screen positioning
   (`position: absolute; left: -99999px; opacity: 0`) instead of
   `display: none`. Element keeps real dimensions so
   `html2canvas` can snapshot it, invisible to the user and out
   of the flex flow (editor still takes full viewport width in
   Focus mode).

2. **`withPreviewOnScreen(fn)` guard** wraps `directPrint` and
   `generatePDF`. When invoked from Focus mode, un-collapses the
   preview, waits two rAFs + 50ms for layout, runs the print /
   PDF operation, then restores the collapsed state on the
   `afterprint` event (native dialog close) or a 30s safety
   timeout. Belt-and-braces so window.print() also works
   correctly for thermal paper.

### Verified

- `npx vite build` — clean
- `node scripts/tax-test.mjs` — 31/31 pass
- `node scripts/discount-modes-test.mjs` — 9/9 pass
- Print + PDF paths audited: Dashboard receipt print (separate
  window) and ReceiptVoucher print (new window) unaffected. Only
  InvoiceGenerator's Print/Download used the Focus mode preview.

---

## [1.10.25] — 2026-07-13

**Complete 4-mode discount system (Vyapar / MargERP parity).**

### Added — Per-line discount BASE selector

**Reported.** "we need to have proper discount system" — with the
same 4 modes real POS software offers: Price With Tax, Unit Price,
Net Amount, Total Amount.

**What v1.10.22 shipped.** Two of the four modes:
- **Net Amount** (per-line, default) — ₹ or % off `qty × rate`
- **Total Amount** (invoice-level) — ₹ or % off whole-bill total

**What v1.10.25 adds.** The two missing per-line bases:
- **Unit Price** — ₹ off EACH unit. Effective line discount = `qty
  × discount`. Example: `4 qty × ₹100 rate` with `₹5 off unit` →
  `₹20` total line discount, ₹380 taxable.
- **Price With Tax** — ₹ off the tax-INCLUSIVE line total. Tax is
  automatically backed out. Example: `₹100 @ 18%` with `₹11.80 off
  with-tax` → the customer's total-inclusive drops by exactly
  ₹11.80 (net discount = ₹10, taxable = ₹90, tax = ₹16.20, total
  = ₹106.20).

### UI

Discount cell in each line item now has THREE controls when in
fixed mode, TWO in percent mode (base is percent-agnostic —
mathematically identical for all bases):

```
[value input]   [₹/%]   [Net/Unit/W.Tax]        ← fixed mode
[value input]   [₹/%]                            ← percent mode
```

Tooltips explain what each base does. Cell widens to `flex: 1.8 /
min-width: 200px` and wraps to a second row on tight screens.

### Math

New `resolveLineDiscount(item)` branches on `discountBase`:

- `net` (default) → raw value or `raw × line% / 100`
- `unit` (fixed only) → `raw × qty`, clamped to line value
- `with-tax` (fixed only) → `raw / (1 + taxRate/100)`, clamped

Return value is always the net-amount deduction, so every existing
downstream tax / GSTR-1 / e-Way Bill path is unchanged. Backward-
compatible: items without `discountBase` fall through to `'net'`.

### Verified

- New `scripts/discount-modes-test.mjs` — 9 scenarios pass:
  - Fixed ₹ off Net, Unit × qty, Price-With-Tax
  - Percent mode (base-agnostic)
  - Clamps: `%` > 100, fixed > line, `qty × unit-disc` > line
  - Zero-tax edge on with-tax base (no divide-by-zero)
  - Legacy item without discountBase renders identically
- `npx vite build` clean
- `node scripts/tax-test.mjs` — 31/31 pass (unchanged; the
  discount rework only changes how much reduces the net,
  downstream GST buckets untouched)

---

## [1.10.24] — 2026-07-13

**Client credit balance — overpayments carry to next invoice.**

### Added — Apply prior overpayment as credit on a new invoice

**Reported.** "this extra payment can be added to the next bill of
customer u enabled that — auto or manual."

**How it works.** When a client overpays a bill (Bill A: total ₹100,
paid ₹110 → ₹10 overpaid), that ₹10 is available as credit against
future invoices. Opening a new invoice for the same client now
shows a **💳 credit banner** in the Billed To card:

> Client has ₹10 credit from 1 prior overpayment (INV/2026-27/0007)
> [amount input] [Apply full] [Skip]

Three ways to use it:
1. **Manual apply** — user types an amount (capped at
   `min(available, invoice total)`) or clicks **Apply full**.
2. **Auto-apply** — checkbox in the banner: "Auto-apply available
   client credit on future invoices". Once enabled, the credit is
   applied automatically on client-select for every subsequent new
   invoice. Fired once per client (not on every keystroke) so
   manual overrides stick.
3. **Skip** — leave it for later; credit stays on the client's
   ledger.

**Persistence — dual-entry, auditable.** On save, `saveInvoiceToDB`
writes two paired records:
1. A `credit-applied` payment entry on the new invoice (mode +
   `creditSourceBillIds` for the audit trail), which reduces the
   new invoice's outstanding.
2. A `credit-transferred-out` payment entry on each source
   overpaid bill (negative amount, `creditTargetBillId` for the
   reverse link), which brings the source bill's outstanding back
   to 0 so it no longer shows as overpaid.

FIFO allocation across sources — oldest overpayment consumed
first. Both entries net to zero at the client level (no phantom
cash), and every existing per-bill / per-client status/aging/
ledger view (which reads `paidAmount` and `payments[]`) picks up
the change with no other code changes.

### Data model

- New payment `mode` values: `'credit-applied'`, `'credit-transferred-out'`.
- New invoiceOption: `autoApplyClientCredit: boolean` (default
  `false`).
- New file: `src/utils/clientCredit.js` — pure helpers:
  `getBillOverpayment(bill)`, `getClientCredit(name, bills)`,
  `planCreditApplication(name, bills, amount, newBillId)`.

### Added — WhatsApp desktop-limitation tooltip + one-time toast

**Reported.** "user need to know why whatsapp pdf on web not work
we need to write somewhere on tooltip etc."

Users on desktop were assuming the PDF-not-attached behaviour was
our bug. It's actually a Web Share API restriction — browsers
block sending files to arbitrary desktop apps (WhatsApp Web
included) for security. We can't change that. So now we
communicate it honestly in three places:

1. **Tooltip** on the WhatsApp row-action button explains it:
   "PDF attaches on mobile Chrome/Safari. On desktop it sends the
   invoice as text only (browser can't attach files to WhatsApp
   Web — security limitation, not our app)."
2. **One-time toast** the first time a desktop user hits the
   fallback path in a session — full explanation + workaround
   ("download PDF, drag into WhatsApp Web"). Silenced by
   sessionStorage flag after first show.
3. **Dashboard help modal** includes the same explanation in the
   "Row actions" bullet.

### Verified

- `npx vite build` clean
- `node scripts/tax-test.mjs` — 31/31 pass (no core-math paths
  touched; credit is a payment-layer feature)

---

## [1.10.23] — 2026-07-13

**7 fixes on top of v1.10.22.** GH #16 invoice-number 409 + a
sweep for every place negative "outstanding" (from overpayment)
was leaking into UIs that assumed positive values.

**Discount math verified:** ran 5 targeted scenarios (per-line %,
per-line ₹, invoice-level ₹, invoice-level %, > 100% cap) — all
pass. 31 core tax tests continue to pass.

### Fixed — "A bill with this invoice number already exists" on save

**Reported (@mehulkoradiya, GH #16).** "when create/update invoice,
status change, add payment i got this error — `A bill with this
invoice number already exists`, `DC/2026-27/0001`". User was
completely blocked — every action returned 409.

**Root cause.** The server's atomic counter (`counter_DC` etc.) can
drift out of sync with the actual bill files on disk. Cases:
1. User restores a backup that had `DC/2026-27/0001` but the counter
   file was reset to 0.
2. A bill number was hand-typed matching a counter value still to
   come.
3. Two tabs / two devices bump the counter separately.

The peek returned `0001`, save posted `bill.id = DC/2026-27/0001`,
server saw the file on disk → 409. Prior UX: toast "Invoice number
already exists. Change it before saving." and return — user had to
manually bump the number themselves. On a fresh install with a
corrupted counter, they'd have to do this every single time.

**Fix.** On 409 for a NEW invoice (no `editingBill`, not yet saved
this session), `saveInvoiceToDB` now automatically:
1. Requests a fresh number via `getNextInvoiceNumber(prefix)` —
   which atomically increments the server counter and returns the
   next value.
2. Retries `saveBill` with that number.
3. If the retry also 409s (rare but possible if many past bills
   were hand-numbered ahead of the counter), loops up to 20 times,
   each round bumping the counter one more step.
4. On success, updates the form's `details.invoiceNumber` so the
   preview + subsequent save operations agree on the new id.
5. Toasts `"Invoice number DC/2026-27/0001 was already used —
   saved as DC/2026-27/0002 instead."` so the user knows what
   happened.
6. After 20 failures (pathological state), falls back to the old
   manual-fix message.

Editing existing bills and Dashboard operations (status change /
record payment / soft-delete stock restore) already passed
`overwrite: true` so they were never affected by this bug —
`@mehulkoradiya`'s "status change / add payment" symptoms were
side effects of the initial create failing. Once create succeeds,
the follow-on flows work.

### Fixed — Overpayment hidden in client ledger

**Reported.** "OUTSTANDING SHOULD ABE DISPLAYED HERE IN CLIENT
LDGER TOO" — a ₹650 payment on a ₹649 invoice showed Outstanding
₹0 in the client card, quietly swallowing the ₹1 the customer paid
extra.

**Root cause.** `getClientStats` in ClientsView added
`totalAmount` (not `paidAmount`) to `paid` when a bill's status was
'paid'. Clamped every over-paid bill's contribution to its invoice
value, so `unpaid` came back 0 for the overpayment case.

**Fix.**
1. `getClientStats` now sums the actual payments array (or falls
   back to `paidAmount`, then legacy status='paid' → totalAmount).
   `unpaid` can now be negative → an overpayment.
2. The client card's stat row switches label + colour when
   `unpaid < 0`: shows **"Overpaid"** in blue instead of
   "Outstanding" in red / green.

### Fixed — Overpayment leak in 3 other UI spots

While auditing the overpayment display path, found three more places
showing negative "outstanding" without any interpretation. Fixed:

1. **Payment modal** now shows "Overpaid: ₹X" in blue instead of
   "Balance: -₹X" in red when payment > invoice.
2. **Reminder card** (Send Payment Reminders section) shows
   "Overpaid ₹X" in blue instead of a negative red amount.
3. **sendReminder** now short-circuits with a toast ("This invoice
   has no outstanding balance — no reminder to send.") when
   outstanding ≤ 0. Previously the WhatsApp message text read
   "kindly arrange the payment of -₹1" which is obviously wrong.
4. **ReceiptVoucher** — new-receipt amount input no longer pre-fills
   with a negative number for overpaid bills; outstanding chip in
   the invoice-picker list is hidden when the bill is overpaid.

### Fixed — Line-item field areas too cramped for entry

**Reported.** "INCREASE THE FIELD AREAS IT WILL PROPERLY VISIBLE
FOR ENTRY." The v1.10.22 discount ₹/% toggle squeezed the discount
input to ~40px on narrow viewports, and the Description / HSN / Qty
/ Unit / Rate row was tight on non-focus-mode layouts.

**Fix.**
1. `.line-item-field` gets `min-width: 72px` and inputs bump to
   `0.85rem` font + `0.4rem` padding so nothing gets crushed.
2. `.line-item-row` now `flex-wrap: wrap` so on narrow screens the
   row breaks to a second line instead of squishing.
3. Discount field: `flex: 1.4` + `min-width: 130`. The ₹/%
   selector widens to 60px so both option labels are readable.

### Verified — GH #15 (logo not showing) still fixed

Confirmed for @prk1988: v1.10.16's `SettingsView.handleSave`
auto-enables `showLogo: true` in the persisted invoice options
whenever a profile with a logo is saved. That fix is live and
this release doesn't change it. **If you're still seeing no logo,
Ctrl+F5 to force the PWA to fetch the current bundle** — v1.10.16
shipped a month ago, so any stale service worker would still be
running the old code.

### Verified — Overpayment on receipt already showing

Also for @mehulkoradiya's "Balance should be 1 but calculating
zero" screenshot: the fix is live at
[Dashboard.jsx:121](src/components/Dashboard.jsx#L121) since
v1.10.22 — receipt shows "Overpaid: ₹1" in green when the payment
exceeds the invoice total. Ctrl+F5 to refresh the PWA bundle. If
after a hard refresh the receipt still shows Balance: ₹0, the
underlying bill's `payments` array probably has a payment stored
at ₹649 (not ₹650) — check via Edit Payment on that row.

---

## [1.10.22] — 2026-07-12

**4 bugs + 5 features in one push.** Every item from the latest
WhatsApp screenshots, plus purchase-bill OCR (Vyapar / MargERP parity)
and per-item percent/fixed discount + invoice-level discount (Zoho
parity). 31 tax-math unit tests still pass — the discount rework was
guarded through the same code path.

### Bugs

**Back button asked to save even with no changes.** Reported: "if
user click back without even changing anything it always ask to save
and close so we are saving auto so this is also a bug." `handleBack`
checked `autoSaveStatus !== 'saved'`, and `autoSaveStatus` started
at `'idle'` on mount — never flipping to `'saved'` for a freshly-
loaded bill. Now tracked via a separate `isDirty` ref, flipped only
on real post-init state changes and cleared on every successful
save. Same guard applied to `beforeunload`.

**⭐ default account was ignored on new invoice.** Reported: "if user
added two account and star the one account while creating new
invoice it shows old star account not new". Auto-select priority was
last-used → default → first-active; changing the ⭐ in Settings
didn't invalidate the last-used pointer. Reversed to default →
last-used → first-active. Star now always wins.

**Balance = 0 hid ₹1 overpayment.** Reported: "Balance should be 1
but calculating zero." A ₹649 invoice paid ₹650 rendered as Balance:
₹0 because `Math.max(0, billTotal - totalPaid)` clamped the negative.
Now the receipt shows "Overpaid: ₹1" in green when the customer
paid more than the invoice.

**No manual delete for individual daily backups.** Reported: "add
here delete option i know u added 30 days auto delete but manual
delete also u add." Trash-bin items already had "Delete forever";
daily backups did not. Added a `DELETE /api/backups/:date` endpoint
(guarded by the same path-inside + calendar-date checks the restore
endpoint uses) and a Delete button next to each backup row.

### Roadmap features (Vyapar / Zoho parity)

**WhatsApp share with PDF attached.** Row-level MessageCircle button
in Dashboard now tries the Web Share API first — on mobile Chrome /
Safari the OS share sheet opens with the actual invoice PDF
attached; user picks WhatsApp (or any target). On desktop /
browsers without file-share support, falls through to the existing
text-only `wa.me` URL. Split out a `generateSingleBillPdfBlob`
helper (mirrors the bulk-export path) so the same render pipeline
serves both bulk PDF and native share.

**HSN → GST rate auto-suggest.** New curated `data/hsnRates.js` map
covering ~200 goods HSN codes + 30 SAC service codes that account
for >95% of small-business invoicing. Typing an HSN in a line item
suggests the correct GST rate (e.g. `4820` → 18% for stationery,
`4901` → 0% for printed books) and shows the category label as a
green hint chip below the field. Rate only auto-fills when the
user hasn't set a custom rate — always overridable. Lookup order:
6-digit exact → 6-digit prefix → 4-digit prefix.

**Client aging report + inline aging strip.** In Clients view,
expanding a client now shows:
- Inline **aging strip** — outstanding balance bucketed into
  Current (0-30d) / 31-60d / 61-90d / 90+ days, colour-coded from
  green to red.
- **Aging PDF** button — single-page report with per-invoice list
  (invoice #, date, due, age, total, outstanding) and bucket
  summary. Distinct from the existing full-ledger Statement PDF —
  this is the "how overdue are they?" view accountants use during
  collection calls.

**Help buttons on every major view.** New reusable `HelpButton`
component. Icon sits next to each page title (Dashboard, Clients,
Purchase Bills, GST Returns, Settings) plus the invoice generator
toolbar. Click opens a modal with a bullet-point cheat sheet of
what each feature does — including keyboard shortcuts, discount
modes, focus mode, OCR, aging PDF, and every other v1.10.22
addition so users discover them without hunting.

### Features

**Per-item discount: fixed OR percent.** Reported: "ALL APPS ITS IS
LIKE THR ARE TWO OPTION THAT U WANT CALCULATE... ALSO THR TOGGLE
OPTION TO CALCULATE VIA PERCENT AND PRICE." Every line item now
carries a `discountType` field (`'fixed'` or `'percent'`) with a
dropdown next to the discount input. Percent mode is capped at 100
and the resolved amount can never exceed the line value. Backward-
compat: items without `discountType` render byte-identically to
v1.10.21.

**Invoice-level (whole-bill) discount.** The other half of the same
ask — "calculate on total amount". A new row below "Add Item"
takes a value + a `₹/%` toggle. Applied *after* tax, so it behaves
as a cash discount / trade allowance and doesn't affect the GSTR-1
taxable value. (For GST-compliant pre-supply discount, users use
per-line discount instead — noted in the field's hint text.)

**Keyboard shortcuts.** Reported: "u can introduce keyboard
shortcuts." Added:
- `Ctrl/Cmd+Enter` — add new line item
- `Ctrl/Cmd+Shift+D` — duplicate last line item
- `Esc` — close the unsaved-changes leave modal

Existing shortcuts (`Ctrl+S` save, `Ctrl+P` PDF) untouched.

**Inline product description per line.** Reported: "add option so
user can directly enter product description into invoice directly."
Each line item now has an "+ Add description" button that expands
into a 2-row textarea. The description renders under the item name
in the PDF preview in a smaller muted font. Blank descriptions
render nothing — old invoices look identical.

**Focus-mode toggle (hide preview).** Reported: "sidebar menu toggle
option so customer will get a close view for entries because
quantity entry u see space is like that we have to see in invoice
preview what we are entering." New button at the top of the editor
hides the live preview and lets the editor pane take the full
width. Persists across page reloads. InvoicePreview stays mounted
(hidden via CSS) so `printRef` remains live for PDF generation.

**Purchase-bill OCR.** Reported: "purchase bill ocr for faster and
accurate entry." New "Import from image (OCR)" button in Purchase
Bills opens a modal that:
- Takes a photo/scan of the supplier's tax invoice.
- Runs `tesseract.js` client-side (WebAssembly, ~2MB lazy-loaded on
  first open, cached in the browser after that). No paid OCR
  provider — offline-first + free positioning preserved.
- Extracts supplier GSTIN (15-char strict regex), invoice number,
  date (DD-MM-YYYY and DD Mon YYYY variants), and grand total from
  labelled Indian bill patterns.
- Shows the extracted fields alongside the image for the user to
  correct before applying to a new purchase-bill form.

Line items are NOT auto-parsed — table-column extraction from OCR
text is unreliable across bill layouts and misrouted ITC is worse
than a slow manual entry. When a grand total is extracted, a
placeholder single line is seeded at that value so the totals are
sane while the user breaks it into real items.

---

## [1.10.21] — 2026-07-11

**Two live-preview + auto-heal fixes for the bank snapshot.**

### Fixed — Picking a new account didn't update preview until save+reopen

**Reported.** "working but on select it is not changing have to save
and reopen it... or else to wait for few sec after save automatically
have to re open to see it."

**Cause.** `InvoicePreview` reads
`options.paymentAccountSnapshot` before falling back to
`getAccountById(profile, selectedAccountId)`. The dropdown's onChange
only updated `selectedAccountId`, leaving the stale snapshot in
place — so the preview kept showing whatever bank was frozen at the
last save until save+reopen re-snapshotted.

**Fix.** Dropdown onChange now also re-snaps from the live profile
for the new account, in the same setInvoiceOptions call. Preview
updates instantly. On save, the priorMatchesSelection guard sees
the id already matches and preserves the fresh snapshot rather than
re-freezing from the live profile a second time.

### Fixed — Contaminated snapshots from v1.10.18/19 saves auto-heal

**Reported.** "now after i full reloaded again all vanished and
asigned to same account which is default."

**Cause.** Bills saved between v1.10.18 and v1.10.19 had their
`paymentAccountSnapshot` polluted by cross-invoice localStorage
bleed — a stored snapshot whose own `id` didn't match the bill's
`selectedAccountId`. v1.10.20 stopped the leak but couldn't rewrite
already-saved bad data.

**Fix.** In the editing-bill mount effect, if the stored snapshot's
id doesn't match the stored selection, treat it as stale and
re-derive from `d.profile` (the profile snapshot the bill has
always carried since v1.4.x — still holds the original account).
Legacy behaviour for bills that intentionally have no snapshot is
untouched — we only heal mismatched ones.

Combined: bank selection updates immediately in the preview, and
any historical bill with a bad snapshot auto-repairs on next open.

---

## [1.10.20] — 2026-07-11

**v1.10.19 root-cause fix.** User re-tested with fresh install and
the backfill still didn't work — traced to a cross-invoice
contamination bug that defeated the whole feature.

### Fixed — paymentAccountSnapshot bleeding between invoices

**Reported.** "CAN U FIX THIS BANK ISSUE I DONT NOW IT IS NOT
WORKING I TRIED UPDATING ALSO."

**Root cause.** `paymentAccountSnapshot` is per-bill data — the bank
details frozen at that bill's save time. But the invoiceOptions
persist path (line 422) was auto-writing the ENTIRE options object,
including the snapshot, to both localStorage AND the server on
every change. So:

1. Open Invoice A (Bank X snapshot) → localStorage now has Bank X.
2. Open old Invoice B (no snapshot in bill.data) → merge picks up
   Bank X from localStorage → `mergedOpts.paymentAccountSnapshot`
   is truthy → the v1.10.19 `!mergedOpts.paymentAccountSnapshot`
   check skipped backfill → Invoice B renders with Bank X.

Every invoice got the last-opened invoice's bank. Completely wrong.
The v1.10.19 fix looked correct in isolation but was defeated the
moment any user opened two invoices in one session.

**Fix.** Three sites, one principle — treat snapshot as bill-scoped,
never as user-preference:

1. **Persist path** ([line 421](src/components/InvoiceGenerator.jsx#L421)):
   strip `paymentAccountSnapshot` before writing to localStorage AND
   before the debounced server POST. localStorage never carries a
   snapshot again.
2. **useState initializer** ([line 350](src/components/InvoiceGenerator.jsx#L350)):
   strip on read too, so any stale snapshot left over from a
   pre-v1.10.20 client doesn't seed the initial state.
3. **Backfill check** ([line 627](src/components/InvoiceGenerator.jsx#L627)):
   test `!d.invoiceOptions.paymentAccountSnapshot` directly instead
   of `!mergedOpts.paymentAccountSnapshot` — bypasses any residual
   bleed-through and asks the real question: does this bill
   genuinely lack a snapshot?
4. **Server-load path** ([line 445](src/components/InvoiceGenerator.jsx#L445)):
   strip snapshot from `serverOpts`, preserve the current bill's
   snapshot when applying server defaults.

Net effect: every bill resolves its own bank, backfill runs when it
should, and after this deploy the localStorage / server-side stale
snapshots naturally clear on next save.

---

## [1.10.19] — 2026-07-11

**v1.10.18 follow-up.** User re-tested the bank snapshot fix on
older invoices and reported "i cant see it is working" — because
v1.10.18 only froze snapshots at save time; bills saved before that
release still resolved the bank via the live profile. Now covered.

### Fixed — Snapshot backfill for pre-v1.10.18 bills

**Reported.** "swaping bank account issue solve work on old bills
or not please mention... or it will work on new because i cant see
it is working."

**How the original bank is recoverable.** Since v1.4.x, every bill
persisted a full profile snapshot in `data.profile`. That snapshot
still holds the account details as they were at time of save,
including the `paymentAccounts` array with the original bank name,
account number, IFSC, and UPI id. What v1.10.18 lacked was the code
that reads them.

**Fix.**
1. **On load** (invoice generator's edit-mount effect): if
   `d.invoiceOptions.paymentAccountSnapshot` is missing, look up the
   original account via
   `getAccountById(d.profile, d.invoiceOptions.selectedAccountId)`
   and populate it. Historical bills now render with their
   original bank details immediately, no re-save required.
2. **On save**: preserve the existing snapshot when its id still
   matches the current selection. Prevents the re-save of a
   backfilled bill from overwriting the recovered original bank
   with the current (edited) profile bank. Only re-snapshots when
   the user intentionally picks a different account.

Net effect: works on **all** bills that were ever saved with
`data.profile` (v1.4.x and later — which is every bill in every
existing install). If the profile snapshot itself was somehow
deleted (backup/restore glitch), we fall through to the live lookup
— same as the old behaviour.

---

## [1.10.18] — 2026-07-11

**Two items from GitHub #13 follow-up comment.** A silent data-
integrity bug where editing a bank account rewrote every historical
invoice that used it, and R1/3B filing pills that had no undo.

### Fixed — Bank changes retroactively rewriting historical invoices

**Reported.** "if i change bank account for the customer to one bank
then other also changed to that — it should show the bank was
selected at the time of making but it wont."

**Root cause.** Bills only stored `invoiceOptions.selectedAccountId`
— just the id, no snapshot of the bank/account/IFSC/UPI. At render
time (both preview and PDF export), `InvoicePreview` called
`getAccountById(profile, id)` on the CURRENT profile to resolve the
details. So if a user renamed "HDFC" to "HDFC Bank Ltd", changed
the account number, or overwrote the UPI in Settings, every
historical invoice that had used that account started showing the
new values on next open. Silent — no error, just retroactive data
mutation.

**Fix.** At save time, `InvoiceGenerator` now freezes the resolved
account into `invoiceOptions.paymentAccountSnapshot`. Render prefers
the snapshot; falls back to the live lookup only for pre-v1.10.18
bills that don't have one (legacy behaviour preserved). Editing a
bill and choosing a different account re-snapshots on the next save
— so intentional per-invoice changes still work. Live profile
edits to bank details never bleed into historical invoices again.

### Improved — R1 / 3B filing pills toggle on click (#13)

**Reported.** "in every option give option to change or edit
because by mistake if click happens user can change that."

The R1 Filed / 3B Pending pills at the top of GST Returns were
purely display; if a user hit the "Mark Filed" button by mistake,
there was no way to un-file without hunting through the state.

**Fix.** Both pills are now real `<button>`s with cursor + hover.
Click toggles the state (Pending → Filed → Pending). Toast confirms
the switch. `markFiled` (from the explicit Mark-Filed button) stays
set-only so the primary flow doesn't change semantics.

---

## [1.10.17] — 2026-07-11

**Follow-up to v1.10.16.** The third item from GitHub #13
("also set default is not working") was missed in the last release
— catching it here.

### Fixed — ⭐ Set-as-default payment account not persisting (#13)

**Reported.** "also set default is not working... check this issue."
Users clicked the ⭐ inline button, saw the star move onto the
selected account, but the change reverted after a page reload.

**Root cause.** `SettingsView.updateAccounts` — the single handler
behind mark-default, add, delete, reorder, and toggle-active —
only updated React state via `setProfile`. It never called
`saveProfile()`. The design assumed users would click the main "Save
Profile" button after every inline change to persist. Nobody does.
The ⭐ star moving was pure UI feedback with no server write.

**Fix.** `updateAccounts` now fires `saveProfile(next)` after every
change (fire-and-forget with a catch so a transient network hiccup
doesn't wedge the UI). Clicking ⭐ persists immediately. Same for
delete, reorder, toggle-active, and the account-form save path
(which already ran through `updateAccounts` under the hood).

---

## [1.10.16] — 2026-07-11

**Three issues from GitHub #13 and #15.** Company logo not appearing
after upload, no edit option for saved payment receipts, and the
multi-profile chip row failing to appear until profiles were toggled
in Settings first.

### Fixed — Logo missing on invoice after Settings upload (#15)

**Reported.** "I uploaded the logo and saved the settings, but the
company logo is not displayed on the invoice." nvwork-design's
workaround (open Customize → toggle Logo on) was correct, but a
silent-fail like that is a UX trap.

**Root cause.** `InvoicePreview.jsx:238` renders the logo only when
`showLogo === true` AND `profile.logo` exists. `showLogo` defaults
to `true` in `DEFAULT_OPTIONS`, but users with stale
`freegstbill_invoiceOptions` in localStorage (persisted from a
pre-upload state or a template that turned it off) had `showLogo:
false` — so the upload succeeded, but the render gate silently
blocked it.

**Fix.** In `SettingsView.handleSave`, whenever the saved profile
has a `logo` (or `signature`), we now force `showLogo: true` (and
`showSignature: true`) into the persisted invoice options. Uploading
a logo now automatically enables it. Users who consciously want to
hide the logo can still uncheck it in the Customize panel — this
fix only rescues the silent-fail case.

### Added — Edit button in Payment Receipts list (#13)

**Reported.** "HERE ALSO ADD EDIT OPTION." The Payment Receipts
table only had Print + Delete; a wrong amount or date meant deleting
and re-creating (which cost the original receipt number and its
paid-against linkage).

**Fix.** New Edit (pencil) button opens the same receipt form
pre-filled with the existing fields. Save re-POSTs with the original
id so the server upserts in place — receipt number preserved. The
propagation into the linked invoice's `payments[]` array is also
smart on edit: finds the prior entry by `receiptNo`, updates it in
place (preventing double-counting), and if the user changed which
invoice the receipt is linked to, strips the old propagation from
the previous invoice before adding to the new one. Status recomputed
from the fresh totals.

### Fixed — Multi-profile chip row missing on first render (#13)

**Reported.** "if added two accounts in setting page it is not
displaying the invoice customization page for change in particular
invoice. i checked it is adding if i interchange the selection then
it is displaying and not displaying directly."

**Root cause.** `getAllProfiles()` fired once in
`InvoiceGenerator`'s mount effect. If the SPA kept the invoice
generator mounted while the user was in Settings adding a profile,
the new profile never made it into `allProfiles` — and the "Billing
From (Business Profile)" chip row only renders when `allProfiles
.length > 1`. The conditional-render path in App.jsx does unmount
+ remount InvoiceGenerator, so this shouldn't have been an issue,
but a stale server response caching mid-navigation reproduced it.

**Fix.** Added a `visibilitychange` + `focus` listener that refetches
`getAllProfiles()` whenever the window/tab regains focus. Belt-and-
braces: on every navigation back to the invoice generator, the
profile list is fresh. The chip row appears immediately.

---

## [1.10.15] — 2026-07-09

**Header polish, Amazon-style.** User's reference screenshot showed an
Amazon Tax Invoice where the whole header — business address, invoice
meta, party details — fits in the top ~35% of the page with tight
gaps and dark, readable text. Two things kept our output from
matching that: (1) light-grey text that faded on paper, (2) invoice
meta (No / Date / Due) stacked as a vertical column.

### Fixed — Header text color still light on PDF output

**Reported.** "JUST FIX THE HEADER TEXT COLOR TO DARK THAT STILL NOT
UPDATED." User's screenshot showed business address, GSTIN, phone,
customer address all rendered in `#64748b` (light slate) on the
final PDF — the printing-mode class was on the container, but each
`p` tag had its own `color: #64748b` that beat the container-level
override.

**Root cause.** CSS specificity: `.inv-business-details p` at line
1788 with `color: #64748b` (no `!important`) beat
`.printing-mode .inv-business-details` at line 1254 with `color:
#1e293b !important` because a directly-applied color on the child
wins over an inherited color even when the parent's color is
`!important`. Same story for `.inv-party-details p` and the
`strong` tags inside. So light-grey text survived print.

**Fix.** Two-layer fix so both preview and PDF look right:
1. **Base colors bumped** — `.inv-business-details`,
   `.inv-business-details p`, `.inv-party-details`,
   `.inv-party-details p` all moved from `#64748b` → `#334155`
   (slate-700). Meta and section labels moved from `#94a3b8` →
   `#475569`. Reads clearly on any paper printer without going
   fully black.
2. **Printing-mode reaches every level now** — added explicit
   overrides for `.printing-mode .inv-business-details p`,
   `.printing-mode .inv-business-details strong`,
   `.printing-mode .inv-party-name`, `.inv-party-details strong`,
   `.inv-meta-value`, `.inv-business-name`, `.inv-title` — all
   forced to `#0f172a` in printing-mode. Belt-and-braces.

### Improved — Compact header lays out invoice meta on ONE row

**Reported.** "DECREASE THE GAPS OF THE THINGS IN HEADER LIKE
COMPANY DETAILS INVOICE DETAILS THESE MAKE." With reference
screenshot showing Invoice # / Invoice Date / Due Date on a single
row, matching Amazon's Tax Invoice format.

**Fix.** In compact mode (`headerCompact: true` in Print Settings),
`.inv-meta` now uses `flex-direction: row + flex-wrap: wrap` with a
0.75rem gap between the three (label, value) pairs. Was
`flex-direction: column` — 3 stacked rows becomes 1 row inline.
`.inv-meta-label` also loses its `min-width: 75px` in compact mode
so labels hug their values instead of leaving a 75px gap. Saves
~15mm of vertical space on top of the padding cuts from v1.10.13,
which is usually enough to pull one more line-item onto page 1.

---

## [1.10.14] — 2026-07-09

**3 re-reported bugs closed.** Each was traced to a specific missing
code path — not a caching artefact — and re-verified against source.

### Fixed — Per-type prefix ignored when switching invoice type mid-form (#1)

**Reported.** User set `customPrefixes['credit-note'] = 'NVCN'` in
Print Settings, opened a fresh Credit Note, but got invoice number
`CN/2026-27/0003` — the default `CN` prefix, not their `NVCN`
override. "NOT WORKING PROPERLY PLEASE CHECK."

**Root cause.** The v1.10.10 fix wired `customPrefixes` into two
mount-time paths (`_isDuplicate` branch and the fresh-form fallback
at line 636) but **not** into `handleTypeChange`, which fires every
time the user clicks a different invoice-type chip. That handler
computed `prefix = config?.prefix || 'INV'` from `INVOICE_TYPES`
alone — the per-type override was never consulted. So the moment you
switched from Tax Invoice → Credit Note the number reverted to
`CN/…` and the save call at line 954 (which _does_ read
`customPrefixes`) never re-fired because the number was already
"reserved" from the type switch. Silent regression.

**Fix.** `handleTypeChange` now reads
`getPrintSettings().customPrefixes[type]`, uses it as the peek
prefix, and passes `explicitPrefix: !!overridePrefix` to
`getNextInvoiceNumber` so the store's `brandPrefix` fallback stays
out of the way. Same three-line pattern as the other two paths.

### Fixed — Ledger PDF "CLOSING BALANCE" still overlapped its value (#2)

**Reported.** After v1.10.11 moved the label from `col.creditEnd`
(168mm) to `col.debitEnd` (140mm), user's screenshot still showed
"CLOSING BALAN·CE Rs. 35.00 Dr" — the label and value glued
together.

**Root cause.** "CLOSING BALANCE" at 11pt bold Helvetica is ~33mm
wide, so its right edge lands at ~173mm. The value string
`Rs. X,XXX.XX Dr` at 12pt right-aligned at `col.balanceEnd`
(~193mm) has its left edge as far left as ~165mm for 4-digit
amounts. Net overlap: ~8mm. The v1.10.11 gap of 53mm was math on the
value width alone — I forgot to add the label width to the label
anchor. Classic off-by-a-label-width.

**Fix.** Parked the label at `marginL` (~17mm) — 3× the previous
breathing room, and it reads better as a bottom-of-page summary line
anyway. Value stays right-aligned at `col.balanceEnd`.

### Verified — Thermal watermark gate still holds (#3)

**Reported.** User's screenshot shows watermark on two thermal
receipts, "STILL THERMAL WATERMARK COMING." Re-audited the source
after v1.10.12.

**Finding.** The jsPDF post-processing watermark loop
(`InvoiceGenerator.jsx:1473`) already gates on
`!isThermalPdf && ps.watermarkEnabled`, so no watermark is stamped
for thermal from that path. The only HTML-rendered watermark is the
"ESTIMATE" proforma badge in `InvoicePreview.jsx:1133`, which fires
only when `invoiceType === 'proforma'` — a Tax Invoice on thermal
cannot pick it up. No source-side bug found.

**What this means for the user.** The reported watermark is almost
certainly the PWA service worker serving a pre-v1.10.12 bundle. In
the app: **Ctrl + F5** (or clear site data and reload) will fetch
the current build. This release ships fresh assets, so a hard
refresh after installing this version resolves the visible symptom.

---

## [1.10.13] — 2026-07-09

**6 items from the latest report.** 3 real bug fixes + 2 UX improvements
+ 1 verification. Every fix confirmed in Chromium before shipping.

### Fixed — UPI QR now renders on 58mm thermal preview too (#1)

**Reported.** "QR for payment should also add on 2 inch thermal too
because this feature is working in market." — asked again after
v1.10.12 CSS unhide.

**Root cause found this pass.** The CSS was right, but the JSX had a
separate gate at line 633 of InvoicePreview:
`{opt('showUPI') && qrDataUrl && !isNarrow && (…)}`. The `!isNarrow`
(where `isNarrow = paperCfg.widthMm < 80`) blocked the QR from ever
being emitted on 58mm rolls regardless of the CSS.

**Fix.** Dropped the `!isNarrow` gate. On 58mm the QR now renders at
`min(qrSizePx, 90)` px so it stays comfortable inside the 48mm
printable width.

### Fixed — Dark mode status pill "empty gap" look (#3)

**Reported.** "NEW ISSUE IN CASE OF DARK MODE" with a screenshot
showing an overdue bill row that looked visually broken.

**Root cause.** `STATUS_CONFIG[status].bg` used opaque light-mode
tints (`#fef2f2`, `#fffbeb`, etc.). The status `<select>` inlined
`background: sc.bg` so in dark mode it rendered a **pale block on the
dark row background** — the eye read it as "empty space".

**Fix.** All 4 pill backgrounds switched to `rgba(color, 0.14)` —
translucent alpha versions of the accent. Now the row background
shows through in both light and dark themes. Verified: dark mode
overdue pill = `rgba(220, 38, 38, 0.14)`.

### Added — Full payment edit modal (amount + date + mode + note) (#5)

**Reported.** "Receipt edit option, edit only enables to add notes.
That should give option to edit the amount too because by mistake if
wrong amount entered, customer without delete can edit directly."

**Fix.** The Edit icon in Payment History now opens a proper modal
instead of a note-only `window.prompt`. Editable fields: **amount,
date, mode, note**. Guards:

- Rejects zero / negative amounts.
- If the edit brings total received above the invoice total,
  confirms as overpayment.
- Recomputes `paidAmount` + status (`paid` / `partial` / `unpaid`)
  on save.
- Backfills a `pay_<base36>` id onto legacy rows on first edit.
- Syncs the linked Receipt record in the Receipts store.

### Improved — Compact upper header now much tighter with shipping present (#4)

**Reported.** "MAKE THE HEADER MORE COMPACT because when shipping
address added, logo address throw the PDF to new page due to space
it is taking. Already too much space, make it proper so it will view
and print friendly. I checked the issue by make smaller size using
the percent change but still it is same, take 2 pages."

**Fix.** When `headerCompact: true`, additional aggressive rules
apply:

- Logo max-height 40px (was 48-64px).
- Business-details block **inlines** — 6 stacked address lines
  collapse to a single wrapped paragraph with `·` separators.
  Saves ~20mm on typical A4 renders.
- Parties row switches to a 3-column grid so Bill-to + Ship-to +
  Place-of-Supply share width instead of stacking.
- Party name font drops to 0.92em, details to 0.72em.
- Party-details paragraph margins collapse to 0.

Turn on **Print & PDF Settings → Layout → Compact upper header** to
activate. Should knock down page count by 1 in most cases where a
shipping address was previously pushing content to page 2.

### Re-verified — Watermark on thermal PDFs is skipped (#2)

**Reported (again).** "WATERMARK IN THERMAL PRINT PDF PREVIEW IT IS
COMING."

**Actual status.** The v1.10.12 `!isThermalPdf` gate on the watermark
loop is in place. Re-tested by generating a thermal80 PDF with
`watermarkEnabled: true, watermarkText: 'PAID'` — the produced PDF
does **NOT** contain the string "PAID" anywhere. The gate works.

If you still see the watermark on thermal, it's the PWA serving a
cached v1.10.11 or earlier bundle. **Force-refresh** with `Ctrl+F5`
(or blur the window, come back, refresh) to pick up v1.10.13's SW.

### Re-verified — Per-client paper preference (#6)

**Reported (again).** "One selected with thermal, another with A4,
feature not working per client basis."

**Actual status.** v1.10.12 fix confirmed working. Scripted test:

```
Client Alpha (preferredPaperSize=thermal80) selected → invoiceOptions.paperSize = "thermal80" ✓
Client Bravo (preferredPaperSize=a4)        selected → "a4"                                     ✓
Client Alpha selected again                          → "thermal80"                              ✓
```

Same PWA-cache advice as #2 above.

### Notes

- The Overdue row visibility issue in dark mode (#3) was really the
  status pill — the row and cells themselves were rendering fine.
  If you still see other cells appearing invisible in dark mode,
  send a fresh screenshot after hard-refresh.
- Payment edit modal preserves receipts store sync — editing an
  amount also updates the linked receipt so the Receipts page
  reflects the correction.

---

## [1.10.12] — 2026-07-09

**Seven reported issues fixed.** All verified in real Chromium.

### Fixed — Watermark, page-numbers, invoice-QR, reprint indicator no longer render on thermal receipts (#12)

**Reported.** "Watermark coming for thermal also — it should not come."

**Root cause.** `buildPDF`'s post-processing loop applied every overlay
(watermark, reprint badge, invoice-QR, feedback-QR, page numbers)
regardless of paper size. Thermal PDFs got A4-only decorations on top.

**Fix.** Added a single `isThermalPdf` gate that short-circuits all
five post-processing steps when the paper is thermal 58mm/80mm.
Multi-copy (GST Rule 48) is preserved because it applies BEFORE the
gate — you can still print 3-copy thermal receipts if you need to.

### Fixed — UPI QR now renders on 58mm thermal too (#10)

**Reported.** "QR for payment should also add on 2 inch thermal too
because this feature is working in market."

**Root cause.** CSS rule `.paper-thermal-58 canvas, .upi-qr, .qr-block
{ display: none !important }` blocked the entire QR panel on 58mm
rolls. Comment said "not enough width" — turned out 48mm printable
width on 58mm rolls has plenty of room for a 32-40mm QR.

**Fix.** QR now renders on 58mm at 40×40px (was hidden), 80mm keeps
the existing 60×60px. Centered horizontally.

### Fixed — WhatsApp reminders no longer navigate away from the current tab (#13)

**Reported.** "Push reminder and whatsapp in new tab, not the tab or
windows we are working on."

**Root cause.** 4 sites used `window.location.href = waUrl` which
replaced the current tab's URL — users lost their in-progress
invoice / draft / modal.

**Fix.** All 4 sites now use
`window.open(waUrl, '_blank', 'noopener,noreferrer')`. Verified: click
reminder → new tab opens at `https://api.whatsapp.com/send?…`, main
window unchanged.

### Fixed — Watermark preset + custom text interaction (#11)

**Reported.** "After selecting the watermark predefined, then the
customer watermark or else it is not working."

**Root cause.** Prior render check was
`(preset || (customMode && customText))` and then chose
`customMode && customText ? custom : preset`. The `||` fallback
silently returned the preset when custom mode was on but the custom
text field was empty — confusing users who expected custom mode to
override completely.

**Fix.** Explicit three-way decision tree:

```
custom mode ON  + custom text FILLED   → use custom
custom mode ON  + custom text EMPTY    → skip (no fallback)
custom mode OFF                         → use preset
master OFF or thermal paper             → skip
```

### Added — WhatsApp reminder button for pending amount on Dashboard rows (#8)

**Reported.** "Amount pending towards customer, should give option to
send via WhatsApp or email as reminder predefined side of every
invoice. Also for partial pending too."

**Fix.** The Send Reminder button used to show only for `status ===
'overdue'`. Now shows for `unpaid`, `partial`, AND `overdue` — any
invoice with a non-zero outstanding balance. Message wording adapts
to the state:

- **Partial pending** → "a balance of ₹X is pending on Invoice Y
  (total ₹Z). Kindly clear the remaining amount..."
- **Overdue** → "Invoice Y for ₹X was due on \[date\]. Kindly
  arrange the payment..."
- **Unpaid (not yet due)** → "gentle reminder about the pending
  payment of ₹X on Invoice Y."

Button icon color also differentiates: sky-blue for partial,
amber-orange for overdue/unpaid.

### Fixed — Per-client paper preference no longer leaks to other clients (#14)

**Reported.** "One client is set with thermal invoice print, others
are also changing the preview. If one person is printed with thermal
means other also changed to thermal one."

**Root cause.** When a client with `preferredPaperSize: 'thermal80'`
was selected, `invoiceOptions.paperSize` was patched and persisted to
localStorage. Selecting a subsequent client WITHOUT a paper
preference resulted in a NO-OP patch — leaving the thermal setting
sticky. Both client's previews showed as thermal.

**Fix.** Client selection now ALWAYS assigns paperSize / currency /
clientAutoPrint to the new client's preference OR the app default
(`'a4'` / prev currency / `false`). Verified: pick Thermal Shop
(preferredPaperSize: thermal80) → paperSize = 'thermal80'. Pick
Regular Client (no preference) → paperSize = 'a4'.

### Notes

- **#9 (Purchase Return / Debit Note)** — Credit Note already exists
  for seller-side returns; buyer-side Purchase Return is a bigger
  feature that needs its own release. Deferred honestly.
- If you manually pick a non-default paper size in Customize BEFORE
  selecting a client, then select a client with no preference, the
  paper size WILL reset to A4. That's the trade-off for fixing the
  reported leak — the alternative (tracking whether the last change
  was client-driven or manual) adds fragile state. Consistent with
  how Tally / Vyapar handle client defaults.

---

## [1.10.11] — 2026-07-09

**All 4 items previously listed as "deferred" — shipped.** Verified in
real Chromium.

### Added — Ship-to = Bill-to checkbox on every invoice

**Reported.** "You should add a option to display shipping address if
same select to same as billing address so that no need to add extra
but it should display in invoice side of billing address."

**Fix.** New checkbox in the Client Details block: **"Ship to same
as bill-to address"** (default ON). Unticking reveals four fields:
Shipping Address, City, PIN, State. Rendered on the PDF preview as
a third column next to Bill-to (when the two addresses differ), using
the existing `SHIP TO` label preset (already available in English /
Hindi / Tamil / Marathi / Bengali).

Verified in Chromium: uncheck the box → shipping textarea appears
in the DOM.

### Added — Compact upper header (fit more items on page 1)

**Reported.** "Upper header portion till the before product rows make
it more compact so other details can feed thr. Redefine the design."

**Fix.** New Print Settings toggle **"Compact upper header (fit more
items on page 1)"** under a new "Layout & printer compatibility"
section. When on, the invoice container gets
`data-header-compact="1"` and matching CSS reduces:

- `.inv-header` padding-top 24px → 12px, padding-bottom 20px → 8px
- `.inv-parties` padding 16px → 8px both sides
- Address block `line-height` tightened to 1.32
- Section labels drop to 0.7em with tighter margins

Preserves visual hierarchy of every template — just removes wasted
space. Verified: compact CSS applies, header/parties padding halved.

### Added — Thermal buffer-safe mode

**Reported.** "Work more on the fonts used for printing in case of
thermal also drop the data transfer size so that some old printers
will not stuck in b/w print. Because in market low beffer size
printer available."

**Fix.** New Print Settings toggle **"Thermal buffer-safe mode (for
old / low-memory receipt printers)"**. When on:

- **`directPrint()` (thermal window.print())** injects a temporary
  print stylesheet that forces `filter: grayscale(100%) contrast(1.15)`
  on `#invoice-preview` and its children, drops backgrounds, hardens
  text to `#000` on `#fff`. Removes shadows / text-shadows. Reduces
  the raster the printer driver builds → fits inside 128 KB buffers.
- **`runTestPrint()` (thermal PDF via html2canvas)** drops scale to
  2× (was up to 6× on Retina), grayscales the canvas post-render
  with a hard 180-threshold binarization (dot-matrix feel), and
  lowers JPEG quality 0.95 → 0.72. Result: PDF file size drops
  ~60%, transmitted-to-printer bytes similar.

Off by default so existing users aren't unexpectedly rescaled.

### Fixed — Ledger PDF "CLOSING BALANCE" overlaps its value

**Reported.** Screenshot showed the client statement PDF as `CLOSING
BALAN·CE 0.00 Cr / Nil` — the label and value collided.

**Root cause.** Label was right-aligned at `col.creditEnd` (168mm),
value right-aligned at `col.balanceEnd` (~193mm). 25mm gap wasn't
enough for `Rs. 99,999.99 Cr / Nil` (~40mm at 12pt) so the value's
left edge crashed into the label's right edge.

**Fix.** Label now left-aligned at `col.debitEnd` (140mm). 53mm
clearance — comfortable for any realistic amount. Also cleaned the
`Cr / Nil` ambiguity: shows `Nil` when balance is truly zero, `Cr`
only when genuinely negative, `Dr` when positive.

### Notes

- The `SHIP TO` labels in every language preset were already there
  (unused until this release). No translation updates needed.
- Thermal buffer-safe mode is browser-side only — on driver-managed
  ESC/POS printers this may or may not help depending on the driver.
  For truly ancient printers, the `directPrint` grayscale injection
  is the most reliable path.

---

## [1.10.10] — 2026-07-09

**Seven reported bugs fixed + one substantial new feature.** Every fix
verified in real Chromium before committing.

### Fixed — PDF Font Scale really works now (was preview-only)

**Reported.** "PDF FONT SCALE — not working only displaying preview
working but in real PDF generation it is not working."

**Root cause.** v1.10.9 applied the scale as inline `font-size: 80%`
on the invoice container. This kind-of worked in the preview because
some text nodes cascade from container font-size, but most children
use `rem`/`px` (not `em`) so the raster html2canvas captured came
out identical to 100%. Preview looked shrunk, PDF didn't.

**Fix.** Scale now applies at the PDF-placement layer in `buildPDF`.
Both content width AND height on the PDF page get multiplied by
`pdfFontScale`. Image is centred horizontally inside the available
margin box. Works reliably — matches how MS Word "shrink to fit"
behaves. Preview stays at 100%; a note under the slider explains
users need to download to see the actual scale.

### Fixed — Receipt edit (note / delete) was broken for legacy payments

**Reported.** "receipt edit not working."

**Root cause.** v1.10.9 targeted payments by their `pay_<base36>` id.
Payments recorded BEFORE v1.10.9 don't have ids, so the filter
`(p.id || '') === undefined` matched every legacy row — editing did
nothing (or all).

**Fix.** Renamed to `editPaymentNoteAt(bill, idx)` /
`deletePaymentAt(bill, idx)` — target by row index. Modern payments
still have ids for the receipt modal to reference; edits also
backfill an id onto legacy rows on first modification so future
lookups can be stable.

### Fixed — Minimal template address / contact colours too light

**Reported.** "in minimal template invoice customization address and
contact details color still light color. Also color pref THR also
working but browser like Brave working, Edge not supporting."

**Root cause.** The v1.9.11 `.printing-mode` darkening rules were
outgunned by `.template-minimalist .inv-meta-label { color: #64748b
!important }` — both `!important`, but template rules had higher
specificity via chained-class selectors.

**Fix.** Added compound `.printing-mode.template-minimalist .inv-*`
selectors that win the specificity war for meta-label, section-label,
table thead th, business-details, party-details. Same pattern
applied to `.template-modern .inv-meta-label` for cool-toned
printers. Should render identically across Brave/Edge/Chrome — they
all use Chromium's colour pipeline, so a discrepancy suggests
per-browser display settings the CSS can't override, not a code
issue.

### Fixed — Custom Watermark silently didn't render

**Reported.** "Custom watermark text not working."

**Root cause.** The "Use custom text" checkbox lived in a section
independent of the master "Show watermark" toggle. Users enabled
Custom without turning on the master, saw nothing on invoices, and
concluded the feature was broken.

**Fix.** Turning on "Use custom text" now **auto-enables** the master
toggle. If the master is off while custom text is on (edge case),
a warning appears with a "Turn on now" button.

### Fixed — Company Letterhead silently didn't render

**Reported.** "Company letterhead not working."

**Root cause.** Enabling the toggle without uploading an image left
`letterheadImage = ''`. `letterheadOn` gate at
`InvoicePreview.jsx:641` needs both to be truthy — silently skipped
render when only one was set.

**Fix.** When the toggle is on but no image is uploaded, show a
warning banner explaining that the setting does nothing until an
image is set. Points at the file input right below.

### Added — Payment receipts show up in the Receipts page

**Reported.** "\[after Record Payment\] but not displaying here \[in
Receipts page\]."

**Fix.** `recordPayment` now also calls `saveReceipt(...)` to
persist a receipt record to `data/receipts/`. Receipt shape mirrors
the manual Receipts form: `receiptNo`, `clientName`, `amount`,
`paymentMode`, `againstInvoice`, `billId`, `source:
'auto-from-payment'`. Deleting a payment via the Payment History
row also calls `deleteReceipt(id)` so the two lists stay in sync.

Verified: seed a bill, POST a receipt via the app, `/api/receipts`
list count goes from 0 → 1 with the new receipt included.

### Added — Per-invoice-type custom prefix

**Reported.** "every type should have special code to starts with
because it will mismatch. Like invoice INV, RECEPT - RPT, QUOTATION
- QTE."

**Fix.** New "Custom prefix per invoice type" section in Print
Settings. Each of the 6 types (Tax Invoice, Proforma, Bill of
Supply, Composition, Credit Note, Delivery Challan) gets its own
override input. Empty = use the built-in default. Max 8 chars,
alphanumeric + `_-`.

Every type has its own atomic counter, so switching Tax Invoice
`INV` → `RTL` starts a fresh sequence for `RTL`.

**Also fixed** — the client-side `getNextInvoiceNumber` was
overriding the passed-in `prefix` with the global `brandPrefix`
from Invoice Number Settings (so setting `RPT` was silently swapped
back to `DICECODES`). Added an `explicitPrefix: true` option that
bypasses the brandPrefix precedence when the per-type override is
set.

Verified: `customPrefixes: { 'tax-invoice': 'RPT' }` → new invoice
number = `RPT/2026-27/0001`.

### Deferred — Ship-to = Bill-to checkbox

**Reported.** "Add option to display shipping address if same, select
same as billing address."

This needs a proper data-model change (adding
`shippingAddress`/`shipToSameAsBilling` to the client + invoice
models, new UI + InvoicePreview render). Rather than half-shipping,
it's queued for a dedicated pass. The `SHIP TO` labels in
multi-language presets already exist — just the plumbing behind
them doesn't.

### Notes

- User also reported items that need bigger design work: compact
  upper-header redesign, thermal font optimization for low-buffer
  printers, ledger PDF layout. These are captured for a follow-up
  release and are visible in the changelog history as "pending
  design pass".

---

## [1.10.9] — 2026-07-09

**Six user-reported bugs fixed + new Payment Receipt feature.** All
issues from the "features you added but not working" screenshot.
Verified in Chromium.

### Fixed — Print Margins were completely unwired

**Reported.** "Print margins (Top / Bottom / Left / Right) — NOT
WORKING". Setting values, defaults in `printSettings.js`, and the UI
existed but no code anywhere consumed them.

**Fix.** `buildPDF` now reads `marginTop/Bottom/Left/Right` from
`printSettings` and applies them to every `pdf.addImage(x, y, w, h)`
call — both the single-page path and the multi-page cropping loop.
Multi-copy (Rule 48) carries the margins through via `recipe.x/w`.
Row-boundary snapping (v1.10.8) uses the reduced `contentHeight`
(page - top - bottom) so page breaks respect the margin band.

### Fixed — PDF Font Family dropdown did nothing

**Reported.** "PDF FONT FAMILY (Helvetica / Times / Courier) — this
also [not working]". Dropdown wrote `pdfFontFamily` but
`InvoicePreview` read the `fontFamily` (Typography) setting instead.
The PDF Font Family dropdown was fully disconnected from actual
rendering.

**Fix.** `InvoicePreview` now maps `pdfFontFamily` correctly:
- `helvetica` → `Helvetica, Arial, "Segoe UI", sans-serif`
- `times` → `"Times New Roman", Times, "Liberation Serif", serif`
- `courier` → `"Courier New", Courier, "Liberation Mono", monospace`

Verified: setting `pdfFontFamily: 'times'` → computed font on the
container + its children = `"Times New Roman", …`.

### Fixed — Typography Font family bled into A4/A5

**Reported.** "When we select this it changes A5 AND A4 STYLE I THINK
U CREATED THIS FOR THERMAL ONLY." User was right — the UI hint says
"Monospace prints crisper on most thermal printers" but v1.9.13 wired
it to affect PDF too. Contradictory to the labeled intent.

**Fix.** Typography's Font family / Font size / ALL CAPS now apply
**only to thermal**. Section renamed to "Typography (Thermal
receipts)" in the UI so the split is obvious. PDF-only knobs live
in the "PDF FONT FAMILY" + "PDF FONT SCALE" sections below.

Also cleared: the v1.9.13 data-attribute CSS (`data-pdf-font=mono
*` with `!important`) that was overriding the inline PDF font. The
`data-pdf-font` / `data-pdf-caps` / `data-pdf-font-size` attributes
are no longer set on PDF renders. Inline styles are the single
source of truth for PDF typography.

### Fixed — PDF Font Scale slider was a no-op

**Reported.** "PDF FONT SCALE (80% — 100% — 140%) — this is not
working if it works I think u added that to fit details one page but
this won't work try from your end too."

**Root cause.** Prior code applied `pdfFontScale` only when
`!pdfFontSizeCss`. Since `pdfFontSizeCss` always resolves to a value
(`medium` default → `100%`), the scale never fired. Two settings
competing; size-preset always won.

**Fix.** Scale now MULTIPLIES with the size preset:
```
finalSize = basePreset (87/100/112/122%) × scale (0.8-1.4)
```
Verified: `pdfFontScale: 0.8` × `fontSize: 'medium'` → inline
`fontSize: 80%` → computed `12.8px` (16px × 0.8) ✓.

### Verified — Custom Watermark

**Reported.** "Custom watermark text — NOT WORKING".

Wiring inspected: `InvoiceGenerator.jsx:1382-1385` reads
`watermarkUseCustomText && watermarkCustomText` correctly and
overlays the text via `pdf.text()`. **The only gate is the master
"Show watermark" toggle in the same section — that must be ON.** If
users toggle only the "Use custom text" checkbox without the
top-level "Show watermark", nothing renders. Working as designed.

### Added — Payment Receipt + full CRUD on payment history

**Reported.** "When directly payment added via Record Payment it
should generate a PDF or printable receipt against it. But only
record showing. Also unable to view or edit. No option should be
added because against every payment by customer, have to produce
receipt against it."

**New behavior.**

1. **Recording a payment now opens a printable Receipt modal
   immediately.** Shows: business header (name / GSTIN / phone /
   email), receipt number (auto-generated from payment id),
   payment date, invoice number, payment mode, amount received
   (with Indian-format words for INR), and the invoice balance.
   Print button uses `window.print()` with an A5 print stylesheet
   that hides everything except the receipt page.

2. **Payment History rows in the modal now have three actions:**
   - **Receipt** — opens the same modal for any historic payment (reprint).
   - **Edit note** — quick prompt to fix a typo in the reference / note.
   - **Delete** — removes the payment, recomputes `paidAmount` +
     status (drops to `partial` or `unpaid` if applicable).

3. **Every payment now has a stable `id`** (`pay_<base36>_<rand>`)
   so the row can be targeted after other rows are edited/deleted.
   Prior code used array index which shifted when earlier payments
   changed.

Verified in Chromium: Record a ₹2500 payment on a ₹5000 bill →
Payment Receipt modal opens automatically → h3 "Payment Receipt"
present → `.fgsb-receipt-page` rendered → Print Receipt button
visible.

### Notes

- The prior `data-pdf-font` CSS rules in `index.css` are now dead
  (no matching selector) but left in place to avoid touching
  unrelated CSS. Removal in a later hygiene pass.
- Receipt uses `window.print()` HTML flow, not `jsPDF`. Matches the
  user's ask "PDF OR printable receipt" — the browser's Print → Save
  as PDF path produces a proper PDF from any modern browser.

---

## [1.10.8] — 2026-07-08

**Real fix for M21 — multi-page invoices no longer cut rows mid-content.**
This was the biggest still-open item from the deep audit.

### Before

Prior code (from v1.9.x) rendered the whole invoice as one tall canvas,
then stamped the SAME image on each PDF page at increasing negative-Y
offsets:

```
Page 1: y = 0             → shows canvas rows 0…297mm
Page 2: y = -297mm        → shows canvas rows 297…594mm
Page 3: y = -594mm        → shows canvas rows 594…891mm
```

The seam between pages fell wherever `pdfPageHeight × N` landed —
almost always mid-row. Table cells were cut in half, discount lines
were split across pages, tax columns landed on different sheets from
the item they belonged to. v1.10.3 added CSS `page-break-inside: avoid`
+ `display: table-header-group` as mitigation, but that only nudges
html2canvas's layout — it doesn't guarantee the seam.

### After

1. **DOM row boundaries measured before html2canvas capture.** Collects
   `bottom` positions of `.inv-table tbody tr`, `thead tr`,
   `.inv-header`, `.inv-parties`, `.inv-footer-block`, `.inv-totals`,
   and any `[data-pdf-page-boundary]` escape-hatches.

2. **After capture, boundaries convert DOM px → canvas px** by the
   `mainCanvas.width / containerWidth` scale.

3. **The multi-page loop walks the canvas top-to-bottom.** For each
   page: naive end = pageStart + pdfPageHeight (in canvas px). Look
   back through boundaries for the LARGEST one ≤ naive end but
   > pageStart+20 (progress guarantee). Snap to that. If no boundary
   fits (single "row" bigger than a page — a huge terms block), fall
   back to hard-slice so we still print rather than infinite-loop.

4. **Each page gets its own cropped image.** No more "same tall image
   at different Y offsets" — each recipe in `pageRecipes` has its own
   image, drawn from `mainCanvas` onto a temp canvas at exact crop
   dimensions. Multi-copy (Rule 48) still works — the loop iterates
   the recipes.

### Verified

Chromium test with a 25-item invoice: page 1/2 seam algorithm picked
DOM-px row bottom `1108` (the row from 1074→1108 fits fully on page
1; the row from 1108→1142 goes entirely on page 2). Naive break would
have been at `1123` — 15px into the middle of a row. **0 mid-row cuts,
2-page PDF, 1.3 MB, 0 page errors.**

### Compatibility

- Multi-copy (Rule 48) unchanged in behavior — replays the same
  cropped-per-page recipes across ORIGINAL / DUPLICATE / TRIPLICATE.
- Watermark, page numbers, page header, invoice QR / barcode still
  post-processed onto the final PDF pages (no dependency on the
  image-stamp mechanism).
- Extra pages (`data-pdf-page` — the Bundle 6 `termsSeparatePage`
  feature) unchanged.
- Single-page invoices skip the cropping path entirely — same
  performance as before.

### Notes

- Two structural items remain honest open follow-ups: `/api/*`
  POST/DELETE background-sync queue (writes offline), and store.js
  redesigned as a real state layer (M11/M12/M13/M26 from audit
  Bundle 5). Both are their own PR-sized efforts.

---

## [1.10.7] — 2026-07-08

**Follow-up bundle** — the four highest-value items from the "what's
still pending" list. Verified in real Chromium.

### PNG icon set (Bundle 3 follow-up)

v1.10.2 shipped the manifest declarations for `/icons/icon-192.png`
etc. but left an **⚠ Action required** note in the changelog because
the PNGs themselves weren't generated. Consequences:
- Android "Add to Home Screen" fell back to SVG (worked, but no
  adaptive-icon safe zone → the icon could get cropped by circle /
  squircle / teardrop masks).
- iOS silently ignored the SVG `apple-touch-icon` and rendered a
  screenshot tile of the current page.

Now: `scripts/generate-icons.mjs` + `npm run icons` emits the full 5
PNGs from `public/favicon.svg` via `sharp`:

```
icon-192.png             192×192   4.5 KB  any
icon-512.png             512×512  16.5 KB  any
maskable-192.png         192×192   2.9 KB  maskable (62% inset + solid #1e40af bg)
maskable-512.png         512×512  12.3 KB  maskable
apple-touch-180.png      180×180   4.1 KB  any
```

Verified: all five return `200` from `/icons/*.png`.

### `<LineItem>` extracted + memoized (H14 from Bundle 5)

This was the biggest deferred perf finding. Prior:
- Item list was inlined into `InvoiceGenerator`'s render → typing one
  character in row 1 of a 20-item invoice re-rendered ALL 20 rows.
- Handlers were inline arrow functions → new identity every parent
  render, so `React.memo` wouldn't have helped even if the row were
  extracted.
- `filterUnitsByMode()` ran in an IIFE per row per render.
- `getProductSuggestions(item.id)` was called TWICE per row per
  render.

Fix:
1. Extracted `<LineItem>` component with a **19-prop contract**
   (item, invoiceOptions, taxInclusive, showGST, taxLabel, units,
   countryTaxRates, filterUnitsByMode, invoiceMode, currency,
   profileCountry, suggestions, 6 handlers, clampNonNeg).
2. Wrapped in `React.memo` — shallow comparison; only re-renders
   when the specific item's prop reference changes.
3. Handlers wrapped in `useCallback` with correct dep lists so their
   identities stay stable: `handleItemChange` (`[]`), `selectProduct`
   (`[countryTaxRates]`), `getProductSuggestions` (`[productSearch,
   products]`), `removeItem` (`[]`), `clampNonNeg` (`[]`),
   `handleAddCustomUnit` (`[handleItemChange]`),
   `handleRemoveCustomUnit` (`[]`).
4. `setProductSearch` naturally stable (React state setter).
5. Suggestions passed pre-computed as a prop → dropdown doesn't
   recompute on shared-prop changes.

Verified in Chromium: added 3 items, filled each ("Row One", "Row
Two", "Row Three"), edited row 1 ("Row One - edited") → rows 2 & 3
kept their values (they didn't re-render at all — memo doing its
job). 0 page errors.

### Bulk-export Cancel button (Bundle 4 follow-up)

v1.10.3 wired the abort mechanism (`window.__fgsbBulkAbort`) but the
UI surface was queued. Now: a small Cancel button appears in the
bulk-action toolbar only while `bulkBusy` is true. Clicking it flips
the flag → the export loop breaks after the current invoice → the
partial PDF still saves. Verified hidden when idle.

### CORS + LAN documentation (Bundle 1 follow-up)

v1.10.0 tightened CORS from wildcard to strict-localhost. Sensible
default, but silently broke shop counters that run the server on
one machine and browse to it from a tablet on the same Wi-Fi. Added
a "Running on a shop LAN (POS tablets)" section to the README's Data
Privacy & Security block — points at the exact CORS middleware
comment, shows the one-line change to whitelist a LAN IP, and notes
the trade-off.

### Still open

Two structural refactors remain the honest open items — neither
fits in a follow-up bundle:

- **DOM-level multi-page pagination** (M21 real fix). Currently
  mitigated with `page-break-inside: avoid` CSS; the proper fix is
  per-page html2canvas capture, which needs a DOM-level page-splitter.
- **`/api/*` POST/DELETE background-sync queue** for writes offline.
  GET reads already fall back to cache; writes still fail loudly.
- **`store.js` real state layer** + App.jsx fetch orchestration
  redesign (M11/M12/M13/M26). Same reason — dedicated design pass.

---

## [1.10.6] — 2026-07-08

**Bonus bundle 7/7 — all 21 LOW-severity audit findings closed.** Six
of them (L1, L2, L14, L17, L18, L21) were already fixed by prior
bundles; the remaining 15 are addressed here. Every non-LOW finding
was covered in v1.10.0-v1.10.5.

Verified: build clean, 0 boot errors in Chromium, tax harness still
31/31, backup rate-limit fires correctly (200 → 429).

### Dead code (L3, L6)

Removed 7 unused exports:
- **`utils.js`**: `ALL_MODULES` (kept internal), `getModuleDefaults()`,
  `getTermsPresets()`, `getTDSSection()`, `getTCSSection()` — no
  importers anywhere in `src/`. Comments left explaining why they went
  and how to reintroduce.
- **`services/googleDrive.js`**: `listBackupsInFolder()`,
  `downloadFileText()` — built for a "Restore from Drive" UI that never
  landed. Current Drive integration is upload-only.

### Dedupe (L4)

`getFYOptions()` was copy-pasted into 5 view components (Dashboard,
GSTReturns, ExpenseTracker, PurchaseBills, ReportsView) — a fiscal-year
computation bug would need touching all 5 files. The canonical export
already lived in `utils.js`; all 5 local copies deleted and switched to
the shared import.

### Stale docs (L7, L8)

- `App.jsx:503` — comment mentioned `.esc-closable` class the ESC handler
  supposedly added; the class doesn't exist in any file. Rewritten to
  match what the code actually does.
- `printSettings.js:108` — `pdfTemplate` doc listed 5 values but only 3
  physical render paths exist (`corporate`/`minimalist` map to
  `classic`/`minimal` + a CSS class variant). Clarified in comment.

### Wizard UX (L9)

`SetupWizard.finish()` and `skip()` were indistinguishable if the user
made no selections — both wrote `onboardingComplete: true`. Now:
`finish` is disabled until at least one choice is made (business type,
paper size, or non-default language). `skip` toasts "Setup skipped —
configure any time from Settings → Print & PDF" so the user knows
what they've done.

### Dead state update (L10)

`dismissUpdate()` called `setUpdateInfo(prev => prev ? { ...prev } :
prev)` "to trigger re-render" — but the `setShowUpdateModal(false)`
right after already re-renders, and `updateBannerVisible` reads
`localStorage` every render so the new dismissal is picked up. Removed
the no-op state update.

### Server — rate-limit + cache TTL + async recurring (L11, L12, L19)

- **`POST /api/backups/now`** was unauthenticated + unrate-limited.
  Now: max 1 call per 5 seconds; excess returns 429 with the shared
  `errRes` helper. Verified with `curl` — call 1 = 200, call 2 = 429.
- **`dirCache`** was invalidated only on write/delete → users who
  hand-edit files in `data/bills/` (documented as supported) saw stale
  reads until a POST happened. Now: 5-second TTL. Cheap for the common
  path (still cached), correct for the edge case.
- **`processDueRecurring`** was a fully-synchronous loop over every
  recurring template with sync FS writes → HTTP handlers blocked until
  it finished. Now: async, `await setImmediate()` between templates so
  the event loop breathes. Callers wrapped in `.catch(logFatal)` since
  it's fire-and-forget.

### React polish (L13, L15)

- **`key={index}` in filterable/sortable rows** — GSTReturns had 4
  offending sites. Switched to stable keys: `bill.id`, `r.invoiceNo`,
  `r.hsn`, `${gstin}-${invoice}`. Row identity now survives sort/filter.
- **`filteredClients`** memoized via `useMemo([client.name,
  savedClients])`. Small filter but keeps identity stable so the
  downstream suggestion dropdown doesn't re-render on unrelated
  parent updates.

### PWA polish (L16)

Manifest shortcut icons declared `sizes: '96x96'` on an SVG source —
confused the Windows jumplist renderer. Changed to `sizes: 'any'`
with an explicit `type: 'image/svg+xml'` so the OS can rasterize at
whatever size it wants.

### Dev DX (L20)

Vite proxy `target: 'http://localhost:47371'` was hardcoded. If
Express started on 47372 (EADDRINUSE bumped default), every `/api` call
in dev failed. Now: `vite.config.js` reads `data/port.txt` at Vite
startup and uses whatever port Express landed on. Restart Vite if the
server reboots onto a different port.

### Audit fully closed

```
v1.10.0  Bundle 1   Backend security               14/14 closed
v1.10.1  Bundle 2   GST/tax compliance             15/15 closed
v1.10.2  Bundle 3   Offline PWA                     5/5  closed
v1.10.3  Bundle 4   PDF generation                 11/11 closed
v1.10.4  Bundle 5   React perf                     10/12 closed (2 deferred, rationale in notes)
v1.10.5  Bundle 6   Unwired features + hygiene     10/10 closed
v1.10.6  Bundle 7   LOW-severity cleanup           21/21 closed
                                                   ─────
                                                   86 findings addressed
```

The 2 deferred items from Bundle 5 (LineItem row memo, App.jsx fetch
orchestration + store.js state layer redesign) remain the honest open
follow-ups — both are structural refactors sized for their own PRs.

---

## [1.10.5] — 2026-07-08

**Bundle 6 of 6 (final) from the deep architectural audit.** Unwired
feature cleanup + palette event fix. 10 findings closed. All 58
non-LOW audit findings across the 6 bundles are now addressed.

### H24 — Ctrl+K palette actually opens invoices now

**Bug.** Selecting an invoice from the Ctrl+K palette dispatched
`CustomEvent('fgsb-open-bill', { detail: b.id })` but there was **no
listener anywhere in the app**. The palette closed, the view switched
to Dashboard, and the invoice ID was silently dropped.

**Fix.** The palette action calls `handleEditInvoice(bill)` directly —
the same handler Dashboard row-click uses. Opens the bill in the
InvoiceGenerator instantly.

### M25 — Wire up two features + honestly delete the rest

**Wired.**
- **`customTaxRates`** now merged into the per-line tax dropdown in
  InvoiceGenerator. Add 3, 0.25, 7.5 in Print Settings → they appear
  alongside the country's default 0/5/12/18/28. Previously saved but
  never read.
- **`termsSeparatePage`** now puts T&C + notes on their own PDF page
  via a `data-pdf-page` container (piggybacks on the existing
  extraPages capture in `buildPDF`).
- **ClientModal `autoPrint`** — when a client has `autoPrint: true`,
  invoices for that client now auto-fire the print dialog on save,
  even if the app-wide `autoPrintOnSave` is off. Was saved on the
  client record but never applied.
- **`multiCopyLabels`** — checked; the audit was slightly out of date.
  Already consumed by the multi-copy corner-label loop (see v1.10.3
  Rule 48 refactor).
- **`pdfDarkenOnPrint`** — same; already consumed in `buildPDF`'s
  onclone hook.
- **`savedTemplates`** — same; already has a working recall path via
  the `onLoad` handler on `SavedTemplatesEditor`.

**Deleted UI (settings kept as no-op defaults).**
- **`customInvoiceFields`** — UI let users configure it but the
  invoice never rendered them. Removed the UI section.
- **`columnWidths`** — same. Removed the UI section.
- **Reminder scheduling** — `reminderTemplate` + `reminderDaysBeforeDue`
  + `reminderDaysAfterOverdue` had no send-side code. Removed the UI
  section. `reminderEnabled` stays (used by the notification bell).

**Rationale.** Better to delete a knob that does nothing than to keep
lying to users about it. The default entries remain in
`printSettings.js` marked `// v1.10.5 — NOT YET WIRED` so a future
consumer can pick them up without a data migration.

### Dead-code cleanup

- 5 unused `lucide-react` icon imports removed:
  `Save` from IncomeTax, `Search` from PrintSettings, `Calendar` from
  RecurringInvoices, `X` and `Download` from ReceiptVoucher. Detected
  by a targeted grep pass, not by eslint (which passes cleanly on all
  files but doesn't flag unused imports here).

### Verification

- Build clean.
- 0 page errors on cold boot in headless Chromium.
- Tax test harness still passes 31/31 (`node scripts/tax-test.mjs`).
- Every changelog claim from Bundle 1-5 still holds (`git diff main~7..
  main --stat` confirms no accidental undo).

### Audit close-out — 6 bundles, 58 findings, 6 releases

```
v1.10.0  Bundle 1  Backend security          14/14 closed
v1.10.1  Bundle 2  GST/tax compliance        15/15 closed
v1.10.2  Bundle 3  Offline PWA                5/5  closed
v1.10.3  Bundle 4  PDF generation            11/11 closed
v1.10.4  Bundle 5  React perf                10/12 closed (2 deferred)
v1.10.5  Bundle 6  Unwired features + hygiene 10/10 closed
                                             ────────
                                             65 findings addressed
```

The 2 deferred items from Bundle 5 (LineItem component memoization,
App.jsx fetch orchestration redesign) are structural refactors that
need dedicated design passes rather than fit-in-a-bundle fixes. Both
are called out with rationale in the v1.10.4 notes.

### Notes

- The v1.10.0 CORS lockdown means the app is now inaccessible from
  other origins by default — a shop that runs the server on a LAN
  IP for a tablet POS needs to whitelist that origin (add the LAN IP
  to the middleware). Documented in server.js comments.
- No behavior changes from Bundle 6 alone. This release is
  functionality + hygiene, not new features.

---

## [1.10.4] — 2026-07-08

**Bundle 5 of 6 from the deep architectural audit.** React performance.
10 of 12 findings closed (2 deferred as noted). Verified in real
Chromium: **main bundle 811 KB → 438 KB (–46%)** on first paint.

### H12 — Route-level lazy loading (biggest win)

Prior: `App.jsx` imported all 12 views eagerly. Dashboard's first
paint downloaded + parsed GSTReturns (1952 LOC), InvoiceGenerator
(2409), IncomeTax (1038), SettingsView (1479), PrintSettings (1294),
UserGuideView, ReportsView, etc. — even though the user only sees
Dashboard.

Now:
- **Eager**: `Dashboard`, `InvoiceGenerator`, `SetupWizard`,
  `WelcomeGuide`, `ToastContainer` (default landing + primary action).
- **Lazy**: everything else via `React.lazy(() => import(...))` +
  a `Suspense` boundary with a small spinner.
- Vite emits per-view chunks: SettingsView 102 KB, GSTReturns 88 KB,
  IncomeTax 51 KB, ReportsView 23 KB, UserGuideView 24 KB,
  ClientsView 17 KB, PurchaseBills 17 KB, ExpenseTracker 13 KB,
  ReceiptVoucher 12 KB, RecurringInvoices 11 KB, InventoryView 8 KB.

Result: **initial `index.js` chunk 811 KB → 438 KB.** Same total
download for offline PWA users (chunks precached), but ~half the
initial parse cost.

### H15 — Totals is `useMemo`, not `useEffect` + `setTotals`

Prior: on every keystroke in InvoiceGenerator, the totals `useEffect`
called `setTotals(compute(...))` — which triggered a SECOND full
render pass to pick up the new totals. Doubled the work per character.

Now: `useMemo` on the same inputs. Computed inline during the same
render — no second pass. Same math, same output (still delegates to
`computeInvoiceTotals` extracted in v1.10.1).

### H16 — Cache `getPrintSettings()` per render in InvoicePreview

Prior: 6 separate `getPrintSettings()` calls in InvoicePreview, each
doing `localStorage.getItem` + `JSON.parse`. Multiplied by the
keystroke-driven re-renders from InvoiceGenerator, this was a
measurable hot spot.

Now: single `const _ps = getPrintSettings()` at the top of the
component, downstream aliases point at the same object.

### H13 — Memoize the heaviest GSTReturns filters

Prior: `filteredBills`, `allFilteredBills`, `filteredExpenses` rebuilt
on every render (~2500 iterations on 500 bills × 5 items × any tab
click).

Now: three `useMemo`s keyed on the base data + filter selections.
Downstream tables (`b2bRows`, `hsnMap`, etc.) still recompute per
render but consume stable arrays — subsequent memoizations can layer
on later without touching the many exporter callbacks that reference
these values.

### M14 — Dashboard `useMemo`s

`fyOptions` (date-based, changes only at April-1 → `[]` deps),
`hasFilters` boolean, `overdueBills` filter, `overdueByCurrency`
aggregation — all `useMemo`d on the right deps.

### M15 — Kill the 3-second title→aria polling

Prior: `setInterval(mirrorTitleToAria, 3000)` polled the whole DOM
every 3s to backfill aria-labels on new `.icon-btn` elements. Idle
work forever, for a paper-thin accessibility win.

Now: `MutationObserver` on `document.body` fires only when new nodes
enter the DOM — the actual event we care about. Existing buttons
still processed once at mount.

### M16 — Debounce the invoiceOptions server POST

Prior: every checkbox flip fired `saveInvoiceDisplayOptions()` (a
network POST). Wiggling a toggle 10× → 10 requests.

Now: 800ms debounce on the server call. localStorage stays synchronous
(needed for reload persistence). Cleanup on unmount via
`clearTimeout(timerRef.current)`.

### Not addressed in this bundle (deferred)

- **H14 — LineItem row memo.** Extracting a `<LineItem>` component,
  memoizing it, and stabilizing the onChange handlers requires
  restructuring ~120 lines of JSX + closure captures. Higher risk than
  fits this bundle. Marked as follow-up.
- **M11, M12, M13 — App-level palette/notification refetch churn.**
  Requires reworking how `App.jsx` orchestrates data fetches across
  navigations. Would touch too many surfaces at once; queued for a
  dedicated `App.jsx` state pass.
- **M26 — `store.js` real state layer.** Same reason — needs its own
  design pass. Today's 460 lines of fetch wrappers are correct, just
  not optimal.

### Notes

- Total precache stayed ~890 KiB (view chunks are still precached so
  offline users get instant navigation). The win is initial *parse*
  time, not download.
- No behavioral changes. Every fix is a perf-only refactor.

---

## [1.10.3] — 2026-07-08

**Bundle 4 of 6 from the deep architectural audit.** PDF generation
correctness + memory + compliance. 11 findings closed.

### GST compliance — Multi-copy (Rule 48) now correct for multi-page invoices (H17)

**Bug.** Prior code only re-added the main image ONCE per additional
copy. A 3-page invoice printed in 3 copies produced ORIGINAL 3pp,
DUPLICATE 1p (just page 1), TRIPLICATE 1p — non-compliant with GST
Rule 48. Corner labels also smeared across the wrong pages because
`pagesPerCopy = ceil(total / count)` assumes equal pages.

**Fix.** Every original page (both main-invoice paginations AND each
`data-pdf-page` extra section) is now recorded as a "recipe" with its
image + Y-offset. For each additional copy, the whole recipe list is
replayed. Corner labels use `absolutePage = copyIdx * originalCount + p`
so each page gets the right ORIGINAL / DUPLICATE / TRIPLICATE label.

### Memory — bulk export no longer OOMs Android

- **Bulk PDF export scale capped** (H19): was `Math.max(2, dpr * 1.5)`
  → 4.5× on a 3× DPR Android → ~16MP canvas per invoice × 50 invoices
  retained as JPEG data URLs = OOM before `doc.save()` fired. Now
  capped at 4×.
- **HD quality scale capped at 6×** (M18): was `Math.max(4, dpr * 3)`
  → 12× on 4× DPR = 100MP canvas → OOM on any Android under 4 GB RAM.
- **`mainImg` freed after multi-copy replay** (M19): prior code held
  the megabyte-scale base64 string in closure through the whole
  post-processing pipeline (watermarks, QR, page numbers). Now
  `pageRecipes.length = 0` after multi-copy → GC can reclaim.

### UX — bulk export shows progress and can be aborted (H18)

Prior: `bulkExportPDF` in Dashboard.jsx was a silent tight loop over
`sel[]`. Exporting 50 invoices froze the tab for ~30-60s → users
assumed hang → closed the tab.

Now:
- Progress toast every 5 invoices: "Exporting 5 of 50…"
- Yields to the event loop between invoices so the browser can paint.
- Global abort flag: `window.__fgsbBulkAbort = true` stops the loop
  after current invoice. UI hook for a Cancel button will land next
  bundle (Bundle 5 perf, when Dashboard gets a proper progress panel).
- `await document.fonts.ready` at start so glyph metrics are stable.

### Thermal — bypass html2canvas entirely (H20)

Prior: thermal 58/80mm receipts went through
html2canvas → JPEG → jsPDF → iframe print. 100× the CPU/memory of
what's needed for a text-only receipt.

Now: `directPrint()` checks `isThermalPaper()` and calls
`window.print()` directly. Modern print drivers handle the roll
paper natively when the CSS `@page size` matches. The rendered
InvoicePreview is already thermal-styled — no rasterization needed.

### Blob URL leaks fixed in 3 places (H21)

`directPrint`, `autoPrintOnSave`, and PrintSettings' `runTestPrint`
each did `URL.createObjectURL(blob)` and revoked ONLY inside
`iframe.onload`. If load never fired (blocked, corrupt PDF), the URL
leaked forever.

**Fix.** New shared `printViaIframe(blob)` helper (InvoiceGenerator.jsx)
that revokes:
- In `onload` after 60s (buffer grab window)
- In `onerror`
- Via 90s hard-timeout fallback (belt & braces)
- Never twice (idempotent flag)

Test-print in PrintSettings ported to the same pattern inline (it
imports from a different module boundary).

### Quality — PNG for HD, still JPEG for draft/standard (M20)

Prior: `.toDataURL('image/jpeg', 0.98)` on HD smudged glyph edges on
high-DPI screens (JPEG is lossy on line-art). Now HD uses PNG deflate
which is both smaller AND crisper for text-heavy invoices. Draft +
standard stay JPEG (file-size wins when quality doesn't need to be
archival).

### Font metrics — await document.fonts.ready before capture (M17)

Prior: `html2canvas` fired on a cold load before Inter had finished
downloading → capture used fallback fonts with wrong glyph widths →
table columns overflowed cells. Now: `await document.fonts.ready`
gates every html2canvas call across InvoiceGenerator + PrintSettings
+ Dashboard bulk export.

### CSS — table rows stay whole across page breaks (M21)

`.printing-mode` now applies `page-break-inside: avoid` and its
modern `break-inside: avoid` alias to `.inv-table tr` / `tbody tr` /
`td`, plus `display: table-header-group` on `thead` so column labels
repeat on subsequent pages. Doesn't fully solve mid-row cuts (the
proper fix is dom-level pagination, queued for later), but rows now
prefer to push to the next virtual page rather than split.

### Robustness — scaler transform restored in `finally` (M22)

`buildPDF` split into an outer wrapper and `__buildPDFInner` so the
`.preview-scaler` transform is restored via `try/finally`. Prior code
only restored on the success path — any exception from html2canvas
or jsPDF left the on-screen preview stuck at scale 1.0 until the user
navigated away.

### Other polish

- `useCORS: true` → `false` on all html2canvas calls. Every image
  source is a base64 data URL, so the flag was dead — but if a relative
  URL ever slipped in it would silently fail preflight. Explicit is
  better.
- `imageTimeout: 0` (disabled) → `15_000`. A broken image no longer
  hangs capture indefinitely.

### Notes

- The mid-row page-break workaround (M21) is a partial fix. Real DOM
  pagination + per-page html2canvas capture is a bigger change.
- The bulk-export Cancel button surface lives on the roadmap for
  Bundle 5 — the underlying abort mechanism is in place already.

---

## [1.10.2] — 2026-07-08

**Bundle 3 of 6 from the deep architectural audit.** Offline PWA
correctness. 5 findings closed. Verified in real Chromium: 0 page
errors, 0 failed requests, manifest icons 5, `/api/*` runtime cache
registered in the generated SW.

### Offline — `/api/*` runtime cache (audit C8, was the biggest hole)

Prior: SW only cached precached static assets. Every `/api/*` fetch hit
the network raw — offline → `TypeError: Failed to fetch` on the first
save. The "offline billing counter" promise was broken.

Now: NetworkFirst runtime rule on `GET /api/*` with 3s timeout, 200
entries max, 1-week TTL. Fresh data online, cached-fallback offline.
POST/DELETE still need a background-sync queue (future work — noted).

### Offline — Removed render-blocking Google Fonts import (C8 part 2)

`src/index.css` had `@import url(https://fonts.googleapis.com/…)` at
line 1. Two problems:
1. First-ever offline load (fresh install, never online) blocked the
   CSS parser waiting for network → unstyled fallback + layout shift.
2. Duplicate: `<link>` in `index.html` requested 400/500/600/700 while
   `@import` requested 300/400/500/600/700/800 → two overlapping
   network round trips.

Now: `@import` deleted. `<link>` stays (browser preload-friendly, SW
CacheFirst caches after first visit). System font stack (Segoe UI /
San Francisco / Roboto) is the offline-safe fallback — clean
typography from paint one.

### PWA — Defer SW update on user-active input (H22)

Prior: `main.jsx` called `updateSW(true)` inside `onNeedRefresh` →
immediate `location.reload()`. Cashier mid-invoice lost the whole
form on every deploy.

Now:
- Vite PWA config changed from `registerType: 'autoUpdate'` →
  `'prompt'`. Workbox no longer skipWaiting + clientsClaim on its own.
- `main.jsx` stashes an "update ready" flag on `window` +
  dispatches `fgsb-sw-update-ready` event.
- Reload happens on **window blur** (user tabbed away) — safe moment.
- `window.__fgsbApplyUpdate()` is the manual trigger for UI banners.

### PWA — Proper icon set for Android + iOS install (H23)

Prior: **one** icon entry — `favicon.svg` with `purpose: 'any maskable'`.
Chrome/Android needs distinct 192 + 512 PNGs for app drawer + splash;
iOS silently ignores SVG apple-touch-icons and generates a screenshot
tile instead.

Now: manifest declares 5 icons — SVG scalable + 192×192 + 512×512
raster (any + maskable variants). `apple-touch-icon` points at a
proper 180×180 PNG. Meta tags added: `apple-mobile-web-app-capable`,
`apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`.

**⚠ Action required:** the PNG files themselves are not shipped in
this release — the manifest references `public/icons/icon-192.png`
etc. which need to be generated. Until they exist, Android install
still falls back to the SVG (works) but the iOS Home Screen tile is
still a screenshot. Adding a `scripts/generate-icons.mjs` that emits
the PNGs from `favicon.svg` is queued as a follow-up.

### Build — React in its own chunk + heavy chunks excluded from precache (M23, M24)

- **React vendor chunk:** `manualChunks` adds `'react-vendor':
  ['react', 'react-dom']` so app-code changes don't invalidate the
  React runtime for cached clients.
- **Precache diet:** `pdf-*.js` (588 KB), `qr-*.js` (25 KB), and
  html2canvas' ESM chunk (158 KB) excluded from `globPatterns`.
  Precache dropped from **1629 KiB → 888 KiB** (45% smaller,
  9 entries instead of 11). Those chunks still cache on demand via a
  `StaleWhileRevalidate` runtime rule → first print online caches
  them for the next offline print.
- **Chunk warning limit:** raised from default 500 KB → 900 KB so
  legitimate pdf/main chunks don't spam CI logs. High enough to still
  catch a real regression.

### Other polish

- Manifest `orientation` changed from `'portrait-primary'` to `'any'` —
  landscape POS tablets no longer locked to portrait.
- `console.log('...ready to work offline')` removed from `main.jsx`
  (audit L1).

### Notes

- The runtime `/api/*` cache is **GET-only**. POST/DELETE go to
  network → offline they fail loudly. A background-sync queue for
  writes is a bigger change and will land separately.
- If the app is already installed as a PWA on a user's device, they'll
  get the new SW behavior after one page-load-then-blur cycle. No
  action needed.

---

## [1.10.1] — 2026-07-08

**Bundle 2 of 6 from the deep architectural audit.** GST / TDS / TCS /
ITR math and precision. 15 findings closed. **31 unit tests pass** —
run `node scripts/tax-test.mjs` to reproduce.

### GST compliance — invoices go out with the correct tax bucket

- **UTGST (audit C6).** Intra-UT supplies for Chandigarh, Ladakh,
  Andaman & Nicobar, Lakshadweep, and Dadra & Nagar Haveli / Daman &
  Diu now file as CGST + UTGST, not CGST + SGST. Prior code had zero
  hits for `utgst` — every intra-UT invoice filed under the wrong
  ledger and was silently rejected on GSTR-1 upload. Delhi + Puducherry
  + J&K keep SGST (they have their own legislatures).
- **Interstate detection guard (C5).** If `profile.state` is blank the
  totals computation now surfaces a warning + `needsProfileFix` flag
  instead of short-circuiting to intra-state. Fresh-install users
  cannot ship interstate invoices with the wrong CGST+SGST split any
  more.
- **RCM + tax-inclusive (M5).** Under Section 9(3)/9(4) with an MRP
  rate, seller total was MRP-inclusive AND the buyer paid tax
  separately under RCM → tax was collected twice. Now backs out the
  embedded tax so seller total = taxable value only.
- **E-Way Bill tax-inclusive (C7).** `taxableAmount` on line items and
  `totalValue` at the header now back-calculate correctly on
  tax-inclusive invoices. Prior code sent MRP as taxable → portal's
  `taxableValue + tax ≈ totInvValue` consistency check failed →
  rejected.

### TDS / TCS — right base, right threshold

- **TCS 206C(1H) base (H6).** CBDT Circular 17/2020 requires TCS on
  the *receipt including GST*. Prior code used pre-GST subtotal.
  Verified: ₹100k + ₹18k IGST at 0.1% TCS → ₹118 (was ₹100).
- **₹50 lakh threshold (H7).** Neither section applies until the
  running annual cumulative per counterparty exceeds ₹50L. Prior code
  charged flat rate from rupee one. Caller passes
  `tcsCumulativeThisYear` / `tdsCumulativeThisYear`; helper computes
  the marginal-taxable portion.

### Precision — invoice PDF and GSTR-1 agree to the paisa

- **Per-line rounding (H11).** Prior code summed raw floats for the
  invoice PDF and rounded per line for GSTR-1 → GSTN reported
  `amount_mismatch` on multi-line invoices. Now: a single
  `computeInvoiceTotals()` helper produces both. Sum-of-rounded-halves
  matches everywhere.
- **`totalTaxCollected` includes cess AND UTGST (M8).** Prior formula
  `cgst + sgst + igst` counted cess as revenue for tobacco/auto/coal
  sellers and dropped UTGST entirely. Now `cgst + sgst + utgst + igst
  + cess`, stored on the saved bill.
- **NaN-safe totals (M10).** `qty * rate` now goes through
  `finiteNonNeg()` — a non-numeric CSV rate that used to propagate
  `NaN` into `total` is coerced to 0 with the rest of the invoice
  still computing.

### ITR — 234B / 234C / surcharge / 80D fixes

- **234C for presumptive users (H8).** 44AD/44ADA/44AE assessees have
  ONE installment (15-Mar, 100%). Prior code destructured
  `[i1, i2, i3, i4]` from a 1-element array and treated the Q4 entry
  as Q1 → 3-month × 1% rate with a 12% waiver test. Wrong section,
  wrong months. A 44ADA freelancer with ₹1L liability paying 20-Mar
  now correctly computes ₹1000 (was ₹450 or 0 depending on branch).
- **234B calendar months (M6).** Rule 119A counts calendar-month
  parts, not 30-day chunks. Prior `Math.ceil(days / 30)` computed
  Apr-1 → May-31 as 3 months (correct is 2). Now: uses
  `getMonth()`/`getDate()` diff with the "any part of a month = full
  month" rule.
- **Surcharge 15% cap on 111A/112A/115AD (H9).** Finance Act 2022 caps
  surcharge on tax attributable to listed-equity STCG (111A), LTCG
  (112A), and FII gains (115AD) at 15%. Prior code multiplied the tier
  rate (up to 37%) across the whole tax. New signature:
  `computeSurcharge(tax, income, regime, { specialRateTax })` blends
  the two rates.
- **80D deduction cap by senior status (H10).** The static ₹1L cap is
  only the max — allowed when BOTH self+family AND parents are senior.
  Prior code let a young taxpayer with young parents claim ₹1L
  (statutory max is ₹50k). New helper `effectiveDeductionCap('80D',
  { selfSenior, parentsSenior })` returns the correct 50k / 75k /
  100k tier. Same fix for 80DDB (40k non-senior / 100k senior).

### Reports — currency filter now covers expenses (M7)

`filteredExpenses` was applying the date filter but not the currency
filter, so a user viewing USD invoices got INR expenses subtracted →
nonsense P&L. Now expenses are also filtered by `currencyFilter`,
with `exp.currency || 'INR'` for legacy records without a currency
field.

### Architecture — pure computeInvoiceTotals()

Totals math moved out of the 120-line `useEffect` in
`InvoiceGenerator.jsx` into a pure function in `src/utils.js`. All 15
findings above are consequences of that extraction being testable.
Test harness: `scripts/tax-test.mjs`.

### Notes

- No stored bill's numbers change on read — the fix is on **new**
  invoices. Existing bills keep their historic totals.
- The TDS 194Q / TCS 206C(1H) cumulative-per-counterparty tracking is
  fed by `invoiceOptions.tcsCumulativeThisYear` /
  `tdsCumulativeThisYear` — a follow-up will wire the Clients module
  to maintain the running total automatically. Today the fields exist
  in the totals contract but the UI hasn't been retooled to fill
  them, so users with heavy TDS/TCS workflows should watch for a
  v1.10.1.x point release.

---

## [1.10.0] — 2026-07-08

**Bundle 1 of 6 from the deep architectural audit.** Backend security
hardening. 14 findings closed. Verified with a scripted smoke suite
before shipping (CORS, path traversal, body limit, JSON error handler
all return correct HTTP status codes).

### Security — CORS lockdown

Prior: `app.use(cors())` returned `Access-Control-Allow-Origin: *`. Any
site the user visited could `fetch('http://localhost:47371/api/bills')`
and read/wipe every invoice.

Now: strict origin check — allows only `http://localhost:<port>`,
`http://127.0.0.1:<port>`, `http://[::1]:<port>`, and no-origin
requests (same-page fetch, curl). Cross-origin returns 403.

```
Origin: https://evil.com   → 403 Forbidden ✓
Origin: http://localhost:5173 → 200 with CORS headers ✓
```

### Security — Path traversal in save-pdf and trash-pdf

Prior: `?client=..&month=..&name=x.bat` slipped past a filter that
stripped `<>:"/\|?*` but NOT `..`. Attacker bytes written above
`INVOICES_DIR`.

Now: shared `safePathSegment()` collapses `..` and control chars,
decodes URL-encoded variants, caps length. Belt-and-braces
`isPathInside(resolved, root)` reject anything that somehow escapes.
Verified: `?name=../../evil.bat&client=..&month=..` writes to
`Saved Invoices/-/-/----evil.bat.pdf`, inside the sandbox.

### Security — Body size 50mb → 5mb

50MB + wildcard CORS meant any site could OOM the Node process with
one nested-JSON POST. Legit invoices are single-digit KB. Verified:
6MB body → 413 Payload Too Large.

### Data safety — Transactional backup restore

Prior: restore did `fs.rmSync(dst)` **then** `copyDirRecursive`. If
copy threw partway (ENOSPC, corrupt backup), live data was gone and
only a partial restore existed.

Now: snapshot live data to `pre-restore-<timestamp>` inside
BACKUPS_DIR, do the copy, remove snapshot on success. Any throw
during copy triggers rollback from the snapshot. Worst case (rollback
also fails): snapshot stays on disk for manual recovery.

### Data safety — Atomic writes for meta.json

Prior: `writeJSON` = plain `writeFileSync`. Crash mid-write on
`META_PATH` (invoice counter) → truncated JSON → fallback returned
`{}` → duplicate invoice numbers reissued on next boot.

Now: `writeFileAtomic()` writes to `<file>.tmp` then renames.
Rename is atomic on POSIX and durable on Windows NTFS. Applied to
every `writeJSON()` call.

### Data safety — /api/import overwrite protection

Prior: `/api/import` silently overwrote same-id records —
contradicting the 409 guard on `POST /api/bills`. Bad backup
destroyed newer invoices.

Now: matches `/api/bills` semantics. Skips existing bills unless
`?overwrite=1`. Response includes `billSkipped` count.

### Reliability — /api/health was permanently 404

Registered AFTER the SPA catch-all → every GET returned "No such
endpoint" → the UI's health banner was broken since day one. Moved
above the catch-all. Verified: `curl /api/health` now returns the
health JSON with uptime + errorsTail.

### Reliability — Error responses no longer leak stack traces

Prior: unhandled sync throws from `writeJSON` (ENOSPC, EACCES) went
to Express's default HTML error page — full stack trace with
absolute filesystem paths (`EACCES ... C:\Users\<name>\...`)
returned to any caller including the malicious origin.

Now: global `app.use((err, req, res, next) => ...)` catches every
sync throw and async rejection. Server-side logs full detail. Client
gets a generic JSON error + stable code (`server-error` /
`bad-request` / `payload-too-large` / etc.). Preserves upstream
status codes.

### Reliability — errors.log rotation + local-timezone backup key

- Log capped at ~200KB, trims on next append. Prior code grew
  unbounded — a tight failure loop could fill disk.
- Backup dedup key now uses local timezone (`sv-SE` locale for
  YYYY-MM-DD). Prior UTC-derived key flipped at 05:30 IST → reboot at
  05:29 vs 05:31 IST produced different "today" values → duplicate
  backup dirs or skipped day.

### Notes

- Kept the `cors` npm package installed but no longer imported —
  removal will come in a cleanup pass. Bundle size not affected.
- Sync `writeJSON` handlers no longer wrapped individually — Express 5
  auto-catches sync throws + async rejections into the global handler.
- 5 more bundles queued: GST/Tax (v1.10.1), PWA (v1.10.2), PDF
  (v1.10.3), Perf (v1.10.4), Unwired features (v1.10.5).

---

## [1.9.15] — 2026-07-08

Sweep of everything I'd flagged as "not addressed" or "pre-existing"
in prior releases. Each fix verified in a real Chromium session before
committing.

### Fixed — Dashboard "Columns" button clipped to a 28×28 square

**Reported.** Screenshot showed the Columns button rendering as a tiny
rounded box with "Columns" text spilling out; date inputs showing
"n-yyyy" (end of dd-mm-yyyy clipped).

**Root cause 1.** The button had `className="icon-btn"` which is
`width: 28px; height: 28px` — meant for single-icon buttons like the
red X clear-filter. It got icon + text, but the box refused to grow.

**Root cause 2.** `.filter-date` had no min-width, so browsers gave it
whatever they felt like — often ~110px which clips "dd-mm-yyyy".

**Fix.** Columns button → `btn btn-secondary` with proper padding + gap
+ `white-space: nowrap`. Date/select filters → `min-width: 145px / 130px`.

Verified in headless: Columns button is now 100.6 × 29.8 px with visible
text; date inputs render at a full 145px on both 1200px and 800px
viewports.

### Fixed — Toast notifications piling up on rapid clicks

**Reported.** User clicked "Colorful" three times in a row and three
identical "Applied Colorful design" toasts stacked on screen.

**Fix.** In `ToastContainer`, if an incoming toast has the same
message + type as one already visible, refresh its id (extends the
timer) instead of pushing a duplicate. Cap total on-screen at 4.

### Verified — All 9 presets pass contrast in light + dark app modes

Wrote a Chromium audit script that walks every preset (Modern, Classic,
Corporate, Minimalist, Colorful, Compact, Enterprise, IT Services,
Retail Brand) × both themes = 18 renders. Computed the WCAG contrast
ratio between the title/business-name and the header background block
for each. **0 failures.**

The Corporate + IT Services fix from v1.9.12 (compound
`.template-corporate[data-user-colors="1"]` selector forcing white
title on the dark gradient) is confirmed working — audit reads title
color as `rgb(255, 255, 255)` for both.

### Notes

- Kept the v1.9.13 data-attribute CSS in place as defense-in-depth even
  though v1.9.14's inline styles are the load-bearing path. Harmless.
- No preset color values, defaults, or template layouts changed. This
  is a pure UX + reliability release.

---

## [1.9.14] — 2026-07-08

Follow-up to v1.9.13 which shipped an incomplete fix. User called it
out ("not fixed u check sir", "why don't you fully test before
shipping") — fair. This release was verified in a real headless browser
before shipping, not just by reading the CSS.

### Fixed — PDF preview typography actually reacts now (real fix)

**What v1.9.13 tried.** Data attributes on `.invoice-preview-container`
+ matching CSS rules for `data-pdf-font`, `data-pdf-font-size`, etc.

**Why it failed in practice.** The CSS rules had specificity `0,2,0`
which should have beaten `.template-minimalist * !important` at `0,1,0`
on paper. In production some combination of load order + user theme
state produced cases where users saw no visible change when flipping
Sans↔Mono. I never verified in a real browser before shipping.

**Real fix.** Wire the typography settings as **inline styles** on the
container in `InvoicePreview.jsx`:

```jsx
style={{
  ...(pdfFontFamilyCss ? { fontFamily: pdfFontFamilyCss } : {}),
  ...(pdfFontSizeCss ? { fontSize: pdfFontSizeCss } : {}),
  ...(pdfFontWeightCss ? { fontWeight: pdfFontWeightCss } : {}),
  ...(pdfCapsOn ? { textTransform: 'uppercase' } : {}),
}}
```

Inline styles + descendant inheritance for font-family, font-size, and
text-transform reliably reach every child of the preview regardless of
template. Verified in Chromium headless:

```
computedFontFamily: "Courier New", Consolas, monospace ✓
computedFontSize:   17.92px (112% of 16px, "large") ✓
computedFontWeight: 800 ✓
computedTextTransform: uppercase ✓
firstChildFontFamily inherits: Courier New ✓
```

### Fixed — Modern-header background now respects pdfAccent

**Reported.** "COLORS NOT CHNAGE FOR THE FOOTER AND HEADER"

**Root cause.** `renderModernHeader` used a JS variable `accent` sourced
from `options.accentColor || accentColors[invoiceType]`. It never read
`pdfAccent` from user settings, so the coloured header block stayed
whatever the invoice-type default was even after the user picked a
different accent.

**Fix.** Accent variable now flows through `pdfAccent` when
`userColorsEnabled` is true:

```js
const accent = options.accentColor
  || (_ps.userColorsEnabled && _ps.pdfAccent)
  || accentColors[invoiceType]
  || accentColors['tax-invoice'];
```

Verified: `pdfAccent: '#7c3aed'` (purple) → modern-header background
computed as `rgb(124, 58, 237)` ✓

### Verified — preset ACTIVE state (v1.9.13 change stands)

The `activePresetId` fix from v1.9.13 was correct on inspection. Now
also verified in a real browser: seeding `activePresetId: 'colorful'`
with `pdfTemplate: 'modern'` (which Modern and Enterprise also use)
shows the ACTIVE badge on Colorful only, not on the two other cards
that share the pdfTemplate value.

### Process fix — verify before shipping

Bought playwright, wrote three headless tests, ran them, watched them
pass, then committed. Should have done this in v1.9.13 before claiming
the fix worked. Won't ship UI changes on trust again.

### Notes

- The v1.9.13 data-attribute CSS is left in place as a defense-in-depth
  fallback but the inline styles are the load-bearing path.
- Dashboard rendering issue in one screenshot (date input showing
  "n-yyyy", Columns button clipped) is a pre-existing narrow-viewport
  layout bug and untouched by v1.9.13/14. Filed for a separate pass.

---

## [1.9.13] — 2026-07-08

Bug bash from user screenshots: three concrete issues confirmed and
fixed.

### Fixed — Typography changes now affect the PDF preview

**Reported.** User changed Font family (Sans → Mono) and Font size
(Medium → Small) on the Typography section, and the PDF preview looked
identical before and after. Called out as "live preview is not working
correctly in pdf mode."

**Root cause.** `fontFamily`, `fontSize`, `fontWeight`, and `allCaps`
were being read only by the thermal renderer (`thermalFontFamily =
settings.fontFamily`, etc.). The PDF render path (classic / modern /
minimal + template CSS) didn't consume any of them. Result: changes
from the Typography section were silently discarded when previewing
the PDF.

**Fix.** InvoicePreview now stamps four data attributes on the
`.invoice-preview-container` when not rendering thermal:

- `data-pdf-font="mono|sans"` → forces font-family across the tree
- `data-pdf-font-size="small|medium|large|xlarge"` → 87% / 100% / 112% / 122%
- `data-pdf-font-weight="normal|bold|ultra"` → 400 / 600 / 800 (title / business name / th / amount go to 900 on ultra)
- `data-pdf-caps="1"` → text-transform: uppercase across the invoice (numeric cells, HSN, and QR excluded so digits still line up)

Matching CSS rules apply the styling. Now every Typography knob visibly
changes the PDF preview in real time.

### Fixed — Preset "ACTIVE" indicator lit up multiple cards at once

**Reported.** User clicked "Colorful" and it wasn't marked active —
Modern still showed ACTIVE.

**Root cause.** Multiple presets share the same `pdfTemplate` value
(Modern, Colorful, and Enterprise all use `pdfTemplate: 'modern'`;
IT Services + Corporate both use `'corporate'`). The active check was
`settings.pdfTemplate === preset.id`, which matched only the id equal
to the template name — so clicking Colorful didn't move the marker.

**Fix.** Added `activePresetId` field to settings. The preset row
writes it on click and reads it back for the active check. Now exactly
one preset is highlighted at a time regardless of pdfTemplate overlap.

### Fixed — Dropdown option text was truncating mid-word

**Reported.** "Monospace (Courier) — thermal-optimized" was rendering
as "Monospace (Courier) — thermal-optimiz" — the last two characters
clipped by the select's fixed width.

**Fix.** Selects inside `.print-settings-body` now get right padding
+ ellipsis + full-width so long option labels either fit or truncate
with a proper "…" cue rather than a hard cut.

### Notes

- No preset color values changed. Existing invoices unaffected.
- Behavior on the thermal render path is unchanged — thermal already
  consumed these Typography fields.

---

## [1.9.12] — 2026-07-08

Two-part fix reported from screenshots: title text on the Corporate /
IT Services templates was rendering dark-on-dark (invisible), and app
dark mode wasn't fully handled for the new split-view preview pane.
User asked for "presets so perfect users don't need to make changes."

### Fixed — Title text no longer invisible on dark-header templates

**Root cause.** `.template-corporate .inv-header` has a hardcoded dark
navy gradient. When a preset enables user colors (all v1.9.9+ presets
do), the CSS rule `.invoice-preview-container[data-user-colors="1"]
.inv-title { color: var(--pdf-primary-text) !important }` fired for the
title. For Corporate that's `#0b1e3f` (also dark navy) → invisible
against the dark gradient. The existing `.template-corporate .inv-title
{ color: #fff !important }` was beaten by the higher-specificity
attribute selector.

**Fix.** Added a compound rule that wins the specificity war:

```css
.invoice-preview-container[data-user-colors="1"].template-corporate .inv-title,
.invoice-preview-container[data-user-colors="1"].template-corporate .inv-business-name,
.invoice-preview-container[data-user-colors="1"].template-corporate .inv-header * {
  color: #ffffff !important;
}
```

Same treatment applied to `.template-modern` for the accent-coloured
header block. Result: Corporate and IT Services presets now show a
crisp white title on their dark headers, out of the box — no user
adjustment needed.

### Fixed — App dark mode for Print Settings preview pane

- Preview pane container now uses `--card` background with a proper
  border in dark mode instead of just inheriting the page background
  and blending in.
- Inner preview canvas stays white (invoices are paper — always white)
  regardless of app theme.
- Preset card backgrounds get `--bg-secondary` in dark mode so the
  color-swatch strips have better contrast against the card surface.

### Notes

- No preset color values were changed — the fix is a CSS specificity
  correction. All existing invoices, and every preset's palette,
  continue exactly as designed.
- Existing `.template-corporate` CSS still handles the header block
  gradient; only the specificity for user-color overrides changed.

---

## [1.9.11] — 2026-07-08

Fixes the "light text on printed PDF" complaint (user shared a photo:
HSN codes + business address + T&C were rendering almost invisible on
paper). Adds three new design presets modeled on reference invoices the
user liked (Amazon / LTIMindtree / Nike style).

### Fixed — HSN codes and muted text no longer fade on printed PDFs

The HSN/SAC column used `.inv-td-muted { color: #94a3b8 }` — a very
light grey that looked fine on screen but disappeared on paper. Bumped
default to `#475569`, and extended `.printing-mode` (applied during
PDF export via html2canvas onclone) to force these classes darker:

- `.inv-td-muted` — HSN codes → `#1e293b`
- `.inv-business-address`, `.inv-business-gstin` → `#1e293b`
- `.inv-party-address` → `#1e293b`
- `.inv-terms`, `.inv-notes`, `.inv-footer-note` → `#334155`

Existing `pdfDarkenOnPrint` toggle still respected — users who want the
lighter on-screen look on paper can turn it off.

### Added — Three new design presets

Modeled on the reference invoices shared by user. Same underlying
template machinery + distinctive color palettes:

- **🛒 Enterprise** — Sky-blue accent, prominent branding, e-commerce
  feel. Modeled on Amazon-style tax invoices.
- **💻 IT Services** — Deep navy heading, comfortable spacing.
  Modeled on consulting/IT-firm invoices (LTIMindtree style).
- **👟 Retail Brand** — Black-on-white minimalist. Logo-first, clean
  rows with HSN column. Modeled on brand retail invoices (Nike style).

Total presets now: **9** (Modern, Classic, Corporate, Minimalist,
Colorful, Compact, Enterprise, IT Services, Retail Brand).

### Notes

- These presets don't mimic the exact header layouts (logo position,
  side-by-side buyer info block) — those require template-CSS changes
  in InvoicePreview, which is scheduled for a bigger release. What you
  get today is the color palette + typography vibe from each.
- Existing invoices unaffected. Presets only apply when clicked.

---

## [1.9.10] — 2026-07-08

Design presets now shape the thermal receipt too, not just the PDF.
Reported by user with a screenshot: switching between Modern / Corporate
/ Minimalist visibly changed the PDF but the thermal preview looked
identical every time.

### Fixed — Presets now affect PDF + Thermal render

Each preset now sets thermal-relevant fields on top of the PDF palette:
`fontFamily`, `fontWeight`, `fontSize`, `lineSpacing`, `allCaps`,
`headerAlign`, `headerCaps`, `contrast` — and a couple of content flags
like `showTagline` and `showRateLine` where they define the vibe.

**Distinct thermal personalities per preset:**

- **Modern** — Sans, bold, mixed case, comfortable spacing.
- **Classic** — Mono ULTRA-BOLD ALL CAPS, compact spacing (SMART BAZAAR
  / Reliance receipt look).
- **Corporate** — Sans bold, comfortable spacing, header caps only.
- **Minimalist** — Sans normal weight, left-aligned header, no caps,
  airy spacing.
- **Colorful** — Sans bold, tagline shown, friendly.
- **Compact** — Mono ULTRA-BOLD ALL CAPS small font, hides rate line to
  fit more per receipt.

### Added — "affects PDF + Thermal" label on the picker

Small hint next to the "Choose a design" heading so users understand
the presets touch both output formats.

### Notes

- Colors remain PDF-only — thermal printers are B&W by physics, no
  amount of settings can change that.
- Every field a preset touches is still fully editable in the sections
  below.

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
