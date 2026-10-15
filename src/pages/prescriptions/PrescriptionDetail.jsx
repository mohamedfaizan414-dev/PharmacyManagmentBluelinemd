import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { AlertTriangle, ArrowRightLeft, Ban, CheckCircle2, PackageX, Pill, PlayCircle, RotateCcw, ReceiptText } from "lucide-react";
import { inventoryApi, ordersApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useQueue } from "../../context/QueueContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Alert, Button, ConfirmDialog, ErrorState, ExpiryBadge, NumberInput, PageHeader, PageLoader, PriorityBadge, StatusBadge, TypeBadge } from "../../components/ui";
import PaymentPanel, { emptyPayment, resolvePayment } from "../../components/pharmacy/PaymentPanel";
import SubstituteModal from "./SubstituteModal";
import { batchesForMedicine } from "../../utils/inventory";
import { buildBillPayload, computeTotals, lineFromInventory } from "../../utils/billing";
import { allergyHits } from "../../utils/allergy";
import { errorMessage, formatDate, formatDateTime, initials, money } from "../../utils/format";

const CLOSED = ["DISPENSED", "REJECTED", "CANCELLED"];
const remainingOf = (it) => Math.max(0, it.qtyPrescribed - it.qtyDispensed);

/** FEFO fill: take from the earliest-expiring sellable batches until `need` is met. */
const autoAllocate = (batches, need) => {
  const picks = {};
  let left = need;
  for (const b of batches) {
    if (left <= 0) break;
    const take = Math.min(left, b.stockUnits);
    if (take > 0) { picks[b.id] = take; left -= take; }
  }
  return picks;
};

