import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { inventoryApi } from "../../api/services";
import { ADJUST_REASONS } from "../../config/constants";
import { Alert, Button, Field, Modal, NumberInput } from "../../components/ui";
import { errorMessage } from "../../utils/format";

export default function AdjustModal({ batch, preset, onClose, onDone }) {
  const [dir, setDir] = useState("remove");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(ADJUST_REASONS[0]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!batch) return;
    setErr(""); setBusy(false);
    if (preset === "writeoff") { setDir("remove"); setQty(batch.stockUnits); setReason("Expired – written off"); }
    else { setDir("remove"); setQty(""); setReason(ADJUST_REASONS[0]); }
  }, [batch, preset]);

  if (!batch) return null;
  const n = Number(qty) || 0;
  const after = batch.stockUnits + (dir === "add" ? n : -n);

  const submit = async () => {
    if (!(n > 0)) return setErr("Enter a quantity greater than zero.");
    if (after < 0) return setErr(`You can't remove more than the ${batch.stockUnits} units in stock.`);
    setBusy(true);
    try {
      await inventoryApi.adjust(batch.id, { delta: dir === "add" ? n : -n, reason });
      toast.success("Stock updated");
      onDone();
    } catch (e) { setErr(errorMessage(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={() => !busy && onClose()} title="Adjust stock"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} onClick={submit} variant={dir === "remove" ? "danger" : "primary"}>{dir === "remove" ? "Remove stock" : "Add stock"}</Button></>}>
      <div className="mb-16"><b>{batch.name}</b><div className="cell-sub">Batch {batch.batch} · Current stock {batch.stockUnits} units</div></div>
      {err && <Alert tone="danger" className="mb-16">{err}</Alert>}
      <div className="flex-col gap-16">
        <div className="seg" role="group" aria-label="Direction">
          <button className={dir === "remove" ? "active" : ""} onClick={() => setDir("remove")}>Remove</button>
          <button className={dir === "add" ? "active" : ""} onClick={() => setDir("add")}>Add</button>
        </div>
        <Field label="Quantity (units)" required>{(p) => <NumberInput {...p} value={qty} onChange={setQty} min={0} data-autofocus />}</Field>
        <Field label="Reason" required>{(p) => <select {...p} className="bl-select" value={reason} onChange={(e) => setReason(e.target.value)}>{ADJUST_REASONS.map((r) => <option key={r}>{r}</option>)}</select>}</Field>
        <div className="muted fs-14">Stock after adjustment: <b style={{ color: after < 0 ? "var(--danger)" : "var(--text)" }}>{after}</b> units</div>
      </div>
    </Modal>
  );
}
