export default function Button({ variant = "primary", size, loading = false, block, icon: Icon, children, className = "", disabled, type = "button", ...rest }) {
  const cls = ["btn-bl", variant, size, block && "block", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
