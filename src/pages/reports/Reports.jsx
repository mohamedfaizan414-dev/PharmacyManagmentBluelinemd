import { useState } from "react";
import { BarChart3, CreditCard, IndianRupee, Package, ReceiptText, Undo2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { reportsApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Alert, EmptyState, ErrorState, Kpi, PageHeader } from "../../components/ui";
import { money, number, toISODate } from "../../utils/format";

const COLORS = ["#0d67b7", "#d70d78", "#0e7490", "#f59e0b", "#6d28d9", "#15803d"];
const PRESETS = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]];
const rangeFor = (days) => ({ from: toISODate(new Date(Date.now() - (days - 1) * 86400000)), to: toISODate(new Date()) });
const short = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const compact = (v) => (v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${v}`);

export default function Reports() {
  useDocumentTitle("Reports & Analytics");
  const [preset, setPreset] = useState("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = preset === "custom" ? custom : rangeFor(Number(preset));
  const invalid = preset === "custom" && (!custom.from || !custom.to || custom.from > custom.to);
  const { data, loading, error, reload } = useAsync(() => (invalid ? Promise.resolve(null) : reportsApi.summary(range)), [range.from, range.to, invalid]);
  const t = data?.totals;

  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Sales, collections and best-selling medicines." />
      <section className="card-box mb-24"><div className="toolbar" style={{ borderBottom: 0 }}>
        <div className="seg" role="group" aria-label="Date range">
          {PRESETS.map(([v, l]) => <button key={v} className={preset === v ? "active" : ""} onClick={() => setPreset(v)}>{l}</button>)}
          <button className={preset === "custom" ? "active" : ""} onClick={() => setPreset("custom")}>Custom</button>
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-8">
            <input type="date" className="bl-input sm" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From date" />
            <span className="muted">to</span>
            <input type="date" className="bl-input sm" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To date" />
          </div>
        )}
      </div></section>

      {invalid ? <Alert tone="info">Pick a valid start and end date to see the report.</Alert> : error && !data ? <div className="card-box"><ErrorState message={error} onRetry={reload} /></div> : (
        <>
          <div className="grid grid-kpi">
            <Kpi icon={IndianRupee} tone="green" label="Sales" value={t ? money(t.sales) : "—"} sub={t && `${number(t.bills)} bills`} loading={loading && !data} />
            <Kpi icon={CreditCard} tone="blue" label="Collected" value={t ? money(t.collected) : "—"} loading={loading && !data} />
            <Kpi icon={ReceiptText} tone="amber" label="Pending" value={t ? money(t.pending) : "—"} loading={loading && !data} />
            <Kpi icon={Package} tone="violet" label="Units sold" value={t ? number(t.unitsSold) : "—"} loading={loading && !data} />
            <Kpi icon={Undo2} tone="red" label="Refunds" value={t ? money(t.refunds) : "—"} loading={loading && !data} />
          </div>

          {data && t.bills === 0 ? <div className="card-box mt-24"><EmptyState icon={BarChart3} title="No sales in this period" text="Try a wider date range." /></div> : data && (
            <div className="grid mt-24" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
              <section className="card-box" style={{ gridColumn: "1 / -1" }}>
                <div className="card-box__head"><h3>Daily sales</h3></div>
                <div className="card-box__body chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily} margin={{ left: 0, right: 12, top: 8 }}>
                      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d67b7" stopOpacity={0.3} /><stop offset="100%" stopColor="#0d67b7" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 12 }} minTickGap={24} />
                      <YAxis tickFormatter={compact} tick={{ fontSize: 12 }} width={56} />
                      <Tooltip formatter={(v) => [money(v), "Sales"]} labelFormatter={short} />
                      <Area type="monotone" dataKey="sales" stroke="#0d67b7" strokeWidth={2} fill="url(#g)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card-box">
                <div className="card-box__head"><h3>Sales by source</h3></div>
                <div className="card-box__body">
                  <div style={{ height: 190 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.bySource} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{data.bySource.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => money(v)} /></PieChart></ResponsiveContainer></div>
                  {data.bySource.map((s, i) => <div className="legend-row" key={s.name}><span><i style={{ background: COLORS[i % COLORS.length] }} />{s.name === "WALKIN" ? "Walk-in" : s.name}</span><b className="num">{money(s.value)}</b></div>)}
                </div>
              </section>

              <section className="card-box">
                <div className="card-box__head"><h3>Collections by payment mode</h3></div>
                <div className="card-box__body">
                  <div style={{ height: 190 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.byPayment} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{data.byPayment.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => money(v)} /></PieChart></ResponsiveContainer></div>
                  {data.byPayment.map((s, i) => <div className="legend-row" key={s.name}><span><i style={{ background: COLORS[(i + 2) % COLORS.length] }} />{s.name}</span><b className="num">{money(s.value)}</b></div>)}
                </div>
              </section>

              <section className="card-box" style={{ gridColumn: "1 / -1" }}>
                <div className="card-box__head"><h3>Top medicines by revenue</h3></div>
                <div className="card-box__body" style={{ height: 40 + data.topMedicines.length * 38 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topMedicines} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" horizontal={false} />
                      <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 12 }} tickFormatter={(n) => (n.length > 30 ? `${n.slice(0, 29)}…` : n)} />
                      <Tooltip formatter={(v, n) => [n === "revenue" ? money(v) : v, n === "revenue" ? "Revenue" : "Units"]} />
                      <Bar dataKey="revenue" fill="#d70d78" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
