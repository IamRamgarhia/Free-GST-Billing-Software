# BillKaro

### Free, Open-Source GST Invoice & Billing Software

Create GST-compliant invoices for Indian and international clients. Runs offline on your machine — no signup, no subscription, no cloud. Your financial data stays private.

**Built by [DiceCodes](mailto:Contact@dicecodes.com)**

---

## Key Highlights

- **Offline & Private** — Runs on localhost. No data leaves your machine.
- **Multi-Currency** — Bill in INR, USD, EUR, GBP, AUD, CAD, SGD, AED with proper formatting and amount-in-words.
- **GST Compliant** — Auto CGST/SGST (intra-state) and IGST (inter-state) calculation.
- **Professional PDFs** — Download or auto-upload to Google Drive.
- **Free Forever** — MIT licensed, no hidden costs.

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

### Client Management
- Save recurring clients — name, address, state, GSTIN
- Quick-select when creating invoices
- Client-wise ledger with outstanding amounts

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
│   ├── App.jsx                   # Root + sidebar navigation
│   ├── store.js                  # API client
│   ├── utils.js                  # Currency, number-to-words, GST helpers
│   ├── components/
│   │   ├── Dashboard.jsx         # Invoice list, filters, stats, payments
│   │   ├── InvoiceGenerator.jsx  # Create/edit with live preview
│   │   ├── InvoicePreview.jsx    # Invoice template
│   │   ├── ClientsView.jsx       # Client ledger
│   │   ├── SettingsView.jsx      # Profile, templates, data backup
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
| GET/POST | `/api/profile` | Get or update business profile |
| GET/POST | `/api/meta/:key` | Metadata (invoice counters) |
| GET | `/api/export` | Full data backup (JSON) |
| POST | `/api/import` | Restore from backup |

---

## Roadmap

Features planned for upcoming releases:

- [ ] **Recurring Invoices** — auto-generate monthly/weekly invoices for retainer clients
- [ ] **Invoice Reminders** — auto email/WhatsApp reminders before due date
- [ ] **Expense Tracker** — track business expenses alongside income
- [ ] **Profit & Loss Report** — monthly/yearly P&L from invoices and expenses
- [ ] **GST Reports** — GSTR-1 and GSTR-3B summary from invoice data
- [ ] **E-Invoice / IRN** — generate IRN via GST portal API (NIC e-invoice)
- [ ] **E-Way Bill** — auto-generate for goods transport above threshold
- [ ] **Inventory & Stock** — track product stock with auto-deduction on invoice
- [ ] **Multi-Business** — switch between multiple business profiles
- [ ] **Receipt / Payment Voucher** — generate payment receipts for clients
- [ ] **Dark Mode** — full dark theme support
- [ ] **PWA / Mobile App** — installable progressive web app for mobile
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

**How do I backup or move to another PC?**
Settings → Export Data → save JSON file. On new PC → Settings → Import Data.

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
