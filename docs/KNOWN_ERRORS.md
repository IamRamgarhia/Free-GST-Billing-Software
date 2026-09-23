# Known Errors — never let these come back

Every bug reported by a user (GitHub issue, WhatsApp screenshot, email)
gets an entry here **the moment it is diagnosed**, with the rule that
prevents it. Read this file before touching launcher scripts, the
release builder, or PDF/print code.

**Format:** each entry records the *symptom the user saw*, the *real
cause*, the *rule*, and the *automated guard* — if there is no guard,
say so explicitly, because an unguarded rule will be broken again.

---

## ERR-001 — Non-ASCII characters break every Windows `.ps1`

**Version:** broke in v1.10.46 · fixed in v1.10.47
**Reported by:** @sangwanmail-eng (GitHub issue)

**Symptom**

```
Update — Failed
At ...\_system-scripts\update-windows.ps1:104 char:56
+   Write-Host '  Restart the app (Stop Server �+' Open App) to run the n ...
Unexpected token ')' in expression or statement.
The string is missing the terminator: '.
```

**Cause**

The `.ps1` files were UTF-8 **without a BOM**. Windows PowerShell 5.1
decodes a BOM-less script using the machine's ANSI codepage (cp1252),
*not* UTF-8. So:

| Character | UTF-8 bytes | Decoded as cp1252 | Damage |
| --- | --- | --- | --- |
| `→` | `E2 86 92` | `â†'` | `0x92` = `'` (U+2019) |
| `—` | `E2 80 94` | `â€"` | `0x94` = `"` (U+201D) |

PowerShell accepts curly quotes `' ' " "` as **genuine string
delimiters**. So the injected quote terminated the string mid-line.

Two consequences that made this worse than it looked:

1. It is a **parse-time** error — PowerShell compiles the whole file
   before executing a single line. Nothing ran. The update did not
   partially apply.
2. It hit **four** scripts, not just the reported one: `update`
   (line 104), `start` (56), `backup` (36), `move` (40). An em dash is
   only fatal inside a **double**-quoted string; an arrow is fatal in
   both — which is why the breakage looked random.

**Rule**

> Windows launcher scripts (`.ps1`, `.bat`, `.cmd`) must be **pure
> ASCII**. Use `-` not `—`, `...` not `…`, `->` not `→`, `[OK]` not `✅`.

ASCII is the only encoding every Windows codepage agrees on. A UTF-8
BOM would also fix the parse, but ASCII additionally survives users on
non-Latin locales (cp1251, cp936, cp1252) where a BOM alone still
renders mojibake.

**Guard:** `scripts/build-release-zip.mjs` → `assertAsciiOnly()` fails
`npm run release:zip` and prints the offending `file:line`.

**Verify manually:**

```powershell
Get-ChildItem release-templates\_system-scripts\*.ps1 | ForEach-Object {
  $errs = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$null, [ref]$errs)
  "{0,-24} {1}" -f $_.Name, $(if ($errs.Count) { "BROKEN line $($errs[0].Extent.StartLineNumber)" } else { "ok" })
}
```

Must run under **`powershell.exe` (5.1)**, not `pwsh` (7+). PowerShell 7
defaults to UTF-8 and will happily parse a file that 5.1 rejects, so
testing in `pwsh` gives a false pass.

---

## ERR-002 — HTML/HTA with no declared charset renders mojibake

**Version:** fixed in v1.10.47 (found while fixing ERR-001)

**Symptom:** launcher window shows `â€"` and garbled button icons
instead of `—` and emoji.

**Cause:** `Free GST Billing.hta` declared no charset, so MSHTML fell
back to the system codepage.

**Rule**

> Any `.hta` / `.html` file shipped to users declares its charset in the
> first 1024 bytes, as the first tag inside `<head>`:
> `<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />`

Use the `http-equiv` form, not bare `<meta charset>` — HTA runs on
MSHTML and the long form is the reliable one there.

**Note:** this is the *opposite* fix from ERR-001. HTML can declare its
encoding, so keep the nice typography; PowerShell cannot be trusted to,
so strip to ASCII. Do not "fix" the HTA by stripping its emoji.

