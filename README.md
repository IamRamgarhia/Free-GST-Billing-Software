# GST Biller

**Free, open-source offline GST invoice generator for Indian businesses.**

Create professional GST-compliant invoices that run entirely on your local machine. No signup, no subscription, no cloud dependency — your financial data never leaves your computer.

---

## Why GST Biller?

Most billing software is either expensive, requires a subscription, or uploads your financial data to third-party servers. GST Biller is built for freelancers, small businesses, and anyone who wants a **fast, private, and free** invoicing tool.

- **100% Offline** — Runs on localhost, no internet required (except optional Google Drive backup)
- **No signup or account needed** — Just install and start billing
- **Your data stays local** — Invoices stored as JSON files on your machine
- **Open source** — Inspect, modify, and contribute

---

## Features

### Invoice Types
- **Tax Invoice** — Standard GST-compliant invoice with CGST/SGST/IGST
- **Proforma / Estimate** — Quotations and estimates for clients
- **Bill of Supply** — For exempt goods/services or composition dealers (no GST)
- **Credit Note** — For returns, price adjustments, or corrections

### Invoicing
- Auto-generated invoice numbers with fiscal year prefix (`INV/2025-26/0001`)
- Line items with HSN code, quantity, rate, discount, and per-item tax
- Automatic GST calculation — CGST+SGST for intra-state, IGST for inter-state
- Amount in words (Indian numbering: Crore, Lakh, Thousand)
- Custom notes and remarks per invoice
- Rich-text extra sections (paste formatted HTML — tables, lists, headings) that render as separate PDF pages with automatic page numbering
- QR code on invoice (UPI payment link)

### 15 Toggle Options
Control exactly what appears on your invoice:

| Toggle | What it controls |
|--------|-----------------|
| GST | Show/hide GST tax columns and amounts |
| State | Show/hide state fields |
| GSTIN | Show/hide GSTIN numbers |
| Place of Supply | Show/hide place of supply |
| HSN Code | Show/hide HSN/SAC column |
| Discount | Show/hide discount column |
| Bank Details | Show/hide bank account info |
| UPI | Show/hide UPI QR code |
| Logo | Show/hide business logo |
| Signature | Show/hide signature image |
| Terms | Show/hide terms & conditions |
| Notes | Show/hide custom notes section |
| Amount in Words | Show/hide amount in words |
| Due Date | Show/hide payment due date |
| Item Qty | Show/hide quantity column |

### PDF Export
- High-quality PDF generation via html2canvas + jsPDF
- Multi-page support — extra sections automatically start on new pages
- Download locally or auto-upload to Google Drive

### Client Management
- Save recurring clients with name, address, state, GSTIN
- Quick-select when creating invoices
- Client-wise invoice ledger with outstanding amounts

### Dashboard
- All invoices at a glance with search and filters
- Filter by invoice type, payment status, fiscal year, or date range
- Stats: total revenue, tax collected, invoice count, unpaid amount
- Payment tracking — record partial payments with date, mode, and notes

### Payment Tracking
- Track invoice status: Unpaid, Partial, Paid, Overdue
- Record multiple payments per invoice
- Payment modes: Bank Transfer, UPI, Cash, Cheque, Card, Other

### Sharing
- **WhatsApp** — Share invoice details with clients (tries desktop app first, falls back to web)
- **Email** — One-click email with invoice summary
- **Web Share API** — On mobile, share PDF as attachment directly to WhatsApp/any app

### Google Drive Integration (Optional)
- Auto-upload PDFs to a dedicated Google Drive folder
- Browser-based OAuth — no backend token handling
- Configure your own Google OAuth Client ID in Settings

### Data Safety
- **Export** all data (invoices, clients, templates, profile) as a JSON backup file
- **Import** from a previous backup to restore or migrate
- Session-based draft auto-save — never lose work mid-invoice

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/IamRamgarhia/biller.git
cd biller

# Install dependencies
npm install

# Start development server
# On Windows:
npm run dev:win

# On macOS/Linux:
npm run dev
```

The app opens at **http://localhost:5173** with the API server on port 3001.

### First-Time Setup

1. Go to **Settings** from the sidebar
2. Fill in your **Business Profile** — name, address, GSTIN, PAN, bank details
3. Upload your **logo** and **signature** (optional)
4. Add **Terms & Conditions** templates you frequently use
5. Start creating invoices from **New Invoice**

---

## Production Build

```bash
# Build for production
npm run build

