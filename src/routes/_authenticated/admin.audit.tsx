import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAuditLogsServer } from "@/lib/server/audit/functions";

type AuditRow = {
  id: string;
  userId: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: Date | string;
};

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAuditLogsServer({
      data: { page, pageSize: 50, entity: entity || undefined, action: action || undefined },
    })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error);
          setRows([]);
          return;
        }
        setError(null);
        setRows(result.logs as AuditRow[]);
        setTotal(result.total);
      })
      .catch(() => active && setError("Audit log gagal dimuat"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [action, entity, page]);

  const pageCount = Math.max(1, Math.ceil(total / 50));

  return (
    <AdminPage className="mx-auto w-full max-w-[1600px] pb-12">
      <AdminPageHeader
        title="Audit Trail"
        description="Riwayat tindakan penting sistem. Halaman ini hanya-baca untuk penelusuran perubahan."
      />
      <div className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-medium">
          Entitas
          <Input value={entity} onChange={(event) => { setEntity(event.target.value); setPage(1); }} placeholder="ujian" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Aksi
          <Input value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="backup.restore" />
        </label>
        <Button variant="outline" onClick={() => { setEntity(""); setAction(""); setPage(1); }}>
          Bersihkan filter
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">Memuat audit log...</p> : null}
        {error ? <p role="alert" className="p-8 text-center text-sm text-destructive">{error}</p> : null}
        {!loading && !error && rows.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Belum ada catatan audit.</p> : null}
        {!loading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-label text-muted-foreground">
                <tr><th className="p-3">Waktu</th><th className="p-3">Aktor</th><th className="p-3">Aksi</th><th className="p-3">Entitas</th><th className="p-3">Detail</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="p-3"><div>{row.userId}</div><div className="text-label text-muted-foreground">{row.userRole}</div></td>
                    <td className="p-3 font-medium">{row.action}</td>
                    <td className="p-3">{row.entity}{row.entityId ? <span className="ml-1 text-label text-muted-foreground">({row.entityId})</span> : null}</td>
                    <td className="max-w-[24rem] truncate p-3 font-mono text-label text-muted-foreground">{row.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t p-3 text-sm text-muted-foreground">
          <span>{total} catatan</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
            <span>Halaman {page} / {pageCount}</span>
            <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
