import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { sesiRepo, ujianRepo, usersRepo, soalRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";

import { hydrateRepos } from "@/lib/cbt/repos";

export const Route = createFileRoute("/_authenticated/admin/evaluasi/ujian/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch (e) {
      console.error(e);
    }
  },
  component: EvaluasiUjianList,
});

function EvaluasiUjianList() {
  const { id } = useParams({ from: "/_authenticated/admin/evaluasi/ujian/$id" });
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const visibleIds = new Set(visibleUjians(user).map((u) => u.id));
  
  if (!visibleIds.has(id)) {
    return <div className="py-20 text-center text-sm font-medium text-slate-500">Tidak ada akses atau ujian tidak ditemukan.</div>;
  }

  const ujian = ujianRepo.byId(id);
  if (!ujian) return <div className="py-20 text-center text-sm font-medium text-slate-500">Ujian tidak ditemukan.</div>;

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
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <div className="mb-4">
        <Link to="/admin/evaluasi" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          ← Kembali ke Penilaian Essay
        </Link>
      </div>
      
      <div className="mb-10 bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {ujian.nama}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {totalBelum > 0 
            ? <><span className="font-bold text-slate-700 dark:text-slate-300">{totalBelum}</span> jawaban belum dinilai dari <span className="font-bold text-slate-700 dark:text-slate-300">{items.filter(x => x.belum > 0).length}</span> peserta.</>
            : "Semua jawaban pada ujian ini telah selesai dinilai."}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek overflow-hidden">
        {items.length === 0 ? (
          <div className="py-20 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
            Tidak ada jawaban essay yang perlu dinilai.
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
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {u?.namaLengkap || "Peserta Anonim"}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 font-mono">
                      {u?.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="text-slate-700 dark:text-slate-300">{total - belum}</span> / {total} dinilai
                    </div>
                    {isWarning ? (
                      <div className="flex items-center justify-center text-xs font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-md">
                        {belum} Perlu Dinilai
                      </div>
                    ) : (
                      <div className="flex items-center justify-center text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                        Selesai
                      </div>
                    )}
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