**Guard:** none — HTA is not covered by `assertAsciiOnly()`. Check by
eye when editing the launcher.

---

## ERR-003 — Uploading a new ZIP onto an old release tag

**Version:** affected v1.10.45 and v1.10.46 · corrected at v1.10.47

**Symptom:** the Releases page showed `Free-GST-Billing-v1.10.46.zip`
attached to a release titled **v1.10.44**, with mismatched dates (asset
"13 hours ago", source code "4 days ago"). No v1.10.45 or v1.10.46
release ever existed.

**Cause:** new builds were uploaded as assets onto the existing v1.10.44
release instead of cutting a new tagged release.

Two real consequences:

1. The in-app updater reads
   `GET /repos/.../releases/latest` and shows the user `tag_name`. That
   returned `v1.10.44` no matter which build was actually attached, so
   every user was told the wrong version number.
2. Anyone landing on the old release page downloads whatever ZIP is
   pinned there — which is how a build that was already known-broken
   stayed publicly downloadable after the fix shipped.

**Rule**

> Every shipped build gets its **own** tagged release matching
> `package.json`. Never re-upload an asset onto a previous tag.

```
npm run release:zip
gh release create v<VERSION> "release-build/Free-GST-Billing-v<VERSION>.zip" --target main
```

Then confirm what the updater will actually see:

```
gh api repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest \
  --jq '{tag: .tag_name, asset: .assets[0].name}'
```

The tag and the asset filename must both match the new version.

**Guard:** none — this is release procedure, not code. Run the
verification command above after every publish.

**Also:** `gh` may have more than one account in its keyring. If
`gh release create` fails with *"workflow scope may be required"*, the
active account is probably the wrong one — check `gh auth status` and
`gh auth switch -h github.com -u IamRamgarhia`. The error message is
misleading; it is a permissions problem, not a scope problem.

---

## ERR-004 — CSP `frame-src` blocked the print iframe

**Version:** fixed in v1.10.48
**Reported by:** @sangwanmail-eng (console screenshot, Firefox)

**Symptom**

```
Content-Security-Policy: The page's settings blocked the loading of a
resource (frame-src) at blob:http://localhost:47371/993b6dbb-... because
it violates the following directive: "frame-src https://accounts.google.com"
```

Print and Save-as-PDF silently did nothing.

**Cause**

`printViaIframe()` does `URL.createObjectURL(blob)` → `frame.src = url`,
but the CSP `frame-src` allowed only `https://accounts.google.com`. The
iframe was blocked outright.

Why it went unnoticed to v1.10.46: **Firefox enforces `frame-src` against
`blob:` strictly; Chrome has been laxer with blob-URL frames.** Testing
only in Chrome hides this entire class of bug.

**Rule**

> Every CSP directive that a `blob:` URL can be fetched under must list
> `blob:` explicitly. Today: `worker-src` (Tesseract), `img-src`,
> `frame-src` (PDF print). A directive with an explicit value does **not**
> inherit `default-src`.

**Guard:** none automated. When adding any `createObjectURL` usage, check
which CSP directive governs the sink and confirm it lists `blob:`.

**Test in Firefox, not just Chrome** — see also ERR-005.

---

## ERR-005 — `transform: scale()` does not shrink the layout box

**Version:** fixed in v1.10.48
**Reported by:** @sangwanmail-eng

**Symptom:** "live preview show full when browser zoom on 50%" — at normal
zoom the invoice preview was clipped on the **left**, and no amount of
scrolling reached it.

**Cause**

`.preview-scaler` used `transform: scale(z)`. Transforms change what is
painted, never the element's layout box, so the preview kept reserving
`.invoice-preview-container`'s hard `width: 210mm` (≈794px) at every zoom
level. Two things then compounded:

1. On a pane narrower than 794px the sheet overflowed horizontally.
2. `.preview-pane` used `align-items: center`. **Centring an overflowing
   child in a scroll container pushes its leading edge into negative
   scroll space, which is unreachable.** Hence the left side was gone for
   good, not merely off-screen.

Dropping the browser to 50% zoom "fixed" it only because that doubles the
viewport in CSS pixels, clearing the 794px threshold.

