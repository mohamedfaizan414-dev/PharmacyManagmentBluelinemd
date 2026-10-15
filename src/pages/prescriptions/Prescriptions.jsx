import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, RefreshCw } from "lucide-react";
import { ordersApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useQueue } from "../../context/QueueContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Button, EmptyState, ErrorState, PageHeader, Pagination, PriorityBadge, SearchInput, StatusBadge, TableSkeleton, TypeBadge } from "../../components/ui";
import { formatDateTime, initials, timeAgo } from "../../utils/format";

const STATUS_FILTERS = [
  { key: "open", label: "Open", value: "PENDING,REQUESTED,IN_PROGRESS,PARTIALLY_DISPENSED" },
  { key: "awaiting", label: "Awaiting", value: "PENDING,REQUESTED", countKey: "AWAITING" },
  { key: "done", label: "Dispensed", value: "DISPENSED" },
  { key: "closed", label: "Rejected / Cancelled", value: "REJECTED,CANCELLED" },
  { key: "all", label: "All", value: "" },
];

export default function Prescriptions() {
  useDocumentTitle("Prescriptions & Orders");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { counts, version } = useQueue();

  const type = params.get("type") || "";
  const statusKey = params.get("status") || "open";
  const urlSearch = params.get("search") || "";
  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debounced = useDebounce(search, 400);

  // keep the box in sync when the header search navigates here with ?search=
  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setPage(1);
  };
  useEffect(() => {
    if (debounced !== urlSearch) setParam("search", debounced.trim());
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusValue = STATUS_FILTERS.find((s) => s.key === statusKey)?.value ?? STATUS_FILTERS[0].value;
  const { data, loading, error, reload } = useAsync(
    () => ordersApi.list({ page, limit: pageSize, search: urlSearch, type, status: statusValue }),
    [page, pageSize, urlSearch, type, statusValue],
  );

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    reload({ silent: true });
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader
        title="Prescriptions & Orders"
        subtitle="OPD and IPD prescriptions sent by doctors. Open one to check stock, pick batches and dispense."
        actions={<Button variant="ghost" icon={RefreshCw} onClick={() => reload()} loading={loading && !!data}>Refresh</Button>}
      />

      <section className="card-box">
        <div className="toolbar">
          <SearchInput className="search" value={search} onChange={setSearch} placeholder="Search patient, ID, doctor or order no." />
          <div className="seg" role="group" aria-label="Filter by type">
            {[["", "All"], ["OPD", "OPD"], ["IPD", "IPD"]].map(([v, l]) => (
              <button key={l} className={type === v ? "active" : ""} onClick={() => setParam("type", v)} aria-pressed={type === v}>{l}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Filter by status" style={{ flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((s) => (
              <button key={s.key} className={statusKey === s.key ? "active" : ""} onClick={() => setParam("status", s.key === "open" ? "" : s.key)} aria-pressed={statusKey === s.key}>
                {s.label}
                {s.countKey && counts[s.countKey] > 0 && <span className="count">{counts[s.countKey]}</span>}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? <TableSkeleton rows={7} cols={6} /> : error && !data ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data?.rows.length ? (
          <EmptyState
            icon={ClipboardList}
            title={urlSearch ? "No prescriptions match your search" : "Nothing in this list"}
            text={urlSearch ? "Check the spelling, or try a patient ID or order number." : "When doctors send OPD or IPD prescriptions, they'll appear here."}
            action={(urlSearch || type || statusKey !== "open") && <Button variant="outline" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}>Clear filters</Button>}
          />
        ) : (
          <>
            <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
              <table className="bl-table">
                <thead>
                  <tr><th>Order ID</th><th>Patient</th><th>Doctor</th><th>Type</th><th>Received</th><th className="c">Items</th><th>Status</th><th className="r">Action</th></tr>
                </thead>
                <tbody>
                  {data.rows.map((o) => {
                    const done = ["DISPENSED", "REJECTED", "CANCELLED"].includes(o.status);
                    return (
                      <tr key={o.id} className={`clickable ${o.priority === "URGENT" && !done ? "row-urgent" : ""}`} onClick={() => navigate(`/prescriptions/${o.id}`)}>
                        <td><span className="link-id">{o.orderNo}</span></td>
                        <td>
                          <div className="flex items-center gap-12">
                            <span className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{initials(o.patient.name)}</span>
                            <div>
                              <div className="cell-main">{o.patient.name || "—"}</div>
                              <div className="cell-sub">{o.patient.code ? `ID: ${o.patient.code}` : ""}{o.location ? ` · ${o.location}` : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td><div>{o.doctor.name || "—"}</div><div className="cell-sub">{o.doctor.department}</div></td>
                        <td><div className="flex gap-4 items-center wrap"><TypeBadge type={o.type} /><PriorityBadge priority={o.priority} /></div></td>
                        <td title={formatDateTime(o.createdAt)}><div>{timeAgo(o.createdAt)}</div><div className="cell-sub">{formatDateTime(o.createdAt)}</div></td>
                        <td className="c">{o.items.length}</td>
                        <td><StatusBadge status={o.status} /></td>
                        <td className="r">
                          <Button size="sm" variant={done ? "ghost" : "primary"} onClick={(e) => { e.stopPropagation(); navigate(`/prescriptions/${o.id}`); }}>{done ? "View" : "Process"}</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
          </>
        )}
      </section>
    </>
  );
}
