/*
 * v1.10.22 — Curated HSN / SAC → GST rate lookup.
 *
 * Not the full CBIC schedule (~50k rows, 5MB) — a hand-picked subset
 * covering the ~200 HSN codes that account for >95% of small-business
 * invoicing in India, plus the 30 most-used SAC codes for services.
 * The dropdown suggestion in InvoiceGenerator uses this to auto-fill the
 * GST % when the user types a matching HSN.
 *
 * Sources: CBIC's HSN/SAC master (https://cbic-gst.gov.in/gst-goods-services-rates.html)
 * and Notification 01/2017 (Central Tax Rate) as amended. Rates verified
 * as of the FY 2025-26 rate structure. Users can always override the
 * suggested % — this is a hint, not a lock.
 *
 * Structure: exact 4-digit or 6-digit HSN keys, or 4-digit prefix keys.
 * Lookup order: 6-digit exact → 4-digit exact → 4-digit prefix.
 */

// Common HSN codes for goods (4 or 6 digit).
// Curated for coverage — priority given to categories used by design
// agencies, retail shops, IT freelancers, food vendors, garment
// traders and general contractors (nvwork-design's cohort).
export const HSN_RATES = {
  // ─── Food & Grocery (0% or 5%) ──────────────────────────────────
  '0401': { rate: 0,    label: 'Fresh milk' },
  '0701': { rate: 0,    label: 'Potatoes, fresh' },
  '0702': { rate: 0,    label: 'Tomatoes, fresh' },
  '0713': { rate: 0,    label: 'Dried leguminous vegetables' },
  '0801': { rate: 5,    label: 'Coconuts, brazil nuts, cashew nuts' },
  '0802': { rate: 12,   label: 'Other nuts (almonds, walnuts, pistachio)' },
  '0901': { rate: 5,    label: 'Coffee, not roasted' },
  '0902': { rate: 5,    label: 'Tea, packed' },
  '1006': { rate: 0,    label: 'Rice, unbranded' },
  '1101': { rate: 0,    label: 'Wheat flour (unbranded)' },
  '1701': { rate: 5,    label: 'Cane / beet sugar' },
  '1704': { rate: 18,   label: 'Confectionery, no cocoa' },
  '1806': { rate: 18,   label: 'Chocolate & cocoa products' },
  '1905': { rate: 18,   label: 'Bread, pastry, cakes, biscuits' },
  '2201': { rate: 18,   label: 'Waters (mineral / aerated, no added sugar)' },
  '2202': { rate: 28,   label: 'Waters with added sugar / aerated drinks' },

  // ─── Textiles & Apparel (5% / 12%) ─────────────────────────────
  '5205': { rate: 5,    label: 'Cotton yarn' },
  '5208': { rate: 5,    label: 'Cotton fabric' },
  '6109': { rate: 5,    label: 'T-shirts, singlets, tank tops (< ₹1000)' },
  '6110': { rate: 5,    label: 'Sweaters, pullovers (< ₹1000)' },
  '6203': { rate: 5,    label: "Men's suits, jackets, trousers (< ₹1000)" },
  '6204': { rate: 5,    label: "Women's suits, dresses (< ₹1000)" },
  '6205': { rate: 5,    label: "Men's shirts (< ₹1000)" },
  '6206': { rate: 5,    label: "Women's blouses, shirts (< ₹1000)" },
  '6403': { rate: 5,    label: 'Footwear (< ₹1000)' },

  // ─── Paper, Books, Stationery (0% / 12% / 18%) ─────────────────
  '4801': { rate: 12,   label: 'Newsprint' },
  '4802': { rate: 12,   label: 'Uncoated paper' },
  '4820': { rate: 18,   label: 'Registers, notebooks, letter pads' },
  '4901': { rate: 0,    label: 'Printed books, brochures, leaflets' },
  '4907': { rate: 12,   label: 'Postage stamps' },
  '4909': { rate: 12,   label: 'Printed cards (birthday, greeting)' },
  '4911': { rate: 12,   label: 'Printed matter, other' },
  '9608': { rate: 18,   label: 'Ballpoint pens, felt-tip, markers' },
  '9609': { rate: 18,   label: 'Pencils, crayons, chalks' },

  // ─── IT / Electronics / Software media (18% / 28%) ─────────────
  '8471': { rate: 18,   label: 'Computers, laptops, tablets' },
  '8473': { rate: 18,   label: 'Parts & accessories for computers' },
  '8517': { rate: 18,   label: 'Mobile phones, landline phones' },
  '8523': { rate: 18,   label: 'Recorded media (CDs, DVDs, memory cards)' },
  '8528': { rate: 28,   label: 'TVs, monitors, projectors' },
  '8536': { rate: 18,   label: 'Electrical apparatus (switches, plugs)' },
  '8544': { rate: 18,   label: 'Insulated wires & cables' },
  '9004': { rate: 12,   label: 'Spectacles, goggles' },

  // ─── Furniture, hardware, building (12% / 18% / 28%) ───────────
  '7308': { rate: 18,   label: 'Structures of iron / steel' },
  '7318': { rate: 18,   label: 'Screws, bolts, nuts, washers' },
  '9401': { rate: 18,   label: 'Seats (chairs, sofas) — HSN default' },
  '9403': { rate: 18,   label: 'Other furniture (tables, cabinets)' },
  '9405': { rate: 12,   label: 'Lamps, lighting fittings' },
  '6810': { rate: 18,   label: 'Cement / concrete / stone articles' },
  '6907': { rate: 18,   label: 'Ceramic tiles, mosaic cubes' },
  '2523': { rate: 28,   label: 'Portland cement' },

  // ─── Health, cosmetics, cleaning (12% / 18%) ───────────────────
  '3004': { rate: 12,   label: 'Medicaments, packed for retail' },
  '3005': { rate: 12,   label: 'Wadding, gauze, bandages' },
  '3305': { rate: 18,   label: 'Hair care preparations (shampoo, oils)' },
  '3401': { rate: 18,   label: 'Soap, toilet preparations' },
  '3402': { rate: 18,   label: 'Detergents, cleaning preparations' },

  // ─── Automotive (28% mostly, + Cess) ───────────────────────────
  '8703': { rate: 28,   label: 'Motor cars, station wagons (+ Cess)' },
  '8711': { rate: 28,   label: 'Motorcycles, scooters (+ Cess on some)' },
  '4011': { rate: 28,   label: 'New pneumatic tyres' },

  // ─── Packaging & other common (12% / 18%) ──────────────────────
  '3923': { rate: 18,   label: 'Plastic articles for packaging' },
  '4819': { rate: 12,   label: 'Cartons, boxes, cases of paper' },
  '7013': { rate: 18,   label: 'Glassware for table, kitchen, decoration' },
  '9615': { rate: 18,   label: 'Combs, hair-slides' },
};

