# Free GST Billing Software — User Guide

A plain-language guide for everyone who uses this app — no coding background
needed. If you only have 2 minutes, jump to [Quick Start](#quick-start).

> **TL;DR**
> 1. Double-click **Install FreeGSTBill.bat** once. That's it — installer handles the rest.
> 2. A desktop icon appears called *Free GST Billing Software*. Use it to open the app.
> 3. Your data lives in the `data/` folder next to the app. Back that folder up and you've backed up everything.

---

## Table of Contents

1. [What is this?](#what-is-this)
2. [Quick Start (Windows)](#quick-start)
3. [Daily use — making your first invoice](#first-invoice)
4. [India users vs International users](#india-vs-international)
5. [Backing up your data](#backup)
6. [Moving to a new computer](#migrate)
7. [Common questions (FAQ)](#faq)
8. [Troubleshooting](#troubleshooting)
9. [For developers](#developers)

---

<a id="what-is-this"></a>
## 1. What is this?

A free billing & invoicing app you run on your own computer. It works without
internet, your data stays on your machine, and there is no monthly fee — ever.

**It can do:**
- Create tax invoices, quotations / proforma invoices, credit notes, bills of
  supply, and delivery challans.
- Calculate GST automatically (CGST + SGST or IGST) for India, or VAT / SST /
  TVA / MwSt / Sales Tax for 21 other countries.
- Generate professional PDFs, share over WhatsApp, email, or upload to Google
  Drive.
- Track inventory with units (kg, ltr, mtr, hrs, pcs, …), payments received,
  recurring invoices, expenses, and purchase bills.
- Export GSTR-1 / GSTR-3B CSVs for the Indian GST portal and E-Way Bill JSON
  for the NIC portal.

**It will not:**
- Send your data anywhere. There's no signup, no cloud sync (unless you
  explicitly turn on Google Drive backup), no analytics.
- Charge you. There is no paid tier.

---

<a id="quick-start"></a>
## 2. Quick Start (Windows)

### If you've never installed Node.js before — that's fine.

1. **Download** the project as a ZIP from
   <https://github.com/IamRamgarhia/Free-GST-Billing-Software> (green *Code*
   button → *Download ZIP*) and unzip it somewhere you'll remember (e.g.
   `Documents\FreeGSTBill`).

2. **Double-click `Install FreeGSTBill.bat`.** That's it.
   - It installs Node.js for you if it isn't already on your computer.
   - It installs the app's dependencies (one-time, takes ~2 minutes).
   - It builds the app.
   - It creates a *Free GST Billing Software* shortcut on your Desktop and in
     the Start Menu.
   - It sets the server to start automatically when you log in to Windows.

3. **From now on, just double-click the Desktop icon.** Your browser opens
   straight to the app.

> **First-run wizard:** The first time you open the app, a 4-step wizard asks
> for your business name, country, bank details, and so on. Pick *India*,
> *Outside India*, or *Both* on the welcome screen — the rest of the form
> adapts to your choice.

### macOS / Linux users
The `.bat` files are Windows-only, but the app itself works on any OS:
```bash
git clone https://github.com/IamRamgarhia/Free-GST-Billing-Software.git
cd Free-GST-Billing-Software
npm install
npm start          # builds, then serves on http://localhost:47371
```
Open <http://localhost:47371> in your browser.

---

<a id="first-invoice"></a>
## 3. Daily use — making your first invoice

1. Click **+ New Invoice** in the top bar.
2. Pick the invoice type (Tax Invoice / Proforma / Credit Note / Bill of
   Supply / Delivery Challan).
3. Type the client's name. If you've billed them before, you'll see their saved
   address and tax ID auto-suggested.
4. Add line items. For each row:
   - **Description** — what you sold or did.
   - **Qty** — how much.
   - **Unit** — kg, ltr, mtr, ft, hrs, pcs, … or pick *＋ Add custom…* to
     create your own (e.g. *Bundle*, *Carat*).
   - **Rate** — price per unit.
   - **Tax %** — pick from your country's standard rates, or *Custom…* for
     anything else.
5. Click **Download PDF** to save and share. The invoice gets a unique number
   (configurable in Settings → Invoice Number Format).

### Did the app save it?
Look at the top-left status badge:
- **"Draft only — not saved yet"** → you've started a new invoice but haven't
  added a real client + item yet. Nothing is saved to your bills list.
- **"Saving…"** → changes being persisted now.
- **"All changes saved"** → safe to close.

If you click **Back** while changes are unsaved, you'll see a confirmation —
choose *OK* to save and exit, or *Cancel* to keep editing.

---

<a id="india-vs-international"></a>
## 4. India users vs International users

The app has a **Region Preference** in *Settings → Region Preference*:

| Mode | Use this if you… |
|---|---|
| 🇮🇳 **India only** | Bill Indian clients only. CGST/SGST/IGST split, GSTR-1/3B export, UPI QR codes, E-Way Bill, HSN/SAC codes — all enabled. |
| 🌍 **International** | Bill clients outside India only. Tax labels become VAT / SST / TVA / MwSt / Sales Tax based on the country. Currency picker shows USD, EUR, GBP, AED, etc. |
| 🌐 **Both / Auto** | Bill mixed clients. Default. All 22 supported countries available; the app automatically uses the right tax label for each invoice. |

You can switch any time without losing data. Existing invoices keep whatever
tax label they had when you created them.

---

<a id="backup"></a>
## 5. Backing up your data

**Everything you create is stored in two places:**

1. **The `data/` folder** next to the app. Contains:
   - `bills.json` — every invoice
   - `clients.json` — your client list
   - `products.json` — your inventory
   - `profiles.json` — business profile(s)
   - `expenses.json`, `purchases.json`, `receipts.json`, `recurring.json`,
     `templates.json`, `meta.json`

2. **The `Saved Invoices/` folder** — PDF copies of every invoice you've
   downloaded, organised by client and month.

### The easy way (recommended for non-tech users)

Inside the app: **Settings → Export Data** writes a single `.json` file with
*everything* (bills, clients, inventory, settings). Save that file to a USB
drive, Google Drive, OneDrive, or wherever you like.

To restore: **Settings → Import Data** reads the file back.

> **Tip:** Do this monthly. Keep at least the last 2 backup files in case one
> gets corrupted.

### The manual way (techies)

Just copy the entire app folder somewhere safe. The `data/` and `Saved
Invoices/` folders are the only thing that matters — `node_modules/` and
`dist/` can always be regenerated.

### Automatic Google Drive backup

In *Settings → Google Drive*, follow the wizard to connect your Google account
once. From then on, every PDF you generate is automatically uploaded to your
Drive in a folder of your choosing. Your `data/` JSON files stay local — only
the PDFs go to Drive.

---

<a id="migrate"></a>
## 6. Moving to a new computer

You have three good options. Pick whichever fits.

### Option A — One-file export / import (easiest)

On the **old** computer:
1. Open the app.
2. Go to **Settings → Export Data**. Save the resulting `.json` file
   somewhere portable (USB drive, email to yourself, Google Drive).

On the **new** computer:
1. Install the app fresh (run `Install FreeGSTBill.bat`).
2. Skip or fill in the welcome wizard — doesn't matter, the import will
   overwrite.
3. Go to **Settings → Import Data**, pick the `.json` file.
4. Done. All your bills, clients, inventory, settings are back.

> **Note:** Option A does *not* move the PDF files in `Saved Invoices/`. If
> you need those, copy that folder manually. Most users don't — the app can
> regenerate any PDF from the saved invoice data.

### Option B — Copy the data folder

On the **old** computer, copy these two folders to a USB drive:
- `data/`
- `Saved Invoices/` (only if you want the PDF archive)

On the **new** computer:
1. Install the app fresh.
2. **Stop the server first** (close the app, then run *Stop FreeGSTBill.bat*
   if it's running in the background — or just reboot).
3. Replace the new install's `data/` folder with the copied one.
4. Restart the app.

### Option C — Keep the same files (advanced)

If you have OneDrive / Google Drive Desktop / Dropbox installed on both
computers, just put the entire `Free-GST-Billing-Software` folder inside the
synced folder. Both machines now see the same `data/` files. **Don't run the
app on both machines at the same time** — that can corrupt files.

---

<a id="faq"></a>
## 7. Common questions

**Q: Where exactly is my data?**
A: In the `data/` folder next to where you installed the app. Plain JSON
files — you can open them in Notepad if you ever want to inspect them.

**Q: Is anything sent to the internet?**
A: Only if you turn on Google Drive backup, or click *Update* to fetch a new
version. Otherwise nothing leaves your computer.

**Q: I'm not GST-registered. Can I still use this?**
A: Yes. Pick *Bill of Supply* as the invoice type — no GST is charged. Or set
the GST rate to 0%. Or set Region Preference to *International*.

**Q: I run multiple businesses. Can I bill from different ones?**
A: Yes. Add each business in *Settings → Business Profiles*. A profile picker
appears at the top of every new invoice.

**Q: Can I use my own units (e.g. *Carat* for jewellery)?**
A: Yes. On any line item, click the Unit dropdown → *＋ Add custom…* and type
your unit name. It's saved on this device and shows up everywhere.

**Q: I made a mistake on an invoice. Can I edit it?**
A: Yes. Open it from the *Bills* list and edit. Or, if you've already sent the
PDF, create a *Credit Note* against the original invoice number — the proper
GST way.

**Q: Why does it open in my browser instead of being a "real" app?**
A: It's a Progressive Web App. After the first launch, click *Install App*
in the address bar and Windows treats it like any other desktop app —
appears in Start Menu, has its own window, no browser chrome.

**Q: How do I update to a new version?**
A: Run *Update FreeGSTBill.bat*. It pulls the latest from GitHub without
touching your `data/` folder.

**Q: I want a feature that's missing.**
A: Open an issue at
<https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues> — many
features in this app started as community requests (the per-line *unit*
feature came from a user named Apurba, for example).

---

<a id="troubleshooting"></a>
## 8. Troubleshooting

### Windows shows "Windows protected your PC" or my antivirus blocked the installer

This is normal for free open-source apps that aren't code-signed. The
installer is plain text — you can open it in Notepad and read every line
before running. To proceed:

- **SmartScreen blue screen** → click **More info** → **Run anyway**
- **"File came from another computer"** → right-click `Install
  FreeGSTBill.bat` → **Properties** → tick **Unblock** at the bottom → OK
- **Antivirus quarantine** → add the project folder to your AV's exclusion
  list, then re-run the installer

The installer **does not** need admin rights, **does not** write to
Program Files or HKLM, and **does not** auto-download executables (we open
the nodejs.org page in your browser if Node.js is missing — you download
the signed MSI yourself).

Full source: <https://github.com/IamRamgarhia/Free-GST-Billing-Software>

### "Cannot connect to server" / blank page
The local server isn't running. Run *Start FreeGSTBill.bat* again, or reboot
(the server is set to auto-start on login). The Desktop shortcut always
opens the correct URL automatically — you never need to type a port number.
If you want to check which port the app is using, open `data/port.txt` next
to the install folder (it usually says `47371`, but the server picks a free
port automatically if that one is in use).

### Installer says Node.js install failed
Install Node.js manually from <https://nodejs.org> (pick *LTS*), then run
*Install FreeGSTBill.bat* again.

### Update broke something
The previous `data/` folder is untouched, so your bills are safe. Either:
1. Run *Update FreeGSTBill.bat* again — most updates self-heal on second run.
2. Or restore the previous version from Git:
   `git -C "<path-to-app>" checkout v1.2.0` (replace with the version you want).

### I see "GST" labels but I'm in the UAE / UK / US
You're on the *India only* region preference. Switch in *Settings → Region
Preference* to *International* or *Both*.

### Foreign client invoice shows wrong tax split (CGST + SGST)
Make sure the **client's country** is set correctly in the client form. The
app uses the *seller's* country for tax labels and the *client's* country for
place-of-supply detection.

---

<a id="developers"></a>
## 9. For developers

The code is React 19 + Vite 7 on the frontend, Express 5 on the backend, all
in JavaScript (no TypeScript). Persistence is plain JSON files in `data/`.

```bash
git clone https://github.com/IamRamgarhia/Free-GST-Billing-Software.git
cd Free-GST-Billing-Software
npm install
npm run dev        # starts both Express server + Vite dev server
npm run lint       # ESLint
npm run build      # production build → dist/
```

Key files:
- `src/components/InvoiceGenerator.jsx` — the invoice form
- `src/components/InvoicePreview.jsx` — the PDF / on-screen preview template
- `src/utils.js` — `COUNTRIES`, units, validation helpers, GST exports
- `server.js` — REST API surface, file persistence
- `src/store.js` — frontend wrapper around the API

PRs welcome. The project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — see
[CHANGELOG.md](./CHANGELOG.md).

---

## Need help?

- File an issue: <https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues>
- Email DiceCodes: contact@dicecodes.com