# Start production server (serves built frontend + API)
npm start
```

The production build serves the app from `/dist` on port 3001.

---

## Project Structure

```
gst-biller/
├── server.js                  # Express API server (port 3001)
├── index.html                 # Entry HTML with SEO meta tags
├── package.json
├── vite.config.js
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx               # React entry point
│   ├── App.jsx                # Root component with sidebar navigation
│   ├── index.css              # Global styles
│   ├── store.js               # API client (talks to Express server)
│   ├── utils.js               # Utilities (currency formatting, number-to-words, etc.)
│   ├── components/
│   │   ├── Dashboard.jsx      # Invoice list, filters, stats, payment tracking
│   │   ├── InvoiceGenerator.jsx  # Create/edit invoices with live preview
│   │   ├── InvoicePreview.jsx    # Invoice template rendering
│   │   ├── ClientsView.jsx       # Client ledger and management
│   │   ├── SettingsView.jsx      # Profile, templates, Drive config, data backup
│   │   └── Toast.jsx             # Toast notification system
│   └── services/
│       └── googleDrive.js     # Google Drive OAuth & upload (browser-side)
└── data/                      # Auto-created, gitignored — local JSON storage
    ├── profile.json
    ├── meta.json
    ├── bills/
    ├── clients/
    └── templates/
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7 |
| Backend | Express 5 (Node.js) |
| PDF | jsPDF + html2canvas |
| Icons | Lucide React |
| QR Code | qrcode |
| Storage | Local JSON files (no database) |
| Auth | Google OAuth 2.0 (optional, for Drive) |

---

## Google Drive Setup (Optional)

To enable automatic PDF upload to Google Drive:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized JavaScript origin: `http://localhost:5173` (dev) or your production URL
7. Copy the **Client ID**
8. In GST Biller, go to **Settings** → paste the Client ID → **Save**
9. Click **Connect Google Drive** — authorize when prompted

PDFs will now auto-upload after each download.

---

## API Endpoints

The Express server provides these REST endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills` | List all invoices |
| POST | `/api/bills` | Create/update an invoice |
| DELETE | `/api/bills/:id` | Delete an invoice |
| GET | `/api/clients` | List all saved clients |
| POST | `/api/clients` | Save a client |
| DELETE | `/api/clients/:id` | Delete a client |
| GET | `/api/templates` | List terms templates |
| POST | `/api/templates` | Save a template |
| DELETE | `/api/templates/:id` | Delete a template |
| GET | `/api/profile` | Get business profile |
| POST | `/api/profile` | Update business profile |
| GET | `/api/meta/:key` | Get metadata (counters) |
| POST | `/api/meta/:key` | Update metadata |
| GET | `/api/export` | Export all data as JSON |
| POST | `/api/import` | Import data from JSON backup |

---

## Screenshots

> _Coming soon — add screenshots of Dashboard, Invoice Generator, PDF output, and Settings._

---

## FAQ

**Q: Is this really free?**
Yes. MIT licensed, no hidden costs, no premium tier.

**Q: Where is my data stored?**
In a `data/` folder on your machine as plain JSON files. Nothing is sent to any server.

**Q: Can I use this for my real business?**
Yes. This generates standard GST-compliant invoices. However, verify with your CA that the invoice format meets your specific compliance needs.

**Q: Does it work without internet?**
Yes. The only feature that needs internet is the optional Google Drive upload.

**Q: Can I customize the invoice template?**
The invoice design is in `src/components/InvoicePreview.jsx` and styled in `src/index.css`. Fork and modify to match your brand.

**Q: How do I backup my data?**
Go to **Settings** → **Data Management** → **Export Data**. This downloads a JSON file with all your invoices, clients, templates, and profile.

**Q: How do I move to a new computer?**
Export your data on the old machine, install GST Biller on the new one, then import the JSON backup from Settings.

---

## Contributing

Contributions are welcome! Feel free to:
- Report bugs via [Issues](https://github.com/IamRamgarhia/biller/issues)
- Submit feature requests
- Open pull requests

---

## License

[MIT](LICENSE) — use it however you want.

---

Built with React + Vite + Express. Made in India.
