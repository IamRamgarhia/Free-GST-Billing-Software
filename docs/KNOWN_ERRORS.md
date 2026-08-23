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
