# Release Checklist

Users of this app are **not developers**. They are shop owners and
accountants who will read the release note once, on a phone, and decide
whether to act. A release note that only lists what changed is useless to
them — it must also tell them **what to do**.

**Rule: every user-facing release note carries a "How to update" section.
No exceptions, including hotfixes and one-line patches.**

"User-facing" means both places a user can land:

1. `CHANGELOG.md` in the repo
2. The **GitHub Release** body (this is the one most users actually see —
   it is what the Releases page and the download link show)

Both get the same "How to update" block. Do not write it in one and skip
the other.

---

## The mandatory "How to update" block

Copy this into every release. Fill in the parts in `<angle brackets>`,
delete the lines that do not apply — but never delete the section.

```markdown
## How to update

**Current version:** <OLD>  →  **New version:** <NEW>

### If the in-app Update button works for you
1. Open the Free GST Billing launcher.
2. Click **Update**.
3. Wait for "Update complete", then click **Stop Server**, then **Open App**.

That is all — your data is not touched.

### If the Update button does not work (or you are unsure)
1. Download `Free-GST-Billing-v<NEW>.zip` from the Assets section below.
2. Close the app completely (click **Stop Server** first if it is running).
3. Extract the ZIP over your existing Free GST Billing folder, replacing
   files when Windows asks.
4. Double-click the launcher again.

### Is my data safe?
Yes. Invoices, clients, products and settings live in `_system/data/`,
which an update never touches. The updater also takes an automatic backup
to `Documents\FreeGSTBill Backups\` before it changes anything.

### Installed the Linux .deb, the AppImage or Docker?
The Update button does not apply to those. Download the new file from the
table below and install it like the first time (.deb: double-click it, or
`sudo apt install ./free-gst-billing_<NEW>_amd64.deb`; AppImage: use the
new file instead of the old one). Your books in
`~/.local/share/free-gst-billing-data` are kept.

### Something went wrong?
Open an issue with a screenshot of the error:
https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues
```

### The download table (every release, under the How to update block)

```markdown
## Downloads

| Your computer | Download this |
|---|---|
| Windows | `Free-GST-Billing-Windows-Setup.exe` |
| Mac | `Free-GST-Billing.zip` (same as always) |
| Linux: Ubuntu, Linux Mint, Debian | `free-gst-billing_<NEW>_amd64.deb` |
| Linux: any other (64-bit) | `Free-GST-Billing-Linux-x86_64.AppImage` |
| NAS / home server (Docker) | coming 14 Nov, with safe access from other PCs |

How to install each: https://dicecodes.com/free-gst-software-documentation/install-linux.html
```

Never upload a second `.zip`: the in-app updater on Windows takes the
first `.zip` on the release. The Linux files are `.deb` / `.AppImage` /
`.yml` on purpose.

### When a release BREAKS the updater

If the bug being fixed is in the updater itself, the in-app path cannot
save the user — say so at the very top, in bold, before anything else:

> ⚠️ **The Update button cannot fix this** — the updater is the broken
> component. Please download the ZIP below manually, this one time.

---

## Writing the rest of the note

Write for the person who reported it, not for the compiler.

- **Lead with the symptom the user saw**, in their words. They recognise
  "Print button did nothing", not "TDZ ReferenceError in buildPDF".
- **Credit the reporter** by @handle. It is why people report at all.
- **Say which buttons/screens are affected.** A user cannot map
  `start-windows.ps1` to "Open App" — do it for them.
- Keep the technical root cause, but put it **below** the user-facing
  part, not above it.

---

## Publish steps

```bash
# 1. Bump the version
#    package.json "version" is the single source of truth.

# 2. Write CHANGELOG.md — including the How to update block above.

# 3. Build (release:zip empties release-build/, so it goes first)
npm run release:zip
npm run release:linux      # .deb, AppImage, docker-compose.yml + local image
npm run test:linux         # installs and runs each one in clean containers

# 4. Publish ONE ZIP, under the fixed name (from v1.10.76: two identical
#    ZIPs on a release confused people). The README's Download button links
#    to releases/latest/download/Free-GST-Billing.zip, which only resolves if
#    the latest release has a file of exactly that name. The in-app and
#    launcher updaters take the first *.zip, so the name does not matter to
#    them. See ERR-003: one tagged release per version.
cp "release-build/Free-GST-Billing-v<NEW>.zip" "release-build/Free-GST-Billing.zip"
gh release create v<NEW> "release-build/Free-GST-Billing.zip" \
  "release-build/free-gst-billing_<NEW>_amd64.deb" \
  "release-build/Free-GST-Billing-Linux-x86_64.AppImage" \
  --target main --title "v<NEW> — <short user-facing summary>" \
  --notes-file <notes>
curl -sIL -o /dev/null -w "%{http_code}\n" \
  https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing.zip

# 4b. The Windows Setup (docs/WINDOWS_SETUP.md), on the same release, under
#     exactly this name: an installed copy's Update now downloads
#     releases/latest/download/Free-GST-Billing-Windows-Setup.exe.
npm run release:exe
gh release upload v<NEW> "release-build/Free-GST-Billing-Windows-Setup.exe"

# 5. Verify what the in-app updater will actually see
gh api repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest \
  --jq '{tag: .tag_name, asset: .assets[0].name}'
```

The tag and the asset filename must **both** match the new version. The
updater shows the user `tag_name`, so a mismatch means every user is told
the wrong version number.

---

## Before you publish

- [ ] `package.json` version bumped
- [ ] `CHANGELOG.md` entry written, **with** the How to update block
- [ ] GitHub Release body has the **same** How to update block
- [ ] Reporter credited by @handle
- [ ] Affected buttons/screens named in plain language
- [ ] If the updater itself was broken — the ⚠️ manual-download warning is
      at the top
- [ ] `npm run release:zip` succeeded. It runs `npm run lint` (0 errors) and
      the unit tests first, and stops if either fails. It also refuses to hand you a ZIP
      unless that ZIP **extracts, installs, boots and passes the full smoke
      suite** (see `scripts/verify-release.mjs`). A failing build deletes
      the ZIP rather than leaving something shippable lying about.
      It also runs the ASCII guard (ERR-001), the server import-graph
      check (ERR-009), and refuses a ZIP with `\` paths or CRLF shell
      scripts (ERR-014).
- [ ] If `update-unix.sh`, the ZIP layout or any Unix launcher changed:
      `npm run test:update-unix` passes. It runs the Linux / NAS updater in
      real Alpine and Debian containers (needs Docker, ERR-014).
- [ ] `releases/latest` verified to return the new tag **and** new asset
- [ ] Exactly ONE asset, `Free-GST-Billing.zip`, and the README Download button returns 200
- [ ] Reply posted to whoever reported it
