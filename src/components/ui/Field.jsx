import { Search, X } from "lucide-react";
import { useId } from "react";

export function Field({ label, error, hint, required, children, className = "" }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>}
      {typeof children === "function" ? children({ id, "aria-invalid": !!error || undefined }) : children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className = "", ...rest }) {
  return (
    <div className={`input-wrap ${className}`}>
      <Search aria-hidden="true" />
      <input className="bl-input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} {...rest} />
      {value && (
        <button className="icon-action suffix" style={{ border: 0, background: "transparent" }} onClick={() => onChange("")} aria-label="Clear search"><X /></button>
      )}
    </div>
  );
}

/** Numeric-only controlled input that never produces NaN. */
export function NumberInput({ value, onChange, min = 0, max, step = 1, ...rest }) {
  return (
    <input
      type="number" inputMode="decimal" className="bl-input" value={value} min={min} max={max} step={step}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange("");
        let n = Number(raw);
        if (!Number.isFinite(n)) return;
        if (max != null && n > max) n = max;
        if (n < min) n = min;
        onChange(n);
      }}
      onWheel={(e) => e.currentTarget.blur()}
      {...rest}
    />
  );
}
