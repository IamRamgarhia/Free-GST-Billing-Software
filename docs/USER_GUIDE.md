# Free GST Billing Software — User Guide

A plain-language guide for everyone who uses this app — no coding background
needed. If you only have 2 minutes, jump to [Quick Start](#quick-start).

> **TL;DR**
> 1. [Download the ZIP](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest/download/Free-GST-Billing.zip), **extract it**, and double-click **Free GST Billing - WINDOWS** once.
> 2. Click **Install Node & App**, then **Open App**. A desktop icon appears called *Free GST Billing*. Use it from then on.
> 3. Your data lives in the `_system\data\` folder inside the app folder. Back that folder up and you have backed up everything.

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

1. **Download the release ZIP** from
   <https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases/latest>
   and save it somewhere you'll remember (e.g. `Documents\FreeGSTBill`).

   > Use the **Releases** page, not the green *Code → Download ZIP* button.
   > The green button gives you the source code without the built app.

2. **Right-click the ZIP → Extract All.** This matters: everything the app
   needs sits next to the launcher, so the launcher has to be opened from the
   extracted folder, not from inside the ZIP. (If you double-click it while
   still browsing inside the ZIP, Windows copies only that one file to a temp
   folder and the launcher will tell you the `_system` folder is missing —
   even though you can plainly see it in the window behind. Extract first.)

3. **Open the extracted folder and double-click `Free GST Billing - WINDOWS`.**
   (Each launcher is named after the system it is for, so there is nothing to
   work out — Mac and Linux users pick theirs.)
   A small window opens with buttons. Click **Install Node & App**.
   - It installs Node.js for you if it is not already on your computer.
   - It installs the app's dependencies (one-time, takes ~2 minutes).
   - It creates a *Free GST Billing* shortcut on your Desktop and in the
     Start Menu.

4. **Click `Open App`.** Your browser opens straight to the app. From now on,
   just double-click the Desktop icon.

### Or, one command in PowerShell

If you are comfortable with a terminal, this does all of the above by itself.
It needs no admin rights and writes nothing outside your own user folder:

```powershell
irm https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/install.ps1 | iex
```

It installs to `%LOCALAPPDATA%\Programs\Free GST Billing`. To pick your own
folder, run `$env:FREEGSTBILL_DIR = 'D:\Apps\Free GST Billing'` first.

> **First-run wizard:** The first time you open the app, a 4-step wizard asks
> for your business name, country, bank details, and so on. Pick *India*,
> *Outside India*, or *Both* on the welcome screen — the rest of the form
> adapts to your choice.

### macOS / Linux users
The `.hta` launcher is Windows-only — use `Free GST Billing - MAC.command` or
`Free GST Billing - LINUX.sh` from the same ZIP, or run it from source:
```bash
git clone https://github.com/IamRamgarhia/Free-GST-Billing-Software.git
cd Free-GST-Billing-Software
npm install
npm start          # builds, then serves on http://localhost:47371
```
Open <http://localhost:47371> in your browser.

**Updating on Linux or a NAS.** If you installed from the release ZIP, use
*Control Panel → Update Now* (v1.10.66 and later). It backs up your data first,
downloads the latest release, and puts the previous version back if anything
fails. It needs `unzip` (or python3): `sudo apt install unzip` on Debian /
Ubuntu, `apk add unzip` on Alpine. Restart the app — or its container —
afterwards. If you installed with `git clone`, update with
`git pull && npm install && npm run build` instead.

**On a phone or tablet** the menu sits behind the ☰ button at the top left, so
pages get the whole screen.

---

<a id="first-invoice"></a>
## 3. Daily use — making your first invoice

1. Click **+ New Invoice** in the top bar.
2. Pick the invoice type (Tax Invoice / Proforma / Credit Note / Bill of
   Supply / Delivery Challan).
3. Type the client's name. If you've billed them before, you'll see their saved
   address and tax ID auto-suggested.
   - Typing the client's **GSTIN** fills in their **State** for you — the first
     two digits of a GSTIN are the state it is registered in. This works with
     no internet and no account anywhere.
   - If you mistype a digit, the app says so: every GSTIN carries a checksum
     over its own characters, so a wrong one is caught here instead of when
     your return is rejected. The state and city are never guessed — only the
     state is filled, because that is the only thing the number actually says.
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

1. **The `_system\data\` folder** inside the app folder. (Before v1.10.44 this
   was `data/` at the top level. The installer hides `_system`, so switch on
   *View → Hidden items* in Explorer to see it.) Contains:
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

Just copy the entire app folder somewhere safe. The `_system\data\` and `Saved
Invoices/` folders are the only thing that matters — `node_modules/` and
`dist/` can always be regenerated.

### Automatic Google Drive backup

In *Settings → Google Drive*, follow the wizard to connect your Google account
once. From then on, every PDF you generate is automatically uploaded to your
Drive in a folder of your choosing. Your `_system\data\` JSON files stay local
— only the PDFs go to Drive.

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
1. Install the app fresh (extract the ZIP, run `Free GST Billing - WINDOWS`, click
   **Install Node & App**).
2. Skip or fill in the welcome wizard — doesn't matter, the import will
   overwrite.
3. Go to **Settings → Import Data**, pick the `.json` file.
4. Done. All your bills, clients, inventory, settings are back.

> **Note:** Option A does *not* move the PDF files in `Saved Invoices/`. If
> you need those, copy that folder manually. Most users don't — the app can
> regenerate any PDF from the saved invoice data.

### Option B — Copy the data folder

On the **old** computer, copy these two folders to a USB drive:
- `_system\data\`
- `Saved Invoices/` (only if you want the PDF archive)

On the **new** computer:
1. Install the app fresh.
2. **Stop the server first** — open the launcher and click **Stop Server**
   (or just reboot).
3. Replace the new install's `_system\data\` folder with the copied one.
4. Restart the app.

### Option C — Keep the same files (advanced)

If you have OneDrive / Google Drive Desktop / Dropbox installed on both
computers, just put the entire app folder inside the
synced folder. Both machines now see the same `_system\data\` files. **Don't run the
app on both machines at the same time** — that can corrupt files.

---

<a id="faq"></a>
## 7. Common questions

**Q: Where exactly is my data?**
A: In the `_system\data\` folder inside where you installed the app. Plain
JSON files — you can open them in Notepad if you ever want to inspect them.
`_system` is hidden after install, so switch on *View → Hidden items*.

**Q: Is anything sent to the internet?**
A: Only if you turn on Google Drive backup, or click *Update* to fetch a new
version. Otherwise nothing leaves your computer.

**Q: I'm not GST-registered. Can I still use this?**
A: Yes. Pick *Bill of Supply* as the invoice type — no GST is charged. Or set
the GST rate to 0%. Or set Region Preference to *International*.

**Q: I run multiple businesses. Can I bill from different ones?**
A: Yes. Add each business in *Settings → Business Profiles*, then switch
between them from the picker at the top of the window.

Each business keeps its **own books**. The dashboard and its totals, reports,
GST returns, Income Tax, expenses, purchases, recurring invoices and payment
receipts all show only the business you have selected, so one company's figures
never turn up under another. Switching updates whichever screen you are on
straight away — no need to reload — and anything you add afterwards is saved
under the business you switched to.

Your **client list is shared** by all your businesses, because the same customer
often buys from more than one of them.

Businesses are matched on their **GST number**, so renaming a business does
not split its history in two.

**Q: I used the app before separating my businesses. Where did those records go?**
A: Nowhere — they are all still there. Anything saved before you began keeping
businesses apart has no business recorded against it, so it stays visible under
*every* business rather than being hidden from you.

When you open Expenses, Purchases, Recurring or Receipts, you will see a line such as
*"3 expenses are not assigned to a business"* with an **Assign to ‹business›**
button. Pressing it attaches those records to the business you currently have
selected, and they stop appearing under the others.

It is never done automatically, because only you know which business an old
record belonged to. Check the correct business is selected before assigning.

**Q: Can I use my own units (e.g. *Carat* for jewellery)?**
A: Yes. On any line item, click the Unit dropdown → *＋ Add custom…* and type
your unit name. It's saved on this device and shows up everywhere.

**Q: How do I cancel an invoice I already sent?**
A: Open *Bills*, find the invoice and press the red **Cancel invoice** button.
The invoice keeps its number and stays in the list marked *Cancelled*, prints
with **CANCELLED** across it, and stops counting in your totals, reports and GST
returns. Any stock on it is put back. Changed your mind? Pick another status
(for example *Unpaid*) from the status dropdown on that row.

Invoice numbers must run without gaps for GST, which is why a saved invoice is
cancelled rather than deleted.

**Q: I made a mistake on an invoice. Can I edit it?**
A: Yes. Open it from the *Bills* list and edit. Or, if you've already sent the
PDF, create a *Credit Note* against the original invoice number — the proper
GST way.

**Q: Why does it open in my browser instead of being a "real" app?**
A: It's a Progressive Web App. After the first launch, click *Install App*
in the address bar and Windows treats it like any other desktop app —
appears in Start Menu, has its own window, no browser chrome.

**Q: How do I update to a new version?**
A: In the app, **⚙ Control Panel → Update Now** — or **Update Software** in
the launcher. Either one backs your data up first, then fetches the latest
release. Your invoices, clients and settings are not touched.

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
- **"File came from another computer"** → right-click `Free GST Billing - WINDOWS`
  → **Properties** → tick **Unblock** at the bottom → OK
- **Antivirus quarantine** → add the project folder to your AV's exclusion
  list, then re-run the installer

The installer **does not** need admin rights, **does not** write to
Program Files or HKLM, and **does not** auto-download executables (we open
the nodejs.org page in your browser if Node.js is missing — you download
the signed MSI yourself).

Full source: <https://github.com/IamRamgarhia/Free-GST-Billing-Software>

### "Cannot connect to server" / blank page
The local server isn't running. Open the launcher (Desktop shortcut) and click
**Open App** — it starts the server if it is not already up. The shortcut
always opens the correct URL, so you never need to type a port number. If you
want to check which port the app is using, open `_system\data\port.txt` (it
usually says `47371`, but the server picks a free port automatically if that
one is in use).

### Installer says Node.js install failed
Install Node.js manually from <https://nodejs.org> (pick *LTS*), then open the
launcher again and click **Install App**.

### Update broke something
Your data folder is untouched, so your bills are safe — and the updater took a
backup to `Documents\FreeGSTBill Backups\` before it started. Either:
1. Run the update again — most updates self-heal on a second run.
2. Or download the previous version from the
   [Releases page](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases)
   and extract it over the app folder (your `_system\data\` is not in the ZIP,
   so it survives).

### The launcher says "`_system` folder is missing"
You opened `Free GST Billing - WINDOWS` while still looking **inside** the ZIP.
Windows unpacks just that one file to a temp folder and runs it there, so the
rest of the app really is missing — from the temp folder, not from your
download. Close the launcher, right-click the ZIP in your Downloads folder,
choose **Extract All**, and open the launcher from the extracted folder.

If you did extract it and still see this, the extraction stopped early (a
partial download, or antivirus removing files mid-extract). Download the ZIP
again and re-extract. From v1.10.69 the launcher prints the folder it is
actually looking in, which tells the two cases apart at a glance.

### I see "GST" labels but I'm in the UAE / UK / US
You're on the *India only* region preference. Switch in *Settings → Region
Preference* to *International* or *Both*.

### Foreign client invoice shows wrong tax split (CGST + SGST)
Set the **client's country** in the client form. From v1.10.66 a client whose
country is outside India is treated as an export, so any tax charged is shown as
IGST. Leave *Place of Supply* on "Defaults to Client State" — picking an Indian
state there means the goods are supplied in India, and that state is used
instead. The invoice currency does not change the tax split. Invoices saved
before v1.10.66 keep the split they were issued with.

In *GST Returns* these invoices count as zero-rated exports in GSTR-3B 3.1(b).
They are not put in the GSTR-1 file: add them in Table 6A on the GST portal with
the shipping bill details — a red notice at the top of GST Returns lists them.

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
