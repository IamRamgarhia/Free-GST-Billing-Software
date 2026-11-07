// v1.10.85 (#137) - the box for a USB barcode scanner on New Invoice. A
// scanner types the code fast and presses Enter; the box then empties and
// keeps the cursor, so the next item can be scanned straight away.
import { useState } from 'react';
import { ScanBarcode } from 'lucide-react';

export default function ScanBarcodeBox({ onScan }) {
  const [code, setCode] = useState('');
  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const c = code.trim();
    setCode('');
    if (c) onScan(c);
  };
  return (
    <div className="search-box" style={{ maxWidth: 320, marginBottom: '0.75rem' }}
      title="Click here, then scan: the product is added, and scanning it again adds 1 to its quantity">
      <ScanBarcode size={16} className="search-icon" />
      <input type="text" className="search-input" value={code} placeholder="Scan barcode" aria-label="Scan barcode"
        autoComplete="off" onChange={(e) => setCode(e.target.value)} onKeyDown={onKeyDown} />
    </div>
  );
}
