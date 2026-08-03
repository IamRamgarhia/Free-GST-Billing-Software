<div align="center">

# Free GST Billing Software — 100% Free, No Subscription, No Limits

### The only GST invoicing software you'll never have to pay for.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#quick-start--installation)
[![Version](https://img.shields.io/badge/Version-1.10.42-orange.svg)](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases)
[![PWA](https://img.shields.io/badge/PWA-installable-purple.svg)](#install-as-a-desktop-app-pwa)
[![GitHub Stars](https://img.shields.io/github/stars/IamRamgarhia/Free-GST-Billing-Software?style=social)](https://github.com/IamRamgarhia/Free-GST-Billing-Software)
[![Countries](https://img.shields.io/badge/Countries-22-blue.svg)](#key-features)
[![GST](https://img.shields.io/badge/GST-Compliant-success.svg)](#clipboard-gst-compliance--filing)

**Create GST-compliant invoices, file GSTR-1 / GSTR-3B / GSTR-2B reconciliation, track TDS / TCS, bill international clients in 22 currencies, manage inventory — all without paying a single rupee. Ever.**

Your data never leaves your computer. No cloud. No signup. No tracking. No limits. Open-source and offline-first.

[⬇ Download ZIP](https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip) &nbsp;|&nbsp; [📦 Releases](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases) &nbsp;|&nbsp; [⚡ 3-Step Install](#quick-start--installation) &nbsp;|&nbsp; [🧾 First Invoice in 5 Minutes](#your-first-invoice-in-5-minutes) &nbsp;|&nbsp; [📸 Screenshots](#screenshots) &nbsp;|&nbsp; [🐛 Report Bug](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)

</div>

---

## ⚡ Install in 60 Seconds (Windows one-click)

The fastest way to get billing on your PC — no coding, no cloud, no signup.

```
1. Download → https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip
2. Right-click the ZIP → Extract All → pick a folder you'll remember
3. Double-click  Install FreeGSTBill.bat
```

The installer auto-installs Node.js if missing, sets up the app, and opens it at **http://localhost:47371** — a **Desktop shortcut** and **Start-Menu entry** are created for you. From then on, just click the shortcut.

> **Mac / Linux user?** Jump to [Option 2 → Developer Setup](#option-2-developer-setup) below — one `npm install && npm start` and you're done.

---

## Screenshots

<div align="center">

![Free GST Billing Software dashboard — invoices list with overdue tracking, multi-currency totals, and per-status badges](docs/screenshots/dashboard.png)

*Dashboard view — recent invoices, currency-aware revenue cards, overdue alerts, low-stock indicators, and one-click actions.*

</div>

> 📸 **Want more screenshots?** Open an issue and we'll add captures of the New Invoice form, GSTR-2B Reconciliation tab, Multi-Account Payments manager, and the in-app Searchable User Guide. PRs welcome too.

---

## 📑 Table of Contents

- [Install in 60 Seconds](#-install-in-60-seconds-windows-one-click) — *Windows one-click*
- [Why Choose Free GST Billing Software?](#why-choose-free-gst-billing-software)
- [Your First Invoice in 5 Minutes](#your-first-invoice-in-5-minutes) — *start here if you're new*
- [Key Features](#key-features)
  - [Invoicing & Billing](#receipt-invoicing--billing)
  - [GST Compliance & Filing](#clipboard-gst-compliance--filing)
  - [Business Management](#briefcase-business-management)
  - [Reports & Analytics](#bar_chart-reports--analytics)
  - [Sharing & Export](#outbox_tray-sharing--export)
  - [Customization](#gear-customization)
- [Quick Start / Installation](#quick-start--installation)
- [Install as a Desktop App (PWA)](#install-as-a-desktop-app-pwa)
- [How to Self-File GST Returns](#how-to-self-file-gst-returns)
- [Free GST Billing Software vs Paid Alternatives](#-comparison-free-gst-billing-software-vs-paid-alternatives)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)
- [Documentation](#books-documentation)
- [Who Is This For?](#who-is-this-for)
- [Why Is This Free?](#why-is-this-free)
- [Data Privacy & Security](#data-privacy--security)
- [Contributing](#contributing)
- [Contact & Support](#contact--support)

---

## Your First Invoice in 5 Minutes

A step-by-step guide for the *very first* invoice you create after installing. Targeted at users who've never used billing software before.

### Before you start
You need: Windows 10/11 PC, ~50 MB free disk, your business name + bank details (optional, can be added later). **No coding knowledge required.** No internet needed after install.

### Step 1 — Install (1 minute)

1. Download the project as a ZIP from <https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip>
2. Right-click the downloaded ZIP → **Extract All** → pick a folder you'll remember (e.g. `Documents\FreeGSTBill`)
3. Open that folder → **double-click `Install FreeGSTBill.bat`**
4. Let it run — it installs Node.js automatically if you don't have it, then sets everything up. Takes 1–2 minutes the first time
5. The app opens in your browser at `http://localhost:47371` when done

> 💡 **Tip:** Click the small **Install App** icon in your browser's address bar to make the app open in its own window like Tally or Word — no browser chrome, looks and feels native.

### Step 2 — Set up your business profile (1 minute)

The Welcome Wizard appears automatically on first launch.

1. **Welcome screen** → pick your region:
   - 🇮🇳 **India only** — enables GST, GSTR-1/3B, UPI QR, E-Way Bill
   - 🌍 **Outside India** — enables VAT / SST / MwSt / TVA labels for 21 other countries
   - 🌐 **Both** — keeps everything visible (default)
2. **Business Details** → fill in your business name and address. Add GSTIN if you have one (leave blank if not GST-registered). PAN is optional.
3. **Bank & UPI** → add one bank account + your UPI ID so clients can pay you. You can add more accounts later from Settings → Payment Accounts.
4. Click **Done** → you land on the empty Dashboard

### Step 3 — Create your first invoice (2 minutes)

1. Click **+ New Invoice** in the sidebar
2. Pick the invoice type: **Tax Invoice** for GST-registered sales, **Bill of Supply** for exempt goods, **Proforma** for quotes, **Delivery Challan** for goods movement
3. Pick **📦 Goods** or **⏱ Services** at the top — this drives the default unit (Nos for goods, Hrs for services)
4. Type the client's name in the **Bill To** field. If you've billed them before they auto-suggest. Otherwise click **+ Save as new client** and fill the modal.
5. Add line items in the table:
   - **Description** — what you sold/did
   - **Qty** — how much
   - **Unit** — pick from the dropdown (Nos/Kg/Ltr for goods; Hrs/Day/Session for services). Click **＋ Add custom…** for things like *Carat* / *Bundle*
   - **Rate** — price per unit
   - **Tax %** — picks from your country's standard rates (5/12/18/28% for India; 5% for UAE; etc.)
6. Click **Download PDF** in the top-right

That's it. The PDF saves to `Saved Invoices/<Client Name>/<Month>/` and the invoice is logged in your bills list with a unique number.

### Step 4 — Send to your client (1 minute)

After clicking Download PDF you get three sharing options inline:

- 📱 **WhatsApp** — opens WhatsApp Web/Desktop with the PDF link prefilled to the client's number
- 📧 **Email** — opens your default mail app with the invoice summary
- ☁ **Google Drive** — auto-uploads (optional, requires you to configure your Google Client ID once in Settings)

### Step 5 — Track payment (whenever)

Open the Dashboard. The invoice shows in the list with a status badge.

- Click the **💰** icon to record a payment (full or partial) — date, mode, note
- The status updates automatically (`unpaid` → `partial` → `paid`)
- Overdue invoices get a red row + days-overdue counter automatically once the due date passes
- Use the **🔔 Notifications** bell in the sidebar to see overdue invoices and upcoming GST filing deadlines

### What to do next

Once you're comfortable with the basics, explore:

- **Recurring invoices** — tick "🔁 Make this recurring" in the Customize panel of any invoice. The app auto-generates it monthly/weekly/yearly on your chosen date.
- **Multi-currency** — billing an overseas client? Open Customize → Currency → USD/EUR/GBP/AED/etc. The PDF renders the right symbol, locale formatting, and amount-in-words.
- **GST Returns** — sidebar → GST Returns. Filter by month/quarter/FY, click **JSON Export** to download GSTR-1 / GSTR-3B ready for the GST portal offline tool.
- **GSTR-2B Reconciliation** — download your 2B JSON from gst.gov.in, click Import in our 2B tab — we auto-match against your purchase records and flag mismatches.
- **TDS / TCS** — Customize → tick TDS or TCS, pick a section (194Q / 206C(1H) / etc.). The Reports view aggregates these for Form 26Q / 27EQ filing.

📖 **Full walkthrough** — see [docs/USER_GUIDE.md](docs/USER_GUIDE.md) or the in-app **User Guide** view (searchable, includes PDF download).

---

## Why Choose Free GST Billing Software?

Most billing software in India — Zoho Invoice, Vyapar, Tally, myBillBook — charges you monthly, stores your financial data on their servers, and locks you in. **Free GST Billing Software is the open-source alternative that changes everything.**

- **Completely free** — no subscription, no premium tier, no hidden charges, no "free trial" that expires
- **100% offline** — runs on localhost, works without internet after installation
- **Your data stays on YOUR computer** — invoices, GSTIN, bank details, client records stored as local JSON files. No cloud, no third-party servers
- **GST compliant** — auto-calculates CGST/SGST/IGST, generates GSTR-1 & GSTR-3B data, exports JSON for GST portal upload
- **Self-file your GST returns** — built-in step-by-step filing guide so you don't need a CA for basic filing
- **Install once, use forever** — MIT licensed, open-source, community-driven

> **If you're paying for billing software, you can stop now.**

### 📊 Comparison: Free GST Billing Software vs Paid Alternatives

Every 🆕 row below is a feature we shipped in v1.10 that competitors either paywall, cripple in the free tier, or don't offer at all.

| Feature | **Free GST Billing Software** | Tally Prime | Vyapar | Zoho Books | ClearTax GST |
|---|---|---|---|---|---|
| **Price** | ✅ **Free forever** | ₹22,500–₹67,500 one-time | ₹2,599+/year | ₹899–₹2,999/month | ~₹3,599/year+ |
| **GST invoices (CGST/SGST/IGST)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| 🆕 **UTGST for intra-UT supplies** | ✅ Auto-detected | ⚠ Manual | ❌ | ⚠ Manual | ⚠ Manual |
| **GSTR-1 / GSTR-3B JSON export** | ✅ | ✅ (paid tier) | ⚠ CSV only | ✅ (Standard+) | ✅ |
| **GSTR-2B reconciliation** | ✅ | ✅ (paid tier) | ❌ | ✅ (Premium) | ✅ |
| **E-Way Bill JSON** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **TDS / TCS on invoices** | ✅ Form 26Q / 27EQ-ready | ✅ | ❌ | ✅ | ✅ |
| 🆕 **TCS on right base + ₹50L threshold** | ✅ Auto (Circular 17/2020) | ⚠ Manual | ❌ | ⚠ Manual | ⚠ Manual |
| 🆕 **Income Tax (ITR) with 234B/C interest** | ✅ Free | ❌ | ❌ | ⚠ CA add-on | ✅ (separate product) |
| **Multi-business / multi-GSTIN** | ✅ Unlimited | ✅ (Gold tier) | ⚠ Silver tier | ✅ (Premium) | ✅ |
| **Multi-account payments per business** | ✅ Unlimited | ✅ | ⚠ Paid | ✅ | ✅ |
| **Custom per-line units (kg, ltr, Hrs + custom)** | ✅ | ⚠ Limited | ⚠ Paid | ✅ | ⚠ Limited |
| **22-country multi-currency** | ✅ | ⚠ Paid | ❌ | ✅ (Premium) | ❌ |
| **PWA installable (own window, no browser)** | ✅ | ❌ Desktop only | ❌ Android-first | ❌ Web only | ❌ Web only |
| **Offline-first (works without internet)** | ✅ | ✅ | ⚠ Limited | ❌ Cloud | ❌ Cloud |
| **Your data on YOUR computer (no cloud)** | ✅ | ✅ | ⚠ Cloud sync | ❌ Cloud | ❌ Cloud |
| **Open-source (MIT licensed)** | ✅ | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary |
| **No signup / no email collected** | ✅ | ✅ | ❌ Phone+OTP | ❌ Email login | ❌ Email login |
| **Recurring invoices auto-generation** | ✅ | ✅ | ⚠ Paid | ✅ | ⚠ |
| 🆕 **9 one-click design presets (Modern / Corporate / Retail Brand / …)** | ✅ | ❌ | ⚠ 2-3 templates (paid tier) | ⚠ Paid | ❌ |
| 🆕 **Split-view live preview (settings + preview side-by-side)** | ✅ | ❌ | ❌ | ⚠ Small preview | ❌ |
| 🆕 **User-configurable PDF colours (accent, header, text, divider)** | ✅ Every colour | ❌ | ❌ | ⚠ Accent only (paid) | ❌ |
| 🆕 **Print margins (mm) — top/bottom/left/right** | ✅ | ⚠ Paid tier | ❌ | ⚠ Paid | ❌ |
| 🆕 **Multi-language section labels (English/Hindi/Tamil/Marathi/Bengali)** | ✅ Free | ⚠ Paid | ❌ | ❌ | ❌ |
| 🆕 **Multi-page Rule 48 (Original/Duplicate/Triplicate) — rows never cut** | ✅ | ✅ | ⚠ Paid Gold | ⚠ Paid | ⚠ Paid |
| 🆕 **Watermark (DUPLICATE / DRAFT / custom) on PDF** | ✅ | ⚠ Paid | ⚠ Paid Silver | ✅ | ⚠ Paid |
| 🆕 **Auto-print payment receipt (with view/edit/delete history)** | ✅ | ⚠ Paid | ⚠ Paid | ⚠ Paid | ⚠ Paid |
| 🆕 **Bulk PDF export with progress + cancel** | ✅ Free | ⚠ Paid | ❌ | ⚠ Paid | ⚠ Paid |
| 🆕 **Ctrl+K command palette (search invoices/clients/products)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🆕 **Notification bell (overdue + low stock + filings + updates)** | ✅ | ⚠ Basic | ⚠ Paid | ✅ | ⚠ |
| 🆕 **Automatic daily backup + Trash bin (30-day retention)** | ✅ Free | ⚠ Manual export | ⚠ Paid cloud-sync | ✅ Cloud-only | ✅ Cloud-only |
| 🆕 **Transactional restore (rollback on error)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🆕 **Setup wizard with 6 business-type presets** | ✅ | ❌ | ⚠ Basic | ⚠ Basic | ⚠ Basic |
| 🆕 **In-app searchable user guide** | ✅ | ❌ External PDF | ❌ External | ❌ External | ❌ External |
| 🆕 **Barcode + QR of invoice number on PDF** | ✅ Every invoice | ⚠ Paid | ⚠ Paid | ❌ | ❌ |
| 🆕 **Feedback QR (Google Reviews link) on PDF** | ✅ | ❌ | ❌ | ❌ | ❌ |
| 🆕 **Google Drive backup + PDF upload (opt-in)** | ✅ Free (your OAuth) | ❌ | ⚠ Paid | ✅ (Premium) | ❌ |

*Last verified 2026. Competitors' features change; verify on their pricing pages.*

### 💰 What you'd pay elsewhere for what's free here

If we priced every 🆕 feature at the going rate on the paid alternatives:

- **Custom PDF branding + design presets**: paid tier on Vyapar, Zoho, ClearTax
- **Multi-copy Rule 48**: Vyapar Gold (₹3,999/yr), Tally paid module
- **Watermarks**: Vyapar Silver (₹2,599/yr)
- **Auto-print payment receipts**: standard on ClearTax + Zoho Standard
- **Bulk export**: paid tier on all four
- **Daily backup with Trash bin**: cloud-only (paid) on Zoho + ClearTax
- **ITR module** (with 234B/C, surcharge cap, 80D senior tiers): ClearTax sells this as a separate ~₹1,500/yr product
- **Multi-language invoices**: Tally paid module

**Total that would cost you ~₹8,000–₹15,000/year on the competing stack.** Here: **₹0, forever, MIT-licensed.**

---

## Key Features

> 🆕 **What's new (v1.10.30 → v1.10.42, shipped 2026)**
>
> - **Direct-HTML vector thermal print** (v1.10.42) — 58/80mm receipts skip the raster PDF path and go straight to the printer as vector text. Sharp glyphs on 203-dpi thermal heads, smaller print jobs. User-toggle to switch back to Via-PDF for finicky printers.
> - **Payment / receipt reconciliation** (v1.10.41) — Dashboard auto-heals any orphaned receipts against their invoice; stale-editor saves can no longer wipe a payment recorded in another tab.
> - **REPRINT badge polish** (v1.10.41) — moved to top-right so it never overlaps the logo; default OFF for freelancers/services (retail/POS can opt in).
> - **Bill of Supply / Delivery Challan** (v1.10.39) — the "no GST" invoice types now correctly remove GST from the invoice total.
> - **PDF colour crash fix** (v1.10.40) — swapped `color-mix(in oklab, …)` for `rgba()`; PDF Save & Download works on every browser again.
> - **Invoice PDF polish** (v1.10.38) — accent-tinted TOTAL DUE anchor, footer-block containers matching Bill To, smart Terms format default (services → formatted, goods → compact).
> - **Payment Accounts — Account Holder Name + Account Type** (v1.10.37) — invoices now show whose name is on the bank and whether it's Savings/Current.
> - **Portal print preview + settings redesign + business-type gating** (v1.10.36) — split-view collapses to one column on mobile, sections gated by business preset (freelancer no longer sees thermal-only options), reusable page-header card across every screen.
> - **Vector-HTML thermal preview + OCR line items** (v1.10.35) — OCR now extracts HSN / qty / rate / tax% per line and fuzzy-matches your saved product catalogue.
> - **In-app ConfirmModal + PromptModal** (v1.10.34) — every native browser confirm/prompt replaced with a theme-aware in-app modal.
> - **Complete 4-mode discount system** (v1.10.25) — Net / Unit / Price-with-Tax + invoice-level Total discount.
> - **Client credit balance** (v1.10.24) — overpayments carry forward and apply to the next bill automatically.
> - **Focus mode + Ctrl+K command palette + Notification bell** (through v1.10.36) — keyboard-first workflow for POS speed.
>
> Full history: [CHANGELOG.md](./CHANGELOG.md). Earlier v1.10 milestones (UTGST bucket, GST Rule 48 multi-copy, 9 design presets, print margins, multi-language labels, daily backup + Trash bin, transactional restore) remain — see the feature tables below.

### :receipt: Invoicing & Billing

| Feature | Details |
|---------|---------|
| **5 Invoice Types** | Tax Invoice, Proforma/Estimate, Bill of Supply, Credit Note, Delivery Challan |
| **Auto GST Calculation** | CGST + SGST for intra-state, IGST for inter-state — uses *Place of Supply* override and SEZ flag (Section 16, IGST Act) |
| 🆕 **UTGST Bucket** | Intra-UT supplies for Chandigarh, Ladakh, Andaman & Nicobar, Lakshadweep, Dadra & Nagar Haveli / Daman & Diu correctly file as CGST + **UTGST** instead of CGST + SGST — required by GSTN portal (Chapter II of GST Act) |
| 🆕 **Interstate Detection Guard** | Blank business-state produces a warning + block instead of silently defaulting to intra-state (fresh installs can no longer ship interstate invoices with wrong tax split) |
| **HSN/SAC Codes** | Add HSN or SAC codes per line item with correct tax rates |
| **Per-Line Units of Measurement** | kg, ltr, mtr, ft, hrs, pcs, sqft + 15 more — plus user-defined custom units (Carat, Bundle, anything). UQC propagated to GSTR-1 and E-Way Bill |
| **TDS / TCS on Invoices** | Section 194Q / 194C / 194J / 194I / 194H / 194O / 195 (TDS) and 206C(1H) / 52 (TCS) with per-quarter Form 26Q / 27EQ-ready CSV reports |
| 🆕 **TCS on Right Base + ₹50L Threshold** | Section 206C(1H) computed on receipt **including GST** per CBDT Circular 17/2020 (not pre-GST subtotal). ₹50 lakh annual per-counterparty threshold properly enforced — no over-collection on the first invoice |
| **UPI QR Code** | Auto-generated QR code on every Indian-rupee invoice from your UPI ID |
| **Multi-Currency** | Bill in INR + 21 other currencies (USD, EUR, GBP, AED, AUD, SGD, CAD, MYR, ZAR, NGN, KES, SAR, NPR, BDT, LKR, PKR, PHP, IDR, NZD, etc.) with locale-correct formatting and amount-in-words for each |
| **Country-Aware Tax Labels** | "GST" for India, "VAT" for UAE/UK/EU, "SST" for Malaysia, "MwSt" for Germany, "TVA" for France, "PPN" for Indonesia — auto-applied based on seller country |
| **3 PDF Styles** | Classic / Modern / Minimal layouts with customisable accent colour and high-quality multi-page export |
| 🆕 **9 One-Click Design Presets** | Modern (indigo, filled headers) · Classic (mono ALL CAPS, SMART BAZAAR style) · Corporate (navy + gold, premium) · Minimalist (hairlines, airy) · Colorful (warm orange, retail/cafe) · Compact (max lines per page) · Enterprise (blue accent, e-commerce feel) · IT Services (deep navy heading) · Retail Brand (logo-first, HSN column). Each preset shapes **both PDF colours + thermal typography** in one click |
| 🆕 **Multi-Page Rule 48 Compliant PDF** | DOM-level pagination snaps page breaks to safe row boundaries — table rows never cut mid-content across pages. Multi-copy (ORIGINAL / DUPLICATE / TRIPLICATE) correctly duplicates every page for goods invoices |
| 🆕 **Print Margins (mm)** | Top / Bottom / Left / Right margins in mm — shifts content inside every PDF page. Essential for pre-printed letterhead and printers with built-in edge margins |
| 🆕 **PDF Font Family** | Helvetica (default, cleanest) · Times New Roman (traditional / formal) · Courier (monospace / receipt style). Independent of thermal typography setting |
| 🆕 **PDF Font Scale (80% – 140%)** | Slider that multiplies with the base size preset. Fit more per page (80%) or bump up for older customers (140%) — proportional across the whole invoice |
| 🆕 **Multi-Language Section Labels** | English, Hindi, Tamil, Marathi, Bengali — or override any individual label to match your brand. `BILL TO` → `बिल किसे`, `TAX INVOICE` → `கர சாலான்`, etc. |
| 🆕 **PDF User Colours** | Fully user-configurable palette — primary text, muted text, accent, accent text, header background, divider colour. Live preview updates as you type |
| 🆕 **Print & PDF Split-View Live Preview** | 70+ settings on the left, sticky preview on the right. Tabs for PDF (A4) · Thermal (80mm) · Split view — every change reflects instantly without scrolling |
| **Granular PDF Field Control** | 30+ togglable fields grouped by section (Header, Client, Items table, Totals, Footer). Hide-all / Reset-default in one click |
| **Round-off + Currency Exchange Rate Snapshot** | Optional round-to-nearest-rupee line and FX rate stored on the invoice for accurate historical reports |
| **Rich-Text Terms & Notes** | Bold, italic, underline, lists, headings, links — all DOMPurify-sanitised. **13 India-specific Terms presets** by business type (SME, Freelancer, Manufacturer, Retail, Restaurant, IT/SaaS, Construction, Medical, Education, Transport, Real Estate, E-commerce, Export-LUT) |
| **Amount in Words** | Indian format (Crore, Lakh) for INR, international format (Million, Thousand) for foreign currencies — correctly named per currency (Dollars, Dirhams, Pounds, Pence, Riyals, Halalas, Naira, Kobo, etc.) |
| **Quotation to Invoice** | Convert any Proforma/Estimate to Tax Invoice in one click |
| **Auto-Save + Save-Before-Leave** | Auto-saves to sessionStorage as you type; only persists to bills list once meaningful (client + priced item). Browser-close / Back prompts to save |
| **Custom Invoice Numbers** | Branded prefix, separator style, financial year, zero-padded digits — atomic counter (no duplicate numbers under concurrent saves) |
| **Private Internal Notes** | Add notes only you can see (not printed on the PDF) |
| **Rich-Text Extra Pages** | Attach formatted content (tables, lists, scope of work) as additional PDF pages |

### :clipboard: GST Compliance & Filing

| Feature | Details |
|---------|---------|
| **GSTR-1 Data** | B2B invoices (with GSTIN), B2C aggregated by tax rate, B2C Large (inter-state > Rs.2.5 L), HSN summary with UQC, Credit Notes (CDNR / CDNUR), Document Summary (Table 13) |
| **GSTR-3B Computation** | Output tax liability, Input Tax Credit from expenses + purchases (auto-routed to IGST or CGST+SGST per inter-state flag), net tax payable — ready to copy into GST portal |
| **GSTR-1 + GSTR-3B JSON Export** | Download GSTN offline-tool format JSON files (schema v1.7) and upload directly to gst.gov.in — no manual data entry |
| **GSTR-2B Reconciliation** | Import GSTR-2B JSON downloaded from the GST portal; auto-matches each entry against your purchase records by supplier GSTIN + invoice number. Flags Matched / Amount-mismatch / Books-only / 2B-only entries with filterable summary and CSV export |
| **TDS / TCS Reports** | Per-quarter, per-section aggregation of TDS receivable (deducted by clients) and TCS collected. CSV exports formatted as direct input for **Form 26Q** and **Form 27EQ** quarterly returns |
| **CSV Exports** | Download B2B, B2C, B2C Large, HSN, CDNR, Doc Summary reports as CSV for your CA or portal upload |
| **Step-by-Step Filing Guide** | Interactive walkthrough for filing GSTR-1 and GSTR-3B on the GST portal — late-fee math up-to-date with CGST Amendment Act 2023 |
| **NIL Return Guide** | Auto-detects zero-activity periods with instructions for filing NIL returns |
| **E-Way Bill JSON** | Download NIC-format JSON (schema v1.0.1221) for e-way bill portal upload (goods > Rs.50,000). PIN codes auto-extracted from address; correct supplyType for outward bills |
| **SEZ Client Flag** | Tick on a client and supplies are auto-charged IGST regardless of state (Section 16, IGST Act) |
| **Soft Tax-ID Validation** | GSTIN / VAT / TRN / EIN format check per country with friendly warning — never blocks save |
| **Filing Checklist** | Interactive checklist with progress tracking, deadlines, and penalty info |

### :briefcase: Business Management

| Feature | Details |
|---------|---------|
| **Client Ledger** | Save clients with GSTIN, track outstanding amounts, view payment history |
| **Product Catalog** | Save products with HSN/SAC, rate, GST %, unit, stock quantity — auto-fills during invoicing |
| **Stock Management** | Auto-deducts stock on invoice creation, restores on deletion, low stock tracking |
| **Expense Tracker** | Record expenses with category, vendor, GST % for automatic ITC calculation |
| **Recurring Invoices** | Templates for retainer clients — weekly, monthly, quarterly, yearly with auto-advance |
| **Payment Receipts & Vouchers** | Generate payment receipts linked to invoices with amount in words |
| 🆕 **Auto-Print Payment Receipt** | Recording a payment auto-opens a printable receipt (business header, receipt number, invoice number, mode, amount in Indian words, running balance). Print via browser Print → Save as PDF |
| 🆕 **Payment History CRUD** | Every payment has a stable id + Receipt (reprint) / Edit note / Delete actions. Deleting a payment recomputes totals + status automatically |
| 🆕 **Notification Bell** | Overdue invoices, low stock, upcoming GST filings, and update banners all surface in a single click-out popover with badge count |
| 🆕 **Ctrl+K Command Palette** | Spotlight-style search across invoices, clients, products, and every settings section. Select an invoice → opens for edit in one keystroke |
| 🆕 **Setup Wizard** | 3-step first-run wizard with 6 business-type presets (Retail / Freelancer / Restaurant / Wholesale / Manufacturing / Service). Configures paper size, language, and defaults in 90 seconds |
| **Purchase Bills** | Record purchase invoices for ITC tracking and expense management |
| **Multi-Business Profiles** | Switch between multiple businesses with separate GSTIN, bank details, logo, signature |

### :bar_chart: Reports & Analytics

| Feature | Details |
|---------|---------|
| **Profit & Loss Statement** | Revenue vs. expenses breakdown (excluding GST) with net profit/loss and margin % |
| **Monthly P&L Breakdown** | Month-by-month financial performance |
| **Outstanding & Aging** | Track unpaid invoices with auto-overdue detection and days overdue counter |
| **Low Stock Alerts** | Monitor inventory levels across your product catalog |
| **GST Return Summaries** | GSTR-1, GSTR-3B, HSN summaries auto-generated from your invoices and expenses |
| **Dashboard Stats** | Total revenue, tax collected, invoice count, outstanding amount at a glance |
| 🆕 **Client Analytics** | Top clients by revenue, worst payers (average days-to-payment), client mix — data straight from your invoice ledger |
| 🆕 **Product Performance** | Best-sellers, most units sold, revenue by product — surfaces which items to restock or push |
| 🆕 **Income Tax (ITR) Computation** | Full-featured ITR module: old vs. new regime compare, salary/business/capital-gains slabs, deductions with senior-citizen-aware 80D caps, Section 234B/234C interest with calendar-month accuracy, surcharge with 15% cap on 111A/112A gains (Finance Act 2022), presumptive-mode advance-tax schedule, ITR-4 Sugam field map |

### :outbox_tray: Sharing & Export

| Feature | Details |
|---------|---------|
| **PDF Download** | High-quality, multi-page PDF — render scale `max(3, devicePixelRatio × 2)`, JPEG 0.95, deflate-compressed. Sharper text, modest file size |
| **WhatsApp Sharing** | Share invoices directly via WhatsApp (desktop app or web, auto-detected) |
| **Email** | One-click email with invoice summary |
| **Google Drive Auto-Upload (PDFs)** | Invoices auto-upload to your own Google Drive after download (optional, OAuth via your Client ID) |
| **Google Drive JSON Backup** | Optional checkbox in Export to upload the JSON backup to your Drive's `<Folder> - Backups` subfolder alongside the local download |
| **Granular Backup / Restore** | Pick exactly what to back up via checkboxes — profile, profiles, invoices, clients, products, expenses, purchases, recurring, receipts, terms templates, settings, local prefs (custom units, theme, region, modules). Import previews counts before restoring |
| 🆕 **Automatic Daily Backup + Trash Bin** | Every day the server snapshots your entire `data/` folder into `data/backups/YYYY-MM-DD/`. 30-day retention with auto-purge. Deleted invoices move to a Trash bin (30-day retention) with one-click Restore |
| 🆕 **Transactional Restore** | Restoring a backup snapshots your live data FIRST — if the restore errors partway through, it rolls back automatically. No more losing everything on a bad restore |
| 🆕 **Bulk PDF Export with Progress + Cancel** | Combine any selection of invoices into one multi-page PDF. Progress toast every 5 invoices, event-loop yield between renders, Cancel button. Works on 50+ invoices without freezing the tab |
| **CSV Import** | Bulk import clients and products from CSV files |
| **Mobile Web Share** | Web Share API attaches PDF to WhatsApp or any app on mobile |

### :gear: Customization

| Feature | Details |
|---------|---------|
| **30+ Invoice Display Toggles** | Show/hide every field: logo, business name, address, phone, email, state, GSTIN, client address/phone/email, place of supply, invoice number/date, due date, HSN, qty, unit, rate, discount, tax, subtotal, amount in words, round-off, bank details, UPI QR, signature, signatory caption, Terms, Notes — grouped by section with Hide-all / Reset |
| **Region Preference** | Pick **India only** / **International** / **Both**. Adapts every menu, picker, and tax label without losing data |
| **Modules Page** | Turn off entire feature groups you don't need (recurring invoices, expenses, purchases, GST returns, integrations) — sidebar shrinks to match |
| **Custom Invoice Numbering** | Branded prefix, separator (/ - #), financial year toggle, starting number, digit padding |
| **Terms & Conditions** | Rich-text editor (B/I/U, lists, headings, links) + 13 India business-type starter templates + reusable saved-template library |
| **Multi-Business Profiles** | Separate profiles with different GSTIN, bank details, logo, signature, country, currency. Switcher in the header for one-click context change |
| **Dark Mode** | Full dark theme with automatic persistence and theme-aware utility classes everywhere |
| **PWA Installable** | Install as a standalone desktop app via Chrome or Edge — opens instantly, no browser needed |
| **In-App Searchable User Guide** | 17 sections, live search with highlighted matches, downloadable as a fully searchable text PDF |

---

## Quick Start / Installation

### Prerequisites

- **Windows 10/11** for the one-click installer, **OR** **Node.js 18+** for macOS / Linux
- ~50 MB free disk space
- No internet after install (except for optional Google Drive backup / update check)

### Option 1: Windows One-Click Installer (recommended — no terminal, no commands)

1. **Download the ZIP** → [click here](https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip) or grab the latest from [Releases](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases)
2. **Extract** it anywhere (e.g. `Documents\FreeGSTBill`)
3. **Double-click** `Install FreeGSTBill.bat`
4. The app opens at **http://localhost:47371** — a **Desktop shortcut** and **Start-Menu entry** are created for you

That's it. The installer auto-installs Node.js if you don't have it. From then on, click the Desktop shortcut to launch. Use `Stop FreeGSTBill.bat` to shut the server down and `Update FreeGSTBill.bat` to pull the latest release without losing your data.

> **Why port 47371?** IANA-unassigned range, well above the 3000-range that every dev server fights over. If it's ever busy, the server auto-scans upward and writes the chosen port to `data/port.txt` — the Start launcher always opens the right URL. Always use the Desktop shortcut.

### Option 2: macOS / Linux (Developer Setup)

```bash
git clone https://github.com/IamRamgarhia/Free-GST-Billing-Software.git
cd Free-GST-Billing-Software
npm install
npm start                # production build + serve on http://localhost:47371
```

For live-reload development:

```bash
npm run dev              # dev server on http://localhost:5173 · API on http://localhost:47371
```

### Option 3: Install as a Desktop App (any OS)

Once the server is running, open the URL in Chrome / Edge / Brave and click **Install** in the address bar. The app gets its own window, icon, and jump-list — see [Install as a Desktop App (PWA)](#install-as-a-desktop-app-pwa) below.

### Option 4: Deploy online (advanced — Vercel + Supabase, Railway, VPS, Cloudflare Tunnel)

For solo users who want access from multiple devices, or small teams sharing invoices across a shop and an accountant's laptop — **[docs/DEPLOY_ONLINE.md](./docs/DEPLOY_ONLINE.md)** walks through four honest paths (Railway lift-and-shift, Vercel + Supabase serverless, own VPS, free Cloudflare Tunnel) with costs, trade-offs, and code snippets.

> **Read the trade-offs first.** Going online means your business data lives on someone else's server — the local install exists precisely to avoid that. For most users the local install is still the right answer.

## Install as a Desktop App (PWA)

Free GST Billing Software is a **Progressive Web App** — once installed, it gets its own icon, its own window, and behaves exactly like a regular Windows / macOS / Linux app. No browser chrome, no localhost URL visible to the user.

### How to install as a PWA

1. Open **http://localhost:47371** in Chrome / Edge / Brave (any Chromium browser)
2. Click the orange **Install as Desktop App** banner at the top — or the **➕ install icon** in the address bar
3. The app opens in its own window with the GST Billing Software icon in your Start Menu / taskbar

### After installation — manifest shortcuts

Right-click the pinned PWA icon (Windows taskbar / Start Menu / Edge's app launcher) and you get a jump-list:

- 🆕 **New Invoice** → straight to the invoice form
- 📊 **Dashboard** → recent invoices and stats
- 📋 **GST Returns** → GSTR-1 / 3B / 2B reconciliation
- ⚙ **Settings** → business profile, accounts, modules

No need to land on the Dashboard first — jump directly to the most-used flow.

### Offline-first

The PWA caches its full app shell + fonts + icons on first install. Even if your localhost server isn't running for some reason, the app still loads (and tells you the server is offline rather than just showing a blank page). Service worker auto-updates the cache when you upgrade.

> 🪟 **Coming in v2.0:** Native `.exe` installer (Tauri repackage) with code-signed binary, Add/Remove Programs entry, system tray icon, and native auto-update. The PWA flow stays as the developer / power-user fallback.

---

## How to Self-File GST Returns

Free GST Billing Software auto-generates all the data you need for GSTR-1 and GSTR-3B filing. Here's the workflow:

```
Step 1 ──► Enter invoices throughout the month as you normally would
              │
Step 2 ──► Go to GST Returns page → Review GSTR-1 data (B2B, B2C, HSN, Credit Notes)
              │
Step 3 ──► Export GSTR-1 JSON → Upload directly to gst.gov.in
              │
Step 4 ──► Review GSTR-3B summary → Copy figures into the GST portal and file
              │
Step 5 ──► Mark the return as filed to track your compliance status
```

The app includes a **step-by-step interactive filing guide** with screenshots and tips for both GSTR-1 and GSTR-3B. It even covers NIL return filing for months with no activity.

> **No CA needed for basic GST filing.** The app does all the calculations — you just upload and confirm.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 7 |
| **Backend** | Express 5 (Node.js) |
| **PDF Generation** | jsPDF + html2canvas |
| **Icons** | Lucide React |
| **QR Codes** | qrcode |
| **Security** | DOMPurify (XSS protection) |
| **Storage** | File-based JSON — no database needed |
| **Offline** | PWA with service worker caching |

> **No database. No Docker. No cloud setup.** Clone, install, run. Your data lives in a simple `data/` folder as plain JSON files.

---

## Roadmap

### :white_check_mark: Recently Delivered (v1.10 series — 2026)

- [x] **Direct-HTML vector thermal print with PDF fallback toggle** (v1.10.42)
- [x] **Payment/receipt reconciliation** — orphaned receipts auto-heal on Dashboard load (v1.10.41)
- [x] **REPRINT badge** repositioned + default OFF for non-retail (v1.10.41)
- [x] **PDF Save & Download crash fix** — swapped `color-mix(oklab)` for `rgba()` (v1.10.40)
- [x] **Bill of Supply / Delivery Challan** correctly remove GST from invoice total (v1.10.39)
- [x] **Invoice PDF polish** — accent TOTAL DUE anchor, footer containers, smart Terms default (v1.10.38)
- [x] **Payment Accounts — Account Holder Name + Account Type** on bank block (v1.10.37)
- [x] **Portal print preview + settings redesign + business-type gating** (v1.10.36)
- [x] **Vector-HTML thermal preview + OCR line items with catalog fuzzy-match** (v1.10.35)
- [x] **In-app ConfirmModal + PromptModal** — every native browser confirm/prompt replaced (v1.10.34)
- [x] **Thermal print rewrite + CSP fix + OCR offline bundling** (v1.10.33)
- [x] **Complete 4-mode discount system** — Net / Unit / Price-with-Tax + invoice-level Total (v1.10.25)
- [x] **Client credit balance** — overpayment carries forward and applies to next bill (v1.10.24)
- [x] **Focus mode + Ctrl+K command palette + Notification bell** — POS-speed keyboard flow
- [x] **DOM-level pagination + GST Rule 48 multi-copy** — page breaks respect row boundaries
- [x] **UTGST bucket** for Chandigarh / Ladakh / A&N / Lakshadweep / DN&DD (Chapter II compliance)
- [x] **TCS 206C(1H) on receipt-including-GST** per CBDT Circular 17/2020 + ₹50L threshold
- [x] **9 one-click design presets** + full user-configurable PDF colours + font scale
- [x] **Multi-language section labels** — English / Hindi / Tamil / Marathi / Bengali
- [x] **Automatic daily backup + Trash bin** + transactional restore (rollback on error)
- [x] **Bulk PDF export** with progress + cancel
- [x] **Income Tax (ITR)** computation — old/new regime, 234B/C interest, surcharge cap
- [x] **Setup wizard** with 6 business-type presets

### :rocket: Coming Soon

- [ ] **Bank Statement Import** + ITR Filing Summary PDF *(see [docs/TAX_HELPER_PLAN.md](./docs/TAX_HELPER_PLAN.md))*
- [ ] **Tally XML export + Tally-format ledger import**
- [ ] **Recurring invoices: scheduled auto-generate + email/WhatsApp dispatch**
- [ ] **WhatsApp Business API integration** — one-click invoice send (currently opens WA Web with pre-filled text)
- [ ] **Barcode scanning for products** (PWA camera)
- [ ] **E-Invoicing (IRN)** — Invoice Reference Number via IRP portal *(mandatory for AATO > ₹5 cr)*

### :calendar: Planned Features

- [ ] **E-Invoicing (IRN)** — generate Invoice Reference Number via IRP portal *(mandatory for AATO > ₹5 cr — see [docs/COMPETITOR_GAPS.md](./docs/COMPETITOR_GAPS.md))*
- [ ] **Bulk E-Invoicing** — generate IRN for multiple invoices at once
- [ ] **Direct GSTR-1/3B portal upload** *(currently we generate the JSON, user uploads via offline tool — direct submission requires GSP partnership)*
- [ ] **Reverse Charge Mechanism (RCM)** flag + self-invoice
- [ ] **GST Cess** (compensation cess on tobacco/auto/coal)
- [ ] **Composition scheme** invoice variant with Rule 46A declaration
- [ ] **Automatic Payment Reminders** — email + WhatsApp for overdue invoices
- [ ] **Android & iOS Mobile App** — native apps for billing on the go
- [ ] **Multi-Language Support** — Hindi, Tamil, Telugu, Gujarati, Marathi
- [ ] **AI-Powered Expense Categorization** — auto-classify expenses
- [ ] **Shopify / WooCommerce Integration** — sync orders and generate invoices
- [ ] **Customer Self-Service Portal** — shareable link for clients to view and pay invoices
- [ ] **Payment-gateway pay-links** on invoices (Razorpay / Stripe / Cashfree)
- [ ] **Multi-user access with roles** (admin, billing, view-only)
- [ ] **Advanced Inventory** — batch tracking, expiry dates, warehouse management
- [ ] **Payroll & Salary Management** — employee salary processing with TDS
- [ ] **Balance Sheet & Cash Flow Reports** — complete financial reporting

### :bulb: Community Requested (still open)

- [ ] Party-wise discount settings
- [ ] Multiple price lists (wholesale / retail)
- [ ] Sales order & purchase order workflows
- [ ] Item size / colour variants
- [ ] Digital signature on invoices (DSC integration)
- [ ] More industry-specific *invoice templates* (separate from the 13 Terms presets we already ship)
- [ ] Branch-wise reporting

> **Want a feature?** [Open an issue](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues) and let us know.

### :scroll: Changelog

See **[CHANGELOG.md](./CHANGELOG.md)** for a detailed history of every release.

---

## :books: Documentation

The deep-dive material lives in **[docs/](./docs/)**:

- **[docs/USER_GUIDE.md](./docs/USER_GUIDE.md)** — plain-language handbook for end users (Quick Start → Daily Use → Backup → Migration → FAQ → Troubleshooting). Also available **inside the app** as a searchable view with one-click PDF export.
- **[docs/DEPLOY_ONLINE.md](./docs/DEPLOY_ONLINE.md)** — deploy the app online (Vercel + Supabase, Railway lift-and-shift, own VPS, free Cloudflare Tunnel). Four paths with honest trade-offs, costs, and code snippets. Read this only if you have a specific reason to move off the local install.
- **[docs/COMPETITOR_GAPS.md](./docs/COMPETITOR_GAPS.md)** — gap analysis vs ERPNext / Akaunting / Invoice Ninja / Crater + Tally / Vyapar / Zoho Books / ClearTax / Marg, with the prioritised post-1.4 roadmap.
- **[docs/TAX_HELPER_PLAN.md](./docs/TAX_HELPER_PLAN.md)** — three-tier proposal for the v1.5.x Income Tax Helper (bank-statement CSV import + ITR Filing Summary PDF + optional ITR-4 JSON).

---

## Who Is This For?

| Who | How They Use It |
|-----|----------------|
| **Freelancers & Consultants** | Invoice clients for projects, retainers, hourly work. Bill international clients in USD/EUR/GBP. |
| **Small Shops & Retail Stores** | Quick bill generation with UPI QR code for instant payment. Stock tracking and low-stock alerts. |
| **Service Businesses** (IT, consulting, design) | Professional tax invoices with HSN/SAC codes. Recurring invoices for retainer clients. |
| **Manufacturers & Traders** | GST tax invoices with HSN codes, delivery challans, e-way bill JSON, stock management. |
| **Startups & New Businesses** | Zero-cost billing from day one. No commitment, no vendor lock-in. |
| **CAs & Tax Consultants** | Generate invoices for advisory fees. Use GST filing tools and CSV exports for clients. |
| **Exporters** | Multi-currency invoices with GST toggles for export billing. |
| **Anyone Who Wants to Self-File GST** | Built-in filing guide replaces the need for a CA for basic GSTR-1 and GSTR-3B filing. |

---

## Why Is This Free?

Free GST Billing Software is built and maintained by [DiceCodes](mailto:Contact@dicecodes.com). It is:

- **Open-source** under the MIT license — fork it, modify it, use it commercially
- **Community-driven** — features are built based on what users actually need
- **No hidden charges** — no premium tier, no ads, no data collection, no signup wall
- **No vendor lock-in** — your data is plain JSON files. Take them anywhere, anytime

We believe every business in India deserves professional billing software without paying monthly fees.

---

## Data Privacy & Security

| Question | Answer |
|----------|--------|
| **Where is my data stored?** | In a `data/` folder on your computer as plain JSON files. No server, no cloud, no database. |
| **Can anyone access my invoices?** | No. The app runs on `localhost` — not accessible from the internet or other computers. |
| **What if I uninstall?** | Your `data/` folder stays untouched. Reinstall anytime and everything is still there. |
| **Do I need internet?** | Only for the first install (`npm install`). After that, everything works offline. |
| **How do I backup?** | Settings → Export Data → save JSON file. Import on any machine. |

### Running on a shop LAN (POS tablets)

Since v1.10.0, the Express server accepts requests only from
`localhost` (`127.0.0.1`, `[::1]`). If you run the server on one
machine and access it from a POS tablet on the same Wi-Fi:

1. Find the server machine's LAN IP (e.g. `192.168.1.42`).
2. Open [server.js](server.js), find the CORS middleware near the top
   (search for `v1.10.0 — CORS lockdown`), and add your LAN origin
   to the allowlist regex:

   ```js
   /^https?:\/\/192\.168\.1\.42(:\d+)?$/i.test(origin) ||
   ```

3. Restart the server.
4. From the tablet's browser, hit `http://192.168.1.42:47371/`.

If you don't lock the middleware to specific IPs, any device on the
same Wi-Fi (including guests) can hit your server. That's the trade —
the default is safest, LAN access is opt-in.

---

## Contributing

We welcome contributions from the community. Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

You can also contribute by:
- Reporting bugs via [GitHub Issues](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)
- Suggesting features
- Improving documentation
- Sharing the project with other businesses

---

## Google Drive Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Web application) under Credentials
4. Add authorized JavaScript origins:
   - `http://localhost:47371` (production install)
   - `http://localhost:5173` (developer mode, optional)
5. Copy the Client ID into **Settings → Cloud Backup** in the app
6. Click **Connect Google Drive** and authorize

PDFs and JSON backups will auto-upload to your own Google Drive after every download.

---

## Project Structure

```
Free-GST-Billing-Software/
├── server.js                     # Express API server (default port 47371, auto-scans if busy)
├── src/
│   ├── App.jsx                   # Root layout, sidebar navigation, dark mode
│   ├── store.js                  # API client for all data operations
│   ├── utils.js                  # Currency formatting, number-to-words, GST helpers
│   ├── components/
│   │   ├── Dashboard.jsx         # Invoice list, filters, stats, payment tracking
│   │   ├── InvoiceGenerator.jsx  # Create/edit invoices with live preview
│   │   ├── InvoicePreview.jsx    # Invoice PDF template
│   │   ├── ClientsView.jsx      # Client ledger & management
│   │   ├── InventoryView.jsx    # Product catalog & stock management
│   │   ├── ExpenseTracker.jsx   # Business expense tracking with ITC
│   │   ├── RecurringInvoices.jsx # Recurring invoice templates
│   │   ├── ReceiptVoucher.jsx   # Payment receipt generation
│   │   ├── ReportsView.jsx      # P&L reports & analytics
│   │   ├── GSTReturns.jsx       # GSTR-1, GSTR-3B, HSN reports, filing guide
│   │   ├── SettingsView.jsx     # Profile, templates, multi-business, backup
│   │   └── Toast.jsx            # Notification system
│   └── services/
│       └── googleDrive.js       # Google Drive OAuth & upload
└── data/                        # Local JSON storage (gitignored)
```

---

## Frequently Asked Questions

### Is Free GST Billing Software really free?
Yes — MIT licensed open-source software. No subscription, no premium tier, no "free trial" that expires, no usage limits. The full feature set is available to every user forever. We make zero rupees from this directly.

### Will my data be sent to the cloud?
No. All your invoices, clients, products, and settings are stored as plain JSON files in a `data/` folder next to the app on your computer. Nothing leaves your machine unless you explicitly turn on the optional Google Drive backup feature (in which case it goes to *your own* Google Drive, not ours).

### Can I file GST returns directly from this software?
The software generates **GSTR-1**, **GSTR-3B**, and **GSTR-2B reconciliation** data in CSV and the GSTN offline-tool JSON format. You upload these files directly to gst.gov.in — no third-party intermediary. The built-in step-by-step filing guide walks you through the GSTN portal once you've downloaded the files.

### Does it work without internet?
Yes, completely. After installation everything runs on `localhost:47371` on your computer. The only optional internet-using features are Google Drive backup, the in-app update notifier (checks GitHub for new versions), and WhatsApp sharing.

### Can I bill international clients?
Yes. Free GST Billing Software supports **22 countries** with locale-correct currency formatting, country-aware tax labels (GST / VAT / SST / MwSt / TVA / PPN / Sales Tax), and amount-in-words in the right currency name (Dollars, Dirhams, Pounds, Rand, Naira, Pesos, etc.). Set your Region Preference in Settings to *International* or *Both*.

### What invoice formats are supported?
**Tax Invoice**, **Proforma / Estimate**, **Bill of Supply** (for exempt goods or non-GST sellers), **Composition scheme invoice** (with Rule 46A declaration), **Credit Note**, **Delivery Challan**.

### Does it support multiple businesses?
Yes. You can add unlimited business profiles (each with its own GSTIN, bank accounts, logo, signature, and country setting). Switch between them with one click in the header.

### Does it run on Mac or Linux?
The `.bat` installers are Windows-only, but the app itself works on macOS and Linux via `npm install` + `npm start`. See the [Quick Start](#quick-start--installation) section.

### What happens to my data when the app updates?
Updates only refresh the app code and dependencies. Your `data/` folder (invoices, clients, products, settings) and `Saved Invoices/` PDF archive are **never touched**. The updater also backs them up to `%TEMP%` as a third safety net before pulling new code.

### Is there a mobile app?
Not yet — the PWA installs as a desktop app today. A native Android app is on the v2.x roadmap.

### Can I import data from Tally / Vyapar / Excel?
CSV import is supported today for clients and products. Direct Tally XML import is on the Coming Soon roadmap. Free-form Excel import requires manual mapping today.

---

## Contact & Support

- **Email:** [Contact@dicecodes.com](mailto:Contact@dicecodes.com)
- **Issues / bugs / feature requests:** [GitHub Issues](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)
- **Releases:** [GitHub Releases](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases)
- **Discussions:** *(coming soon)*

---

## License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

### Ready to stop paying for billing software?

[**⬇ Download Now**](https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip) &nbsp;·&nbsp; [⭐ **Star on GitHub**](https://github.com/IamRamgarhia/Free-GST-Billing-Software) &nbsp;·&nbsp; [📖 **Read the User Guide**](docs/USER_GUIDE.md) &nbsp;·&nbsp; [🐛 **Report an Issue**](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues) &nbsp;·&nbsp; [📧 **Email DiceCodes**](mailto:Contact@dicecodes.com)

---

**Free GST Billing Software** by [DiceCodes](mailto:Contact@dicecodes.com) · MIT Licensed · v1.10.42

<sub>Free GST billing software India · Free GST invoice software for small business · Open source GST billing software · Free alternative to Tally Prime Vyapar Zoho Books ClearTax myBillBook Marg ERP · No subscription invoice software · Offline billing software India · GSTR-1 GSTR-3B filing software free · GSTR-2B reconciliation tool free · TDS Form 26Q TCS Form 27EQ software · Section 194Q 206C(1H) TCS calculator with ₹50 lakh threshold · UTGST invoice software · CGST SGST IGST auto calculator · E-way bill JSON generator free · HSN SAC code invoice generator · Bill of Supply generator · Delivery Challan software · Credit Note Debit Note software · Proforma invoice estimate software · Composition scheme invoice · UPI QR invoice maker · Thermal receipt printer software 58mm 80mm · Direct vector thermal print software · POS billing software free India · Retail shop kirana billing software · Restaurant cafe billing software · Freelancer consultant invoice software India · Multi-currency invoice generator (USD EUR GBP AED SGD AUD JPY) 22 countries · Country-aware VAT SST MwSt TVA PPN tax labels · Recurring invoice software · Payment receipt voucher software · Bulk PDF invoice export · Google Drive backup billing software · Automatic daily backup + Trash bin · Multi-business multi-GSTIN switcher · Multi-language invoice Hindi Tamil Marathi Bengali · Dark mode PWA billing app · Rich-text Terms & Conditions with 13 India presets · OCR bill scan tesseract · Ctrl+K command palette · Split-view live PDF preview · Income Tax (ITR) computation old vs new regime 234B 234C · Client credit balance carry-forward · Watermark DUPLICATE DRAFT PDF · Rule 48 multi-copy (Original Duplicate Triplicate) · WhatsApp share invoice PDF · Self-file GST return software · GST invoice software without subscription · No signup no login billing software · Vyapar alternative open source · Tally alternative free · Zoho Books alternative · ClearTax alternative · myBillBook alternative · Marg ERP alternative · Made in India</sub>

Made in India 🇮🇳 · [DiceCodes](https://dicecodes.com)

</div>