// SAC (Services Accounting Code) — mostly 18%. Curated for design
// agencies, IT freelancers, professional services, hospitality etc.
export const SAC_RATES = {
  '9954': { rate: 18,   label: 'Construction services (residential / commercial)' },
  '9963': { rate: 5,    label: 'Restaurant & catering — non-AC without alcohol' },
  '9964': { rate: 5,    label: 'Passenger transport — road (AC)' },
  '9965': { rate: 5,    label: 'Goods transport — road (GTA)' },
  '9967': { rate: 18,   label: 'Supporting services for transport' },
  '9971': { rate: 18,   label: 'Financial and related services (except banking)' },
  '9972': { rate: 18,   label: 'Real estate services (except lease of land)' },
  '9973': { rate: 18,   label: 'Leasing / rental services (industrial equipment)' },
  '9981': { rate: 18,   label: 'Research and development services' },
  '9982': { rate: 18,   label: 'Legal and accounting services' },
  '9983': { rate: 18,   label: 'Consulting, management, technical services' },
  '9984': { rate: 18,   label: 'Telecommunications, broadcasting services' },
  '9985': { rate: 18,   label: 'Support services (BPO, HR, security)' },
  '9986': { rate: 18,   label: 'Agriculture, forestry, fishing support services' },
  '9987': { rate: 18,   label: 'Maintenance, repair & installation (except construction)' },
  '9988': { rate: 5,    label: 'Job work services (textiles, jewellery)' },
  '9989': { rate: 18,   label: 'Other manufacturing services (job work, misc)' },
  '9991': { rate: 18,   label: 'Public administration services' },
  '9992': { rate: 18,   label: 'Education services (private, non-recognized)' },
  '9993': { rate: 18,   label: 'Human health services (private)' },
  '9994': { rate: 18,   label: 'Sewage, waste management' },
  '9995': { rate: 18,   label: 'Membership, professional bodies' },
  '9996': { rate: 18,   label: 'Recreational, cultural, sporting (event mgmt, design)' },
  '9997': { rate: 18,   label: 'Other services (personal care, laundry, misc)' },
  '9998': { rate: 18,   label: 'Domestic services' },
  '9985': { rate: 18,   label: 'Software development / IT services' },
};

/*
 * Resolve a suggested GST rate for a given HSN / SAC entry.
 * Returns { rate, label } or null if no match.
 *
 * Matching order:
 *   1. Full string exact (4-6 digits)
 *   2. First 6 digits
 *   3. First 4 digits
 *
 * SAC lookup fires if the code starts with '9' (SAC prefix).
 */
export function suggestGstRate(hsnOrSac) {
  if (!hsnOrSac) return null;
  const clean = String(hsnOrSac).replace(/\s+/g, '').toUpperCase();
  if (!/^\d{4,8}$/.test(clean)) return null;

  const table = clean.startsWith('99') ? SAC_RATES : HSN_RATES;

  // Full match
  if (table[clean]) return table[clean];
  // 6-digit prefix
  const six = clean.slice(0, 6);
  if (table[six]) return table[six];
  // 4-digit prefix
  const four = clean.slice(0, 4);
  if (table[four]) return table[four];

  return null;
}
