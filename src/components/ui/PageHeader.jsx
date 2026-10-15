import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageHeader({ title, subtitle, actions, back }) {
  const navigate = useNavigate();
  return (
    <div className="page-head">
      <div>
        {back && (
          <button className="crumb" onClick={() => navigate(back === true ? -1 : back)}><ArrowLeft size={16} /> Back</button>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}
