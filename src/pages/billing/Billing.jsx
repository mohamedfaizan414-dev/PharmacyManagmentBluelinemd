import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, CreditCard, FileText, IndianRupee, ReceiptText, ShoppingCart } from "lucide-react";
import { billsApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Button, EmptyState, ErrorState, Kpi, PageHeader, Pagination, SearchInput, StatusBadge, TableSkeleton, TypeBadge } from "../../components/ui";
import { formatDateTime, money, number } from "../../utils/format";

const STATUSES = [["", "All"], ["PAID", "Paid"], ["PARTIAL", "Partial"], ["UNPAID", "Unpaid"]];

export default function Billing() {
  useDocumentTitle("Billing & Invoices");
  const navigate = useNavigate();
  const { access } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useDebounce(search.trim(), 400);
  const badRange = from && to && from > to;

  const { data, loading, error, reload } = useAsync(
    () => (badRange ? Promise.resolve(null) : billsApi.list({ page, limit: pageSize, search: q, status, from, to })),
    [page, pageSize, q, status, from, to],
  );
  const s = data?.stats;
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader title="Billing & Invoices" subtitle="Every pharmacy bill – prescription and walk-in – with payment status."
        actions={access.canCreate() && <Button icon={ShoppingCart} onClick={() => navigate("/pos")}>New walk-in sale</Button>} />

      <div className="grid grid-kpi mb-24">
        <Kpi icon={FileText} tone="blue" label="Total Pharmacy Bills" value={s ? number(s.totalBills) : "—"} loading={loading && !data} />
        <Kpi icon={IndianRupee} tone="green" label="Total Amount" value={s ? money(s.totalAmount) : "—"} loading={loading && !data} />
        <Kpi icon={CreditCard} tone="violet" label="Paid Amount" value={s ? money(s.paidAmount) : "—"} loading={loading && !data} />
        <Kpi icon={Clock} tone="amber" label="Pending Amount" value={s ? money(s.pendingAmount) : "—"} loading={loading && !data} />
      </div>

      <section className="card-box">
        <div className="toolbar">
          <SearchInput className="search" value={search} onChange={reset(setSearch)} placeholder="Search bill no., patient or phone" />
          <div className="seg" role="group" aria-label="Payment status">
            {STATUSES.map(([v, l]) => <button key={l} className={status === v ? "active" : ""} onClick={() => reset(setStatus)(v)} aria-pressed={status === v}>{l}</button>)}
          </div>
          <div className="flex items-center gap-8">
            <input type="date" className="bl-input sm" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} aria-label="From date" />
            <span className="muted">to</span>
            <input type="date" className="bl-input sm" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} aria-label="To date" />
            {(from || to) && <button className="link-btn" onClick={() => { setFrom(""); setTo(""); setPage(1); }}>Clear</button>}
          </div>
        </div>
        {badRange ? <ErrorState compact message="The 'from' date is after the 'to' date." /> : loading && !data ? <TableSkeleton rows={7} cols={7} /> : error && !data ? <ErrorState message={error} onRetry={reload} /> :
          !data?.rows.length ? <EmptyState icon={ReceiptText} title="No bills found" text="Try a different search or date range." /> : (
            <>
              <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
                <table className="bl-table">
                  <thead><tr><th>Bill No.</th><th>Patient</th><th>Source</th><th>Date</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.rows.map((b) => (
                      <tr key={b.id} className="clickable" onClick={() => navigate(`/billing/${b.id}`)}>
                        <td><span className="link-id">{b.billNo}</span></td>
                        <td><div className="cell-main">{b.patientName}</div><div className="cell-sub">{b.phone}</div></td>
                        <td><TypeBadge type={b.source} /></td>
                        <td>{formatDateTime(b.createdAt)}</td>
                        <td className="r num fw-700">{money(b.total)}</td>
                        <td className="r num">{money(b.paid)}</td>
                        <td className="r num" style={{ color: b.balance > 0 ? "var(--danger)" : undefined }}>{money(b.balance)}</td>
                        <td><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
            </>
          )}
      </section>
    </>
  );
}
