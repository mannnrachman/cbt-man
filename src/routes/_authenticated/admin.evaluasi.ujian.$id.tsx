import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { sesiRepo, ujianRepo, usersRepo, soalRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { CheckCircle2, ChevronRight, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/evaluasi/ujian/$id")({
  component: EvaluasiUjianList,
});

function EvaluasiUjianList() {
  const { id } = useParams({ from: "/_authenticated/admin/evaluasi/ujian/$id" });
  const user = useAuthStore((s) => s.user);
  const visibleIds = new Set(visibleUjians(user).map((u) => u.id));
  
  if (!visibleIds.has(id)) {
    return <div className="p-8 text-center text-slate-500">Ujian tidak ditemukan atau Anda tidak memiliki akses.</div>;
  }

  const ujian = ujianRepo.byId(id);
  if (!ujian) return <div className="p-8 text-center text-slate-500">Ujian tidak ditemukan.</div>;

  const sesis = sesiRepo.all().filter((s) => s.status === "selesai" && s.ujianId === id);
  const users = usersRepo.all();
  const soals = soalRepo.all();
  const soalSet = new Set(soals.filter((s) => s.tipe === "essay").map((s) => s.id));

  const items = sesis
    .map((s) => {
      const essays = s.jawaban.filter((j) => soalSet.has(j.soalId));
      const belum = essays.filter((j) => typeof j.skor !== "number").length;
      return { sesi: s, total: essays.length, belum };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.belum - a.belum);

  const totalBelum = items.reduce((acc, curr) => acc + curr.belum, 0);

  return (
    <div className="mx-auto max-w-5xl py-8 px-6 space-y-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 dark:hover:text-white -ml-3" asChild>
          <Link to="/admin/evaluasi">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Ujian
          </Link>
        </Button>
      </div>
      
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Evaluasi: {ujian.nama}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {totalBelum > 0 
            ? `${totalBelum} soal essay dari ${items.filter(x => x.belum > 0).length} mahasiswa menunggu penilaian manual.` 
            : "Semua jawaban essay pada ujian ini sudah dinilai."}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Semua Selesai</p>
            <p className="text-sm text-slate-500">Tidak ada sesi mahasiswa dengan soal essay yang perlu dinilai pada ujian ini.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
            {items.map(({ sesi, total, belum }) => {
              const u = users.find((x) => x.id === sesi.pesertaId);
              const isWarning = belum > 0;

              return (
                <Link
                  key={sesi.id}
                  to="/admin/evaluasi/$id"
                  params={{ id: sesi.id }}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {u?.namaLengkap || "Peserta Anonim"}
                      </span>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate font-mono">
                      {u?.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      {isWarning ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-200/50 dark:border-amber-800/50">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>{belum} Belum dinilai</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200/50 dark:border-emerald-800/50">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Selesai</span>
                        </div>
                      )}
                      <div className="text-sm text-slate-500 hidden sm:block">
                        dari {total} essay
                      </div>
                    </div>
                    
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