**This is why it did not reproduce for the maintainer:** the bug is a pure
function of preview-pane width. Invisible on a wide monitor, guaranteed on
a 1366px laptop.

**Rule**

> When scaling with `transform`, an ancestor must reserve
> `natural size × scale`, or the layout will not match what is painted.
> In a scroll container use `align-items: safe center`, never bare
> `center` — `safe` degrades to start-alignment on overflow instead of
> hiding the leading edge.

**Guard:** none automated. **Check new layout work at 1366×768**, not only
at your monitor's width.

---

## ERR-006 — Missing custom paper width silently becomes 80mm thermal

**Version:** fixed in v1.10.48

**Symptom (suspected):** "live preview show normal template, but pdf save
as thermal printer."

**Cause**

`getPaperSize()` reads a missing `customPaperWidth` as `80`, and
`kind = w < 100 ? 'thermal' : 'sheet'` — so absent width means **thermal**.
Meanwhile the client-preference writer saved only `preferredPaperSize`,
not the dimensions. A client stored on `custom` therefore came back as
`custom` *with no width* → silently an 80mm receipt.

**Rule**

> A setting whose meaning depends on companion fields must persist those
> fields together. Never let a missing dimension fall through to a default
> that changes the **kind** of output.

**Guard:** none automated.

**Status:** the code defect is real and fixed, but it is **probably not**
what the reporter hit — see ERR-007, which reproduces their symptom
exactly. Keep this fix; treat ERR-007 as the real cause.

---

## ERR-007 — CSP `'self'` does not resolve inside an `about:blank` iframe, so PDFs rendered unstyled

**Version:** fixed in v1.10.48
**Reported by:** @sangwanmail-eng — "live preview show normal template, but
pdf save as thermal printer"

**Symptom:** the on-screen preview looks correct, but the saved PDF comes
out as cramped plain text in a narrow column with no colours, borders or
table rules. It *reads* as a thermal receipt. **It is not thermal — it is
the invoice with no CSS.**

**Cause**

`html2canvas` clones the invoice into an **`about:blank` iframe** before
rasterising it (confirmed by instrumenting `document.createElement`: one
iframe, empty `src`, no `srcdoc`). Firefox inherits the parent CSP into
that iframe but resolves `'self'` against `about:blank`'s **null origin**,
so `'self'` matches nothing and the app's own stylesheet is refused:

```
Content-Security-Policy: blocked a style (style-src-elem) at
http://localhost:47415/assets/index-*.css ... violates the following
directive: "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
```

**Chrome resolves `'self'` to the inherited origin, so it never fails
there.** This is the second bug in one report caused by Chrome-only
testing (see ERR-004).

**Rule**

> Do not rely on `'self'` for resources that a *cloned or inherited*
> document will request — `about:blank`, `srcdoc` and `blob:` documents
> may carry a null origin where `'self'` matches nothing. Name the real
> origin. `connect-src` already lists `http://localhost:*` for a
> comparable reason.

**Guard:** none automated.

**How it was proved** (repeat this for any "renders differently in the PDF"
report — file size is a reliable proxy for lost styling):

| | PDF bytes | CSP violations |
| --- | --- | --- |
| before fix, CSP present | 421,048 | 1 |
| before fix, CSP stripped | 452,389 | 0 |
| after fix, CSP present | 452,551 | 0 |
| after fix, CSP stripped | 452,173 | 0 |

A 31 KB gap that closes to noise once fixed. Strip the CSP meta with a
Playwright `route` interception to get the baseline.

---

## ERR-008 — `<datalist>` options showed GSTINs instead of supplier names

