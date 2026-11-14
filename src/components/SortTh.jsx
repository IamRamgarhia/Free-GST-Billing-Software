// v1.10.86 - a column header that sorts its list (see useListSort in
// utils/listPrefs.js). The header is a button, so Tab + Enter sorts too. The
// arrow is drawn by CSS (.th-sort::after), so the header's text stays exactly
// the column name for screen readers and the smoke test.
export default function SortTh({ col, label, sort, onSort, className, style }) {
  const dir = sort?.key === col ? sort.dir : null;
  const title = !dir ? `Sort by ${label}`
    : dir === 'asc' ? `Sorted by ${label}: A-Z, oldest or lowest first. Click for the other way round`
      : `Sorted by ${label}: Z-A, newest or highest first. Click for the usual order`;
  return (
    <th className={className} style={style} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="th-sort" onClick={() => onSort(col)} title={title}>{label}</button>
    </th>
  );
}
