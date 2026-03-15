# BillKaro

### Free, Open-Source GST Invoice & Billing Software

Create GST-compliant invoices for Indian and international clients. Runs offline on your machine — no signup, no subscription, no cloud. Your financial data stays private.

**Built by [DiceCodes](mailto:Contact@dicecodes.com)**

---

## Key Highlights

- **Offline & Private** — Runs on localhost. No data leaves your machine.
- **Multi-Currency** — Bill in INR, USD, EUR, GBP, AUD, CAD, SGD, AED with proper formatting and amount-in-words.
- **GST Compliant** — Auto CGST/SGST (intra-state) and IGST (inter-state) calculation.
- **GST Filing Ready** — GSTR-1, GSTR-3B summaries, HSN reports, CSV export, step-by-step filing guide.
- **Expense Tracker** — Track expenses, claim ITC, auto-generate P&L reports.
- **Professional PDFs** — Download or auto-upload to Google Drive.
- **Dark Mode** — Full dark theme support.
- **Free Forever** — MIT licensed, no hidden costs.

---

## Who Is This For?

BillKaro replaces paid billing software for anyone who sends invoices. If you're paying for Zoho, Tally, Vyapar, or any SaaS billing tool — you don't have to.

| Industry | How They Use It |
|----------|----------------|
| **Freelancers & Consultants** | Invoice clients for projects, retainers, hourly work. Bill international clients in USD/EUR/GBP. |
| **Software Developers & IT Services** | Bill for development, SaaS, AMC contracts. Export invoices for foreign clients. |
| **Graphic Designers & Creative Agencies** | Proforma estimates before work, tax invoices after delivery. |
| **CA / Accountants / Tax Consultants** | Generate invoices for advisory fees. Track client payments. Use GST filing guide. |
| **Tutors & Coaching Centres** | Monthly fee invoices with batch-wise billing. Recurring invoices for retainer students. |
| **Photographers & Videographers** | Quotation (proforma) + final invoice for events and shoots. |
| **Small Manufacturers & Traders** | GST tax invoices with HSN codes, bill of supply for exempt goods. |
| **Retailers & Shopkeepers** | Quick bill generation with UPI QR code for instant payment. |
| **Exporters** | Multi-currency invoices (USD, EUR, GBP, AED) with GST turned off for export. |
| **Doctors & Clinics** | Bill of supply for healthcare services (GST exempt). |
| **Interior Designers & Architects** | Detailed estimates with extra pages for scope of work, material lists. |
| **Event Planners & Caterers** | Proforma with itemized breakdown, credit notes for cancellations. |
| **Transport & Logistics** | Invoices with per-item HSN, integrated with e-way bill (coming soon). |
| **Real Estate & Construction** | Multi-page invoices with payment milestones and terms. |
| **NGOs & Trusts** | Receipt generation and bill of supply for exempt services. |

**Bottom line:** If you send invoices and don't want to pay monthly for billing software, BillKaro is for you.

---

## All Features

### 4 Invoice Types
| Type | Use Case |
|------|----------|
| **Tax Invoice** | Standard GST invoice with CGST/SGST/IGST |
| **Proforma / Estimate** | Quotations for clients before confirmation |
| **Bill of Supply** | Exempt goods/services or composition dealers (no GST) |
| **Credit Note** | Returns, price adjustments, corrections |

### Invoicing
- Auto invoice numbers with fiscal year prefix — `INV/2025-26/0001`
- Line items with HSN/SAC code, quantity, rate, per-item discount & tax
- Auto GST — CGST+SGST for same state, IGST for different state
- **8 currencies** — INR, USD, EUR, GBP, AUD, CAD, SGD, AED
- Amount in words — Indian format (Crore, Lakh) for INR, international format (Million, Thousand) for foreign currencies
- UPI QR code on invoice (auto-generated from your UPI ID)
- Custom notes & remarks per invoice
- Rich-text extra pages — paste formatted content (tables, lists, headings) that render as separate PDF pages with auto page numbering

### 15 Toggle Controls
Show or hide any section on the invoice:

> GST, State, GSTIN, Place of Supply, HSN Code, Discount, Bank Details, UPI QR, Logo, Signature, Terms & Conditions, Notes, Amount in Words, Due Date, Item Quantity

### PDF & Sharing
- High-quality multi-page PDF export
- **WhatsApp** — share invoice directly (desktop app or web, auto-detected)
- **Email** — one-click email with invoice summary
- **Mobile** — Web Share API attaches PDF to WhatsApp/any app
- **Google Drive** — auto-upload PDFs after download (optional)

### Dashboard & Analytics
- Search invoices by client name or number
- Filter by type, status, fiscal year, date range
- Stats — total revenue, tax collected, invoice count, outstanding
- **Payment tracking** — record partial payments with date, mode (Bank/UPI/Cash/Cheque/Card), and notes
- Status tracking — Unpaid, Partial, Paid, Overdue

