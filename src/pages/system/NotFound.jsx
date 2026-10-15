import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button, EmptyState } from "../../components/ui";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export default function NotFound() {
  const navigate = useNavigate();
  useDocumentTitle("Page not found");
  return (
    <div className="card-box">
      <EmptyState icon={Compass} title="We couldn't find that page" text="The link may be old or mistyped. Head back to the dashboard to continue." action={<Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>} />
    </div>
  );
}
