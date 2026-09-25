import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ujianRepo, usersRepo, unitAkademikRepo, penawaranRepo, sesiRepo, deleteAllExamSessions } from "@/lib/cbt/repos";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Search, Trash2, RotateCcw, Clock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AdminPage, AdminPageContent, AdminPageHeader } from "@/components/cbt/AdminPage";
import { ConfirmDialog } from "@/components/cbt/ConfirmDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/ujian/$id/peserta")({
  component: PesertaUjian,
});

function PesertaUjian() {
  const { id } = useParams({ from: "/_authenticated/admin/ujian/$id/peserta" });
  const ujian = ujianRepo.byId(id);
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sesis, setSesis] = useState(() => sesiRepo.all().filter((s) => s.ujianId === id));

  function refresh() {
    setSesis(sesiRepo.all().filter((s) => s.ujianId === id));
  }

  if (!ujian) return <AdminPage><p className="text-sm text-muted-foreground">Ujian tidak ditemukan.</p></AdminPage>;
  const users = usersRepo.all();
  const units = unitAkademikRepo.all();
  const unitYangIkut = units.filter((u) => ujian.groupIds.includes(u.id));
  const offering = ujian.penawaranId ? penawaranRepo.byId(ujian.penawaranId) : undefined;
  const sessionUserIds = new Set(sesis.map((s) => s.pesertaId));

  const peserta = users.filter((u) => {
    if (u.role !== "mahasiswa") return false;
    const enrolled =
      sessionUserIds.has(u.id) ||
      (offering?.pesertaIds.includes(u.id) ?? false) ||
      (u.unitId && ujian.groupIds.includes(u.unitId));
    if (!enrolled) return false;
    if (selectedUnit !== "all" && u.unitId !== selectedUnit) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return u.namaLengkap.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    }
    return true;
  });

  async function handleDeleteSingleSession() {
    if (!deleteSessionId) return;
    setIsDeleting(true);
    try {
      sesiRepo.remove(deleteSessionId);
      const res = await sesiRepo.flush();
      if (!res.ok) {
        toast.error(res.error || "Gagal menghapus sesi");
        return;
      }
      refresh();
      toast.success("Sesi peserta berhasil dihapus. Peserta dapat ujian ulang.");
    } catch {
      toast.error("Gagal menghapus sesi. Coba lagi.");
    } finally {
      setIsDeleting(false);
      setDeleteSessionId(null);
    }
  }

  async function handleDeleteAllSessions() {
    setIsDeleting(true);
    try {
      const res = await deleteAllExamSessions(id);
      if (!res.ok) {
        toast.error(res.error || "Gagal menghapus semua sesi");
        return;
      }
      refresh();
      toast.success("Semua sesi peserta berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus semua sesi. Coba lagi.");
    } finally {
      setIsDeleting(false);
      setDeleteAllOpen(false);
    }
  }

  return (
    <AdminPage className="mx-auto max-w-6xl pb-12">
      <AdminPageHeader
        title={`Peserta: ${ujian.nama}`}
        description={`${peserta.length} peserta${sesis.length > 0 ? ` · ${sesis.length} sesi tercatat` : ""} dari ${unitYangIkut.length} unit${ujian.groupIds.length === 0 ? " (belum ditentukan)" : ""}.`}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/ujian/$id" params={{ id }}><ArrowLeft className="mr-1 h-4 w-4" /> Kembali ke Editor</Link>
            </Button>
            {sesis.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Hapus Semua Sesi ({sesis.length})
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/peserta/kartu"><Printer className="mr-1 h-4 w-4" /> Cetak Kartu</Link>
            </Button>
          </div>
        )}
      />

      <AdminPageContent>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Peserta yang berhak ikut</h2>
            <p className="mt-1 text-xs text-muted-foreground">Filter daftar berdasarkan unit atau cari nama peserta.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Unit</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Unit</SelectItem>
                  {unitYangIkut.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cari peserta</label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="search"
                  aria-label="Cari peserta"
                  placeholder="Cari nama atau username..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">Unit aktif:</span>
            {unitYangIkut.length > 0 ? unitYangIkut.map((u) => (
              <span key={u.id} className="rounded-md bg-accent px-2 py-1 text-xs font-medium">{u.nama}</span>
            )) : (
              <span className="text-xs text-muted-foreground">Belum ada unit peserta</span>
            )}
          </div>
        </CardContent>
      </AdminPageContent>

      <AdminPageContent className="p-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-14 p-4">#</th>
                <th className="p-4">Username</th>
                <th className="p-4">Nama</th>
                <th className="p-4">Unit</th>
                <th className="p-4">Status Sesi</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {peserta.map((p, i) => {
                const session = sesis.find((s) => s.pesertaId === p.id);
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 text-muted-foreground">{i + 1}</td>
                    <td className="p-4 font-mono text-xs">{p.username}</td>
                    <td className="p-4 font-medium">{p.namaLengkap}</td>
                    <td className="p-4">{units.find((u) => u.id === p.unitId)?.nama ?? "-"}</td>
                    <td className="p-4">
                      {!session && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Belum Mulai
                        </span>
                      )}
                      {session?.status === "sedang" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          <Clock className="h-3 w-3 animate-spin" /> Sedang Ujian
                        </span>
                      )}
                      {session?.status === "selesai" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> Selesai {typeof session.skorTotal === "number" ? `· Skor: ${session.skorTotal}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {session ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs gap-1 font-medium"
                          onClick={() => setDeleteSessionId(session.id)}
                          title="Hapus sesi ini agar peserta dapat ujian ulang"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Hapus Sesi
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {peserta.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Tidak ada peserta untuk ujian ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </CardContent>
      </AdminPageContent>

      <ConfirmDialog
        open={!!deleteSessionId}
        onOpenChange={(open) => !open && setDeleteSessionId(null)}
        title="Hapus Sesi Peserta?"
        description="Sesi ujian peserta ini akan dihapus dari sistem. Rekaman jawaban dan nilai sebelumnya akan direset sehingga peserta dapat mengerjakan ujian kembali."
        confirmLabel="Hapus Sesi"
        destructive={true}
        busy={isDeleting}
        onConfirm={handleDeleteSingleSession}
      />

      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="Hapus Semua Sesi Ujian?"
        description={`Apakah Anda yakin ingin menghapus seluruh ${sesis.length} sesi peserta pada ujian ini? Semua data pengerjaan dan nilai akan direset sehingga semua peserta dapat mengikuti ujian ulang.`}
        confirmLabel="Ya, Hapus Semua Sesi"
        destructive={true}
        busy={isDeleting}
        onConfirm={handleDeleteAllSessions}
      />
    </AdminPage>
  );
}
