import { useState, useMemo } from 'react';
import { Download, Search, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { GUIDE_CONTENT } from '../userGuideContent';
import { toast } from './Toast';

// Searchable User Guide. The on-screen render and the PDF use the same content
// array so they can never drift. The PDF is built with jsPDF.text() (real text
// glyphs, OS-searchable / copy-pasteable) NOT html2canvas (which rasterises
// to JPEG and is not searchable).
export default function UserGuideView() {
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(false);

  // Filter blocks by search term. Headings stay visible if any of their child
  // blocks match, so context isn't lost. Implemented by walking the array in
  // chunks delimited by h1/h2 boundaries.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GUIDE_CONTENT.map((b, i) => ({ ...b, _idx: i, _hit: false }));
    const blockMatches = (b) => {
      if (b.text && b.text.toLowerCase().includes(q)) return true;
      if (b.items && b.items.some(i => i.toLowerCase().includes(q))) return true;
      if (b.rows && b.rows.some(([k, v]) => `${k} ${v}`.toLowerCase().includes(q))) return true;
      return false;
    };
    // Group into sections starting at h1/h2 — keep the section header if any
    // block in the section matches.
    const sections = [];
    let cur = null;
    GUIDE_CONTENT.forEach((b, i) => {
      if (b.type === 'h1' || b.type === 'h2') {
        if (cur) sections.push(cur);
        cur = { header: { ...b, _idx: i }, blocks: [] };
      } else {
        if (!cur) cur = { header: null, blocks: [] };
        cur.blocks.push({ ...b, _idx: i });
      }
    });
    if (cur) sections.push(cur);
    const out = [];
    sections.forEach(sec => {
      const matches = sec.blocks.filter(b => blockMatches(b));
      const headerMatches = sec.header && blockMatches(sec.header);
      if (matches.length === 0 && !headerMatches) return;
      if (sec.header) out.push({ ...sec.header, _hit: headerMatches });
      // If only the header matched, show all blocks in that section so context is preserved.
      const blocks = headerMatches && matches.length === 0 ? sec.blocks : matches;
      blocks.forEach(b => out.push({ ...b, _hit: blockMatches(b) }));
    });
    return out;
  }, [search]);

  const highlight = (text) => {
    const q = search.trim();
    if (!q) return text;
    const re = new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'ig');
    const parts = text.split(re);
    return parts.map((p, i) => re.test(p)
      ? <mark key={i} style={{ background: '#fef08a', padding: 0 }}>{p}</mark>
      : <span key={i}>{p}</span>);
  };

  const downloadPDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 18;
      const marginTop = 18;
      const marginBottom = 18;
      const contentWidth = pageWidth - marginX * 2;
      let y = marginTop;
      let pageNum = 1;

      const ensureSpace = (needed) => {
        if (y + needed > pageHeight - marginBottom) {
          pdf.setFontSize(8); pdf.setTextColor(150);
          pdf.text(`Page ${pageNum} — Free GST Billing Software User Guide`, pageWidth / 2, pageHeight - 8, { align: 'center' });
          pdf.addPage();
          pageNum += 1;
          y = marginTop;
        }
      };

      const writeWrapped = (text, opts = {}) => {
        const { size = 11, bold = false, indent = 0, color = [40, 40, 40], leading = 1.4 } = opts;
        pdf.setFont('helvetica', bold ? 'bold' : 'normal');
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, contentWidth - indent);
        const lineHeight = size * 0.3528 * leading; // pt → mm × leading
        lines.forEach(line => {
          ensureSpace(lineHeight);
          pdf.text(line, marginX + indent, y);
          y += lineHeight;
        });
      };

      // Cover-page-ish heading
      writeWrapped('Free GST Billing Software', { size: 22, bold: true, color: [30, 64, 175] });
      writeWrapped('User Guide — v1.4.0', { size: 12, color: [100, 116, 139] });
      writeWrapped(`Generated on ${new Date().toLocaleDateString()}. by DiceCodes — github.com/IamRamgarhia/Free-GST-Billing-Software`, { size: 9, color: [148, 163, 184] });
      y += 4;

      GUIDE_CONTENT.forEach(block => {
        switch (block.type) {
          case 'h1':
            y += 6; ensureSpace(12);
            writeWrapped(block.text, { size: 18, bold: true, color: [30, 64, 175] });
            break;
          case 'h2':
            y += 5; ensureSpace(10);
            writeWrapped(block.text, { size: 14, bold: true, color: [30, 41, 59] });
            break;
          case 'h3':
            y += 3;
            writeWrapped(block.text, { size: 11, bold: true, color: [51, 65, 85] });
            break;
          case 'p':
            writeWrapped(block.text, { size: 10, color: [40, 40, 40] });
            y += 1;
            break;
          case 'note':
            y += 2;
            ensureSpace(20);
            // light yellow background
            pdf.setFillColor(254, 252, 232);
            pdf.setDrawColor(254, 240, 138);
            pdf.rect(marginX, y - 4, contentWidth, 0, 'F'); // placeholder; we draw after text height known
            // Actually compute text height first by writing into a dry-run buffer:
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            const noteLines = pdf.splitTextToSize(block.text, contentWidth - 8);
            const noteH = noteLines.length * 10 * 0.3528 * 1.45 + 5;
            pdf.setFillColor(254, 252, 232);
            pdf.setDrawColor(202, 138, 4);
            pdf.roundedRect(marginX, y - 2, contentWidth, noteH, 2, 2, 'FD');
            pdf.setTextColor(120, 53, 15);
            noteLines.forEach((ln, i) => {
              pdf.text(ln, marginX + 4, y + 2 + i * 10 * 0.3528 * 1.45);
            });
            y += noteH + 2;
            break;
          case 'ul':
          case 'ol':
            (block.items || []).forEach((item, i) => {
              const bullet = block.type === 'ol' ? `${i + 1}. ` : '•  ';
              writeWrapped(bullet + item, { size: 10, indent: 4, color: [40, 40, 40] });
            });
            y += 1;
            break;
          case 'kv':
            (block.rows || []).forEach(([k, v]) => {
              writeWrapped(k, { size: 10, bold: true, color: [30, 41, 59] });
              writeWrapped(v, { size: 10, indent: 6, color: [71, 85, 105] });
              y += 0.5;
            });
            y += 1;
            break;
          case 'spacer':
            y += 3;
            break;
          default:
            break;
        }
      });

      // Final-page footer
      pdf.setFontSize(8); pdf.setTextColor(150);
      pdf.text(`Page ${pageNum} — Free GST Billing Software User Guide`, pageWidth / 2, pageHeight - 8, { align: 'center' });

      pdf.save('Free-GST-Billing-User-Guide.pdf');
      toast('User Guide PDF downloaded', 'success');
    } catch (err) {
      console.error(err);
      toast('PDF generation failed', 'error');
    }
    setGenerating(false);
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '900px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Guide</h1>
          <p className="page-subtitle">Everything from install to backup. Use the search box or download as a searchable PDF.</p>
        </div>
        <button className="btn btn-primary" onClick={downloadPDF} disabled={generating}>
          <Download size={16} /> {generating ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <div className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search the guide… (e.g. 'backup', 'TDS', 'unit')" value={search}
            onChange={e => setSearch(e.target.value)} className="form-input" style={{ flex: 1, border: 'none', background: 'transparent' }} />
          {search && <button className="icon-btn" onClick={() => setSearch('')} title="Clear search"><X size={14} /></button>}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', lineHeight: 1.6, fontSize: '0.88rem' }}>
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
            Nothing in the guide matches "{search}". Try a different word, or clear the search.
          </p>
        )}
        {filtered.map((block, i) => {
          const key = `${block.type}-${block._idx ?? i}`;
          switch (block.type) {
            case 'h1': return <h2 key={key} style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary, #1e40af)', marginTop: i === 0 ? 0 : '1.5rem', marginBottom: '0.75rem' }}>{highlight(block.text)}</h2>;
            case 'h2': return <h3 key={key} style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '1.4rem', marginBottom: '0.6rem' }}>{highlight(block.text)}</h3>;
            case 'h3': return <h4 key={key} style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.85rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>{highlight(block.text)}</h4>;
            case 'p':  return <p key={key} style={{ margin: '0.35rem 0' }}>{highlight(block.text)}</p>;
            case 'note': return (
              <div key={key} style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.65rem 0.85rem', margin: '0.5rem 0', color: '#78350f', fontSize: '0.85rem' }}>
                {highlight(block.text)}
              </div>
            );
            case 'ul': return <ul key={key} style={{ margin: '0.35rem 0 0.75rem 1.25rem' }}>{block.items.map((it, j) => <li key={j} style={{ marginBottom: '0.25rem' }}>{highlight(it)}</li>)}</ul>;
            case 'ol': return <ol key={key} style={{ margin: '0.35rem 0 0.75rem 1.5rem' }}>{block.items.map((it, j) => <li key={j} style={{ marginBottom: '0.25rem' }}>{highlight(it)}</li>)}</ol>;
            case 'kv': return (
              <table key={key} style={{ width: '100%', borderCollapse: 'collapse', margin: '0.5rem 0' }}>
                <tbody>
                  {block.rows.map(([k, v], j) => (
                    <tr key={j} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, verticalAlign: 'top', width: '30%', color: 'var(--text-primary)' }}>{highlight(k)}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>{highlight(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
            case 'spacer': return <div key={key} style={{ height: '0.5rem' }} />;
            default: return null;
          }
        })}
      </div>
    </div>
  );
}
