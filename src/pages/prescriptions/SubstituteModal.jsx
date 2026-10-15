import { useMemo, useState } from "react";
import { Modal, SearchInput } from "../../components/ui";
import { groupByMedicine } from "../../utils/inventory";
import { sellable } from "../../utils/inventory";

/** Lets the pharmacist swap a prescribed medicine for an in-stock alternative (generic matches float to the top). */
export default function SubstituteModal({ open, onClose, inventory, prescribedName, genericHint, onPick }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g = groupByMedicine(sellable(inventory));
    const term = q.trim().toLowerCase();
    return g
      .filter((m) => !term || m.name.toLowerCase().includes(term) || (m.genericName || "").toLowerCase().includes(term))
      .map((m) => ({ ...m, same: genericHint && (m.genericName || "").toLowerCase() === genericHint.toLowerCase() }))
      .sort((a, b) => Number(b.same) - Number(a.same) || a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [inventory, q, genericHint]);

  return (
    <Modal open={open} onClose={() => { setQ(""); onClose(); }} title="Choose a substitute" size="lg">
      <p className="muted fs-14 mb-16">Replacing <b style={{ color: "var(--text)" }}>{prescribedName}</b>. Substitution should follow your hospital policy and the doctor's allowance.</p>
      <SearchInput value={q} onChange={setQ} placeholder="Search medicine or generic name" data-autofocus />
      <div className="mt-16" style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
        {groups.length === 0 ? <p className="muted" style={{ padding: 20 }}>No in-stock medicine matches.</p> : groups.map((m) => (
          <button key={m.key} className="result-row" onClick={() => { setQ(""); onPick({ medicineId: m.medicineId, name: m.name }); }}>
            <span>
              <b style={{ display: "block" }}>{m.name}</b>
              <span className="cell-sub">{m.genericName || "—"}</span>
            </span>
            <span className="flex items-center gap-8">
              {m.same && <span className="badge-bl sm b-green">Same generic</span>}
              <span className="fs-13 muted">{m.totalUnits} in stock</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
