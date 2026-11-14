// v1.10.86 - one invoice as a PDF Blob, made from its saved data (moved out
// of Dashboard.jsx, where it was made for the WhatsApp button, so the Clients
// account's WhatsApp button sends the same PDF). The A4 page helpers moved
// with it; Dashboard's Bulk PDF imports them from here.
import { INVOICE_TYPES } from '../utils';

// v1.10.79 - put a captured invoice on A4 pages. It used to be drawn into one
// page whatever its height (`Math.min(h, 297)`), so a long invoice shared on
// WhatsApp or in Bulk PDF came out squashed into a single page. Now each
// 297 mm slice is its own page.
// `breaks` are canvas heights where a page may end (row and block bottoms,
// see safeBreaks): a page ends at the last one that fits, so rows and the
// signature are not cut in half.
export function addCanvasAsA4Pages(doc, canvas, startOnNewPage, breaks = []) {
  const pageW = 210;
  const pageH = 297;
  const slicePx = Math.floor((canvas.width * pageH) / pageW);
  for (let y = 0, page = 0; y < canvas.height; page++) {
    let h = Math.min(slicePx, canvas.height - y);
    if (y + h < canvas.height) {
      const cut = breaks.filter((b) => b > y + slicePx * 0.5 && b <= y + slicePx).pop();
      if (cut) h = cut - y;
    }
    if (page > 0 && h < 4) break; // a sliver of white margin is not worth a page
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0 || startOnNewPage) doc.addPage();
    doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (h * pageW) / canvas.width, undefined, 'FAST');
    y += h;
  }
}

// Heights (in canvas pixels) where a page may end: the bottom of each table
// row and of each block the editor's own PDF also keeps whole.
export function safeBreaks(el, canvas) {
  const top = el.getBoundingClientRect().top;
  const scale = canvas.height / Math.max(1, el.getBoundingClientRect().height);
  return [...el.querySelectorAll('tr, .inv-footer-block, [data-pdf-page-boundary], .inv-signature')]
    .map((n) => Math.round((n.getBoundingClientRect().bottom - top) * scale))
    .filter((b) => b > 0 && b < canvas.height)
    .sort((a, b) => a - b);
}

export async function billPdfBlob(bill) {
  const data = bill.data || {};
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  const InvoicePreviewMod = await import('../components/InvoicePreview');
  const { createRoot } = await import('react-dom/client');
  const { createElement } = await import('react');
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;';
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await new Promise((resolve) => {
      root.render(createElement(InvoicePreviewMod.default, {
        profile: data.profile, client: data.client, details: data.details, items: data.items,
        totals: data.totals, invoiceType: data.invoiceType, customTerms: data.customTerms,
        customNotes: data.customNotes, extraSections: data.extraSections, options: data.invoiceOptions,
        cancelled: bill.status === 'cancelled', einvoice: bill.einvoice,
      }));
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)));
    });
    const capScale = Math.min(4, Math.max(2, Math.round((window.devicePixelRatio || 1) * 1.2)));
    const canvas = await html2canvas(container.firstElementChild || container, {
      scale: capScale, backgroundColor: '#ffffff', useCORS: false, logging: false,
    });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    addCanvasAsA4Pages(doc, canvas, false, safeBreaks(container.firstElementChild || container, canvas));
    return doc.output('blob');
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

// "Tax Invoice INV-2026-27-0012.pdf": the name the client sees in the chat.
export function billPdfName(bill) {
  const label = INVOICE_TYPES[bill.invoiceType || 'tax-invoice']?.label || 'Invoice';
  return `${label} ${String(bill.invoiceNumber || '').replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
}
