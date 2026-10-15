import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { inventoryApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { Alert, Button, Field, Modal } from "../../components/ui";
import { errorMessage, toISODate } from "../../utils/format";

const blank = () => ({ id: Math.random().toString(36).slice(2), medicineId: "", batch: "", expiry: "", strips: "", free: "", units: "", rate: "", mrp: "", gst: "12" });

/** Stock-in (purchase invoice). Posts the same payload the admin panel's inventory invoice uses. */
export default function ReceiveStockModal({ open, onClose, onDone }) {
  const refs = useAsync(async () => {
    const [medicines, manufacturers] = await Promise.all([inventoryApi.medicines(), inventoryApi.manufacturers()]);
    return { medicines, manufacturers };
  }, [open], { immediate: open });
  const [mf, setMf] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));
  const [rows, setRows] = useState([blank()]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const meds = refs.data?.medicines || [];
  const upd = (id, patch) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const pickMed = (id, medicineId) => { const m = meds.find((x) => x.id === medicineId); upd(id, { medicineId, gst: String(m?.gstPercent ?? 12) }); };

  const validate = () => {
    if (!mf) return "Choose the supplier / manufacturer.";
    if (!date) return "Enter the invoice date.";
    const today = toISODate(new Date());
    for (const [i, r] of rows.entries()) {
      const n = `Row ${i + 1}: `;
      if (!r.medicineId) return `${n}choose a medicine.`;
      if (!r.batch.trim()) return `${n}enter the batch number.`;
      if (!r.expiry) return `${n}enter the expiry date.`;
      if (r.expiry <= today) return `${n}expiry date must be in the future.`;
      if (!(Number(r.strips) > 0)) return `${n}enter the number of strips.`;
      if (!(Number(r.units) > 0)) return `${n}enter units per strip.`;
      if (!(Number(r.rate) > 0)) return `${n}enter the rate per strip.`;
      if (r.mrp && Number(r.mrp) < Number(r.rate) * 0) return `${n}check MRP.`;
    }
    return "";
  };

  const submit = async () => {
    const v = validate();
    setErr(v);
    if (v) return;
    setBusy(true);
    try {
      await inventoryApi.createInvoice({
        manufacturer: mf, invoiceDate: date,
        items: rows.map((r) => {
          const m = meds.find((x) => x.id === r.medicineId);
          return { medicineId: r.medicineId, medicineName: m?.name, batch: r.batch.trim(), hsnCode: m?.hsn || "", expiryDate: r.expiry,
            unitsPerStrip: Number(r.units), noOfStrips: Number(r.strips), freeStrips: Number(r.free || 0), pricePerStrip: Number(r.rate),
            mrpPerStrip: Number(r.mrp || r.rate), gstPercent: Number(r.gst || 0), discountPercent: 0, quantity: (Number(r.strips) + Number(r.free || 0)) * Number(r.units) };
        }),
        overallDiscountPercent: 0, paidAmount: 0, paymentMode: "CASH",
      });
      toast.success("Stock received");
      setRows([blank()]); setMf("");
      onDone();
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Receive stock" size="xl"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={submit} loading={busy}>Add to inventory</Button></>}>
      {refs.error ? <Alert tone="danger">{refs.error} <button className="link-btn" onClick={() => refs.reload()}>Retry</button></Alert> : (
        <>
          {err && <Alert tone="danger" className="mb-16">{err}</Alert>}
          <div className="form-grid mb-16">
            <Field label="Supplier / manufacturer" required>{(p) => <select {...p} className="bl-select" value={mf} onChange={(e) => setMf(e.target.value)}><option value="">Select…</option>{(refs.data?.manufacturers || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}</Field>
            <Field label="Invoice date" required>{(p) => <input {...p} type="date" className="bl-input" value={date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />}</Field>
          </div>
          <div className="table-wrap">
            <table className="bl-table rows-editor">
              <thead><tr><th style={{ minWidth: 220 }}>Medicine</th><th>Batch</th><th>Expiry</th><th>Strips</th><th>Free</th><th>Units/strip</th><th>Rate/strip</th><th>MRP/strip</th><th>GST %</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><select className="bl-select" value={r.medicineId} onChange={(e) => pickMed(r.id, e.target.value)} aria-label="Medicine"><option value="">{refs.loading ? "Loading…" : "Select medicine"}</option>{meds.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
                    <td><input className="bl-input" style={{ width: 100 }} value={r.batch} onChange={(e) => upd(r.id, { batch: e.target.value })} aria-label="Batch" maxLength={30} /></td>
                    <td><input type="date" className="bl-input" value={r.expiry} onChange={(e) => upd(r.id, { expiry: e.target.value })} aria-label="Expiry" /></td>
                    {["strips", "free", "units", "rate", "mrp", "gst"].map((k) => (
                      <td key={k}><input type="number" min="0" step={k === "rate" || k === "mrp" ? "0.01" : "1"} className="bl-input" style={{ width: k === "rate" || k === "mrp" ? 92 : 70 }} value={r[k]} onChange={(e) => upd(r.id, { [k]: e.target.value })} aria-label={k} onWheel={(e) => e.currentTarget.blur()} /></td>
                    ))}
                    <td><button className="icon-action danger" disabled={rows.length === 1} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label="Remove row"><Trash2 /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" icon={Plus} className="mt-12" onClick={() => setRows((r) => [...r, blank()])}>Add another batch</Button>
        </>
      )}
    </Modal>
  );
}
