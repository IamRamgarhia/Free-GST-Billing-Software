<div align="center">

# Free GST Billing Software — 100% Free, No Subscription, No Limits

### The only GST invoicing software you'll never have to pay for.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#quick-start--installation)
[![Version](https://img.shields.io/badge/Version-1.6.1-orange.svg)](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases)
[![PWA](https://img.shields.io/badge/PWA-installable-purple.svg)](#install-as-a-desktop-app-pwa)
[![GitHub Stars](https://img.shields.io/github/stars/IamRamgarhia/Free-GST-Billing-Software?style=social)](https://github.com/IamRamgarhia/Free-GST-Billing-Software)
[![Countries](https://img.shields.io/badge/Countries-22-blue.svg)](#key-features)
[![GST](https://img.shields.io/badge/GST-Compliant-success.svg)](#clipboard-gst-compliance--filing)

**Create GST-compliant invoices, file GSTR-1 / GSTR-3B / GSTR-2B reconciliation, track TDS / TCS, bill international clients in 22 currencies, manage inventory — all without paying a single rupee. Ever.**

Your data never leaves your computer. No cloud. No signup. No tracking. No limits. Open-source and offline-first.

[Download Now](https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip) &nbsp;|&nbsp; [Try in Browser](#-try-it-now-in-your-browser) &nbsp;|&nbsp; [Screenshots](#screenshots) &nbsp;|&nbsp; [5-Minute Quick Start](#your-first-invoice-in-5-minutes) &nbsp;|&nbsp; [Report Bug](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues) &nbsp;|&nbsp; [Request Feature](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)

</div>

---

## 🚀 Try it now in your browser

Want to see what it looks like before downloading? Two zero-install options:

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/IamRamgarhia/Free-GST-Billing-Software)
&nbsp;
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/IamRamgarhia/Free-GST-Billing-Software)

- **StackBlitz** — full app runs in your browser via WebContainers (Node + Express + React all simulated in-page). ~30 seconds to boot. Your sandbox is private — nothing leaves your tab. Data resets when you close the tab.
- **GitHub Codespaces** — cloud dev environment with the project pre-loaded. Click *Run* on `npm start` and the forwarded port opens the live app. Requires GitHub login. Free 60 hours/month per personal account.

> ⚠️ **Both are demos.** For real day-to-day billing use the local install (Quick Start below). Your business data deserves to live on your own machine, not in a browser sandbox or a cloud VM. The whole point of this software is that.

---

## Screenshots

<div align="center">

![Free GST Billing Software dashboard — invoices list with overdue tracking, multi-currency totals, and per-status badges](docs/screenshots/dashboard.png)

*Dashboard view — recent invoices, currency-aware revenue cards, overdue alerts, low-stock indicators, and one-click actions.*

</div>

> 📸 **Want more screenshots?** Open an issue and we'll add captures of the New Invoice form, GSTR-2B Reconciliation tab, Multi-Account Payments manager, and the in-app Searchable User Guide. PRs welcome too.

---

## 📑 Table of Contents

- [Try it now in your browser](#-try-it-now-in-your-browser) — *zero-install demo*
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

> 🆕 **New in v1.10** (highlighted with 🆕 throughout): DOM-level multi-page pagination · GST Rule 48 multi-copy for multi-page invoices · **UTGST bucket** (Chandigarh/Ladakh/A&N/Lakshadweep/DN&DD) · TCS 206C(1H) on receipt-including-GST per CBDT Circular 17/2020 · ₹50L per-counterparty TDS/TCS threshold · **Payment Receipt with view/edit/delete history** · **9 one-click design presets** (Modern / Classic / Corporate / Minimalist / Colorful / Compact / Enterprise / IT Services / Retail Brand) · **Print & PDF split-view live preview** · Print margins · PDF Font Family + Font Scale · Multi-language section labels · Setup wizard with 6 business presets · Automatic daily backup + Trash bin · Notification bell · Ctrl+K command palette · Bulk export with progress & cancel · CORS lockdown · Route lazy-loading (main bundle -46%)

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

- **Node.js 18+** (only needed for developer setup)
- **Windows 10/11** (recommended — includes one-click installer)

### Option 1: Windows Installer (Recommended — No Coding Needed)

1. **Download** the ZIP from [Releases](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases) or [click here](https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip)
2. **Extract** the folder anywhere on your computer
3. **Double-click** `Install FreeGSTBill.bat`
4. The app opens automatically in your browser at **http://localhost:47371**

> **That's it.** No terminal. No commands. The app starts automatically when you turn on your PC.
> A desktop shortcut and Start Menu entry are created for you.

> **Why port 47371?** It's in the unassigned IANA range, well above the 3000-range that every Node / React / Vite / Express dev server fights over. If something on your machine somehow already owns 47371, the server auto-scans up to find a free port and writes the chosen one to `data/port.txt` — the Start.bat launcher always opens whichever URL is correct, so you never need to remember a number. Always use the Desktop shortcut.

### Option 2: Developer Setup

```bash
git clone https://github.com/IamRamgarhia/Free-GST-Billing-Software.git
cd Free-GST-Billing-Software
npm install

# Windows
npm run dev:win

# macOS / Linux
npm run dev
```

Dev server: `http://localhost:5173` | API: `http://localhost:47371`

**Production build:**
```bash
npm run build && npm start
```

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

### :white_check_mark: Recently Delivered (v1.3 → v1.4.1)

- [x] **GSTR-2A / GSTR-2B Reconciliation** — import 2B JSON, match purchases, flag mismatches (v1.4.0)
- [x] **GSTR-1 + GSTR-3B JSON exports** — direct upload to GSTN offline tool (v1.4.0–1.4.1)
- [x] **Multi-GSTIN support** — multi-business profile switcher (v1.2.0)
- [x] **TDS / TCS on invoices** + per-quarter Form 26Q / 27EQ-ready CSV reports (v1.4.0–1.4.1)
- [x] **Per-line unit of measurement** with custom units — *thanks Apurba!* (v1.3.0)
- [x] **Country-aware tax labels** (VAT / SST / MwSt / TVA / PPN) for 22 countries (v1.3.0)
- [x] **Region Preference** toggle (India / International / Both) (v1.3.0)
- [x] **Round-off line**, **currency exchange-rate snapshot** (v1.3.0)
- [x] **Modules page** — disable feature groups you don't use (v1.4.0)
- [x] **Granular PDF field control** — toggle every field per section (v1.4.0)
- [x] **Rich-text Terms & Notes** + 13 India business-type T&C presets — partial fulfilment of "Industry-specific templates" (v1.4.0)
- [x] **Granular backup/restore** with Google Drive option (v1.4.1)
- [x] **Searchable in-app User Guide** with downloadable PDF (v1.4.1)
- [x] **GST compliance fixes** — placeOfSupply override, E-Way Bill schema, GSTIN regex, taxInclusive math, SEZ flag (v1.3.0)

### :rocket: Coming Soon (Next Release — v1.5.x)

- [ ] **Bank Statement Import** + ITR Filing Summary PDF *(see [docs/TAX_HELPER_PLAN.md](./docs/TAX_HELPER_PLAN.md))*
- [ ] **Tally XML export + Tally-format ledger import** — every Indian CA's tool
- [ ] **Recurring invoices: scheduled auto-generate + email/WhatsApp dispatch**
- [ ] WhatsApp Business API integration — send invoices directly via WhatsApp
- [ ] POS / Thermal printer billing mode
- [ ] Barcode scanning for products (PWA camera)

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
4. Add origin: `http://localhost:5173`
5. Copy the Client ID into **Settings** in the app
6. Click **Connect Google Drive** and authorize

PDFs will auto-upload to your Google Drive after every download.

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
Currently CSV import is supported for products. Direct Tally XML import is on the v1.7 roadmap. Free-form Excel import requires manual mapping today.

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

**Free GST Billing Software** by [DiceCodes](mailto:Contact@dicecodes.com) · MIT Licensed · v1.6.1

<sub>Free GST billing software India · GSTR-1 GSTR-3B filing software · Free invoice generator with GST · GSTR-2B reconciliation tool · TDS Form 26Q TCS Form 27EQ software · Offline billing software · No subscription billing app · GST invoice software for small business · Free billing app India · GST compliant invoice maker · Self-file GST returns software · Open source billing software India · Free alternative to Tally Vyapar Zoho ClearTax myBillBook · HSN SAC code invoice generator · CGST SGST IGST calculator · E-way bill software free · Credit note debit note software · Multi-currency invoice India · USD EUR GBP AED invoice generator · Reverse charge mechanism invoice · Composition scheme invoice · Bill of supply generator · Delivery challan software · UPI QR invoice maker · Recurring invoice software · PWA invoicing</sub>

Made in India 🇮🇳 · [DiceCodes](https://dicecodes.com)

</div>
