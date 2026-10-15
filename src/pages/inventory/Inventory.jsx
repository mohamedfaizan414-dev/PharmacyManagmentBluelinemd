import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PackagePlus, SlidersHorizontal, Trash2, Package } from "lucide-react";
import { inventoryApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Button, EmptyState, ErrorState, ExpiryBadge, PageHeader, Pagination, SearchInput, TableSkeleton } from "../../components/ui";
import AdjustModal from "./AdjustModal";
import ReceiveStockModal from "./ReceiveStockModal";
import { DEFAULT_REORDER_LEVEL, expiryState, groupByMedicine, stockState } from "../../utils/inventory";
import { daysUntil, formatDate, money } from "../../utils/format";

export default function Inventory() {
  useDocumentTitle("Inventory");
  const { access } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = ["stock", "expiry", "low"].includes(params.get("tab")) ? params.get("tab") : "stock";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adjust, setAdjust] = useState(null); // {batch, preset}
  const [receive, setReceive] = useState(false);
  const { data, loading, error, reload } = useAsync(() => inventoryApi.all(), []);

  const items = useMemo(() => data || [], [data]);
  const term = search.trim().toLowerCase();
  const matches = (b) => !term || b.name.toLowerCase().includes(term) || b.genericName.toLowerCase().includes(term) || b.batch.toLowerCase().includes(term);

  const stockRows = useMemo(() => items.filter(matches).sort((a, b) => a.name.localeCompare(b.name) || (a.expiryDate > b.expiryDate ? 1 : -1)), [items, term]); // eslint-disable-line react-hooks/exhaustive-deps
  const expiryRows = useMemo(() => items.filter((b) => b.stockUnits > 0 && ["expired", "critical", "warning"].includes(expiryState(b))).filter(matches).sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)), [items, term]); // eslint-disable-line react-hooks/exhaustive-deps
  const lowRows = useMemo(() => groupByMedicine(items).filter((g) => stockState(g) !== "ok").filter((g) => !term || g.name.toLowerCase().includes(term)).sort((a, b) => a.totalUnits - b.totalUnits), [items, term]);

  const allExpiry = useMemo(() => items.filter((b) => b.stockUnits > 0 && ["expired", "critical", "warning"].includes(expiryState(b))).length, [items]);
  const allLow = useMemo(() => groupByMedicine(items).filter((g) => stockState(g) !== "ok").length, [items]);

  const rows = tab === "stock" ? stockRows : tab === "expiry" ? expiryRows : lowRows;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const setTab = (t) => { setParams(t === "stock" ? {} : { tab: t }, { replace: true }); setPage(1); };
  const canEdit = access.canEdit();

  return (
    <>
      <PageHeader title="Inventory" subtitle="Batch-wise stock, expiry tracking and reorder alerts."
        actions={access.canCreate() && <Button icon={PackagePlus} onClick={() => setReceive(true)}>Receive stock</Button>} />
      <section className="card-box">
        <div className="tabs" role="tablist">
          {[["stock", "All stock", items.length], ["expiry", "Expiry watch", allExpiry, true], ["low", "Low stock", allLow, true]].map(([k, l, n, alert]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}<span className={`pill ${alert && n > 0 ? "alert" : ""}`}>{n}</span></button>
          ))}
        </div>
        <div className="toolbar"><SearchInput className="search" value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search medicine, generic or batch" /></div>

        {loading && !data ? <TableSkeleton rows={8} cols={6} /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : !rows.length ? (
          <EmptyState icon={Package} title={term ? "Nothing matches your search" : tab === "stock" ? "No stock yet" : tab === "expiry" ? "Nothing close to expiry" : "No low-stock medicines"} text={tab === "stock" && !term ? "Receive your first purchase invoice to add stock." : undefined} />
        ) : (
          <>
            <div className="table-wrap">
              {tab === "low" ? (
                <table className="bl-table">
                  <thead><tr><th>Medicine</th><th>Stock level</th><th className="r">In stock</th><th className="r">Reorder at</th><th>Status</th><th className="r">Batches</th></tr></thead>
                  <tbody>{paged.map((g) => {
                    const lvl = g.reorderLevel || DEFAULT_REORDER_LEVEL; const out = stockState(g) === "out";
                    return (
                      <tr key={g.key}>
                        <td><div className="cell-main">{g.name}</div><div className="cell-sub">{g.genericName}</div></td>
                        <td><span className="stock-bar"><i style={{ width: `${Math.min(100, (g.totalUnits / lvl) * 100)}%`, background: out ? "var(--danger)" : "var(--warning)" }} /></span></td>
                        <td className="r num fw-700">{g.totalUnits}</td><td className="r num">{lvl}</td>
                        <td>{out ? <span className="badge-bl b-red">Out of stock</span> : <span className="badge-bl b-amber">Low stock</span>}</td>
                        <td className="r">{g.batches.length}</td>
                      </tr>);
                  })}</tbody>
                </table>
              ) : (
                <table className="bl-table">
                  <thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th className="r">In stock</th><th className="r">Rate/strip</th><th className="c">GST</th><th>Rack</th>{canEdit && <th className="r">Action</th>}</tr></thead>
                  <tbody>{paged.map((b) => (
                    <tr key={b.id} className={expiryState(b) === "expired" ? "row-expired" : ""}>
                      <td><div className="cell-main">{b.name}</div><div className="cell-sub">{b.genericName}</div></td>
                      <td className="fw-600">{b.batch}</td>
                      <td><div>{formatDate(b.expiryDate)}</div><ExpiryBadge item={b} /></td>
                      <td className="r num fw-700" style={{ color: b.stockUnits === 0 ? "var(--danger)" : undefined }}>{b.stockUnits}{b.unitsPerStrip > 1 && <div className="cell-sub">{(b.stockUnits / b.unitsPerStrip).toFixed(1)} strips</div>}</td>
                      <td className="r num">{money(b.pricePerStrip)}</td><td className="c">{b.gstPercent}%</td><td>{b.rack || "—"}</td>
                      {canEdit && <td className="r"><div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
                        {tab === "expiry" && expiryState(b) === "expired" && <Button size="sm" variant="danger-outline" icon={Trash2} onClick={() => setAdjust({ batch: b, preset: "writeoff" })}>Write off</Button>}
                        <button className="icon-action" onClick={() => setAdjust({ batch: b })} aria-label={`Adjust stock for ${b.name} batch ${b.batch}`} title="Adjust stock"><SlidersHorizontal /></button>
                      </div></td>}
                    </tr>))}</tbody>
                </table>
              )}
            </div>
            <Pagination page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </section>
      <AdjustModal batch={adjust?.batch} preset={adjust?.preset} onClose={() => setAdjust(null)} onDone={() => { setAdjust(null); reload({ silent: true }); }} />
      <ReceiveStockModal open={receive} onClose={() => setReceive(false)} onDone={() => { setReceive(false); reload({ silent: true }); }} />
    </>
  );
}
