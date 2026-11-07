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

**Automated (30 Oct 2026):** `npm run release:check` fails if the launcher loses `charset=utf-8` or gains a non-ASCII character ("ERR-002 ...").

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

**Automated (30 Oct 2026):** `npm run release:check` fails if `frame-src`, `worker-src` or `img-src` in src/index.html loses `blob:` ("ERR-004 ...").

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

**Automated (v1.10.84):** `clientPaperPrefs` / `clientPaperOptions` in src/utils.js, round-trip tested in scripts/tax-test.mjs ("[ERR-006] ...").

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

**Audit, 30 Oct 2026:** the smoke check named below does not exist in tests/smoke.mjs. Writing it is planned for 7 Nov; until then this is checked by hand.

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

## ERR-017 - Launcher said "_system folder is missing" while Explorer showed it

**Version:** shipped with the one-launcher layout in v1.10.44 · explained in v1.10.69
**Reported by:** the maintainer, with a photo of the screen (2026-09-23)

**Symptom** - the launcher opens and says *"`_system` folder is missing - Please
re-extract the ZIP or re-download from GitHub Releases"*, while the Explorer
window right behind it is listing `_system` in the very folder the user just
double-clicked in. It reads as a broken download.

**Cause** - Windows lets you double-click a file **inside** a ZIP without
extracting anything. It copies that one file to
`%TEMP%\Temp1_<name>.zip\<inner folder>\` and runs it from there, with no
siblings. The launcher was reporting the truth about the temp folder it had
been copied into; the folder the user was looking at was a different one. The
message named a cause ("re-extract") without ever naming the folder it had
checked, so there was no way to tell the two apart.

**Rule** - when a program reports that a file is missing, it names the folder it
looked in. A path the user can compare against what is on screen ends the
argument in one glance; "a file is missing" starts it.

**Automated (30 Oct 2026):** `npm run release:check` fails if the launcher loses its Temp-folder check ("ERR-017 ...").

**Guard** - the launcher now detects a `%LOCALAPPDATA%\Temp\` location and says
so in its own words ("Windows opened this file straight out of the ZIP"), with
numbered steps and a button that opens the Downloads folder. Any other missing
`_system` prints the folder it checked. Verified by running the launcher from a
simulated `Temp1_*.zip` folder and screenshotting both states; there is no
automated check, because nothing can drive `mshta` headlessly.

---

## ERR-018 - "Open App" never opened the browser, on any machine

**Version:** broke in v1.10.44, when the HTA launcher replaced the .bat files · fixed in v1.10.69
**Reported by:** found by installing the real release ZIP end to end (2026-09-23)

**Symptom** - the installer finishes, the server starts, and the console then
says *"Server did not respond in 15s. Check for errors in this window."* The
browser never opens. The app is running the whole time: paste the address in
by hand and it answers immediately.

**Cause** - `start-windows.ps1` decided whether the server was up with
`Invoke-WebRequest -Uri http://localhost:$p/api/profile -TimeoutSec 1`. Windows
PowerShell 5.1 runs the system proxy auto-detect (WPAD) on every web request,
including requests to `127.0.0.1`, and that costs about two seconds on a
machine with a proxy, a VPN or a corporate network. With a one-second timeout
the check could never return true - measured on a real install: `-TimeoutSec 1`
always times out, `-TimeoutSec 10` succeeds in 2.07s, and the same request with
`DefaultWebProxy = $null` succeeds in **0.03s**. Meanwhile the server itself was
accepting TCP connections 0.6 seconds after launch. So the script also believed
no server was running when one was, and started a second copy every time.

**Rule** - a loopback health check sets `[System.Net.WebRequest]::DefaultWebProxy
= $null` and addresses `127.0.0.1`, never `localhost` behind a system proxy.
And a timeout is a bound on how long the *other* end may take, never a bet on
how fast the local HTTP stack starts: give it seconds, not one second.

**Rule (second)** - a packaged installer is tested by installing the package.
The release gate boots `server.js` with node directly, which is why it passed
65 checks a release while the thing every Windows user actually double-clicks
was broken. Run the real `install-windows.ps1` from a real extracted ZIP
before shipping a release that touches the launcher or the scripts.

**Guard** - none automated (it needs a real Windows desktop session and a
browser). Verified by hand: extract the ZIP, run `_system\install-windows.ps1`,
and confirm the browser opens on `http://localhost:47371` with no warning.

---

## ERR-085 - "Needs a Quick Start" inside the app's own window during an update

**Version:** the v1.10.84 test Setup (never released) · fixed before release
**Reported by:** the maintainer, running the new Setup over their install (2026-11-07), with a screenshot: "this window should never come"

**Symptom** - while the Setup updated the app, the open app window showed the
browser-style "Free GST Billing Software Needs a Quick Start" page (double-click
the Desktop icon, Chrome/Edge app icons...).

**Cause** - that screen is the app's own `serverDown` view (App.jsx), drawn in
the page when `/api/profile` stops answering. An update stops the server for a
moment. The window's guard (ERR-075 follow-up in FreeGSTBilling.cs) only looks
at page loads, and this view appears without one, so it was never covered.

**Rule** - inside the Windows Setup's window (`window.chrome.webview`, WebView2)
the page never shows start-up instructions: it shows the start screen's
"Starting again..." until the server answers; the window starts the server
itself. Browsers and the ZIP launcher keep the Quick Start help.

**Guard** - `tests/smoke.mjs` "v84 the app window never shows Needs a Quick
Start": with `/api/profile` refused, a page with `window.chrome.webview` shows
"Starting again" and no Quick Start, a plain browser shows the Quick Start.

---

## ERR-084 - A deleted invoice could leave the Trash at once instead of after 30 days

**Version:** every version since 1.9.5 · fixed in 1.10.84
**Found by:** checking the maintainer's question "delete invoice should go to trash folder and 30 days auto delete" (2026-11-07)

**Symptom** (expected, not reported) - an invoice not changed for more than 30
days, deleted (Clients page), was gone from the Trash bin at the next start of
the app (or within a day), with no 30 days to restore it. The Trash bin also
showed the invoice's old date as the date it was deleted.

**Cause** - `DELETE /api/bills/:id` moves the file with `fs.renameSync`, which
keeps the file's modified time; `purgeOldTrash` removes Trash files whose
modified time is over 30 days old, and `/api/trash` shows that time as
`_trashedAt`.

**Rule** - a file moved into the Trash gets the current time
(`fs.utimesSync`); anything that ages files by date must stamp them when they
start their wait.

**Guard** - `scripts/server-lock-test.mjs` (in `npm run test:unit`): a bill
dated 60 days ago, deleted through the real server, is dated now in the Trash.
It fails without the fix.

---

## ERR-083 - The app's own server could freeze on a protected folder (Controlled folder access)

**Version:** every version up to 1.10.83 · fixed in 1.10.84
**Found by:** review of the tray menu's "Make a backup now" (2026-11-05), after ERR-082

**Symptom** (expected, not yet reported) - with Windows Security's "Controlled
folder access" on, Control Panel -> Open backups folder (it makes
`Documents\FreeGSTBill Backups`), or an extra backup folder chosen inside
Documents / Desktop, could make the whole app stop answering; extra backups
could stop for good without an error.

**Cause** - the same as ERR-082, in server.js: 11 `fs.mkdirSync(dir, { recursive:
true })` and 2 `fs.promises.mkdir(dir, { recursive: true })`. A refused
recursive mkdir never returns; the sync one blocks Node's only thread (every
request waits), the async one never settles (`extraCopyRunning` stays true).

**Rule** - server code makes folders with `makeDir` / `makeDirAsync`
(src/utils/makeDir.js: one level at a time, a refusal is a fast error). Never a
recursive mkdir. A new file the server imports goes into the copy list in
`scripts/build-release-zip.mjs` (its import check stopped the first build
without makeDir.js, before anything shipped).

**Guard** - `scripts/makedir-test.mjs` (in `npm run test:unit`): fails if
server.js contains a recursive mkdir; checks nested, repeated and impossible
folders (fast error).

---

## ERR-082 - Windows Setup stuck on "Preparing to Install" (Controlled folder access)

**Version:** the v1.10.84 test Setup (never released) · fixed before release
**Reported by:** the maintainer, trying the test exe on their own PC (2026-11-04)

**Symptom** - the Setup window shows "Preparing to Install - Setup is preparing
to install Free GST Billing on your computer." with an empty page and only
Cancel (greyed out), for ever. Windows Security logged event 1123: node.exe
"has been blocked from modifying %userprofile%\Documents by Controlled Folder
Access".

**Cause** - Windows Security's ransomware protection ("Controlled folder
access") was on. It refuses unknown programs any write in Documents, Desktop,
Pictures... The Setup's helper made the backup folder with
`fs.mkdirSync(dir, { recursive: true })`, and Node's recursive mkdir on Windows
LOOPS FOR EVER when the write is refused this way (a plain mkdir fails at once
with ENOENT). The default books folder was also in Documents, so even a
finished install could not have saved an invoice.

**Rule** - never `mkdirSync({ recursive: true })` in code that may write in a
user folder on Windows: make folders one level at a time (`makeDirs` in
installer/setup-helper.mjs). Check that the app's own node.exe can write
before anything is stopped or copied (`writable`). Default data folders go
outside Documents/Desktop: `C:\Users\<name>\Free GST Billing`. A Desktop icon
Windows refuses is skipped with a message, not an error.

**Guard** - `scripts/installer-test.mjs`: makeDirs on a folder that cannot be
made fails within 2 s with "Controlled folder access" in the message;
checkWritable cleans up after itself. Checked by hand on the maintainer's PC
(protection on): the bundled node.exe gets the clear error in 0.3 s for
Documents and passes for the user folder.

