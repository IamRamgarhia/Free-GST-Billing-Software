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
