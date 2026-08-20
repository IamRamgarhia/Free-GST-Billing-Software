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

### Something went wrong?
Open an issue with a screenshot of the error:
https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues
```

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

# 3. Build
npm run release:zip

# 4. Publish (see ERR-003 in KNOWN_ERRORS.md — one tagged release per
#    version; do not re-upload an asset onto a previous tag)
gh release create v<NEW> "release-build/Free-GST-Billing-v<NEW>.zip" \
  --target main --title "v<NEW> — <short user-facing summary>" \
  --notes-file <notes>

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
- [ ] `npm run release:zip` succeeded (this also runs the ASCII guard from
      ERR-001)
- [ ] `releases/latest` verified to return the new tag **and** new asset
- [ ] Reply posted to whoever reported it