### Expense Tracker
- Record business expenses with category, vendor, invoice number
- **GST on expenses** — enter GST % to auto-calculate ITC (Input Tax Credit)
- Filter by category, fiscal year, search
- CSV export for expenses
- Feeds into GSTR-3B ITC and P&L reports

### GST Reports & Filing
- **GSTR-1 B2B** — all invoices with client GSTIN, broken down by taxable amount, CGST, SGST, IGST
- **GSTR-1 B2C** — invoices without GSTIN, aggregated by tax rate
- **GSTR-3B Summary** — output tax, ITC from expenses, net tax payable
- **HSN Summary** — grouped by HSN code with quantity, taxable value, and tax breakup
- **Document Summary** — invoice number ranges and counts (Table 13)
- **CSV Export** — download B2B, B2C, and HSN reports as `.csv` files ready for GST portal upload
- **NIL Return Detection** — auto-detects periods with no activity
- Filter by fiscal year or specific month

### GST Filing Guide
- **Step-by-step instructions** for filing GSTR-1 on the GST portal
- **Step-by-step instructions** for filing GSTR-3B with tax payment
- **NIL return guide** — how to file when there's no activity
- Interactive checklist with progress tracking
- Tips, deadlines, and penalty information

### Profit & Loss Report
- Revenue vs expenses breakdown (excluding GST)
- Net profit/loss with margin percentage
- Monthly P&L breakdown
- Auto-calculated from invoices and expenses

### Recurring Invoices
- Create templates for retainer clients
- Set frequency — weekly, monthly, quarterly, yearly
- One-click invoice generation from template
- Auto-advance next due date
- Pause/resume recurring templates
- Due invoice alerts

### Receipt / Payment Voucher
- Generate payment receipts for clients
- Quick-select from unpaid invoices
- Amount in words (auto-generated)
- Print-ready receipt format
- Track receipt number sequence

### Client Management
- Save recurring clients — name, address, state, GSTIN
- Quick-select when creating invoices
- Client-wise ledger with outstanding amounts

### Product Catalog / Inventory
- Save products with name, HSN/SAC, rate, GST %, unit, stock quantity
- **Auto-search** — start typing in line items, matching products appear instantly
- Auto-fills HSN, rate, and tax % from catalog — no retyping

### Multi-Business Profiles
- Save multiple business profiles
- Switch between businesses with one click
- Each profile stores name, GSTIN, bank details, logo, signature

### Dark Mode
- Full dark theme with automatic persistence
- Toggle from sidebar — applies instantly

### Business Profile
- Business name, address, GSTIN, PAN
- Bank details — account number, IFSC, bank name
- UPI ID for QR code generation
- Logo & digital signature upload
- Reusable terms & conditions templates

### Data Safety
- **Export** — download all data as JSON backup
- **Import** — restore from backup on any machine
- Auto-save drafts — never lose work mid-invoice

---

## Quick Start

