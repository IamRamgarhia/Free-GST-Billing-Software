// v1.10.84 (#131) - Tally masters (Gateway of Tally > Export > Masters, XML)
// read into clients and products. Demo data only (DiceCodes).
//
// Run: `node scripts/tally-xml-test.mjs`

import { decodeXmlBytes, tallyMastersToRows } from '../src/utils/tallyXml.js';
import { clientsCsvToList, productsCsvToList } from '../src/utils/listCsv.js';
import { fileToSheets } from '../src/utils/importFile.js';

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; console.log(`  ok ${label}`); }
  else { failed++; console.log(`  FAIL ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`); }
}

// The shape Tally writes: groups, ledgers (old Tally.ERP 9 fields and the newer
// TallyPrime lists), stock groups and stock items, &#4; markers, &amp;.
const XML = `<?xml version="1.0" encoding="UTF-16"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
<REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC><REQUESTDATA>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><GROUP NAME="Bengaluru Creditors" RESERVEDNAME=""><PARENT>Sundry Creditors</PARENT></GROUP></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><GROUP NAME="Sundry Debtors" RESERVEDNAME="Sundry Debtors"><PARENT>&#4; Primary</PARENT></GROUP></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="DiceCodes" RESERVEDNAME="">
 <ADDRESS.LIST TYPE="String"><ADDRESS>12, Demo Road</ADDRESS><ADDRESS>Bengaluru</ADDRESS></ADDRESS.LIST>
 <PARENT>Sundry Debtors</PARENT><PARTYGSTIN>29ABCDE1234F1ZW</PARTYGSTIN><LEDSTATENAME>Karnataka</LEDSTATENAME>
 <PINCODE>560001</PINCODE><LEDGERPHONE>080-0000000</LEDGERPHONE><LEDGERMOBILE>9800000001</LEDGERMOBILE><EMAIL>accounts@dicecodes.example</EMAIL>
 <LANGUAGENAME.LIST><NAME.LIST TYPE="String"><NAME>DiceCodes</NAME></NAME.LIST></LANGUAGENAME.LIST>
</LEDGER></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="DiceCodes Paper &amp; Ink" RESERVEDNAME="">
 <PARENT>Bengaluru Creditors</PARENT>
 <LEDGSTREGDETAILS.LIST><APPLICABLEFROM>20170701</APPLICABLEFROM><GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE><STATE>Karnataka</STATE><GSTIN>29ABCDE1234F1ZW</GSTIN></LEDGSTREGDETAILS.LIST>
 <LEDMAILINGDETAILS.LIST><ADDRESS.LIST TYPE="String"><ADDRESS>4 Sample Street</ADDRESS></ADDRESS.LIST><APPLICABLEFROM>20170701</APPLICABLEFROM><PINCODE>560002</PINCODE><MAILINGNAME>DiceCodes Paper &amp; Ink</MAILINGNAME><STATE>Karnataka</STATE></LEDMAILINGDETAILS.LIST>
</LEDGER></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="DiceCodes Mumbai" RESERVEDNAME="">
 <PARENT>Sundry Debtors</PARENT><PARTYGSTIN>27ABCDE1234F1ZW</PARTYGSTIN><LEDSTATENAME>&#4; Not Applicable</LEDSTATENAME>
</LEDGER></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="Cash" RESERVEDNAME="Cash"><PARENT>Cash-in-Hand</PARENT></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="Sales @ 18%" RESERVEDNAME=""><PARENT>Sales Accounts</PARENT><PARTYGSTIN>29ABCDE1234F1ZW</PARTYGSTIN></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKGROUP NAME="Inks" RESERVEDNAME=""><PARENT/>
 <GSTDETAILS.LIST><APPLICABLEFROM>20170701</APPLICABLEFROM><HSNCODE>3215</HSNCODE><TAXABILITY>Taxable</TAXABILITY>
  <STATEWISEDETAILS.LIST><STATENAME>&#4; Any</STATENAME>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD><GSTRATE>6</GSTRATE></RATEDETAILS.LIST>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD><GSTRATE>6</GSTRATE></RATEDETAILS.LIST>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD><GSTRATE>12</GSTRATE></RATEDETAILS.LIST>
  </STATEWISEDETAILS.LIST></GSTDETAILS.LIST>
</STOCKGROUP></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM NAME="DiceCodes Pen" RESERVEDNAME=""><PARENT>&#4; Primary</PARENT><BASEUNITS>Nos</BASEUNITS>
 <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
 <GSTDETAILS.LIST><APPLICABLEFROM>20170701</APPLICABLEFROM><HSNCODE>9608</HSNCODE><TAXABILITY>Taxable</TAXABILITY>
  <STATEWISEDETAILS.LIST><STATENAME>&#4; Any</STATENAME>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD><GSTRATE>9</GSTRATE></RATEDETAILS.LIST>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD><GSTRATE>9</GSTRATE></RATEDETAILS.LIST>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD><GSTRATE>18</GSTRATE></RATEDETAILS.LIST>
   <RATEDETAILS.LIST><GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD><GSTRATE>0</GSTRATE></RATEDETAILS.LIST>
  </STATEWISEDETAILS.LIST></GSTDETAILS.LIST>
 <OPENINGBALANCE> 100 Nos</OPENINGBALANCE><OPENINGRATE>15.00/Nos</OPENINGRATE>
 <STANDARDCOSTLIST.LIST><DATE>20250401</DATE><RATE>18.50/Nos</RATE></STANDARDCOSTLIST.LIST>
 <STANDARDPRICELIST.LIST><DATE>20240401</DATE><RATE>22.00/Nos</RATE></STANDARDPRICELIST.LIST>
 <STANDARDPRICELIST.LIST><DATE>20250401</DATE><RATE>1,025.00/Nos</RATE></STANDARDPRICELIST.LIST>
</STOCKITEM></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM NAME="DiceCodes Notebook" RESERVEDNAME=""><BASEUNITS>Pcs</BASEUNITS>
 <GSTDETAILS.LIST><APPLICABLEFROM>20250922</APPLICABLEFROM><HSNCODE>4820</HSNCODE>
  <STATEWISEDETAILS.LIST><RATEDETAILS.LIST><GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD><GSTRATE>2.5</GSTRATE></RATEDETAILS.LIST>
  <RATEDETAILS.LIST><GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD><GSTRATE>2.5</GSTRATE></RATEDETAILS.LIST></STATEWISEDETAILS.LIST></GSTDETAILS.LIST>
 <GSTDETAILS.LIST><APPLICABLEFROM>20170701</APPLICABLEFROM><HSNCODE>4820</HSNCODE>
  <STATEWISEDETAILS.LIST><RATEDETAILS.LIST><GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD><GSTRATE>12</GSTRATE></RATEDETAILS.LIST></STATEWISEDETAILS.LIST></GSTDETAILS.LIST>
</STOCKITEM></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM NAME="DiceCodes Ink" RESERVEDNAME=""><PARENT>Inks</PARENT><BASEUNITS>Ltr</BASEUNITS>
 <OPENINGRATE>120/Ltr</OPENINGRATE>
</STOCKITEM></TALLYMESSAGE>
<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM NAME="DiceCodes Gift Card" RESERVEDNAME=""><BASEUNITS>Nos</BASEUNITS>
 <GSTDETAILS.LIST><APPLICABLEFROM>20170701</APPLICABLEFROM><HSNCODE>4911</HSNCODE><TAXABILITY>Exempt</TAXABILITY></GSTDETAILS.LIST>
</STOCKITEM></TALLYMESSAGE>
</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;

const utf16 = new Uint8Array(Buffer.from(String.fromCharCode(0xFEFF) + XML, 'utf16le'));
const utf8 = new TextEncoder().encode(XML);

console.log('Encodings');
eq(decodeXmlBytes(utf16) === XML, true, 'UTF-16 LE with a byte-order mark (how Tally saves)');
eq(decodeXmlBytes(new Uint8Array(Buffer.from(XML, 'utf16le'))) === XML, true, 'UTF-16 LE without the mark');
eq(decodeXmlBytes(utf8) === XML, true, 'UTF-8');
eq(decodeXmlBytes(new Uint8Array([0xEF, 0xBB, 0xBF, ...utf8])) === XML, true, 'UTF-8 with a byte-order mark');
eq(JSON.stringify(tallyMastersToRows(utf16)) === JSON.stringify(tallyMastersToRows(utf8)), true, 'both read the same');

const { clients, products } = tallyMastersToRows(XML);
console.log('Ledgers -> clients');
eq(clients[0], ['Name', 'GSTIN', 'Phone', 'Email', 'Address', 'State'], 'header the Clients import reads');
eq(clients.slice(1).map((r) => r[0]), ['DiceCodes', 'DiceCodes Paper & Ink', 'DiceCodes Mumbai'],
  'only Sundry Debtors / Sundry Creditors (and groups under them); Cash and Sales ledgers left out; &amp; decoded');
eq(clients[1], ['DiceCodes', '29ABCDE1234F1ZW', '9800000001', 'accounts@dicecodes.example', '12, Demo Road, Bengaluru, 560001', 'Karnataka'],
  'old Tally fields: GSTIN, mobile before phone, email, address lines and PIN, state');
eq(clients[2].slice(1), ['29ABCDE1234F1ZW', '', '', '4 Sample Street, 560002', 'Karnataka'], 'TallyPrime GST and mailing lists');
eq(clients[3][5], 'Maharashtra', 'state "Not Applicable" -> worked out from the GSTIN');

console.log('Stock items -> products');
eq(products[0], ['Name', 'HSN/SAC', 'Unit', 'Purchase Price', 'Selling Price', 'GST %'], 'header the Products import reads');
const byName = Object.fromEntries(products.slice(1).map((r) => [r[0], r.slice(1)]));
eq(byName['DiceCodes Pen'], ['9608', 'Nos', '18.5', '1025', '18'], 'HSN, unit, cost and the latest selling price, Integrated Tax rate');
eq(byName['DiceCodes Notebook'], ['4820', 'Pcs', '', '', '5'], 'the latest GST details win; Central + State when no Integrated Tax');
eq(byName['DiceCodes Ink'], ['3215', 'Ltr', '120', '', '12'], 'HSN and GST from its stock group; opening rate as the cost');
eq(byName['DiceCodes Gift Card'], ['4911', 'Nos', '', '', '0'], 'exempt is 0%');

console.log('Through the same import as a CSV (checks and duplicate rules)');
const c = clientsCsvToList(clients, [{ name: 'dicecodes ' }]);
eq([c.clients.length, c.skipped], [2, 1], 'a client already saved (any case) is skipped');
eq(c.clients[0].gstin, '29ABCDE1234F1ZW', 'GSTIN carried');
const p = productsCsvToList(products, []);
eq(p.errors, [], 'no errors');
eq(p.products.map((x) => `${x.name}|${x.hsn}|${x.unit}|${x.sellingPrice}|${x.purchasePrice}|${x.taxPercent}|${x.stock ?? '-'}`), [
  'DiceCodes Pen|9608|Nos|1025|18.5|18|-', 'DiceCodes Notebook|4820|Pcs|0|0|5|-', 'DiceCodes Ink|3215|Ltr|0|120|12|-', 'DiceCodes Gift Card|4911|Nos|0|0|0|-',
], 'products made; stock left untracked (Tally\'s opening balance is not today\'s stock)');

console.log('The file chooser (.xml)');
const file = new File([utf16], 'Master.xml');
eq((await fileToSheets(file, 'clients')).map((s) => [s.name, s.rows.length]), [['Tally ledgers (parties)', 4]], 'Clients gets the ledgers');
eq((await fileToSheets(file, 'products')).map((s) => [s.name, s.rows.length]), [['Tally stock items', 5]], 'Products gets the stock items');
let err = '';
try { await fileToSheets(file, 'sales'); } catch (e) { err = e.message; }
eq(/Clients or Products/.test(err), true, 'invoices screen points to Clients / Products');
err = '';
try { await fileToSheets(new File(['<html><body>x</body></html>'], 'page.xml'), 'clients'); } catch (e) { err = e.message; }
eq(/not a Tally/i.test(err), true, 'an XML that is not from Tally says so');
err = '';
try { await fileToSheets(new File([utf8], 'Master.xml'), 'clients').then((s) => s); } catch (e) { err = e.message; }
eq(err, '', 'UTF-8 file reads too');

// Review: a name ending in "/" is not an empty tag; a bad character code does not stop the import.
{
  const odd = `<ENVELOPE><BODY><TALLYMESSAGE><LEDGER NAME="M/S DiceCodes/" RESERVEDNAME=""><PARENT>Sundry Debtors</PARENT><LEDSTATENAME>Karnataka</LEDSTATENAME></LEDGER></TALLYMESSAGE>
<TALLYMESSAGE><LEDGER NAME="DiceCodes &#99999999;Two" RESERVEDNAME=""><PARENT>Sundry Debtors</PARENT></LEDGER></TALLYMESSAGE></BODY></ENVELOPE>`;
  let rows = null, oddErr = '';
  try { rows = tallyMastersToRows(odd).clients.slice(1).map((r) => r[0]); } catch (e) { oddErr = e.message; }
  eq([oddErr, rows], ['', ['M/S DiceCodes/', 'DiceCodes Two']], 'NAME="M/S DiceCodes/" read; &#99999999; dropped, not a crash');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
