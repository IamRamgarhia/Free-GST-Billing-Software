// v1.10.86 - the terms a new install starts with, and the ready-made terms
// (Settings → Company → Terms templates → Quick Start). Choosing a business
// type rewords the starting "Standard Terms" to the matching ready-made one,
// but only while it is still word-for-word stock text: terms the user wrote
// or changed are never touched. Pure (server.js seeds from it too); tested in
// scripts/businesstype-test.mjs.

// What the server seeds on a new install (software-agency wording, which is
// why a business type replaces it).
export const STANDARD_TERMS = '1. Payment is due within 15 days of invoice date unless otherwise agreed in writing.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond the due date.\n3. The scope of work is limited to what is explicitly mentioned in the project proposal/agreement. Any additional requirements will be quoted and billed separately.\n4. All intellectual property and source code will be transferred to the client only upon receipt of full payment.\n5. We shall not be liable for any delays caused by incomplete or late submission of content, credentials, or approvals from the client\'s end.\n6. Any change requests after project approval may attract additional charges and revised timelines.\n7. This invoice is subject to the jurisdiction of courts at the service provider\'s registered location.\n8. E. & O.E.';

export const QUICK_TERMS = [
  { name: 'Services (IT, Consulting, Freelance)', content: '1. Payment is due within 15 days of invoice date via NEFT/RTGS/UPI unless otherwise agreed.\n2. Late payment interest of 18% per annum will apply on overdue amounts as per MSME Act, 2006.\n3. All amounts are exclusive of GST (CGST/SGST/IGST) as applicable under the GST Act, 2017.\n4. Services rendered are non-refundable once delivered and accepted by the client.\n5. TDS (if applicable) must be deducted as per Income Tax Act. Please share TDS certificate (Form 16A) within 15 days.\n6. All deliverables remain the intellectual property of the service provider until full payment is received.\n7. Any disputes shall be subject to the exclusive jurisdiction of courts in the service provider\'s city.\n8. This is a computer-generated invoice and does not require a physical signature.' },
  { name: 'Goods & Products (Retail, Wholesale)', content: '1. Goods once sold will not be taken back or exchanged unless defective as per Consumer Protection Act, 2019.\n2. Payment is due on delivery via Cash/UPI/NEFT unless credit terms are agreed in advance.\n3. Warranty (if applicable) covers manufacturing defects only as per terms mentioned on the product.\n4. All prices are inclusive of GST (CGST + SGST / IGST) as shown on this invoice.\n5. Claims for damaged or missing items must be reported within 48 hours of delivery with photos.\n6. E-way bill is generated for consignments exceeding Rs. 50,000 as per GST rules.\n7. Risk of loss passes to the buyer upon dispatch from our godown/warehouse.\n8. Subject to jurisdiction of courts at the seller\'s place of business.\n9. This is a computer-generated invoice and does not require a physical signature.' },
  { name: 'Manufacturing & Trading', content: '1. All prices are ex-factory/ex-godown unless otherwise specified.\n2. Payment terms: 50% advance via NEFT/RTGS, balance before dispatch (or as per agreed credit terms).\n3. Goods dispatched only after full payment or confirmed credit arrangement.\n4. Quality complaints must be raised within 7 days of receipt with photographic evidence.\n5. Returns accepted only for manufacturing defects, subject to inspection at our premises.\n6. GST, freight, insurance, loading/unloading charges are as per agreement or additional to quoted price.\n7. E-way bill will be generated as per Section 68 of CGST Act for applicable consignments.\n8. Force majeure: Delays due to natural calamities, strikes, or government orders shall not be held against us.\n9. Interest @ 18% p.a. on overdue payments as per MSME Development Act, 2006.\n10. Subject to exclusive jurisdiction of courts at the seller\'s registered office.\n11. This is a computer-generated invoice and does not require a physical signature.' },
  { name: 'Export / International', content: '1. All prices are in the agreed currency (USD/EUR/GBP) and exclusive of local taxes/duties in buyer\'s country.\n2. Payment via wire transfer (SWIFT/TT) within 30 days of invoice date as per RBI guidelines.\n3. Supply is zero-rated under GST — exported under Letter of Undertaking (LUT) / Bond.\n4. Title and risk pass to buyer upon delivery to carrier (FOB/CIF as per Incoterms 2020).\n5. Buyer is responsible for import duties, customs clearance, and local compliance in destination country.\n6. Claims for shortage or damage must be filed within 14 days of receipt with supporting documents.\n7. All payments to be received in INR equivalent or foreign currency as per FEMA regulations.\n8. Disputes shall be resolved through arbitration in India under the Arbitration & Conciliation Act, 1996.\n9. This is a computer-generated invoice and does not require a physical signature.' },
  // v1.10.86 (maintainer, 19 Nov) - a restaurant and a repair shop had the
  // retail or IT-services wording; each has its own short terms now.
  { name: 'Restaurant / Cafe', content: '1. Prices include GST unless it is shown separately on this bill.\n2. No refund on food and drinks once served.\n3. Service charge, if any, is optional and only with your consent.\n4. Payment by cash, UPI or card at the counter.\n5. This is a computer-generated bill and does not require a signature.' },
  { name: 'Service / Repair Shop', content: '1. Warranty on repair work: 30 days from delivery, for the same fault only. Parts carry the maker\'s warranty.\n2. Items not collected within 60 days of the repair are not our responsibility.\n3. Payment is due on delivery of the item, by cash, UPI or card.\n4. We are not responsible for data on devices given for repair; please keep a backup.\n5. Estimates may change after the item is opened; we ask you before doing extra work.\n6. This is a computer-generated invoice and does not require a signature.' },
  { name: 'Freelancer (Simple)', content: '1. Payment due within 7 days of invoice via UPI/NEFT/IMPS.\n2. Late payments attract interest @ 2% per month.\n3. 50% advance required before project commencement.\n4. Scope changes after agreement will be quoted and billed separately.\n5. All work remains property of the freelancer until full payment is received.\n6. Cancellation after work begins: completed portion will be billed proportionally.\n7. TDS (if applicable) to be deducted at source. Share Form 16A within 15 days of deduction.\n8. Subject to jurisdiction of courts in the freelancer\'s city.\n9. This is a computer-generated invoice.' },
];

