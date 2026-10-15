import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import Button from "./Button";

export const EmptyState = ({ icon: Icon = Inbox, title, text, action }) => (
  <div className="empty">
    <div className="empty__icon"><Icon /></div>
    <h4>{title}</h4>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export const ErrorState = ({ message, onRetry, compact }) => (
  <div className="empty" role="alert" style={compact ? { padding: "28px 16px" } : undefined}>
    <div className="empty__icon" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}><AlertTriangle /></div>
    <h4>Couldn't load this</h4>
    <p>{message || "Something went wrong."}</p>
    {onRetry && <Button variant="outline" icon={RefreshCw} onClick={onRetry} size="sm" className="mt-16">Try again</Button>}
  </div>
);

export const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Loading"><div className="loader-ring" /></div>
);

export const TableSkeleton = ({ rows = 6, cols = 5 }) => (
  <div style={{ padding: "6px 22px 18px" }} aria-hidden="true">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18, padding: "14px 0", borderBottom: "1px solid #f0f3f7" }}>
        {Array.from({ length: cols }).map((__, c) => <div key={c} className="skeleton" style={{ height: 16, width: `${60 + ((r + c) % 3) * 15}%` }} />)}
      </div>
    ))}
  </div>
);

export const Alert = ({ tone = "info", icon: Icon = AlertTriangle, children, className = "" }) => (
  <div className={`alert-bl ${tone} ${className}`} role={tone === "danger" ? "alert" : undefined}>
    <Icon aria-hidden="true" />
    <div>{children}</div>
  </div>
);
