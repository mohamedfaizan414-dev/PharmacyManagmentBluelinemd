import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { billsApi, returnsApi } from "../../api/services";
import { useDebounce } from "../../hooks/useDebounce";
import { RETURN_REASONS } from "../../config/constants";
import { Alert, Button, Modal, NumberInput, SearchInput, StatusBadge } from "../../components/ui";
import { errorMessage, formatDate, money, round2 } from "../../utils/format";

/** Two steps: find the original bill → choose items, quantities and reasons. */
export default function ReturnModal({ open, presetBillId, onClose, onDone }) {
  const [bill, setBill] = useState(null);
  const [q, setQ] = useState("");
  const term = useDebounce(q.trim(), 350);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState({}); // inventoryId -> {qty, reason}
  const [mode, setMode] = useState("CASH");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBill(null); setQ(""); setSel({}); setErr(""); setResults([]); setMode("CASH");
    if (presetBillId) {
      setLoading(true);
      billsApi.get(presetBillId).then(setBill).catch((e) => setErr(errorMessage(e))).finally(() => setLoading(false));
    }
  }, [open, presetBillId]);

  useEffect(() => {
    if (!open || bill || term.length < 2) { setResults([]); return undefined; }
    let live = true;
    setLoading(true);
    billsApi.list({ search: term, limit: 8 }).then((r) => live && setResults(r.rows)).catch((e) => live && setErr(errorMessage(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [term, bill, open]);

  const returnable = (i) => Math.max(0, i.qty - i.returnedQty);
  const chosen = bill ? bill.items.filter((i) => Number(sel[i.inventoryId]?.qty) > 0) : [];
  const refund = round2(chosen.reduce((s, i) => s + (i.amount / i.qty) * Number(sel[i.inventoryId].qty), 0));

  const submit = async () => {
    if (!chosen.length) return setErr("Enter a return quantity for at least one item.");
    const noReason = chosen.find((i) => !sel[i.inventoryId].reason);
    if (noReason) return setErr(`Choose a reason for ${noReason.name}.`);
    setBusy(true); setErr("");
    try {
      await returnsApi.create({
        billId: bill.id, refundMode: mode,
        items: chosen.map((i) => ({ inventoryId: i.inventoryId, quantity: Number(sel[i.inventoryId].qty), reason: sel[i.inventoryId].reason })),
      });
      toast.success(`Return processed · refund ${money(refund)}`);
      onDone();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={bill ? `Return against ${bill.billNo}` : "New return"} size="lg"
      footer={bill && <><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!chosen.length} onClick={submit}>Refund {money(refund)}</Button></>}>
      {err && <Alert tone="danger" className="mb-16">{err}</Alert>}
      {!bill ? (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Find the original bill by number, patient or phone" data-autofocus />
          <div className="mt-16" style={{ border: results.length ? "1px solid var(--border)" : 0, borderRadius: 8 }}>
            {loading ? <p className="muted">Searching…</p> : term.length >= 2 && !results.length ? <p className="muted">No bills found.</p> : results.map((b) => (
              <button key={b.id} className="result-row" onClick={() => setBill(b)}>
                <span><b>{b.billNo}</b> · {b.patientName}<span className="cell-sub" style={{ display: "block" }}>{formatDate(b.createdAt)} · {b.items.length} item(s)</span></span>
                <span className="flex items-center gap-8"><b className="num">{money(b.total)}</b><StatusBadge status={b.status} /></span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex between wrap gap-8 mb-16"><span><b>{bill.patientName}</b> · {formatDate(bill.createdAt)}</span>{!presetBillId && <button className="link-btn" onClick={() => { setBill(null); setSel({}); }}>Change bill</button>}</div>
          <div className="table-wrap">
            <table className="bl-table">
              <thead><tr><th>Medicine</th><th className="r">Sold</th><th className="r">Returnable</th><th>Return qty</th><th>Reason</th></tr></thead>
              <tbody>{bill.items.map((i) => {
                const max = returnable(i); const s = sel[i.inventoryId] || {};
                return (
                  <tr key={i.id} style={max === 0 ? { opacity: 0.5 } : undefined}>
                    <td><div className="cell-main">{i.name}</div><div className="cell-sub">Batch {i.batch}</div></td>
                    <td className="r num">{i.qty}</td><td className="r num">{max}</td>
                    <td><NumberInput className="bl-input sm qty-input" disabled={max === 0} value={s.qty ?? ""} max={max} placeholder="0" aria-label={`Return quantity for ${i.name}`} onChange={(v) => setSel({ ...sel, [i.inventoryId]: { ...s, qty: v } })} /></td>
                    <td><select className="bl-select sm" disabled={max === 0 || !(Number(s.qty) > 0)} value={s.reason || ""} onChange={(e) => setSel({ ...sel, [i.inventoryId]: { ...s, reason: e.target.value } })} aria-label={`Reason for ${i.name}`}><option value="">Select…</option>{RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}</select></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
          <div className="field mt-16" style={{ maxWidth: 260 }}>
            <label htmlFor="refund-mode">Refund via</label>
            <select id="refund-mode" className="bl-select" value={mode} onChange={(e) => setMode(e.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="CREDIT">Credit note</option></select>
          </div>
          <p className="field-hint mt-8">Damaged, expired and adverse-reaction returns are not put back into sellable stock.</p>
        </>
      )}
    </Modal>
  );
}