const TERMS_FOR_TYPE = {
  retail_shop: 'Goods & Products (Retail, Wholesale)',
  wholesale: 'Goods & Products (Retail, Wholesale)',
  restaurant: 'Restaurant / Cafe',
  manufacturer: 'Manufacturing & Trading',
  freelancer: 'Freelancer (Simple)',
  service: 'Service / Repair Shop',
};

export const termsForType = (typeId) => QUICK_TERMS.find((q) => q.name === TERMS_FOR_TYPE[typeId]) || null;

// The seeded template (id "default"), reworded for the type - or null when
// there is nothing to do: no matching terms, no seeded template, or the user
// has renamed or edited it, or already has that one.
export const defaultTermsFor = (templates, typeId) => {
  const preset = termsForType(typeId);
  const seeded = (templates || []).find((t) => t && t.id === 'default');
  if (!preset || !seeded) return null;
  const stockNames = ['Standard Terms', ...QUICK_TERMS.map((q) => q.name)];
  const stockText = [STANDARD_TERMS, ...QUICK_TERMS.map((q) => q.content)];
  if (!stockNames.includes(seeded.name) || !stockText.includes(seeded.content)) return null;
  if (seeded.content === preset.content) return null;
  // Already added from Quick Start: no second copy with the same name.
  if (templates.some((t) => t && t.id !== 'default' && t.name === preset.name)) return null;
  return { ...seeded, name: preset.name, content: preset.content };
};