export default function PrescriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { access } = useAuth();
  const { refresh: refreshQueue } = useQueue();
  const orderQ = useAsync(() => ordersApi.get(id), [id]);
  const stockQ = useAsync(() => inventoryApi.all(), [id]);
  const order = orderQ.data;
  const inventory = useMemo(() => stockQ.data || [], [stockQ.data]);
  useDocumentTitle(order ? `${order.orderNo}` : "Prescription");

  const [plan, setPlan] = useState(null); // { [itemId]: { include, medicine:{medicineId,name}|null, picks:{[invId]:qty} } }
  const [pay, setPay] = useState(emptyPayment());
  const [notes, setNotes] = useState("");
  const [closeRest, setCloseRest] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [subFor, setSubFor] = useState(null);

  const invMap = useMemo(() => Object.fromEntries(inventory.map((b) => [b.id, b])), [inventory]);
  const closed = order ? CLOSED.includes(order.status) : false;
  const canDispense = access.canCreate();
  const canReject = access.canEdit() || access.canCreate();

  const batchesFor = (it, medicine) => batchesForMedicine(inventory, { medicineId: medicine?.medicineId ?? it.medicineId, name: medicine?.name ?? it.name });

  const buildPlan = () => {
    const next = {};
    order.items.forEach((it) => {
      const need = remainingOf(it);
      const picks = autoAllocate(batchesFor(it, null), need);
      next[it.id] = { include: need > 0, medicine: null, picks };
    });
    return next;
  };

  // Initialise the FEFO plan once both the order and the stock have loaded.
  useEffect(() => {
    if (order && stockQ.data && !plan && !closed) setPlan(buildPlan());
  }, [order, stockQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemState = (it) => {
    const p = plan?.[it.id];
    const need = remainingOf(it);
    const given = p ? Object.values(p.picks).reduce((s, q) => s + (Number(q) || 0), 0) : 0;
    return { p, need, given, short: p?.include ? Math.max(0, need - given) : need };
  };

  const lines = useMemo(() => {
    if (!plan || !order) return [];
    return order.items.flatMap((it) => {
      const p = plan[it.id];
      if (!p?.include) return [];
      return Object.entries(p.picks).filter(([bid, q]) => Number(q) > 0 && invMap[bid]).map(([bid, q]) => lineFromInventory(invMap[bid], Number(q), { itemId: it.id, key: `${it.id}-${bid}` }));
    });
  }, [plan, order, invMap]);

  const totals = useMemo(() => computeTotals(lines, pay.discountPct), [lines, pay.discountPct]);
  const resolved = resolvePayment(pay, totals);

  const setPick = (itemId, bid, qty) => setPlan((pl) => ({ ...pl, [itemId]: { ...pl[itemId], picks: { ...pl[itemId].picks, [bid]: qty === "" ? "" : Number(qty) } } }));
  const toggle = (itemId, include) => setPlan((pl) => ({ ...pl, [itemId]: { ...pl[itemId], include } }));
  const resetItem = (it) => setPlan((pl) => ({ ...pl, [it.id]: { include: remainingOf(it) > 0, medicine: null, picks: autoAllocate(batchesFor(it, null), remainingOf(it)) } }));
  const substitute = (it, medicine) => setPlan((pl) => ({ ...pl, [it.id]: { include: true, medicine, picks: autoAllocate(batchesFor(it, medicine), remainingOf(it)) } }));

  // ── validation ──
  const overStock = lines.some((l) => l.qty > (invMap[l.inventoryId]?.stockUnits ?? 0));
  const anyShort = order?.items.some((it) => { const s = itemState(it); return s.need > 0 && (!s.p?.include || s.short > 0); });
  const nothing = lines.length === 0;

  const allergyAlerts = useMemo(() => {
    if (!order) return [];
    const out = [];
    order.items.forEach((it) => {
      const med = plan?.[it.id]?.medicine;
      const generic = inventory.find((b) => b.medicineId === (med?.medicineId ?? it.medicineId))?.genericName;
      const hit = allergyHits(order.patient.allergies, med?.name ?? it.name, generic);
      if (hit.length) out.push({ name: med?.name ?? it.name, hit });
    });
    return out;
  }, [order, plan, inventory]);

  const dispense = async () => {
    setShowErrors(true);
    if (nothing) return toast.error("Select at least one medicine with stock to dispense.");
    if (overStock) return toast.error("A quantity is higher than the stock in that batch.");
    if (!resolved.valid) return;
    setBusy(true);
    try {
      const base = buildBillPayload({
        lines, patient: order.patient, doctorName: order.doctor.name, overallDiscountPercent: pay.discountPct,
        paidAmount: resolved.paidAmount, paymentMode: resolved.paymentMode, transactionId: resolved.transactionId, notes,
        source: order.type, prescriptionId: order.id,
      });
      const payload = {
        ...base,
        orderItems: lines.map((l) => ({ itemId: l.itemId, inventoryId: l.inventoryId, quantity: l.qty })),
        complete: !anyShort || closeRest,
      };
      const res = await ordersApi.dispense(order.id, payload);
      toast.success(res.message || "Dispensed");
      refreshQueue();
      if (res.bill?.id) navigate(`/billing/${res.bill.id}`, { state: { justBilled: true } });
      else { setPlan(null); orderQ.reload(); stockQ.reload(); }
    } catch (e) {
      toast.error(errorMessage(e));
      stockQ.reload({ silent: true }); // stock may have changed under us
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status, reason) => {
    try {
      const o = await ordersApi.setStatus(order.id, status, reason);
      orderQ.setData(o);
      toast.success(status === "REJECTED" ? "Request rejected" : "Marked in progress");
      refreshQueue();
      setRejectOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  if (orderQ.loading && !order) return <PageLoader />;
  if (orderQ.error && !order) return <div className="card-box"><ErrorState message={orderQ.error} onRetry={orderQ.reload} /></div>;
  if (!order) return null;

  return (
    <>
      <PageHeader
        back="/prescriptions"
        title={<span className="flex items-center gap-12 wrap">{order.orderNo} <TypeBadge type={order.type} /> <PriorityBadge priority={order.priority} /> <StatusBadge status={order.status} /></span>}
        subtitle={`Received ${formatDateTime(order.createdAt)}`}
      />

      {stockQ.error && <Alert tone="danger" className="mb-16">Stock couldn't be loaded, so batches can't be suggested. <button className="link-btn" onClick={() => stockQ.reload()}>Retry</button></Alert>}
      {order.status === "REJECTED" && <Alert tone="danger" icon={Ban} className="mb-16"><b>Rejected.</b> {order.rejectionReason || "No reason recorded."}</Alert>}
      {order.status === "DISPENSED" && order.billId && <Alert tone="success" icon={CheckCircle2} className="mb-16">Fully dispensed. <button className="link-btn" onClick={() => navigate(`/billing/${order.billId}`)}>View bill →</button></Alert>}
      {order.status === "PARTIALLY_DISPENSED" && <Alert tone="info" className="mb-16">Part of this prescription has been dispensed. The remaining items are below.</Alert>}
      {allergyAlerts.length > 0 && !closed && (
        <Alert tone="danger" icon={AlertTriangle} className="mb-16">
          <b>Allergy check.</b> {order.patient.name} has a recorded allergy to <b>{[...new Set(allergyAlerts.flatMap((a) => a.hit))].join(", ")}</b>. Review: {allergyAlerts.map((a) => a.name).join("; ")}. Confirm with the doctor before dispensing.
        </Alert>
      )}

      <div className="rx-layout">
        <div className="flex-col gap-24" style={{ minWidth: 0 }}>
          <section className="card-box patient-strip">
            <span className="avatar">{initials(order.patient.name)}</span>
            <div className="grow">
              <h3>{order.patient.name || "Unknown patient"}</h3>
              <div className="kv mt-4">
                {order.patient.code && <div><span>Patient ID </span><b>{order.patient.code}</b></div>}
                {order.patient.age != null && <div><span>Age/Sex </span><b>{order.patient.age} / {order.patient.gender || "—"}</b></div>}
                {order.patient.phone && <div><span>Phone </span><b>{order.patient.phone}</b></div>}
                <div><span>Doctor </span><b>{order.doctor.name || "—"}</b></div>
                {order.location && <div><span>Location </span><b>{order.location}</b></div>}
                {order.encounterId && <div><span>Ref </span><b>{order.encounterId}</b></div>}
              </div>
              {order.diagnosis && order.diagnosis !== "—" && <div className="fs-13 mt-8"><span className="muted">Diagnosis: </span>{order.diagnosis}</div>}
              {order.patient.allergies.length > 0 && <div className="mt-8 flex gap-8 wrap items-center"><span className="fs-13 fw-700" style={{ color: "var(--danger)" }}>Allergies:</span>{order.patient.allergies.map((a) => <span key={a} className="badge-bl sm b-red">{a}</span>)}</div>}
            </div>
          </section>

          <section className="card-box">
            <div className="card-box__head">
              <h3><Pill size={18} style={{ verticalAlign: "-3px", marginRight: 8 }} />Prescribed medicines ({order.items.length})</h3>
              {!closed && <span className="muted fs-13">Batches are pre-picked earliest-expiry-first (FEFO). Adjust if needed.</span>}
            </div>
            {order.items.map((it) => {
              const st = itemState(it);
              const med = st.p?.medicine;
              const batches = closed ? [] : batchesFor(it, med);
              const done = st.need === 0;
              const pct = it.qtyPrescribed ? Math.min(100, (it.qtyDispensed / it.qtyPrescribed) * 100) : 0;
              return (
                <div className="rx-item" key={it.id} style={done ? { opacity: 0.7 } : undefined}>
                  <div className="rx-item__top">
                    <div style={{ minWidth: 0 }}>
                      <div className="flex items-center gap-12 wrap">
                        {!closed && !done && plan && <input type="checkbox" className="form-check-input" style={{ width: 18, height: 18 }} checked={!!st.p?.include} onChange={(e) => toggle(it.id, e.target.checked)} aria-label={`Include ${it.name}`} />}
                        <span className="rx-item__name">{it.name}</span>
                        {med && <span className="badge-bl sm b-violet"><ArrowRightLeft size={12} /> Substituted: {med.name}</span>}
                        {done && <span className="badge-bl sm b-green">Dispensed</span>}
                      </div>
                      <div className="sig">
                        {it.dosage && <span>{it.dosage}</span>}{it.frequency && <span>{it.frequency}</span>}{it.duration && <span>{it.duration}</span>}{it.route && <span>{it.route}</span>}
                        {it.instructions && <span style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>{it.instructions}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="fw-700">Qty {it.qtyPrescribed}</div>
                      {it.qtyDispensed > 0 && <div className="fs-13 muted">{it.qtyDispensed} dispensed · {st.need} left</div>}
                      {it.qtyDispensed > 0 && <div className="progress" style={{ width: 120, marginLeft: "auto" }}><i style={{ width: `${pct}%` }} /></div>}
                    </div>
                  </div>

                  {!closed && !done && plan && st.p?.include && (
                    <div className="batch-pick">
                      {batches.length === 0 ? (
                        <div className="flex items-center between wrap gap-12">
                          <span className="flex items-center gap-8" style={{ color: "var(--danger)", fontWeight: 700 }}><PackageX size={18} /> Out of stock (or all batches expired)</span>
                          {it.substituteAllowed && <Button size="sm" variant="outline" icon={ArrowRightLeft} onClick={() => setSubFor(it)}>Find substitute</Button>}
                        </div>
                      ) : (
                        <>
                          <div className="batch-row batch-head"><span>Batch</span><span>Expiry</span><span>In stock</span><span>Price / unit</span><span>Dispense qty</span></div>
                          {batches.map((b, idx) => (
                            <div key={b.id} className={`batch-row ${idx === 0 ? "is-fefo" : ""}`}>
                              <span className="batch-name fw-700">{b.batch || "—"}</span>
                              <span>{formatDate(b.expiryDate)} <ExpiryBadge item={b} /></span>
                              <span className="num">{b.stockUnits}</span>
                              <span className="num">{money(b.unitPrice)}</span>
                              <NumberInput className="bl-input sm qty-input" value={st.p.picks[b.id] ?? ""} max={b.stockUnits} placeholder="0" aria-label={`Quantity from batch ${b.batch}`} onChange={(v) => setPick(it.id, b.id, v)} />
                            </div>
                          ))}
                        </>
                      )}
                      <div className="flex items-center between wrap gap-8 mt-8">
                        <span className="fs-13" style={{ color: st.short > 0 ? "var(--danger)" : "var(--success)", fontWeight: 700 }}>
                          {st.short > 0 ? `${st.given} of ${st.need} allocated – short by ${st.short}` : `${st.given} of ${st.need} allocated`}
                        </span>
                        <span className="flex gap-8">
                          {it.substituteAllowed && batches.length > 0 && st.short > 0 && <Button size="sm" variant="outline" icon={ArrowRightLeft} onClick={() => setSubFor(it)}>Substitute</Button>}
                          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => resetItem(it)}>Reset to FEFO</Button>
                        </span>
                      </div>
                    </div>
                  )}
                  {!closed && !done && plan && !st.p?.include && <p className="fs-13 muted mt-8">Skipped – this item won't be billed now.</p>}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="sticky-col flex-col gap-16">
          {!closed ? (
            <section className="card-box">
              <div className="card-box__head"><h3>Bill &amp; dispense</h3></div>
              <div className="card-box__body flex-col gap-16">
                {nothing ? <p className="muted fs-14">Nothing selected yet. Pick batches for at least one medicine.</p> : (
                  <PaymentPanel pay={pay} onChange={setPay} totals={totals} showErrors={showErrors} />
                )}
                <div className="field">
                  <label htmlFor="rx-notes">Notes (optional)</label>
                  <textarea id="rx-notes" className="bl-textarea" style={{ minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
                </div>
                {anyShort && !nothing && (
                  <label className="checkbox fs-13" style={{ alignItems: "flex-start" }}>
                    <input type="checkbox" checked={closeRest} onChange={(e) => setCloseRest(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>Some items aren't fully covered. Tick to <b>close this request</b> after billing; leave unticked to keep the rest pending.</span>
                  </label>
                )}
                {overStock && <Alert tone="danger">A quantity is higher than the batch stock. Reduce it to continue.</Alert>}
                {canDispense ? (
                  <Button size="lg" block variant="success" icon={ReceiptText} loading={busy} disabled={nothing || overStock || !plan} onClick={dispense}>
                    {anyShort && !closeRest ? "Dispense available & bill" : "Dispense & generate bill"}
                  </Button>
                ) : <Alert tone="warn">You can view this request but don't have permission to dispense.</Alert>}
                {["PENDING", "REQUESTED"].includes(order.status) && canReject && (
                  <Button variant="ghost" icon={PlayCircle} onClick={() => setStatus("IN_PROGRESS")}>Mark as in progress</Button>
                )}
                {canReject && <Button variant="danger-outline" icon={Ban} onClick={() => setRejectOpen(true)}>Reject request</Button>}
              </div>
            </section>
          ) : (
            <section className="card-box"><div className="card-box__body">
              <p className="muted fs-14">This request is {order.status.toLowerCase().replace("_", " ")}.</p>
              {order.billId && <Button className="mt-12" block variant="outline" icon={ReceiptText} onClick={() => navigate(`/billing/${order.billId}`)}>Open bill</Button>}
            </div></section>
          )}
        </aside>
      </div>

      <SubstituteModal open={!!subFor} onClose={() => setSubFor(null)} inventory={inventory} prescribedName={subFor?.name}
        genericHint={inventory.find((b) => b.medicineId === subFor?.medicineId)?.genericName}
        onPick={(m) => { substitute(subFor, m); setSubFor(null); toast.info(`Substituted with ${m.name}. Please confirm with the doctor if policy requires.`); }} />

      <ConfirmDialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject this request?" variant="danger" confirmLabel="Reject request"
        message="The doctor will see this request as rejected, along with your reason. This can't be undone."
        reasonLabel="Reason for rejecting" reasonRequired onConfirm={(reason) => setStatus("REJECTED", reason)} />
    </>
  );
}