---

## ERR-081 - The copy label ("ORIGINAL FOR RECIPIENT") covered the e-invoice QR code

**Version:** since v1.10.83 (e-invoicing) · fixed in v1.10.84
**Reported by:** Bir Pandey, by email "pdf rectification" (2026-11-04)

**Symptom** - an e-invoice with Multi-copy on: the PDF's ORIGINAL / DUPLICATE
label box is printed over the top of the IRN QR code.

**Cause** - the copy label is drawn by jsPDF on the finished page, 4-10 mm
from the top right. The e-invoice block is the first thing on the page and its
QR sits in that same corner, about 3 mm from the top.

**Rule** - anything placed in the page's top-right corner must leave the
label's 4-10 mm band free when Multi-copy is on. The e-invoice block gets that
room (`copyLabelGap` in InvoicePreview: 12 mm less any top print margin,
scaled for the PDF text size).

**Guard** - checked in a browser on a test copy: QR top 2.8 mm with labels
off, 12.2 mm with labels on. No smoke check yet (needs an invoice with an IRN).

---

## ERR-080 - Unticking "Tax % column" turned GST off for the whole invoice

**Version:** since the switch existed · fixed in v1.10.84
**Reported by:** educationtoallsantosh-rgb / LordVikram, issue #152; Jdevloper275, issue #138 (2026-11-01)

**Symptom** - Customize -> Items table -> untick "Tax % column (GST/VAT/etc.)"
to hide the GST % column: instead no GST is charged at all, the tax rows go,
and the choice carries over to new invoices. "Hide all" did the same, and
also removed the round-off line, changing the total.

**Cause** - the switch is `showGST`, which is the invoice's "charge GST" flag,
not a display option. Its label described a column. "Hide all" listed it (and
`showRoundOff`) among the display options it switches off.

**Rule** - a switch that changes the money (GST charged, round-off) is never
labelled or grouped as a display option, and "Hide all" only touches display
options. `showGST` is now "Charge GST on this invoice" in its own group (Tax);
hiding the per-line tax columns is `showTaxColumns`.

**Guard** - `tests/smoke.mjs` "#152": unticking "Tax % columns" removes the %
columns while the totals (CGST) stay identical; the GST switch carries the new
name.

---

## ERR-079 - With the preview hidden, Save / Download / Print opened it and closed it again

**Version:** since v1.10.26 · fixed in v1.10.84
**Reported by:** sangwanmail-eng, issue #161 (2026-11-03)

**Symptom** - Live Preview hidden; Save & Download (or Print) makes the
preview pop open for a moment and close again.

**Cause** - v1.10.26 un-hid the preview for every capture
(`withPreviewOnScreen`), for a thermal `window.print()` path that no longer
exists (thermal printing builds its own iframe since v1.10.42). The hidden pane
is also `opacity: 0`, so html2canvas would capture a blank page without it.

**Rule** - never change the visible layout to take a picture of it. Fix the
picture's copy instead: `showHiddenPaneInClone` puts the pane back on-screen and
opaque inside html2canvas's cloned document only.

**Guard** - `tests/smoke.mjs` "#161": with the preview hidden, Save & Download
never removes `split-view-focus`, and the PDF is still full size (styled).

---

## ERR-078 - Enter after an item put the cursor in HSN, not the next Item box

**Version:** broke in v1.10.83 · fixed in v1.10.84
**Reported by:** fulbandhemanish-droid, issue #151 (2026-11-01)

**Symptom** - New Invoice: type an item, press Enter. A new row is added, but
the cursor lands in its HSN box, so the next item cannot just be typed.

**Cause** - v1.10.83 made the Item box a growing `textarea`. The code that
focuses the new row (`addItem`) and the "click to complete" draft badge still
looked for the row's first `input.form-input`, which is now HSN.

**Rule** - find the Item box by its class, `.line-item-name`, never by tag. Any
code that moves the cursor into a line item uses that class.

**Guard** - `tests/smoke.mjs` "ERR-078": Enter on the last row adds a row and
the cursor is in its Item box (120/120 passed on a test copy).

---

## ERR-077 - GSTR-1 said "Invalid client GSTIN format" for a correct GSTIN

**Version:** every version with the GSTR-1 checks · fixed in v1.10.84
**Reported by:** tomsingh0049-svg, issue #141 (2026-10-31)

**Symptom** - GST Returns → GSTR-1: "Invoice 11: Invalid client GSTIN format —
21GLZPP9877E1Z3". The number shown is a valid GSTIN (its check character is right).

**Cause** - the check tests the saved text exactly. A GSTIN pasted with a space
or an invisible character (copied from a web page, WhatsApp or Excel), or saved
in small letters by an import, looks the same on screen but fails it, and would
have gone into the JSON like that. Also, the check wanted a digit as the 13th
character; after a PAN's ninth registration in a state it is a letter.

**Rule** - GST Returns cleans every client GSTIN as it loads the invoices
(`cleanGstin` in `src/utils/gstr1Json.js`: capitals, only 0-9 A-Z, when that
leaves 15 characters), so the checks, tables, CSV and JSON all use the clean
value. One format test (`gstinFormatOk`), with a letter or digit as the 13th
character; `taxIdRegex` for India allows the same.

