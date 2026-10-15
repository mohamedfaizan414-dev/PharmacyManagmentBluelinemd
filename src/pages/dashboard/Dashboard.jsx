import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, CreditCard, FileText, IndianRupee, Layers, ShoppingCart, Clock } from "lucide-react";
import { dashboardApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useQueue } from "../../context/QueueContext";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Alert, Button, EmptyState, ErrorState, Kpi, PageHeader, StatusBadge, TableSkeleton, TypeBadge, PriorityBadge } from "../../components/ui";
import { daysUntil, formatDate, money, number, timeAgo } from "../../utils/format";
import { expiryState, stockState, DEFAULT_REORDER_LEVEL } from "../../utils/inventory";

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const navigate = useNavigate();
  const { access } = useAuth();
  const { version } = useQueue();
  const { data, loading, error, reload } = useAsync(() => dashboardApi.load(), []);

  // Refresh quietly whenever the queue changes (a doctor sent something new).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    reload({ silent: true });
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = data?.stats;
  const money0 = (v) => (v == null ? "—" : money(v));

  return (
    <>
      <PageHeader
        title="Pharmacy Dashboard"
        subtitle="Welcome to BluelineMD EHR Pharmacy Module. Monitor operations and track stock."
        actions={<Button variant="outline" onClick={() => navigate("/billing")}>Billing Ledger</Button>}
      />

      {error && !data ? (
        <div className="card-box"><ErrorState message={error} onRetry={reload} /></div>
      ) : (
        <>
          <div className="grid grid-kpi">
            <Kpi icon={FileText} tone="blue" label="Total Pharmacy Bills" value={stats ? number(stats.totalBills) : "—"} loading={loading && !data} />
            <Kpi icon={IndianRupee} tone="green" label="Total Amount" value={money0(stats?.totalAmount)} loading={loading && !data} />
            <Kpi icon={CreditCard} tone="violet" label="Paid Amount" value={money0(stats?.paidAmount)} loading={loading && !data} />
            <Kpi icon={Clock} tone="amber" label="Pending Amount" value={money0(stats?.pendingAmount)} loading={loading && !data} />
          </div>

          {data?.failed?.stats && <Alert tone="warn" className="mt-16">Billing totals couldn't be loaded right now. Other sections are unaffected.</Alert>}

          <div className="grid grid-main mt-24">
            <div className="flex-col gap-24" style={{ minWidth: 0 }}>
              <section className="card-box">
                <div className="card-box__head"><h3>Quick Operation Shortcuts</h3></div>
                <div className="card-box__body">
                  <div className="shortcut-grid">
                    {access.canCreate() && <button className="shortcut primary" onClick={() => navigate("/pos")}><ShoppingCart />Walk-in POS Sale</button>}
                    <button className="shortcut outline" onClick={() => navigate("/prescriptions")}><ClipboardList />OPD/IPD Queue</button>
                    <button className="shortcut" onClick={() => navigate("/inventory")}><Layers />Manage Stock</button>
                  </div>
                </div>
              </section>

              <section className="card-box">
                <div className="card-box__head">
                  <h3>Recent Incoming Prescriptions &amp; Orders</h3>
                  <button className="link-btn" onClick={() => navigate("/prescriptions")}>View All Queue →</button>
                </div>
                {loading && !data ? <TableSkeleton rows={4} cols={5} /> : data?.failed?.queue ? (
                  <ErrorState compact message="The prescription queue couldn't be loaded." onRetry={reload} />
                ) : !data?.queue.length ? (
                  <EmptyState icon={ClipboardList} title="You're all caught up" text="New OPD and IPD prescriptions from the doctors will appear here the moment they're sent." />
                ) : (
                  <div className="table-wrap">
                    <table className="bl-table">
                      <thead><tr><th>Order ID</th><th>Patient</th><th>Type</th><th>Received</th><th>Status</th><th className="r">Actions</th></tr></thead>
                      <tbody>
                        {data.queue.map((o) => (
                          <tr key={o.id} className={o.priority === "URGENT" ? "row-urgent" : ""}>
                            <td><button className="link-btn link-id" onClick={() => navigate(`/prescriptions/${o.id}`)}>{o.orderNo}</button></td>
                            <td>
                              <div className="cell-main">Patient ID: {o.patient.code || "—"}</div>
                              <div className="cell-sub">{o.location || o.patient.name}</div>
                            </td>
                            <td><div className="flex gap-4 items-center wrap"><TypeBadge type={o.type} /><PriorityBadge priority={o.priority} /></div></td>
                            <td><div>{formatDate(o.createdAt)}</div><div className="cell-sub">{timeAgo(o.createdAt)}</div></td>
                            <td><StatusBadge status={o.status} /></td>
                            <td className="r"><Button size="sm" onClick={() => navigate(`/prescriptions/${o.id}`)}>Process</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="flex-col gap-24" style={{ minWidth: 0 }}>
              <section className="card-box">
                <div className="card-box__head"><h3>Expiring Soon (FEFO Queue)</h3></div>
                <div className="card-box__body">
                  {loading && !data ? <div className="skeleton" style={{ height: 150 }} /> : data?.failed?.stock ? (
                    <ErrorState compact message="Stock data couldn't be loaded." onRetry={reload} />
                  ) : !data?.expiring.length ? (
                    <p className="muted fs-14">No batches are close to expiry. 🎉</p>
                  ) : data.expiring.map((b) => {
                    const st = expiryState(b);
                    const d = daysUntil(b.expiryDate);
                    return (
                      <div key={b.id} className={`alert-row ${st === "warning" ? "amber" : "red"}`}>
                        <div style={{ minWidth: 0 }}>
                          <div className="name">{b.name}</div>
                          <div className="meta">Batch: <b>{b.batch}</b> | Stock: <b>{b.stockUnits}</b></div>
                        </div>
                        <div className="text-right">
                          <span className={`tag-outline ${st === "warning" ? "amber" : "red"}`}>EXP: {b.expiryDate?.slice(0, 10)}</span>
                          <div className="fs-12 fw-700 mt-4" style={{ color: st === "expired" ? "var(--danger)" : "var(--text-2)" }}>
                            {st === "expired" ? `EXPIRED ${Math.abs(d)}D AGO` : "PRIORITIZE DISPENSE"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card-box">
                <div className="card-box__head"><h3>Critical Stock Alerts</h3><button className="link-btn" onClick={() => navigate("/inventory?tab=low")}>View all →</button></div>
                <div className="card-box__body">
                  {loading && !data ? <div className="skeleton" style={{ height: 120 }} /> : !data?.lowStock.length ? (
                    <p className="muted fs-14">Every medicine is above its reorder level.</p>
                  ) : data.lowStock.map((g) => {
                    const out = stockState(g) === "out";
                    return (
                      <div key={g.key} className={`alert-row ${out ? "red" : "amber"}`}>
                        <div style={{ minWidth: 0 }}>
                          <div className="name">{g.name}</div>
                          <div className="meta">In stock: <b>{g.totalUnits}</b> | Reorder at: <b>{g.reorderLevel || DEFAULT_REORDER_LEVEL}</b></div>
                        </div>
                        <span className={`tag-outline ${out ? "red" : "amber"}`}>{out ? "OUT OF STOCK" : "LOW STOCK"}</span>
                      </div>
                    );
                  })}
                  {!loading && data && !data.lowStock.length && !data.failed.stock && null}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
