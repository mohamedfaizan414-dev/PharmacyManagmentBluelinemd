import { STATUS_LABEL } from "../../config/constants";
import { expiryState } from "../../utils/inventory";
import { daysUntil } from "../../utils/format";

const STATUS_TONE = {
  PENDING: "b-amber", REQUESTED: "b-amber", IN_PROGRESS: "b-blue", PARTIALLY_DISPENSED: "b-violet",
  DISPENSED: "b-green", REJECTED: "b-red", CANCELLED: "b-grey",
  PAID: "b-green", PARTIAL: "b-amber", UNPAID: "b-red", REFUNDED: "b-grey",
};

export const StatusBadge = ({ status }) => <span className={`badge-bl ${STATUS_TONE[status] || "b-grey"}`}>{STATUS_LABEL[status] || status}</span>;

export const TypeBadge = ({ type }) => (
  <span className={`badge-bl sm ${type === "IPD" ? "b-cyan" : type === "OPD" ? "b-amber" : "b-grey"}`}>{type === "WALKIN" ? "Walk-in" : type}</span>
);

export const PriorityBadge = ({ priority }) =>
  priority === "URGENT" ? <span className="badge-bl sm b-solid-red">URGENT</span> : null;

export function ExpiryBadge({ item }) {
  const s = expiryState(item);
  const d = daysUntil(item?.expiryDate);
  if (s === "expired") return <span className="badge-bl sm b-red">Expired {Math.abs(d)}d ago</span>;
  if (s === "critical") return <span className="badge-bl sm b-red">{d === 0 ? "Expires today" : `${d}d left`}</span>;
  if (s === "warning") return <span className="badge-bl sm b-amber">{d}d left</span>;
  return null;
}