**Guard** - `scripts/gstr1-json-test.mjs` (#141 section). Checked in the app on a
test copy: invoices whose GSTIN had a trailing space, or small letters plus a
zero-width space, show no error; a GSTIN one character short still does.

---

## ERR-076 - Install stopped at "Opening the app in your browser now..."

**Version:** broke in v1.10.83 · fixed in v1.10.84
**Reported by:** Vijay Darshana, by email (2026-10-31), install in `F:\Apps\Free-GST-Billing`, Windows

**Symptom** - the installer printed "[OK] Install complete!", "Opening the app in
your browser now..." and "Next time, click the Free GST Billing icon...", then
nothing more: no "Starting server", no browser. The Desktop icon (run hidden)
did nothing either. Updating and reinstalling the packages did not help.

**Cause** - v1.10.83's `start-windows.ps1` asked WMI (`Get-CimInstance
Win32_Process`) whether a server for this folder had started in the last two
minutes, before it starts one. On some PCs WMI never answers (a stuck or broken
WMI service, some antivirus), and that call has no time limit, so the script
waited there for ever. It is the first thing after the last line shown.

**Rule** - nothing on the way to opening the app may wait for WMI. The "already
starting" check is a file in TEMP holding the id of the server process it
started, checked with `Get-Process -Id` (no WMI). Where WMI is still needed
(install.ps1 and uninstall stopping the server, they need the command line),
it gets `-OperationTimeoutSec 10`.

**Guard** - none automated (WMI cannot be broken on purpose in CI). Checked by
hand on a test copy: one click starts the server; 3 clicks at once give 1 server;
a server stopped within 2 minutes of starting is started again by the next
click (an earlier version of this fix waited instead: the TEMP file alone,
without the process id, is not enough).

---

## ERR-075 - Opening the app showed the previous version until a refresh

**Version:** every version with the offline cache (since v1.10.2) · fixed in v1.10.84
**Reported by:** the maintainer (2026-10-31): "when user run app from icon on desktop it should auto refresh itself and load correctly"

**Symptom** - after an update, the window opened on the old version and switched
to the new one a few seconds later (or only after a manual refresh). Found while
fixing it: with the app's server stopped, the window was blank or the browser's
"can't be reached" page instead of "Needs a Quick Start", and once the screen
showed old saved data with a green "running" dot.

**Cause** - three things:
1. The service worker kept `index.html` in its precache and answered every page
   open from it (`navigateFallback`), so the page and its code were the old build.
2. `boot-guard.js` cleared the offline cache whenever a file failed to load, also
   when the reason was simply that the server was stopped; nothing loaded after.
   That failure came from `qr-*.js`, which the page loads at start but which was
   left out of the precache, and whose cache rule never matched a name with "-".
3. The heartbeat asked `GET /api/profile`, which the offline API cache answers
   even when the server is down.

**Rule** - the page is fetched from the app first (NetworkFirst, `app-page`), the
cached copy only when the server does not answer. Every file the page loads at
start is precached. Anything that decides "is the server running?" uses a HEAD
request, which no offline cache answers.

**Guard** - checked in a browser on a test copy: a new build shows on the first
load with no reload; with the server stopped the app shows "Needs a Quick
Start"; when the server starts again it carries on by itself. A smoke check for
it is planned with the 7 Nov guards.

---

## ERR-074 - Products CSV import filled in only the names

**Version:** every version up to v1.10.82 · fixed in v1.10.83 (the #121 import)
**Reported by:** @ethbroken-svg (#134, 2026-10-30)

**Symptom** - importing a products CSV with the columns Name, HSN/SAC,
Purchase price, Selling price, GST %, Unit, Stock saved every name, but HSN,
both prices and GST % stayed empty.

**Cause** - the old import (InventoryView.jsx `handleCSVImport`) knew only the
exact headings `hsn`, `rate`, `gst%`, `unit`, `stock`, and had no purchase or
selling price at all. The app's own Products export writes `HSN/SAC`,
`Purchase price`, `Selling price` and `GST %`, so its own file did not import
back. Only Name, Unit and Stock matched.

**Rule** - every import reads what the matching export writes, and headings
are matched loosely (case, spaces, %, / ignored; src/utils/listCsv.js).

**Guard** - scripts/csv-test.mjs "[#134]": the reported file imports with every
column, and the Products screen's own export headings (read from
InventoryView.jsx, so a change to them is caught) all import.

---

## ERR-073 - After a refresh the menu showed "GST Billing" for a moment, then the business's logo

**Version:** v1.10.83 before release (the option was new) · fixed the same day
**Reported by:** the maintainer (2026-10-30), right after trying the option

**Symptom** - with "Show my business name and logo in the app's menu" ticked,
every refresh first drew the default icon and "GST Billing", then swapped in the
business's logo and name.

**Cause** - the menu is drawn before the business profile arrives from the
app's server (`profile` starts as null in src/App.jsx), so the first frame had
nothing to show but the default.

**Rule** - anything drawn from server data on the first frame needs a value
for that first frame: here the last shown name and logo, kept in this browser
(`gst_menuBrand`), replaced by the profile as soon as it arrives and cleared
when the option is turned off.

**Guard** - checked in a browser with the profile request held back 3 seconds:
the menu showed the business name and logo throughout. A smoke check for it is
planned with the 7 Nov guards.

---

## ERR-072 - The app's Desktop icon showed "Needs a Quick Start" after a restart

**Version:** v1.10.2 to v1.10.82 · fixed in v1.10.83
**Reported by:** the maintainer (2026-10-30): the icon "should have all things
like running server" when opened next time.

**Symptom** - after the computer was restarted, a Free GST Billing Software
icon on the Desktop opened a window saying *Free GST Billing Software Needs a
Quick Start*, and nothing started.

**Cause** - that icon was not the installer's. It was made by Chrome or Edge
from the app's own "Install as Desktop App" banner (src/App.jsx,
`beforeinstallprompt`). A browser app icon only opens a browser window on the
saved address; it cannot start the app's server, so the page came from the
offline cache with no server behind it. The ZIP install's own icon opened the
launcher, which then needed *Open App*, so the browser icon looked like the
easier one.

**Rule** - the only icon the app offers is the installer's: Windows
`app-shortcut.ps1` (`New-AppShortcut`, which runs start-windows.ps1
-AppWindow -Hidden; install.ps1 has a copy), Mac `Free GST Billing.app`, Linux
`free-gst-billing.desktop`. Never offer the browser's install prompt again.

**Automated (30 Oct 2026):** `npm run release:check` fails if `beforeinstallprompt` appears anywhere in src/ ("ERR-072 ...").

**Guard** - start-windows.ps1 `Move-IconsToApp` turns old launcher icons into
app icons; the "Needs a Quick Start" screen tells anyone with a browser icon
to use the Free GST Billing icon instead.

---

## ERR-071 - The GST portal refused the GSTR-1 JSON ("Download the latest version of Offline tool")

**Version:** every version up to v1.10.82 · fixed in v1.10.83
**Reported by:** @abhi783821 (#133, 2026-10-30), August 2026 return

**Symptom** - Returns Dashboard → GSTR-1 → Prepare Offline → Upload: "File
could not be uploaded! Download the latest version of Offline tool to generate
the JSON file or ensure to validate your uploaded file against the template
published at Specification Portal."

**Cause** - from the May 2025 return the portal wants the HSN summary (Table
12) as two lists, `hsn: { hsn_b2b, hsn_b2c }`; `exportGSTR1JSON`
(src/components/GSTReturns.jsx) still wrote one list, `hsn: { data }`. The
file also had full item names as HSN descriptions (the limit is 30), no
`typ: "OE"` on B2CS rows, empty tables and blank values, and the 2017-18-only
turnover fields `gt` / `cur_gt`.

**Rule** - the GSTR-1 JSON follows a maintained reference whose files the
portal accepts: India Compliance (resilient-tech/india-compliance,
`gst_india/utils/gstr_1/sections/*.py`, `to_gov`). When the portal changes
a table, check that reference first. B2B = buyers with a GSTIN (SEZ too); B2C
= no GSTIN, and exports. Blank values are stripped before writing.

**Guard** - scripts/gstr1-json-test.mjs (`npm run test:unit`) and the smoke
check "v83 #133 GSTR-1 JSON splits the HSN summary".

---

## ERR-070 - CSV import made a second client when the name was mistyped

**Version:** every version up to v1.10.82 · fixed in v1.10.83
**Reported by:** @surajparshad8 (#132, 2026-10-30)

**Symptom** - importing invoices from a CSV with a wrong firm name for an
existing client, but that client's correct GSTIN, created a new client with
the wrong name instead of using the saved one.

**Cause** - `salesCsvToBills` (src/utils/bulkCsv.js) looked saved clients up
by name only. The GSTIN in the row was copied onto the invoice but never used
to find the client.

**Rule** - a GSTIN identifies a client; a name does not. Look a client up by
GSTIN first, then by name. A GSTIN match uses the saved client and its saved
name. Two new rows with one GSTIN are one client.

**Guard** - scripts/csv-test.mjs, "[#132]" (run by `npm run test:unit`).

---

## ERR-069 - A client abroad, billed in dollars, got a domestic invoice with no LUT

**Version:** every version up to v1.10.82 · fixed in v1.10.83
**Reported by:** the maintainer, on their own books (2026-10-30)

**Symptom** - "I am trying a foreign client invoice, I don't see where it
will add the LUT." The invoice was in $, but it asked for a state, charged
IGST, and showed no LUT box and no "Outside India".

**Cause** - the client form starts with Country = India, so a client abroad
was saved as Indian ("GTB Pro Cleaning Canada" had country India, another had
none). Export, LUT and place of supply follow the client's *country*
(`isExportOrSez`, utils/lut.js); switching the currency to $ by hand changes
only the currency, so the invoice stayed domestic and nothing said why.

**Rule** - an invoice is an export because of where the client is, never
because of its currency. When the two disagree (foreign currency, client in
India, not SEZ) the screen says so and offers *Set the client's country*,
which jumps to the Country box. Never infer the country from the currency:
an Indian client can pay in dollars.

**Automated (v1.10.84):** `currencyCountryMismatch` in src/utils/fx.js decides the warning, tested by scripts/fx-test.mjs ("[ERR-069] ...").

**Guard** - checked by hand on the demo (USD + Indian client shows the
warning; its button focuses Country; Canada turns on the LUT box and
"Outside India (export)"). The export test itself is covered by
`scripts/lut-tds-test.mjs`.

---

## ERR-068 - A service (and anything never counted) showed "Out of Stock"

**Version:** every version up to v1.10.82 · fixed in v1.10.83
**Reported by:** @apfx007 (GitHub issue #121)

**Symptom** - "I added printing service and it shows out of stock." The
Products list, the Dashboard low-stock strip, the bell and the invoice toast
all treated it as goods with 0 in stock.

**Cause** - products had no Goods/Service distinction, and a blank Stock box
saved `stock: 0` (form, bulk edit, CSV import). The screens also disagreed
about a missing stock: the Dashboard used `p.stock ?? 0` (out of stock), the
bell `p.stock ?? 999` (fine).

**Rule** - a product with `kind: 'service'` has no stock; a missing/blank stock
means "not counted", never 0. Every place that shows or alerts on stock goes
through `trackedStock` / `findLowStock` (src/utils.js); every stock move goes
through `stockUpdates` (store.js applyStockChanges), which skips services; the
server drops `stock` from a service on save and skips it in production moves.
Never read `p.stock` directly for display or alerts.

**Guard** - `scripts/services-test.mjs` (in `npm run test:unit`): invoice save,
cancel, purchase and stock report skip a service; untracked stock is never low
or out; the Products/Clients sample files import back with zero errors.

---

## ERR-067 - "Drive C:\ is almost full. It has 0 MB free" on a nearly empty drive

**Version:** v1.10.81 - v1.10.82 installers · fixed in v1.10.83
**Reported by:** Vijay Darshana, by e-mail (29 Oct 2026), with a photo of the installer

**Symptom** - the Windows installer stopped with "Drive C:\ is almost full. It
has 0 MB free; the app needs about 400 MB" although C: had plenty of space and
the Recycle Bin was empty.

**Cause** - `Test-DiskSpace` (ensure-node.ps1) and `Get-FreeMB` (install.ps1)
read `(Get-PSDrive C).Free`. On some PCs that property is empty; `[int]($null /
1MB)` is 0, so "cannot tell" became "0 MB free" and the install was refused.

**Rule** - free space comes from `[IO.DriveInfo]::new(root).AvailableFreeSpace`
first, Get-PSDrive second; an empty or zero reading means "cannot tell" and
never blocks (a truly full disk still fails later with a clear npm/copy error).

**Automated (30 Oct 2026):** `npm run release:check` fails if a .ps1 uses `Get-PSDrive` without the `AvailableFreeSpace` / `-le 0` handling ("ERR-067 ...").

**Guard** - both functions treat `$null` / 0 as unknown. Workaround for older
versions: install to another drive (`$env:FREEGSTBILL_DIR = 'D:\Free GST
Billing'` before the one-line install, or extract the ZIP on D:).

---

## ERR-066 - A server restart filled the Problem log with one entry per request

**Version:** since v1.10.83 (Problem log) · fixed before release
**Reported by:** the maintainer (pasted 10 Problem log entries from 29 Oct 2026)

**Symptom** - while the server was stopped for a few seconds (a restart to
load a new build), Settings logged nine "GET /api/... -> no answer, Failed to
fetch" entries in the same second, plus one "Failed to fetch dynamically
imported module SettingsView-...js".

**Cause** - a screen loads about ten things at once; every failed request was
its own problem because the repeat check compared the request path. The
module error was the same restart: the screen's code file was asked for while
the server was down, the one automatic reload landed on a server still down,
and the 30-second loop guard then showed the error panel.

**Rule** - "no answer" (status 0) is ONE problem whichever request hit it
(`sig()` in src/utils/problemLog.js); real server errors stay separate.
Restarting the demo or an install while a page is open is expected to log
"cannot reach the app" once, not to be a bug.

**Guard** - `scripts/errors-test.mjs`: four "no answer" requests make one
entry; a 500 error is still its own entry.

---

## ERR-065 - After an update the app opened blank (or as the old version) until a second refresh

**Version:** every version with the offline copy (service worker) · fixed in v1.10.83
**Reported by:** seen on the maintainer's demo after an update (29 Oct 2026)

**Symptom** - after the app files were replaced, the first open showed a blank
page or the previous version; a second refresh fixed it.

**Cause** - the browser's offline copy served the previous version's page. Its
main code needs the PDF code file, which is left out of the offline copy to
keep it small; the update had renamed that file, the server answered the
missing file with the app's page (HTML), the module failed to load, and none of
the app's own recovery code had run yet.

**Rule** - (1) the new version's service worker reloads open windows when it
takes over (public/sw-reload.js, importScripts in vite.config.js); (2)
public/boot-guard.js, a plain script before the app, clears the offline copy
once and reloads if the app's code cannot load; (3) the server answers 404 for
a missing code/style file, never the app page. Data is never in that copy.

**Guard** - tested by hand: an older build with different file names, updated in
place and opened once, comes up on the new version (29 Oct 2026). The smoke
suite boots the packaged release with the guard in place.

---

## ERR-064 - HSN rate suggestions filled in pre-September-2025 GST rates

**Version:** since v1.10.22 (stale from 22 Sep 2025) · fixed in v1.10.83
**Reported by:** docs review (rates checked against the 56th GST Council lists)

**Symptom** - typing HSN 1806 (chocolate) set the line to 18% instead of 5%;
2202 (soft drinks) to 28% instead of 40%; 8528 (TVs) and 2523 (cement) to 28%
instead of 18%; 3004 (medicines) to 12% instead of 5%; garments said "< ₹1000".

**Cause** - `src/utils/hsnRates.js` was a hand-written table from the 2017-2024
rate structure. The GST Council's 56th meeting changed most of those rates from
22 Sep 2025, and nothing tied the table to that change. Worse, the invoice
auto-filled the suggestion over 18% / 0%, and codes whose rate depends on price,
engine size or packing were stored as one rate.

**Rule** - every entry carries the rate in force today, with the date checked
and the sources in the file header; a code that cannot be verified is removed,
not guessed. A code with more than one possible rate uses `rates: [...]` and is
shown, never auto-filled (`autoFillRate()` returns null). Re-check the table
whenever the GST Council changes rates.

**Guard** - `scripts/hsnrates-test.mjs` in `npm run test:unit`: asserts current
rates for chocolate, biscuits, water, soft drinks, TVs, cement, tyres,
medicines, pencils, salons; that garments, footwear, cars, bikes and spectacles
do not auto-fill; and that no entry suggests 12% or 28%.

---

## ERR-063 - Any screen that threw while rendering left a blank white page

**Version:** since v1.0 · fixed in v1.10.83
**Reported by:** the maintainer ("make sure it never gives any error in any case")

**Symptom** - a white page with no message. ERR-043 was one case (a refresh
while editing); any saved record with an unexpected field could do the same,
and there was no way to report it except a screenshot of nothing.

**Cause** - there was no React error boundary, so one throw while rendering
unmounted the whole app. Failed API calls and uncaught errors were not
recorded anywhere a user could find or send.

**Rule** - every screen renders inside an `ErrorBoundary` (App.jsx, keyed by
screen) and the app inside two more (main.jsx). A problem is logged, redacted
(`redact()` in `src/utils/errorReport.js`: GSTIN, PAN, phone, email, UPI id,
IFSC, account numbers, user names in paths) and offered as a pre-filled GitHub
issue. A damaged data file is skipped AND named in errors.log. Every known
problem links to a Troubleshooting section.

**Guard** - `scripts/errors-test.mjs` (redaction, issue URL length, known
patterns, ring buffer) in `npm run test:unit`; `node docs-site/build.mjs` fails
if a known problem links to a missing Troubleshooting section.

---

## ERR-062 - Mac: "could not be executed because you do not have appropriate access privileges"

**Version:** since v1.10.66 (ZIP built with Windows tar) · fixed in v1.10.82
**Reported by:** saraiwalaneeraj-cell, issue #120

**Symptom** - double-clicking `Free GST Billing - MAC.command` showed *"The file
"Free GST Billing - MAC.command" could not be executed because you do not have
appropriate access privileges."* Get Info showed it as a plain, non-executable
file.

**Cause** - the ZIP is built on Windows, which has no executable bit, so
tar.exe stored every file as mode 0666. macOS Archive Utility (and Linux
`unzip`) restore the mode stored in the ZIP, so the launcher and every `.sh`
came out not executable.

**Rule** - a release ZIP built on Windows must have its `.command` and `.sh`
entries marked 0755 inside the archive; check the stored mode, not the file on
disk.

**Guard** - `scripts/build-release-zip.mjs` `markScriptsExecutable()` sets the
mode, and `assertPortableZip()` refuses a ZIP with a non-executable launcher;
`npm run release:check` checks it again. Verified: unzip on Debian gives
`-rwxr-xr-x` for both launchers.

---

## ERR-061 - The docs ZIP unpacked as flat files on the web host, every link 404

**Version:** docs-site upload for v1.10.81 · fixed the same day
**Reported by:** the maintainer, uploading to dicecodes.com

**Symptom** - the host's file manager listed files named
`free-gst-software-documentation\assets\docs.js`,
`free-gst-software-documentation\assets\img\app-clients.webp`... in one folder,
and every page of the docs site returned 404.

**Cause** - the ZIP was made with Windows PowerShell 5.1 `Compress-Archive`,
which writes `\` as the folder separator inside the ZIP. Linux (the host, and
`unzip`) treats `\` as part of the file name, so no folders were created.

**Rule** - never zip anything for a web host or Linux with `Compress-Archive`.
Use Windows' own `tar` (`tar -a -c -f out.zip folder`, writes `/`), and check
the result before handing it over.

**Guard** - `node scripts/check-zip-paths.mjs <file.zip>` fails on any `\`
entry; the docs steps in `docs/WEEKLY_RELEASES.md` run it. (The app ZIP has
had the same guard since ERR-014.)

---

## ERR-060 - An old Node.js on the PC broke the update, which still said "complete"

**Version:** since the Windows scripts were written · fixed in v1.10.81
**Reported by:** fzkhan731, issue #109

**Symptom** - `npm ERR! code ENOTDIR ... node_modules\.staging\@types\babel__template...`,
then `[OK] Update complete!`, then "Still starting..." and "The server has not
answered in 90 seconds." npm reported Node.js v6.10.1 and npm 3.10.10.

**Cause** - install, update and start used whatever `node` was on PATH, of any
version. Node 6 cannot run the server, and its npm 3 ignores `--omit=dev`, so
it tried to install the build tools too and broke `node_modules`. The updater
never checked npm's exit code.

**Rule** - never trust a runtime by its name: check its version against
`engines` before using it, and treat a failed install step as a failed update.

**Automated (30 Oct 2026):** `npm run release:check` fails if `$MinNodeMajor` and package.json `engines.node` disagree ("ERR-060 ...").

**Guard** - `_system-scripts/ensure-node.ps1` (shared by install, update and
start) accepts Node.js 18+ only, else fetches the portable Node.js into
`_system\node`; start reinstalls the packages when it had to. Verified by hand
with a fake `node.cmd` printing v6.10.1 first on PATH and an empty
`node_modules`: Open App fetched Node 20, reinstalled and started.

---

## ERR-059 - A maths fix changed invoices that were already saved

**Version:** broke in the v1.10.80 audit (before release) · fixed in v1.10.80
**Reported by:** found by the v1.10.80 review

**Symptom** - a "with tax" discount on a price that includes tax was now taken
off as entered (correct), but GSTR-1 and reprints recalculate old invoices from
their lines, so an invoice saved at ₹1,080 reported taxable + tax of ₹1,062.

**Cause** - the rule changed inside a shared function with no way to tell an old
line from a new one; the saved total stayed, the recalculated parts moved.

**Rule** - a change to invoice maths applies to lines saved after it, never to
ones already issued: mark new lines (here `withTaxRule: 2`) and keep the old
maths for unmarked ones.

**Guard** - `scripts/tax-test.mjs` "[Audit 2026-10]": an old with-tax line still
totals ₹1,080.

---

## ERR-058 - CSV import merged two invoices that shared a number

**Version:** broke in v1.10.80 (before release) · fixed in v1.10.80
**Reported by:** found by the v1.10.80 review

**Symptom** - a file with invoice "1" for Alpha Traders (2025) and invoice "1"
for Beta Stores (2026) became one invoice for Alpha with both items, no error.

**Cause** - rows were grouped by invoice number alone and only the first row
gave the client and date.

**Rule** - rows grouped into one bill must agree on everything that identifies
the bill (date, client); a clash is an error, never a merge.

**Guard** - `scripts/csv-test.mjs` "[Review]".

---

## ERR-057 - "Update to v1.10.80" offered before v1.10.80 was released

**Version:** since the update check was added · fixed in v1.10.80
**Reported by:** Vim1972, issue #105 ("NEW UPDATE NOT DOWNLOAD")

**Symptom** - the app showed a new version; updating installed the same
version again.

**Cause** - the check read the version from `package.json` on GitHub `main`,
but the updater installs the latest **release**. Merging the v1.10.80 work
into main before releasing it made every copy offer a version that could not
be downloaded.

**Rule** - the version offered comes from the latest release's tag;
`package.json` on main is only the fallback when the Releases API can't be read.
Until the new check reaches everyone, keep `package.json` on main at the last
released version and bump it in the release commit.

**Guard** - none automated (needs GitHub). By hand: before pushing to main,
`package.json` "version" must equal the latest release tag unless that push is
the release.

---

## ERR-056 - GSTR-1 Table 13 mixed number series and listed quotations

**Version:** since GSTR-1 was added · fixed in v1.10.79
**Reported by:** found by the v1.10.79 review

**Symptom** - "documents issued" showed one row per type, so two series in one
period (a changed prefix, a business's own numbering) gave a from/to that ran
across both; quotations and proformas, which are not reported, were listed;
and the file numbered the document natures 1, 2, 3 by position.

**Cause** - grouped by type prefix, compared numbers as text, and used the
list index as `doc_num`.

**Rule** - Table 13 rows are per number series, under the portal's nature
codes (1 invoices, 5 credit notes, 12 delivery challans); from/to by the
number's value.

**Automated (v1.10.84):** `docIssueSummary` / `docIssueDetails` in src/utils/gstr1Json.js, tested by scripts/gstr1-json-test.mjs ("[ERR-056] Table 13 ...").

**Guard** - none automated beyond the GSTR-1 checks in the smoke suite.

---

## ERR-055 - A second conversion overwrote the first invoice

**Version:** long-standing · fixed in v1.10.79
**Reported by:** found by the v1.10.79 review, confirmed on the demo app

**Symptom** - convert quotation A to an invoice, then quotation B: only one
invoice existed afterwards. Duplicating twice could do the same.

**Cause** - the editor treated a duplicate or conversion as "editing", so its
first save did not reserve a number (it used the one it had only peeked) and
was sent with overwrite. The second conversion peeked the same number and
replaced the first invoice. Auto-save could also store a duplicate before
the first Save.

**Rule** - a duplicate or conversion is a NEW document until its first save:
it reserves its number, saves without overwrite (retrying on a clash), and is
not auto-saved before you press Save.

**Guard** - smoke check "v79 converting two quotations in a row makes two
invoices, neither overwritten".

---

## ERR-054 - A long invoice shared on WhatsApp or in Bulk PDF was squashed onto one page

**Version:** since v1.10.22 (share) / v1.10.71 (Bulk PDF) · fixed in v1.10.79
**Reported by:** found while checking #94

**Symptom** - an invoice taller than one A4 page came out of WhatsApp share or
Bulk PDF as a single page, its rows squeezed to fit.

**Cause** - both drew the captured invoice with `Math.min(height, 297)`:
clamping the height to one page shrinks the picture instead of continuing it.

**Rule** - a picture taller than a page is cut into page-high slices, one page
each (`addCanvasAsA4Pages` in Dashboard.jsx). Never clamp an image height to fit.

**Guard** - none automated in the smoke suite (Bulk PDF needs a download); the
v1.10.79 e2e run checked a 60-item invoice comes out as 3 pages.

---

## ERR-053 - GSTR-1 B2C did not show sales by state

**Version:** since GSTR-1 was added · fixed in v1.10.79
**Reported by:** @Vim1972 (#95)

**Symptom** - inter-state sales to unregistered buyers in Bihar, Punjab and
other states did not appear state by state in the GSTR-1 B2C table.

**Cause** - the screen's B2C table added everything up by tax rate only. The
JSON and CSV files were grouped by place of supply, but the screen, which is
what people check against the portal, was not; and the CSV wrote states as a
bare code (10) instead of the portal's "10-Bihar".

**Rule** - what the screen shows for a return table is grouped exactly as the
portal's table is. Places of supply are written "NN-State" (placeOfSupplyLabel).

**Audit, 30 Oct 2026:** the "Table 7 ... 10-Bihar" smoke check named below does not exist; only the unit test runs. The smoke check is planned for 7 Nov.

**Guard** - unit test "Place of supply written the portal way"; smoke/e2e check
"GSTR-1 Table 7 shows the inter-state sale under 10-Bihar".

---

## ERR-052 - With a brand prefix, a quotation and an invoice could get the same number

**Version:** since brand prefixes were added · fixed in v1.10.79
**Reported by:** found while working on #95

**Symptom** - with a brand prefix such as ACME, every document printed
ACME/2026-27/0001-style numbers. Quotations and invoices count separately, so a
quotation's next number was often an invoice's number: the app skipped numbers
until it found a free one, and failed after 20.

**Cause** - the brand prefix replaced the type prefix for every type, while
each type kept its own counter. Invoices are stored under their number.

**Rule** - two series that count separately must never print the same
numbers. Tax invoices print the brand alone; other types print brand-TYPE
(formatDocNumber).

**Guard** - unit test "Brand prefix: invoices ACME/..., other types
ACME-QUO/..."; smoke check "v79 brand prefix: a quotation is numbered
SMKA-QUO/...". The type tag makes numbers longer, so Settings checks the
GST limit of 16 characters (numberFormatProblem) and offers the short year.

---

## ERR-051 - Two businesses shared one invoice number series

**Version:** since more than one business was supported · fixed in v1.10.79
**Reported by:** @Vim1972 (#95)

**Symptom** - with two firms, the second firm's invoices continued the first
firm's numbers (1225, 1226...) instead of its own series (502...).

**Cause** - when businesses were separated (v1.10.64), lists and reports were
split by GSTIN but the number format and its counters stayed global. The
editor also asked for the next number before the active business had loaded,
so it showed the shared series' number even where Save would use another.

**Rule** - anything a business can configure for its own documents is looked
up by business (businessKeyOf), and the shown number is re-read when the
business is known. A business with its own series must use its own prefix.

**Guard** - unit tests "[V79] ... per-business numbering"; smoke check "v79 #95
a business with its own numbering shows and numbers in its own series".

---

## ERR-050 - Added-up quantities shown as 6356.9599999999

**Version:** since the reports were added · fixed in v1.10.79
**Reported by:** @Vim1972 (#96)

**Symptom** - Product Performance showed quantities such as 6356.9599999999.
The GSTR-1 HSN summary, the Tally invoice's total quantity and stock after a
decimal purchase could do the same.

**Cause** - decimal quantities added up in floating point (0.1 + 0.2 =
0.30000000000000004) and were shown or saved without rounding. Money was
always rounded; quantities never were.

**Rule** - any added-up quantity goes through roundQty before it is shown,
exported or saved (3 decimals; 2 for the GST portal).

**Guard** - unit test "Added-up quantities are rounded"; e2e check "Product
Performance shows 0.1 + 0.2 as 0.3".

---

## ERR-049 - "Start numbering from" was shown but never used

**Version:** since the number format settings were added · fixed in v1.10.78
**Reported by:** @ved935030-afk (#93)

**Symptom** - a business moving from a paper bill book could not start at its
own number (1001): every new install numbered from 0001.

**Cause** - the settings had a `startNumber`, but there was no field for it in
Settings, and only the number SHOWN on a new invoice read it. The number
actually taken on Save came from the server counter, which always started at
1. So even with a start set, the screen could show 1001 and save 0001.

**Rule** - a number that is shown and the number that is saved come from the
same rule, in one place: `nextCounterValue` + `startFor` (src/utils.js), used
by the server when it reserves a number, by recurring invoices, and by the
preview. The next number is max(last + 1, start), so a used number is never
reused. The start is for tax invoices only (the maintainer's call), passed by
document type, so it holds with a custom prefix too; raising it is confirmed
first, since it cannot be undone.

**Guard** - unit tests "[V78] #93" in `scripts/tax-test.mjs`; smoke check
"v78 #93 Start numbering from: a tax invoice is shown and saved as 900001; a
quotation is not".

---

## ERR-048 - Welcome wizard and Region came back after a restart

**Version:** since the wizard was added · fixed in v1.10.77
**Reported by:** @sangwanmail-eng (#84 items 1 and 4)

**Symptom** - the "Welcome to Free GST Billing" wizard appeared again and
again, and Region set to India came back as Both / Auto after restarting.

**Cause** - these settings lived only in the browser's localStorage. Some
browsers, cleaners and "clear data on exit" settings wipe it, and every
wiped setting fell back to its first-run default.

**Rule** - a setting the user chose must also live in the data folder.
Browser storage is a cache, never the only copy.

**Guard** - `src/utils/prefsMirror.js` mirrors the listed keys to
`data/local-prefs.json` (only after a successful restore, merging only the
keys it changed) and restores missing ones before the first render;
smoke check "v77 #84 settings are mirrored to the data folder".

---

## ERR-047 - A converted invoice showed Paid; Paid → Unpaid kept the payment

**Version:** since conversion was added · fixed in v1.10.77
**Reported by:** @sangwanmail-eng (#86)

**Symptom** - converting a quotation or proforma gave a tax invoice already
marked Paid. Changing a Paid invoice to Unpaid left the amount in the Paid
column and no Send reminder button.

**Cause** - conversion and Duplicate copied the source's payments and print
count into the new invoice. "Unpaid" changed only the status label; the
payment that "Mark paid" had added stayed.

**Rule** - a new document (duplicate or conversion) starts with no payments
and no print history. A status change must change the money behind it:
`markUnpaidPatch` removes the payments "Mark paid" added and recomputes the
status from what is left.

**Guard** - unit tests "[V77] #86" in `scripts/tax-test.mjs`.

---

## ERR-046 - Opening a saved invoice replaced its terms with the first template

**Version:** since terms templates were added · fixed in v1.10.77
**Reported by:** found while testing #88

**Symptom** - open a saved invoice that had its own Terms & Conditions: the
preview showed the first terms template instead, and auto-save wrote that
over the invoice's real terms. A restored draft lost its terms too.

**Cause** - the template loader filled the terms whenever none was
*selected*, and an opened invoice never has one selected (its terms are free
text). It ran for every invoice, not only new ones.

**Rule** - defaults fill only a NEW, BLANK document. Anything opened from a
saved invoice or a draft keeps what it has. Same for display options: a
restored draft's options win over the saved defaults.

**Guard** - `blankNewInvoice` in InvoiceGenerator.jsx; smoke check "v77
opening a saved invoice keeps its own terms (not the first template)".

---

## ERR-045 - Tally style PDF went onto 2 pages although the preview fitted one

**Version:** since v1.10.73 · fixed in v1.10.77
**Reported by:** @Mindfulbrain17 (#88)

**Symptom** - the preview showed the whole invoice on one A4 page; the
downloaded PDF put the terms, bank details and signature on page 2.
Smaller font did not help.

**Cause** - Tally style and Boxed grid stretch the item table with empty
filler space to look like a printed form. The capture is a few millimetres
taller than the page, so the PDF builder broke it into two.

**Rule** - filler space is optional: before capture, shrink spacer rows
(`data-pdf-spacer`) until the invoice fits, and put them back afterwards.
Only real content may push an invoice onto a second page.

**Guard** - `fitSpacersToOnePage`; smoke check "v77 #88 a one-item invoice
is one PDF page in Tally style and Boxed grid". Up to 6% over a page is also
scaled onto one page, so the ERR-024 smoke check accepts a one-page result
when no two-page case of that shape exists (nothing can be cut then).

---

## ERR-044 - CGST and SGST differed by a paisa in GST Returns

**Version:** since v1.10.31 · fixed in v1.10.77
**Reported by:** @jeyadreams (#89)

**Symptom** - on a 5% item, GST Returns showed CGST and SGST one paisa apart,
and neither matched the invoice.

**Cause** - GST Returns split each line's tax with its own rule (CGST rounded
down, SGST rounded up). The invoice uses equal halves, so the two screens
disagreed.

**Rule** - one function splits tax for every screen and file. Each line's
tax is rounded to the paisa as on the invoice; CGST and SGST/UTGST are its
exact halves, added up and rounded ONCE per row. Rounding each half per line
(the first v1.10.77 attempt) drifted from the invoice by a paisa per line.

**Guard** - `splitLineTax` in `src/utils.js`, used by GST Returns; unit tests
"[V77] #89" in `scripts/tax-test.mjs` (25 and 300 lines against the invoice
maths, and round() against toFixed(2)).

---

## ERR-043 - Refreshing the page while editing an invoice blanked the app

**Version:** since v1.5.0 · fixed in v1.10.76
**Reported by:** found while testing the #80 fix

**Symptom** - press F5 (or the browser restores the tab) while an invoice is
open for editing, and the whole app goes blank.

**Cause** - the invoice template read `profile.swift` for the bank block. On
a refresh the business profile is still loading on the first render, so
`profile` was null, and an error while rendering unmounts the whole app.

**Rule** - a component that can render before its data arrives treats the
missing data as empty, never as an object that is certainly there.

**Guard** - InvoicePreview uses `profile || {}`; the smoke check
"refreshing the page while editing an invoice keeps the app on screen".

---

## ERR-042 - With "Prices include tax", Subtotal + tax did not equal the Total

**Version:** since prices-include-tax was added · fixed in v1.10.76
**Reported by:** @sangwanmail-eng (#83)

**Symptom** - a ₹300 line at 0% and two ₹1,050 items at 18%, prices including
tax: Subtotal ₹2,400, CGST ₹160.17, SGST ₹160.17, Total ₹2,400.

**Cause** - the templates printed `totals.subtotal`, which with inclusive
prices is the gross INCLUDING tax. The tax and total were right.

**Rule** - a printed breakdown must add up on paper. With inclusive prices the
Subtotal printed is the taxable value (before discount).

**Guard** - `printedSubtotal()` in utils.js, used by every template and the
WhatsApp text; tax-test "[V76] #83 printed Subtotal".

---

## ERR-041 - Purchase from another state not marked inter-state

**Version:** · fixed in v1.10.76
**Reported by:** @raviagrawal01 (#82)

**Symptom** - a supplier GSTIN from another state left "Inter-state purchase"
unticked, so the credit landed under CGST + SGST in GSTR-3B Table 4.

**Cause** - the box was manual only, unlike sales invoices, which work it out.

**Rule** - anything the GSTIN already tells us is filled in for the user, and
left editable.

**Guard** - `isInterstateSupply()`; tax-test "[V76] #82".

---

## ERR-040 - GSTR-3B Table 6 did not set CGST/SGST credit off against IGST

**Version:** · fixed in v1.10.76
**Reported by:** @raviagrawal01 (#81)

**Symptom** - CGST ₹360 + SGST ₹360 credit, IGST ₹810 liability: Net Tax
Payable ₹810. The law gives ₹90.

**Cause** - each head was reduced only by its own credit.

**Rule** - credit is set off in the legal order (Section 49(5), 49A,
Rule 88A): IGST credit against IGST, then CGST, then SGST; CGST credit
against CGST, then IGST; SGST credit against SGST, then IGST. Never CGST
against SGST or the reverse.

**Guard** - `setOffITC()`; tax-test "[V76] #81".

---

## ERR-039 - Stock ignored edits, and quotations took stock out

**Version:** since stock tracking · fixed in v1.10.76
**Reported by:** @raviagrawal01 (#80)

**Symptom** - changing a saved invoice's quantity 10 -> 15 left stock at 40
(expected 35). Quotations and proformas took stock out; converting one then
took it out again; credit notes took stock out instead of putting it back.

**Cause** - stock was moved once, on a bill's first save, by -quantity for
every type, and never again (`stockDeducted` was true for any existing bill).

**Rule** - every bill keeps a record of what it has done to stock
(`data.stockApplied`), and each save applies only the difference to what it
should do now (sales -qty, credit note +qty, quote/proforma/cancelled 0).
Bills from before have no record and are taken to have done what the old
code did: -quantity for every type (0 if cancelled or made by the recurring
generator). The old code only moved stock on a bill's FIRST save, so an old
bill whose quantity was edited later is taken to hold its current quantity,
not its first one; that difference cannot be recovered and is accepted.
Every save works from the server's copy of the bill (not the editor's), saves
run one at a time, and a conversion takes over the original's record.

**Guard** - `stockEffect` / `appliedStock` / `stockDelta`; tax-test "[V76]
#80"; smoke checks "v76 #80 ...".

---

## ERR-038 - A new ZIP installed a second copy; updates left old files behind

**Version:** since v1.10.44 (one-file launcher) · fixed in v1.10.75
**Reported by:** the maintainer, on their own PC

**Symptom** - after downloading a new version, the PC had two Free GST
Billing apps (`Downloads\Free-GST-Billing-v1.10.68` and `...-v1.10.74`), each
with its own invoices. The shortcuts moved to the new, empty one, so the
invoices seemed to be gone. Separately, installs that started on an older
version still had launchers and scripts under their old names, which also
look like a second copy.

**Cause** - every release ZIP extracts to a new versioned folder, and the
launcher there saw "not installed in THIS folder" and offered Install, which
made a second, complete install and repointed the shortcuts. The updater only
ever copied files in; nothing removed the files a release renamed or retired.

**Rule** - an installer looks for an existing install (the Desktop and
Start-Menu shortcuts say where it is, plus the one-command install folder)
before it installs, and sends the user to Update when it finds one. A release
that renames or retires a file also deletes the old one on the next start -
by exact name, only when its replacement is present, never inside `data`,
`node`, `node_modules` or backups.

**Guard** - `install-windows.ps1`, `install.ps1` and the launcher all stop
with "Already installed in <folder>" (FREEGSTBILL_DIR still allows a
deliberate second copy). `start-windows.ps1` / `start-unix.sh` remove the
known obsolete files. Verified by hand on this PC: from a new folder the
check finds the real install (v1.10.74, 2 invoices) and ignores its own.

---

## ERR-037 - GSTR-3B counted exports twice; HSN summary added credit notes

**Version:** broke before v1.10.67 · fixed in v1.10.74
**Reported by:** found while documenting the GST Returns screen

**Symptom** - an export to a client without a GSTIN appeared in the B2C
table and in 3.1(a) as well as 3.1(b), and its IGST was added to output tax
twice. Credit notes raised the HSN summary instead of lowering it.

**Cause** - `b2cBills` in GSTReturns.jsx was "every bill with no client
GSTIN", which includes exports and credit notes; the HSN aggregation added
every line with a + sign.

**Rule** - every return table starts from one classification: exports,
B2B, B2C and credit notes are disjoint sets, and a credit note always carries
sign -1 wherever it is summed.

**Guard** - none automated yet (GSTReturns has no unit-testable totals
function). By hand: one export without GSTIN must appear only in 3.1(b).

---

## ERR-036 - "Needs a Quick Start" appeared while the app was running

**Version:** since the continuous server check · fixed in v1.10.73
**Reported by:** found by the release test on a machine at 100% CPU

**Symptom** - mid-session, the whole app was replaced by "Free GST Billing
Software Needs a Quick Start ... Starting..." although the server was running
and answered in milliseconds a moment later.

**Cause** - `App.jsx` polls `/api/profile` every 5 s with a 3 s timeout, and a
single slow reply set `serverDown`, which swaps the whole app for the notice.
On a loaded PC one reply can take longer than 3 s.

**Rule** - a liveness check that can take the whole screen away needs more
than one failure: judge "down" on consecutive misses, and only trust a single
miss before the app has ever loaded.

**Guard** - none automated (needs a controlled slow server). By hand: pause
the server process for ~6 s mid-session; the app must stay on screen.

---

## ERR-035 - Control Panel: "Launcher scripts not detected" on every install

**Version:** broke in v1.10.44 (Control Panel) and v1.10.69 (Update Now uses it) · fixed in v1.10.72
**Reported by:** @deppen12 (GitHub #73)

**Symptom**

```
Launcher scripts not detected. This app appears to be running from a dev clone
(npm start) rather than an installer ZIP. Update / Backup / Restore / Move
buttons need the launcher scripts under _system-scripts/.
```

Every button behind it answered `Script not found for this platform`,
including Update Now in Settings and the sidebar.

**Cause** - `scripts/build-release-zip.mjs` has always FLATTENED
`release-templates/_system-scripts/*` into `_system/`, next to `server.js`.
`server.js` looked only for folders named `_system-scripts` (inside
`_system`, in `release-templates`, and beside `_system`). None of them exists
in a ZIP install, so the lookup found nothing. The release test never touched
the Control Panel, so no check noticed.

**Rule** - when the packager moves a file, every path that reads it moves in
the same change. A folder is chosen because it contains the file needed, never
because a folder of that name exists.

**Guard** - `tests/smoke.mjs` "#73 the Control Panel finds its update and
backup scripts" (and, on Windows, all five). `verify-release.mjs` runs the
suite on a fresh install of the ZIP, so the real layout is what is tested.
Verified red: the v1.10.70 ZIP install reports `controlScriptsAvailable: false`.

---

## ERR-034 - Settings: the save bar sat on top of the "Jump to" bar

**Version:** broke in v1.10.67 · fixed in v1.10.71
**Reported by:** found while taking documentation screenshots

**Symptom** - once Settings was scrolled, the "Jump to" section buttons were
hidden behind the "Everything is saved" bar and could not be clicked.

**Cause** - both bars were `position: sticky; top: 0`. The save bar was made
always-visible in v1.10.67 without moving the jump bar down.

**Rule** - two sticky elements in one scroll area need stacked `top` offsets,
and the lower one's offset must follow the upper one's real height (it wraps
on narrow screens).

**Guard** - none automated. By hand: open Settings, scroll down, check the
jump bar sits below the save bar, and a jump lands below both.

---

## ERR-033 - Setup wizard: the chosen language reverted to English

**Version:** broke in v1.10.6 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - picking Hindi (or Tamil, Marathi, Bengali) with the Retail,
Freelancer, Wholesale or Service business type gave English labels. The
paper size picked in the wizard changed nothing either.

**Cause** - `finish()` set `labelLanguage` first, then applied the business
preset, and four presets set `labelLanguage: 'en'`. The paper size was saved
to print settings, which the invoice screen never reads: it reads the invoice
defaults.

**Rule** - apply presets first and the user's explicit choices after, so the
explicit choice wins. Save a setting where the screen that uses it reads it.

**Automated (v1.10.84):** `wizardResult` in src/utils/businessTypes.js, tested by scripts/businesstype-test.mjs ("[ERR-033] ..."), which fails if the preset is applied after the language again.

**Guard** - none automated. By hand: run the wizard with Retail + Hindi + 80mm,
then open a new invoice.

---

## ERR-032 - Income tax: labels and PDF disagreed with the tax worked out

**Version:** broke in v1.10.31 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - the screen said STCG 15% and LTCG 10% over ₹1L, the engine used
20% and 12.5% over ₹1.25L. The 80D hint said ₹1,00,000; the tax used ₹50,000,
and the ITR-4 PDF printed up to ₹1 lakh. Business income added GST, quotes,
challans and foreign-currency invoices to sales. "Office rent" in a bank
statement became rent received. Pushing a statement twice doubled it.

**Cause** - the engine rates and limits were updated, the labels were not; the
UI never passed age, so senior limits could not apply; sales used
`totalAmount` of every non-cancelled bill; the rent-paid rule came after the
rent rule, and the first match wins.

**Rule** - labels quote the engine's values, never their own copies. Income is
counted from real sales without GST (`salesSign`).

**Guard** - `scripts/tax-test.mjs` [V71] income-tax block: office rent is an
expense, and the ITR-4 80D line equals the limit the tax used.

---

## ERR-031 - Reports counted quotes and challans as sales, credit notes as income

**Version:** broke before v1.10.67 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - Reports' revenue did not match the Dashboard's. Proforma
estimates and delivery challans counted as revenue and as money owed; credit
notes were ADDED to revenue.

**Cause** - v1.10.67 introduced `salesSign()` for the Dashboard; Reports kept
summing every non-cancelled bill.

**Rule** - every total of "sales" goes through `salesSign()` / `countsAsSales()`.
Never sum `totalAmount` over all bills.

**Guard** - none in the smoke suite yet; `salesSign` itself is covered in
`scripts/tax-test.mjs`. By hand: a proforma must not change Reports.

---

## ERR-030 - GST rates and the B2C Large limit were out of date

**Version:** stale from Aug 2024 / Sep 2025 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - the GSTR-1 export blocked any item at 40% ("Portal accepts only
0, 0.25, 3, 5, 12, 18, 28%"), no screen offered 40%, and B2C Large started at
₹2.5 lakh.

**Cause** - hard-coded lists from before GST 2.0 (40% from 22 Sep 2025) and
before Notification 12/2024-CT (B2CL above ₹1 lakh from 1 Aug 2024). Adding
40% also broke the "second-highest rate" default for new rows, which would
have become 28%.

**Rule** - GST rates and limits live in one place in `utils.js`
(`GST_PORTAL_RATES`, `b2clThreshold`), with the date a change took effect.
Defaults name the rate (18%), never a position in a list.

**Guard** - `scripts/tax-test.mjs` [V71] rates block.

---

## ERR-029 - TDS / TCS came out as ₹0 on ordinary invoices

**Version:** broke in v1.10.31 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - ticking TDS (194J at 10%, say) or TCS on an invoice under ₹50
lakh gave 0.

**Cause** - the ₹50 lakh threshold was applied to every section, but it belongs
to 194Q and 206C(1H) only. And the client's running total for the year was
never worked out: the invoice screen always passed 0.

**Rule** - thresholds belong to a section, not to TDS/TCS as a whole. A
per-client yearly total is worked out from saved invoices
(`clientYearToDate`), by the invoice screen and the server alike.

**Guard** - `scripts/tax-test.mjs` [V71] TDS/TCS and year-to-date blocks.

---

## ERR-028 - Recurring templates lost their settings when edited

**Version:** broke in v1.10.31 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - editing a template made from an invoice wiped its "every N",
end date or count, terms, options and business. "Generate Now" made invoices
with no CGST/SGST/IGST split, ignored the interval and end, and never counted.
A template with no on/off flag showed Active but never fired. Auto-fired
invoices in Jan-Mar carried next year's financial-year label.

**Cause** - the server replaces the whole record on save and the form only
sent the fields it shows; Generate Now had its own simplified maths in the
browser; the server checked `!tpl.active` and used the calendar year.

**Rule** - an edit form spreads the full original record under its own
fields. One code path makes recurring invoices: the server's
`generateFromTemplate`, used by the daily run and by Generate Now.

**Guard** - `tests/smoke.mjs` "v71 Generate Now" checks: works on a paused
template, splits the tax, honours every-2-months, counts the invoice.

---

## ERR-027 - Deleting a purchase bill did not take its stock back out

**Version:** broke in v1.10.50 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - the confirmation said "Stock levels for the products in this
bill will be reverted", but stock stayed. Removing a row while editing a bill
also left its stock in.

**Cause** - delete only removed the file; the edit path only looked at rows
still present.

**Rule** - every path that adds stock has a matching path that removes it:
save, edit (changed and removed rows) and delete.

**Guard** - none automated. By hand: add a purchase of 5, delete it, check
stock.

---

## ERR-026 - Print did not save; Save & Download could print an unsaved number

**Version:** broke in v1.10.58 · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - Print handed the client a numbered invoice that was never saved.
Save & Download built the PDF before the number was reserved, so the PDF
could show a different number from the saved invoice. After a
duplicate-number error, "Invoice saved" still appeared. Ctrl+S and Save &
leave never took stock out.

**Cause** - print paths never called `saveInvoiceToDB`; the download path
called it after `buildPDF`; `saveInvoiceToDB` returned nothing on its error
paths, so callers could not tell.

**Rule** - save first, then make any output from the saved number.
`saveInvoiceToDB` returns the saved number or null, and callers check it.

**Guard** - none automated for the order. By hand: new invoice, Print, check
it is on the Dashboard with the number printed.

---

## ERR-025 - Dashboard "Bulk PDF" always failed

**Version:** broke in v1.10.x · fixed in v1.10.71
**Reported by:** found while writing the documentation

**Symptom** - "Could not generate any PDFs" whatever was ticked.

**Cause** - `onClick={bulkExportPDF}` passed the click event into the
function's first argument, `billsOverride`, so the event was treated as the
list of invoices. The same pattern opened Clients' Add Client with the event
as prefill.

**Rule** - never pass a handler with parameters straight to `onClick`; wrap it:
`onClick={() => fn()}`.

**Guard** - `tests/smoke.mjs` "v71 Bulk PDF downloads a PDF of the ticked
invoices".

---

## ERR-024 - A page break cut the company stamp in half

**Version:** latent since page breaks learned to respect rows (v1.10.8); made likely by the stamp (v1.10.67) · fixed in v1.10.70
**Reported by:** the maintainer, with a photo of a customer's printed invoice (2026-09-24)

**Symptom** - on a two-page invoice, the top arc of the round company stamp
printed at the foot of page 1 under "Authorized Signatory", with blank space
below it, and the rest of the stamp at the top of page 2 beside the terms.

**Cause** - the PDF is one tall capture sliced into pages. To avoid cutting
through text, buildPDF only ends a page at the top or bottom of a table row or
a `.inv-footer-block`. But the footer is two columns: bank details and terms
are stacked on the left, and the signature block sits beside them on the right.
The bottom of the bank-details block is a clean edge in the left column and
passes straight through the stamp in the right one. Nothing checked the column
next door. The stamp made it likely: a signature block with a 120px stamp is
far taller than a signature alone, so the page edge lands inside it far more
often.

**Rule** - an edge is only a place to break if *nothing* straddles it. Collect
the candidate edges, then drop every one that falls inside anything that must
stay whole: rows, footer blocks, the signature block, and every image.
`safePageBoundaries()` in `src/utils.js` does exactly that. And measure the
layout that is actually captured: the extra pages are now hidden *before* the
edges are measured, not after.

**Guard** - `scripts/tax-test.mjs` `[V70-ERR-024]` models the reported footer.
`tests/smoke.mjs` builds the dangerous invoice for real: it adds rows until the
page-1 edge falls between the bottom of the bank details and the bottom of the
signature, makes a real multi-page PDF, and fails if any page ends inside the
signature block or any image. It reads a read-only test hook,
`window.__lastPdfLayout`. Verified red: against v1.10.69 it failed with "page
ends at 1024px - CUTS THROUGH"; against v1.10.70 page 1 ends at 880px, above
the signature.

---

## ERR-023 - The app icon was unreadable at the size Windows actually draws it

**Version:** artwork unchanged since v1.10.7 · icon first shipped, and fixed, in v1.10.69
**Reported by:** the maintainer, from a screenshot of the extracted folder (2026-09-24)

**Symptom** - *"it looks very bad or corrupted"*. On the Desktop shortcut and
in the launcher title bar the icon was a blurry blue blob with something
indistinct inside it.

**Cause** - the icon was rendered by shrinking `public/favicon.svg`, which is
built for a browser tab and a 512px PWA tile: a #1e40af rounded square, a
#2563eb rounded square inset 4px inside it, a white panel at 15% opacity, a
26px letter and a 3px bar. At 16 pixels the two blues merge into a fuzzy
edge, the panel becomes a grey ghost, the bar becomes a smudge, and the letter
gets about six pixels of height. Nothing was corrupt; there was simply four
times more detail than the canvas could hold.

**Rule** - an icon is drawn at 16px far more often than at 256, so it is
designed at 16px and allowed extra detail as it grows, not the other way
round. Below 64px this one is a solid square and a single letter.

**Rule (second)** - build the .ico out of uncompressed BGRA bitmaps, not PNGs.
Windows 11 reads PNG-in-ICO, but .NET quietly hands back a smaller image when
asked for a PNG-compressed 256 (observed here), and older shells skip such
entries entirely. PNG is kept only for 256px, where a bitmap would be 256 KB.

**Guard** - none automated (it is a judgement about legibility). Verified by
rendering 16/24/32/48 from the shipped .ico, enlarging each with nearest-
neighbour, and looking; and by asking the Windows shell itself, through
SHGetFileInfo, what it draws for a shortcut and for the installed folder.

---

## ERR-022 - Every install re-downloaded 3.9 MB it already had

**Version:** shipped with the packaged release since v1.10.33 · fixed in v1.10.69
**Reported by:** the maintainer asking whether everything in the ZIP is really needed (2026-09-23)

**Symptom** - during install, on a user machine, the console prints
*"fetching eng.traineddata from jsDelivr..."* and pulls 3.9 MB down. The ZIP
they just downloaded already contains that exact file.

**Cause** - `bundle-tesseract-assets.mjs` is wired to `postinstall`, so it runs
wherever `npm install` runs - including on the user machine. It rebuilds
`public/tesseract/` from node_modules and downloads the English OCR data. In a
source checkout that is right: `public/` is what `vite build` copies into
`dist/`. In an installed copy it is pure waste - a release install serves
`dist/`, and `dist/tesseract/` already holds all 18 files including the 3.9 MB
language data. The download also added a network dependency, and a few more
seconds, to an install that did not need either.

**Rule** - a `postinstall` hook runs on every machine that installs the
package, not just yours. Anything in it that only makes sense in a source
checkout has to detect that it is in one. Here: a source checkout has
`public/` (it is in git), an installed copy does not.

**Guard** - none automated. Verified by hand: with `node_modules` present and
`public/` renamed away - the exact shape of a release install - the script now
prints "Installed copy - OCR files already ship in dist/. Nothing to do." and
creates nothing.

---

## ERR-021 - The installer needed administrator rights it could never ask for

**Version:** broke in v1.10.44, with the HTA launcher · fixed in v1.10.69
**Reported by:** found while answering "can you confirm there will be no installation error" (2026-09-23)

**Symptom** - on a PC without Node.js, the install appears to run and then
stops with *"ERROR: npm install failed. See above."* Nothing above it explains
anything. On a PC that already had Node.js, the same installer worked - so it
looked fine in every test done on a developer machine.

**Cause** - `install-windows.ps1` fetched the official Node.js **.msi** and ran
`msiexec /i ... /qn`. That MSI installs per-machine into `C:\Program Files\`,
which requires elevation, and `/qn` means fully silent - so Windows cannot even
show the UAC prompt that would grant it. On a standard account it installed
nothing. The exit code was never checked and `node -v` was never re-tested, so
the script walked straight into `npm install`, which failed because npm did not
exist, and reported that instead of the real cause.

**Rule** - an installer for non-technical users asks for no privileges it
cannot obtain, and a step that can fail is followed by a check that it did not.
Node.js now comes from the official portable **.zip**, unpacked into
`_system\node\`: no admin, no UAC, no registry, nothing written outside the app
folder, and an existing system Node.js is left untouched and preferred.

**Rule (second)** - the machine that builds the release already has every
dependency, so it can never exercise the branch that installs them. Test the
install with the dependency hidden.

**Guard** - none automated (a real install takes three minutes and 30 MB).
Verified by hand: extract the ZIP, run `install-windows.ps1` from a shell whose
PATH has had every folder containing `node.exe` removed, and confirm
`_system\node\node.exe` appears, `npm install` completes, and the app serves
HTTP 200. Done 2026-09-23: 164 seconds, no prompts.

---

## ERR-020 - Launcher buttons ran edge to edge, touching both window sides

**Version:** broke in v1.10.44, with the HTA launcher itself · fixed in v1.10.69
**Reported by:** the maintainer, from a screenshot (2026-09-23)

**Symptom** - every button in the launcher window stretched from the far left
edge to the far right edge, with no margin at all, as if the stylesheet had
not loaded.

**Cause** - the buttons lived in `<main>`, styled `main { padding: 16px 24px }`.
`<main>` is the one HTML5 sectioning element Internet Explorer never
implemented - `<header>`, `<footer>`, `<section>` and `<nav>` all arrived in
IE9, `<main>` never did. Trident treats it as an unknown inline element, so
the padding was dropped and the full-width buttons sized against `<body>`. The
same markup is correct in every other browser, which is why it read as fine in
review.

**Rule** - the HTA renders in Trident, not in a modern browser. Use `<div>` for
layout containers there, and treat anything added to HTML after 2011 as absent
until proven otherwise on the real engine. Screenshot the window; do not read
the markup and assume.

**Guard** - none automated (nothing can drive `mshta` headlessly). Verified by
launching the packaged launcher in all three states and looking at each one.

---

## ERR-019 - "Update Now" and "Open GST Billing" did nothing at all, silently

**Version:** broke in v1.10.44, when the HTA launcher replaced the .bat installer · fixed in v1.10.69
**Reported by:** found while auditing the repo for stale install instructions (2026-09-23)

**Symptom** - three buttons inside the app did nothing when clicked. No error,
no window, no toast, no console message: **Settings → Check for Updates →
Update Now**, the **Update Now** button in the update-available dialog, and
**Open GST Billing** on the "server needs a quick start" screen.

**Cause** - all three were `<a href="freegstbill://…">` links. Those custom URL
protocols were registered in the Windows registry by the old
`Install FreeGSTBill.bat`. The HTA launcher replaced that installer in v1.10.44
and registers no protocol at all, so from that release on the links resolved to
nothing. A browser silently ignores an unregistered protocol - there is no
error to notice, which is why it survived 25 releases. The ⚙ Control Panel was
unaffected: it posts to `/api/control-panel/launch-script`, which works.

**Rule** - a click always produces a visible result: an action, or a message
saying why not. Anything a page hands to the operating system - a custom
protocol, a `mailto:`, a file association - can fail without telling anybody,
so it is never the only path to a feature the app depends on. Where the app
already has a server endpoint that does the job, use that.

**Rule (second)** - when an installer is replaced, every registry key, protocol
handler and shortcut the old one created is a dependency the new one silently
dropped. List them and re-home each one before the old installer stops
shipping.

**Guard** - `scripts/build-release-zip.mjs` `assertNoDeadProtocolLinks()` scans
the packaged `dist/` for `freegstbill:` and `freegstbill-update:` and refuses to
build a ZIP that still contains either. Verified red: re-adding the string to
`src/App.jsx` fails the build.

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
