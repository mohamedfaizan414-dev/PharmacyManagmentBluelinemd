export default function Kpi({ icon: Icon, tone = "blue", label, value, sub, loading, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className="kpi" onClick={onClick} style={onClick ? { cursor: "pointer", textAlign: "left", font: "inherit" } : undefined}>
      <div className={`kpi__icon tone-${tone}`}><Icon aria-hidden="true" /></div>
      <div style={{ minWidth: 0 }}>
        <div className="kpi__label">{label}</div>
        {loading ? <div className="skeleton" style={{ height: 30, width: 110, marginTop: 4 }} /> : <div className="kpi__value">{value}</div>}
        {sub && !loading && <div className="kpi__sub">{sub}</div>}
      </div>
    </Tag>
  );
}
