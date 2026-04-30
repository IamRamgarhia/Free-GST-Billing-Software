<div align="center">

# Free GST Billing Software — 100% Free, No Subscription, No Limits

### The only GST invoicing software you'll never have to pay for.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-blue.svg)](#quick-start--installation)
[![Version](https://img.shields.io/badge/Version-1.4.2-orange.svg)](https://github.com/IamRamgarhia/Free-GST-Billing-Software/releases)
[![GitHub Stars](https://img.shields.io/github/stars/IamRamgarhia/Free-GST-Billing-Software?style=social)](https://github.com/IamRamgarhia/Free-GST-Billing-Software)

**Create GST-compliant invoices, file GSTR-1 / GSTR-3B / GSTR-2B reconciliation, track TDS / TCS, bill international clients in 22 currencies, manage inventory — all without paying a single rupee. Ever.**

Your data never leaves your computer. No cloud. No signup. No tracking. No limits. Open-source and offline-first.

[Download Now](https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip) &nbsp;|&nbsp; [View Demo](#screenshots) &nbsp;|&nbsp; [Report Bug](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues) &nbsp;|&nbsp; [Request Feature](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)

</div>

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

---

## Key Features

### :receipt: Invoicing & Billing

| Feature | Details |
|---------|---------|
| **5 Invoice Types** | Tax Invoice, Proforma/Estimate, Bill of Supply, Credit Note, Delivery Challan |
| **Auto GST Calculation** | CGST + SGST for intra-state, IGST for inter-state — uses *Place of Supply* override and SEZ flag (Section 16, IGST Act) |
| **HSN/SAC Codes** | Add HSN or SAC codes per line item with correct tax rates |
| **Per-Line Units of Measurement** | kg, ltr, mtr, ft, hrs, pcs, sqft + 15 more — plus user-defined custom units (Carat, Bundle, anything). UQC propagated to GSTR-1 and E-Way Bill |
| **TDS / TCS on Invoices** | Section 194Q / 194C / 194J / 194I / 194H / 194O / 195 (TDS) and 206C(1H) / 52 (TCS) with per-quarter Form 26Q / 27EQ-ready CSV reports |
| **UPI QR Code** | Auto-generated QR code on every Indian-rupee invoice from your UPI ID |
| **Multi-Currency** | Bill in INR + 21 other currencies (USD, EUR, GBP, AED, AUD, SGD, CAD, MYR, ZAR, NGN, KES, SAR, NPR, BDT, LKR, PKR, PHP, IDR, NZD, etc.) with locale-correct formatting and amount-in-words for each |
| **Country-Aware Tax Labels** | "GST" for India, "VAT" for UAE/UK/EU, "SST" for Malaysia, "MwSt" for Germany, "TVA" for France, "PPN" for Indonesia — auto-applied based on seller country |
| **3 PDF Styles** | Classic / Modern / Minimal layouts with customisable accent colour and high-quality multi-page export |
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

### :outbox_tray: Sharing & Export

| Feature | Details |
|---------|---------|
| **PDF Download** | High-quality, multi-page PDF — render scale `max(3, devicePixelRatio × 2)`, JPEG 0.95, deflate-compressed. Sharper text, modest file size |
| **WhatsApp Sharing** | Share invoices directly via WhatsApp (desktop app or web, auto-detected) |
| **Email** | One-click email with invoice summary |
| **Google Drive Auto-Upload (PDFs)** | Invoices auto-upload to your own Google Drive after download (optional, OAuth via your Client ID) |
| **Google Drive JSON Backup** | Optional checkbox in Export to upload the JSON backup to your Drive's `<Folder> - Backups` subfolder alongside the local download |
| **Granular Backup / Restore** | Pick exactly what to back up via checkboxes — profile, profiles, invoices, clients, products, expenses, purchases, recurring, receipts, terms templates, settings, local prefs (custom units, theme, region, modules). Import previews counts before restoring |
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
4. The app opens automatically in your browser at **http://localhost:3001**

> **That's it.** No terminal. No commands. The app starts automatically when you turn on your PC.
> A desktop shortcut and Start Menu entry are created for you.

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

Dev server: `http://localhost:5173` | API: `http://localhost:3001`

**Production build:**
```bash
npm run build && npm start
```

### Install as Desktop App (PWA)

1. Open **http://localhost:3001** in Chrome or Edge
2. Click the **Install App** banner (or the install icon in the address bar)
3. Done — the app opens in its own window, no browser tab needed

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

- [ ] **Bank Statement Import** + ITR Filing Summary PDF *(see [TAX_HELPER_PLAN.md](./TAX_HELPER_PLAN.md))*
- [ ] **Tally XML export + Tally-format ledger import** — every Indian CA's tool
- [ ] **Recurring invoices: scheduled auto-generate + email/WhatsApp dispatch**
- [ ] WhatsApp Business API integration — send invoices directly via WhatsApp
- [ ] POS / Thermal printer billing mode
- [ ] Barcode scanning for products (PWA camera)

### :calendar: Planned Features

- [ ] **E-Invoicing (IRN)** — generate Invoice Reference Number via IRP portal *(mandatory for AATO > ₹5 cr — see [COMPETITOR_GAPS.md](./COMPETITOR_GAPS.md))*
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
├── server.js                     # Express API server (port 3001)
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

## Contact & Support

- **Email:** [Contact@dicecodes.com](mailto:Contact@dicecodes.com)
- **Issues:** [GitHub Issues](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues)
- **Feature Requests:** [Open an issue](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues) or email us

---

## License

This project is licensed under the [MIT License](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

**Free GST Billing Software** by [DiceCodes](mailto:Contact@dicecodes.com)

Free GST billing software India | GSTR-1 GSTR-3B filing software | Free invoice generator with GST | Offline billing software | No subscription billing app | GST invoice software for small business | Free billing app India | GST compliant invoice maker | Self-file GST returns software | Open source billing software India | Free alternative to Tally Vyapar Zoho | HSN SAC code invoice generator | CGST SGST IGST calculator | E-way bill software free | Credit note debit note software

Made in India :india:

</div>
