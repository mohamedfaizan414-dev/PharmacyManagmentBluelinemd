import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES } from "../../config/constants";

export default function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const win = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let p = start; p <= Math.min(pages, start + 4); p++) win.push(p);

  return (
    <div className="pager">
      <div className="flex items-center gap-12 wrap">
        <span>Showing <b>{from}–{to}</b> of <b>{total}</b></span>
        {onPageSize && (
          <label className="flex items-center gap-8">
            <span className="sr-only">Rows per page</span>
            <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="pager__btns">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
        {win.map((p) => (
          <button key={p} className={p === page ? "active" : ""} onClick={() => onPage(p)} aria-current={p === page ? "page" : undefined}>{p}</button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
