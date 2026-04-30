# Competitor Gap Analysis & Roadmap

A snapshot of where Free GST Billing Software stands against the leading
open-source GitHub projects and the major commercial Indian GST tools, plus
the prioritized roadmap that came out of that comparison. Pair this with
[CHANGELOG.md](./CHANGELOG.md) for what's already shipped.

> Researched on 2026-04-30 against state-of-tools at that date.

---

## Open-source GitHub competitors

| Project | Stars | Strengths over us | Weaknesses |
|---|---|---|---|
| [frappe/erpnext](https://github.com/frappe/erpnext) | ~33.3k | Full e-Invoice IRN+QR via IRP; direct GSTN portal upload; e-Way Bill API integration; GSTR-2B reconciliation; 14k+ preset HSN/SAC | Heavy Python/MariaDB stack; no offline-first PWA; complex install for a single shopkeeper |
| [akaunting/akaunting](https://github.com/akaunting/akaunting) | ~9.8k | Double-entry ledger + balance sheet + P&L; bank feed reconciliation; vendor bills; multi-user roles; app marketplace | GST features are paid add-ons, not India-first; no built-in IRN or e-Way Bill |
| [invoiceninja/invoiceninja](https://github.com/invoiceninja/invoiceninja) | ~9.7k | Stripe/PayPal/Razorpay payment links; client self-service portal; project + time-tracking; native Flutter mobile apps; PEPPOL e-invoicing | Source-available (not pure OSS); no India GST IRN; limited GSTR exports |
| [crater-invoice-inc/crater](https://github.com/crater-invoice-inc/crater) | ~8.3k | Native React Native iOS/Android apps; custom invoice fields; estimate-to-invoice conversion; per-customer default templates | No GST/HSN/SAC; no GSTR exports; no e-Way Bill — generic invoicing only |
| [InvoiceShelf/InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf) | ~1.7k | Active Crater fork; Docker one-click; mobile companion apps; webhooks; payment gateways | Same India-GST gaps as Crater; smaller community |

## Commercial Indian GST competitors

| Tool | Pricing | Top features we lack |
|---|---|---|
| [TallyPrime](https://tallysolutions.com/gst/gst-invoicing-software/) | ₹22,500–₹67,500 one-time | Connected e-Invoice + IRN auto-capture; direct GSTR-1/3B GSTN upload; TDS/TCS modules; LAN multi-user with roles; auto GSTR-2A/2B reconciliation |
| [Vyapar](https://vyaparapp.in/) | Free Android; ₹2,599+/yr desktop | Native Android with WhatsApp invoice sharing; barcode scanner; thermal printer support; cheque printing; party-wise payment reminders |
| [Zoho Books India](https://www.zoho.com/in/books/pricing/) | ₹899–₹2,999/mo | GSP-licensed direct IRN generation; GSTR-2B reconciliation; bank feeds; client portal; advanced workflow automation; native mobile/tablet |
| [Clear (ClearTax) GST](https://cleartax.in/gst) | Custom; ~₹3,599/yr single-CA | 1-click GSTR-1 → GSTR-9C filing direct to GSTN; vendor compliance scoring; SAP/Oracle/Tally connectors; pre-filing validation engine; bulk IRN |
| [Marg ERP 9+](https://margcompusoft.com/) | ₹8,100 one-time basic; ₹12,600 for GST | Pharmacy/distribution-grade inventory (batch + expiry + barcode); 1000+ pre-built reports; e-Way Bill API direct generation; loyalty/CRM |

---

## Prioritized roadmap (post v1.3.0)

Marked with effort: **TRIVIAL** (~1 day), **MODERATE** (~1 week), **MAJOR**
(2+ weeks), **HUGE** (months).

### Compliance-mandatory (do these first — legal exposure)

1. **e-Invoice IRN + signed QR via IRP API** — *MAJOR*. Mandatory for AATO >
   ₹5 cr; non-compliance penalty ₹25k/invoice plus buyer ITC loss. Needs NIC
   sandbox enrolment, JWS verification, and ideally a GSP partnership.
2. **Reverse Charge Mechanism (RCM) flag + self-invoice generation** —
   *MODERATE*. Required for notified supplies and unregistered-vendor
   purchases.
3. **GST Cess** — *TRIVIAL*. Compensation cess on tobacco/auto/coal etc. as a
   per-line field next to CGST/SGST/IGST.
4. **TDS / TCS tracking** — *MODERATE*. Sec 194Q (purchase TDS) and
   206C(1H) (sale TCS) thresholds and amounts on invoices.
5. **Composition scheme invoice variant** — *TRIVIAL*. Bill of Supply +
   Rule 46A declaration text + composition rate validation.
6. **GSTR-2B reconciliation** — *MAJOR*. Required for ITC accuracy; matches
   our purchase records against supplier-filed GSTR-1.
7. **Direct GSTR-1 / 3B JSON upload to GSTN portal** — *MODERATE*. Right now
   we emit CSV. The GSTN offline-tool JSON schema is published and stable.

### High-value real-world (sequence after compliance)

8. **Native Android app with WhatsApp share** — *HUGE*. Biggest user-acquisition
   gap vs Vyapar.
9. **Payment-gateway pay-links on invoices** (Razorpay / Stripe / Cashfree) —
   *MODERATE*. Invoice Ninja parity.
10. **Tally XML export + Tally-format ledger import** — *MODERATE*. Every CA
    in India runs Tally; this is the "send to my CA" button.
11. **Auto-generate + email/WhatsApp send for recurring invoices** —
    *MODERATE*. We have recurring records, lack scheduled dispatch.

### Polish

12. **Multi-language UI** (Hindi + Tamil + Telugu + Marathi + Gujarati),
    **dark mode**, **barcode scanner via PWA camera** — *MODERATE* combined.

---

## Indian Income Tax e-Filing format support

For end-users wanting help with personal/business tax filing, the IT
Department's portal accepts only two upload formats:

1. **JSON** (primary, since AY 2021-22) — produced by the official **Common
   Offline Utility** (Windows). Pre-filled JSON can be downloaded, edited
   offline, and re-uploaded.
2. **Excel Utility** (.xlsm with macros) — generates JSON on validation.

**There is no public REST API** for individual ITR submission. The
"upload JSON, click authenticate, done" flow can only happen through the
authenticated browser session on incometax.gov.in.

A reasonable target is generating a valid **AY 2025-26 ITR-4 (Sugam) JSON**
matching the published schema, which the user uploads manually. ITR-4 is the
simplest form and fits our small-business / freelancer audience under the
44AD / 44ADA presumptive sections.

See [TAX_HELPER_PLAN.md](./TAX_HELPER_PLAN.md) for the proposed three-tier
implementation:

- **Tier 1 (v1.4.0):** Bank-statement CSV import + invoice/expense
  consolidation + "Income Tax Filing Summary" PDF report.
- **Tier 2 (v1.5+):** Bank-statement PDF parsing (per-bank parsers).
- **Tier 3 (later, opt-in):** ITR-4 JSON generator targeting the Excel
  Utility schema.

**Sources:**
- [IT e-Filing Downloads & Utilities](https://www.incometax.gov.in/iec/foportal/downloads)
- [Offline Utility Manual](https://www.incometax.gov.in/iec/foportal/help/offline-utility)
- [Offline Utility FAQ](https://www.incometax.gov.in/iec/foportal/help/offline-utility-faq)

---

## What we already have that competitors charge for

For balance, here's what we already do that's gated behind paid tiers
elsewhere:

- ✅ Multi-business profile switcher (Vyapar Silver tier)
- ✅ HSN/SAC per item with auto-fill (Tally base)
- ✅ Auto CGST/SGST vs IGST split by place of supply (Tally / Zoho Premium)
- ✅ E-Way Bill JSON export (Marg Silver)
- ✅ GSTR-1 / 3B / HSN-summary CSV exports (Zoho Standard / Tally Silver)
- ✅ UPI QR on invoices (Vyapar Silver)
- ✅ Multi-currency for foreign clients (Zoho Premium)
- ✅ Per-line units with custom-unit support (Vyapar / Marg, paid)
- ✅ Round-off, Bill of Supply, Credit Note, Delivery Challan, Proforma
- ✅ Recurring invoices, expenses, purchases, receipts tracking
- ✅ Google Drive PDF backup
- ✅ Offline-first PWA (no one in this list does this — it's our differentiator)

Free, open-source, and the data lives on your machine forever. That's the
pitch.
