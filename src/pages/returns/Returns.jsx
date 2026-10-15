import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Undo2 } from "lucide-react";
import { returnsApi } from "../../api/services";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../context/AuthContext";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { Button, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, TableSkeleton } from "../../components/ui";
import ReturnModal from "./ReturnModal";
import { formatDateTime, money } from "../../utils/format";

export default function Returns() {
  useDocumentTitle("Returns & Refunds");
  const { access } = useAuth();
  const [params, setParams] = useSearchParams();
  const presetBillId = params.get("billId");
  const [open, setOpen] = useState(Boolean(presetBillId));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useDebounce(search.trim(), 400);
  const { data, loading, error, reload } = useAsync(() => returnsApi.list({ page, limit: pageSize, search: q }), [page, pageSize, q]);

  useEffect(() => { if (presetBillId) setOpen(true); }, [presetBillId]);
  const close = () => { setOpen(false); if (presetBillId) setParams({}, { replace: true }); };

  return (
    <>
      <PageHeader title="Returns & Refunds" subtitle="Take medicines back against the original bill and refund the patient."
        actions={access.canCreate() && <Button icon={Undo2} onClick={() => setOpen(true)}>New return</Button>} />
      <section className="card-box">
        <div className="toolbar"><SearchInput className="search" value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search return no., bill no. or patient" /></div>
        {loading && !data ? <TableSkeleton rows={6} cols={6} /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : !data?.rows.length ? (
          <EmptyState icon={Undo2} title="No returns yet" text="Returns you process will be listed here with the refund amount." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="bl-table">
                <thead><tr><th>Return No.</th><th>Bill</th><th>Patient</th><th>Items</th><th>Date</th><th>Refund mode</th><th className="r">Refund</th></tr></thead>
                <tbody>{data.rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="link-id">{r.returnNo}</span></td><td>{r.billNo}</td><td>{r.patientName}</td>
                    <td>{r.items.map((i, n) => <div key={n} className="fs-13">{i.name} × {i.qty}<span className="cell-sub"> · {i.reason}</span></div>)}</td>
                    <td>{formatDateTime(r.createdAt)}</td><td>{r.refundMode}</td><td className="r num fw-700">{money(r.refundAmount)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </>
        )}
      </section>
      <ReturnModal open={open} presetBillId={presetBillId} onClose={close} onDone={() => { close(); reload({ silent: true }); }} />
    </>
  );
}
