import { useEffect, useRef, useState } from "react";
import { UserRound, X } from "lucide-react";
import { lookupApi } from "../../api/services";
import { useDebounce } from "../../hooks/useDebounce";
import { SearchInput } from "../ui";

/** Optional: link the sale to a registered patient. Falls back to free-text walk-in details in the parent. */
export default function PatientPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const term = useDebounce(q.trim(), 350);
  const ref = useRef(null);

  useEffect(() => {
    if (term.length < 2) { setResults([]); return undefined; }
    let live = true;
    setLoading(true);
    lookupApi.patients(term).then((r) => live && setResults(r)).catch(() => live && setResults([])).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [term]);

  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (value) {
    return (
      <div className="patient-pill">
        <span className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}><UserRound size={18} /></span>
        <div className="grow"><b>{value.name}</b><div className="cell-sub">{value.code && `ID ${value.code} · `}{value.phone}</div></div>
        <button className="icon-action" onClick={() => onChange(null)} aria-label="Unlink patient"><X /></button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <SearchInput value={q} onChange={(v) => { setQ(v); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Link a registered patient (name, ID, phone)" />
      {open && term.length >= 2 && (
        <div className="search-results" style={{ maxHeight: 240 }}>
          {loading ? <p className="muted fs-13" style={{ padding: 14 }}>Searching…</p> : results.length === 0 ? <p className="muted fs-13" style={{ padding: 14 }}>No registered patient found. You can still sell as walk-in.</p> :
            results.map((p) => (
              <button key={p.id} className="result-row" onClick={() => { onChange(p); setQ(""); setOpen(false); }}>
                <span><b>{p.name}</b><span className="cell-sub" style={{ display: "block" }}>ID {p.code} · {p.phone}</span></span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