**Version:** broke in v1.10.50 · fixed in v1.10.52
**Reported by:** @sangwanmail-eng (#40)

**Symptom:** "it shows gst numbers list instead of supplier name list in
supplier text box."

**Cause**

The supplier suggestion list put the GSTIN in the option's **child text**,
intending it as a secondary hint:

```jsx
<option value={s.name}>{`GSTIN ${s.gstin}`}</option>   // WRONG
```

Browsers disagree about which part of a datalist option they display:

| Browser | Shows |
| --- | --- |
| Chrome / Edge | the **value**, with label/text as secondary grey text |
| Firefox | the **label or text INSTEAD of the value** |

So Firefox users got a list of GST numbers where supplier names belonged.

**Rule**

> A `<datalist>` `<option>` carries a **`value` and nothing else** — no
> child text, no `label` attribute — unless the label has been checked in
> both Chrome and Firefox. There is no portable way to attach a secondary
> hint.

**Guard:** none automated.

### The part worth remembering

The v1.10.50 Playwright test **passed**, and would still pass on the
broken build. It asserted on `option.value`, which was correct the whole
time — the defect was in what the browser chose to *display* from that
option.

> **Testing the mechanism is not testing the presentation.** When a bug
> would be visible to a user looking at the screen, the assertion has to
> be on what is rendered, not on the data behind it.

The fixed test asserts on `label ?? textContent ?? value` — the actual
precedence a browser applies — so it fails on the old markup.

---

---

## ERR-009 - The release ZIP shipped a server that could not start

**Version:** broke in v1.10.44.1 - fixed in v1.10.63
**Reported by:** @ANIM35H (#54)

**Symptom**

```
  Starting server on port 47371...
  Server did not respond in 15s. Check for errors in this window.
```

The launcher never showed the real error. Running the shipped `server.js`
by hand gives it:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '_system/src/utils.js'
  imported from '_system/server.js'
```

**Cause**

`server.js` has imported `./src/utils.js` (for `computeInvoiceTotals`)
since v1.10.31. Commit `4169fac` then removed `src/` from the ZIP to cut
the download from 31.5 MB to 15.95 MB - correct for the React source,
except the **server** had quietly grown a runtime dependency on one file
inside it. The process exits before binding, so the launcher can only
report a timeout.

**Every release from v1.10.44.1 onward shipped a dead server.**

**Rule**

> Anything `server.js` imports must be in the ZIP. Slimming the package is
> fine; slimming it without re-checking the server's import graph is not.

**Guard:** `scripts/build-release-zip.mjs` -> `assertServerImportsResolve()`
walks every relative import reachable from the packaged `server.js` and
**fails the build** if a file is missing. Verified by removing the fix and
confirming the build aborts.

### The part worth remembering

Fifteen releases went out broken while every check was green. The smoke
suite, the lint run and the manual testing all exercised the **development
tree**, where `src/` is always present. Nothing ever ran the artefact that
users actually download.

> **Testing the repo is not testing the release.** If a defect can exist
> only in the packaged output, it can only be caught by opening the
> package.

It stayed hidden longer because the README pointed people at the *source*
ZIP, which does contain `src/` - so the users who complained loudest about
other things had working servers, and the only broken path was the one
almost nobody took. Correcting the README in v1.10.61 pointed everyone at
the release ZIP, which would have made this far more visible.


### Two further faults found the moment the gate was built

Running the suite against a genuinely fresh install exposed defects the
tests themselves had been hiding:

1. **The first-run wizard had never been exercised.** A fresh install shows
   two screens in sequence whose buttons are capitalised differently -
   `Skip Setup` then `Skip setup`. The suite matched `/^Skip setup$/`, which
   never matched the first one. In the dev tree onboarding is already
   complete, so no wizard appears and the mismatch was invisible.

2. **The "is anything in the way?" check was wrong.** It used
   `offsetParent !== null`, which is **always null for a `position: fixed`
   element** - and `.modal-overlay` is fixed. So it reported a clear screen
   while a full-page wizard sat on top, and every later click timed out
   against an intercepted element.

Both are the same mistake as ERR-009 wearing a different hat: the primed
development environment is not the one users get.

**Verify by hand after any packaging change:**

```powershell
Expand-Archive Free-GST-Billing-vX.Y.Z.zip -DestinationPath t
cd t\Free-GST-Billing\_system
npm install --omit=dev
node server.js        # must print "running at http://localhost:PORT"
```

---

## ERR-010 - Scoping one record type per business left every other total mixed

**Version:** incomplete in v1.10.64 / v1.10.65 · fixed in v1.10.66
**Reported by:** @sangwanmail-eng (#64)

**Symptom** - *"still payment receipt and reports show all companies data"*;
*"Why total invoiced, tax collected, outstanding and invoices show all companies
data?"*; *"expenses, reports, receipts, purchases and recurring not refresh when
company switch"*. Screenshots: dashboard header "0 invoices" beside a card
reading "Invoices 1 / ₹187.62"; Reports "Revenue ₹0.00, Expenses ₹560.00".

**Cause** - v1.10.64 filtered *invoices* by business, but each screen loads
several collections. GST Returns, Reports and Income Tax passed expenses and
purchases through unfiltered, so GSTR-3B input tax credit mixed GSTINs. The
dashboard summed its cards from the raw server response before filtering.
Receipts were never scoped. And seven screens read the business once on mount,
so after a switch they showed the old company and stamped new records with it.

**Rule** - when a record type becomes per-business, check **every** `getAll*()`
call site, not just the list screen. Derive totals from the filtered list, never
from the raw response. A screen that reads the active business must re-read it
when the business changes - App keys those screens on `businessKey`.

**Guard** - `tests/smoke.mjs` (#64 checks): dashboard, Reports and GSTR-3B ITC
values must **not** move when another company's invoice / expense / purchase is
added, and **must** move when this company's is, so a dead card cannot pass.
Switching company must refresh an open Expenses screen and stamp a new expense
with the new business; another company's receipts must be hidden.

---

## ERR-011 - The invoice re-decided what the tax engine had already decided

**Version:** fixed in v1.10.66
**Reported by:** @Yashparmar1125 (#61)

**Symptom** - *"the itemized `IGST (18%)` line displays as `₹0.00`"* while the
grand total is correct.

**Cause** - `computeInvoiceTotals` decides interstate from GST state **codes**
(place of supply, client GSTIN). `InvoicePreview` and GST Returns'
`billIsInterstate` each decided it again from state **names**. They disagreed for
a client from another state supplied in the seller's state, so the invoice
printed an IGST row holding `totals.igst = 0`. Separately the engine treated a
client abroad as intrastate, because a foreign state has no GST code.

**Rule** - whatever *displays or reports* tax uses the flags the engine returned
with the amounts (`totals.isInterstate`), never a parallel calculation. Place of
supply follows the client's country and state - never the currency, which is
what PR #60 got wrong.

Changing a tax decision moves it everywhere it is reported: exports then had to
leave GSTR-1 B2B / B2C (an inter-state row with the home state as place of
supply is rejected) and enter GSTR-3B 3.1(b), and the invoice form's totals
`useMemo` had to list `client.country`, or switching only the country kept the
old split on screen and Save stored it.

**Guard** - `scripts/tax-test.mjs` `[V66-#61]` (place of supply governs, GSTIN
only, export, same-state USD); smoke: a Delhi client supplied in Punjab must
print CGST / SGST and no IGST row.

---

## ERR-012 - A print fix that only reached the PDF path

**Version:** fixed in v1.10.66
**Reported by:** @sangwanmail-eng (#64, photo of a printed proforma)

**Symptom** - *"Some text not visible in black and white print."* The photo shows
"This is not a tax invoice. For estimation purposes only." almost invisible.

**Cause** - the text was inline `#94a3b8`, a 2.6:1 contrast. The `.printing-mode`
CSS darkens such colours, but only the html2canvas PDF path adds that class; the
**Print** button prints an iframe that never gets it.

**Rule** - fix colours at the source so screen, Print and PDF are all legible.
Invoice text must reach 4.5:1 against its background. Never rely on a mode class
that only one output path applies.

**Guard** - smoke: every text element of a proforma preview must reach 4.5:1.

---

## ERR-013 - CSV exports wrote formula-like text raw

**Version:** fixed in v1.10.66
**Reported by:** @Yashparmar1125 (#63)

**Symptom** - a cell such as `=HYPERLINK("http://…","Invoice")` in an exported CSV
runs as a formula in Excel or Google Sheets.

**Cause** - three local `escape` helpers quoted commas and quotes only - two of
them not even line breaks.

**Rule** - every CSV cell goes through `toCsvCell` / `toCsvLine` in
`src/utils.js`. No local escape functions.

**Guard** - `scripts/csv-test.mjs`, part of `npm run test:unit`.

---

## ERR-014 - The ZIP only unpacked cleanly on Windows, and Linux had no updater

**Version:** every Windows-built release up to v1.10.65 · fixed in v1.10.66
**Reported by:** @deppen12 (#59)

**Symptom** - *"it's very difficult to install on nas"*; *"now today you roll out
new update now my works start again coz update for button not works."*

**Cause** - Windows PowerShell 5.1's `Compress-Archive` writes `\` as the path
separator (73 entries in v1.10.65). The ZIP format allows only `/`, so Linux,
macOS and BusyBox unzip either warn or create single files named
`Free-GST-Billing\_system\server.js`. And the Control Panel's Update looked for
`update-unix.sh`, which never existed, so it always answered "Script not found
for this platform".

**Rule** - build ZIPs with `tar.exe -a` (or `zip`), never `Compress-Archive`.
Every Control Panel action offered on Unix needs a Unix script, written for
POSIX `sh` - NAS images have no bash. Test Unix scripts in a real Linux
container, not by reading them.

Two traps found while testing the fix, not by reading it: BusyBox `unzip` exits
with status 1 for real errors (full disk, damaged file) as well as for the
warnings Info-ZIP uses 1 for, so the updater requires status 0 and then checks
every extracted file's size against the ZIP's own directory. And choosing `sh`
for *every* Unix script broke `backup-unix.sh`, which needs bash - only the
updater runs under `sh`.

**Guard** - `scripts/build-release-zip.mjs` reads the finished archive back and
fails on any `\` path or on a `.sh` with CRLF endings. `npm run test:update-unix`
runs the updater in Alpine (BusyBox, no bash) and Debian slim (dash): a real
update, a re-run, rollback after a failed `npm install`, a truncated download,
no downgrade over a newer install, a git checkout, a system with no unzip, and a
full update under dash.

---

## ERR-015 - "Add New Profile" blanked the form and called it a new company

**Version:** broke when multi-business landed · fixed in v1.10.67
**Reported by:** @sangwanmail-eng (#66 item 3)

**Symptom** - *"when adding a new company, the newly added company profile
replaces the existing company profile. This issue is particularly noticeable
when using the software for the first time."* Plus an unsaved-changes bar for a
form the user had not touched.

**Cause** - `handleAddNewProfile` only called `setProfile({ ...blank })`. The
active profile file still held the old company, so the next **Save Profile**
overwrote it. On a first install that company had never been copied into
`data/profiles/`, so there was no surviving copy anywhere. The blank form also
differed from the saved baseline, which is what raised the unsaved-changes bar.

**Rule** - a "start a new X" button must persist the current X before it clears
the form, and reset the dirty baseline afterwards. Clearing a form is not the
same as creating a record, and the active profile is a single file, not a list.

**Guard** - `tests/smoke.mjs` (#66): after Add New Profile the previous company
is present in Business Profiles and the form is not marked dirty.

---

## ERR-016 - Every document type counted as turnover

**Version:** fixed in v1.10.67
**Reported by:** @sangwanmail-eng (#66 item 7)

**Symptom** - *"Why are documents such as Proforma/Estimate, Delivery Challan,
Composition, Credit Note and Bill of Supply included in the Total Invoiced
Amount?"* A screenshot showed ₹4,248 of "sales" where ₹1,239 was an estimate.

**Cause** - the dashboard cards summed every bill row. `invoiceType` was only
ever used for labels and numbering, never for deciding what is turnover.

**Rule** - money questions go through one rule, not per-screen filters:
`salesSign()` in `src/utils.js` returns +1 for a sale (tax invoice, bill of
supply, composition), -1 for a credit note and 0 for quotes, challans and
anything cancelled. Every new money figure uses it.

**Guard** - `scripts/tax-test.mjs` `[V67-#66]` covers all eight cases; the smoke
suite checks a proforma and a challan do not move Total Invoiced while a sale
and a credit note do.

---

<!--
Adding an entry? Copy this skeleton.

## ERR-00N — one-line title

**Version:** broke in vX · fixed in vY
**Reported by:** who

**Symptom** — paste the user's exact error text, not a paraphrase.
**Cause** — the real mechanism, not the surface.
**Rule** — the imperative that prevents recurrence.
**Guard** — the automated check, or "none" plus how to check by hand.
-->