**Requires:** [Node.js](https://nodejs.org/) v18+

```bash
git clone https://github.com/IamRamgarhia/biller.git
cd biller
npm install

# Windows
npm run dev:win

# macOS / Linux
npm run dev
```

Opens at **http://localhost:5173** — API server runs on port 3001.

### First-Time Setup
1. **Settings** → fill business profile (name, GSTIN, PAN, bank details)
2. Upload logo & signature (optional)
3. Add terms templates you reuse
4. **New Invoice** → start billing

### Production
```bash
npm run build && npm start
```
Serves from port 3001.

---

## Tech Stack

| | Technology |
|---|-----------|
| Frontend | React 19, Vite 7 |
| Backend | Express 5 (Node.js) |
| PDF | jsPDF + html2canvas |
| Icons | Lucide React |
| QR | qrcode |
| Storage | Local JSON files — no database |

---

## Google Drive Setup (Optional)

1. [Google Cloud Console](https://console.cloud.google.com/) → create project
2. Enable **Google Drive API**
3. **Credentials** → OAuth 2.0 Client ID → Web application
4. Add origin: `http://localhost:5173`
5. Copy Client ID → paste in **Settings** → Save
6. Click **Connect Google Drive** → authorize

PDFs auto-upload after every download.

---

## Project Structure

```
billkaro/
├── server.js                     # Express API (port 3001)
├── src/
│   ├── App.jsx                   # Root + sidebar navigation + dark mode
│   ├── store.js                  # API client
│   ├── utils.js                  # Currency, number-to-words, GST helpers
│   ├── components/
│   │   ├── Dashboard.jsx         # Invoice list, filters, stats, payments
│   │   ├── InvoiceGenerator.jsx  # Create/edit with live preview
│   │   ├── InvoicePreview.jsx    # Invoice template
│   │   ├── ClientsView.jsx       # Client ledger
│   │   ├── InventoryView.jsx     # Product catalog management
│   │   ├── ExpenseTracker.jsx    # Business expense tracking
│   │   ├── RecurringInvoices.jsx # Recurring invoice templates
│   │   ├── ReceiptVoucher.jsx    # Payment receipt generation
│   │   ├── ReportsView.jsx       # GST reports + GSTR-3B + P&L
│   │   ├── GSTFilingGuide.jsx    # Step-by-step GST filing instructions
│   │   ├── SettingsView.jsx      # Profile, templates, multi-business, data backup
│   │   └── Toast.jsx             # Notifications
│   └── services/
│       └── googleDrive.js        # Drive OAuth & upload
└── data/                         # Local storage (gitignored)
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/bills` | List or create invoices |
| DELETE | `/api/bills/:id` | Delete invoice |
| GET/POST | `/api/clients` | List or save clients |
| DELETE | `/api/clients/:id` | Delete client |
| GET/POST | `/api/templates` | List or save terms templates |
| DELETE | `/api/templates/:id` | Delete template |
| GET/POST | `/api/products` | List or save products |
| DELETE | `/api/products/:id` | Delete product |
| GET/POST | `/api/expenses` | List or save expenses |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET/POST | `/api/recurring` | List or save recurring templates |
| DELETE | `/api/recurring/:id` | Delete recurring template |
| GET/POST | `/api/receipts` | List or save receipts |
| DELETE | `/api/receipts/:id` | Delete receipt |
| GET/POST | `/api/profiles` | List or save business profiles |
| DELETE | `/api/profiles/:id` | Delete business profile |
| GET/POST | `/api/profile` | Get or update active business profile |
| GET/POST | `/api/meta/:key` | Metadata (invoice counters) |
| GET | `/api/export` | Full data backup (JSON) |
| POST | `/api/import` | Restore from backup |

---

## Roadmap

### Shipped
- [x] **Product Catalog / Inventory** — save products with HSN, rate, tax %. Auto-fill when creating invoices.
- [x] **GST Reports** — GSTR-1 (B2B + B2C), HSN Summary with CSV export for CA filing.
- [x] **Expense Tracker** — track business expenses with GST for ITC claims.
- [x] **GST Filing Assistant** — GSTR-1, GSTR-3B summary, Document Summary, NIL return detection.
- [x] **GST Filing Guide** — step-by-step instructions for filing on GST portal.
- [x] **Profit & Loss Report** — revenue vs expenses with monthly breakdown.
- [x] **Recurring Invoices** — auto-generate monthly/weekly invoices for retainer clients.
- [x] **Receipt / Payment Voucher** — generate payment receipts for clients.
- [x] **Multi-Business Profiles** — switch between multiple business profiles.
- [x] **Dark Mode** — full dark theme support.

### Planned
- [ ] **Invoice Reminders** — auto email/WhatsApp reminders before due date
- [ ] **E-Invoice / IRN** — generate IRN via GST portal API (NIC e-invoice)
- [ ] **E-Way Bill** — auto-generate for goods transport above threshold
- [ ] **Multi-Language** — Hindi, Tamil, Marathi, Gujarati invoice support
- [ ] **Digital Signature** — DSC integration for signed invoices
- [ ] **Client Portal** — shareable link for clients to view & pay invoices

Want a feature? Open an [issue](https://github.com/IamRamgarhia/biller/issues) or email us.

---

## FAQ

**Is this really free?**
Yes. MIT licensed. No premium tier, no ads, no tracking.

**Where is my data stored?**
In a `data/` folder on your machine as JSON files. Nothing goes to any server.

**Can I bill international clients?**
Yes. Select any of the 8 supported currencies (USD, EUR, GBP, AUD, CAD, SGD, AED). Amount in words, formatting, and currency symbols adjust automatically. Turn off GST toggles for export invoices.

**Does it work offline?**
Yes. Only Google Drive upload needs internet.

**How do I file my GST returns?**
Go to the GST Filing Guide page in BillKaro. It provides step-by-step instructions for filing GSTR-1 and GSTR-3B. Use the Reports page to get all the numbers you need.

**Can I track expenses and see profit/loss?**
Yes. Use the Expenses page to record business expenses. The Reports page auto-generates a P&L statement from your invoices and expenses.

**How do I backup or move to another PC?**
Settings → Export Data → save JSON file. On new PC → Settings → Import Data.

**Can I manage multiple businesses?**
Yes. Save your current profile as a business profile in Settings. Switch between profiles anytime.

**Can I customize the invoice design?**
Yes. The template is in `src/components/InvoicePreview.jsx` and `src/index.css`. Fork and modify.

---

## Contact & Support

- **Email:** [Contact@dicecodes.com](mailto:Contact@dicecodes.com)
- **Issues:** [GitHub Issues](https://github.com/IamRamgarhia/biller/issues)
- **Feature Requests:** Open an issue or email us

---

## Contributing

We welcome contributions! Report bugs, suggest features, or submit pull requests.

---

## License

[MIT](LICENSE)

---

**BillKaro** by [DiceCodes](mailto:Contact@dicecodes.com) — Free billing software. Made in India.
