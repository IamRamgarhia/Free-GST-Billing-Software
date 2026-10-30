// v1.10.84 (#129, @zzavior) - phone-first customers for cafes and shops: type
// the customer's phone number on the invoice; a saved customer is found by it,
// or a new one is added from the number and a name in one step. The Clients
// list shows how often each customer came and when they last did.
// Tested by scripts/phone-test.mjs.

import { countsAsSales } from '../utils.js';

// The digits that identify a number, however it was typed: "+91 98765 43210",
// "098765-43210" and "9876543210" are the same phone.
export const phoneDigits = (s) => {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d;
};

// Only a whole number matches: 8 digits or more, all of them the same.
export const findClientByPhone = (clients, phone) => {
  const d = phoneDigits(phone);
  if (d.length < 8) return null;
  return (clients || []).find((c) => phoneDigits(c?.phone) === d) || null;
};

// A new customer in the business's own state, so the sale is a local one.
// Without a name the number is the name, so the customer is never blank.
// Bills find their customer by name, so a name another saved customer has
// gets the number's last 4 digits ("Riya 3210").
export const newPhoneClient = (phone, name, profile, clients = []) => {
  const digits = phoneDigits(phone);
  const typed = String(name || '').trim() || digits;
  const taken = (clients || []).some((c) => String(c?.name || '').trim().toLowerCase() === typed.toLowerCase());
  return {
    name: taken ? `${typed} ${digits.slice(-4)}` : typed,
    phone: digits,
    address: '', city: '', pin: '', gstin: '', email: '', isSEZ: false,
    state: profile?.state || '',
    country: profile?.country || 'India',
  };
};

// Visits are real sales: quotations, challans, cancelled bills and credit
// notes are not visits.
export const clientVisits = (bills) => {
  const sales = (bills || []).filter(countsAsSales);
  const last = sales.reduce((m, b) => (String(b.invoiceDate || '') > m ? String(b.invoiceDate) : m), '');
  return { visits: sales.length, last };
};
