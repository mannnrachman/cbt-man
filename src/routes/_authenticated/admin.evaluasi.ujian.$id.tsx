import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, usersRepo, soalRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleUjians } from "@/lib/cbt/access";
import { Search, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [search, setSearch] = useState("");

  const visibleIds = new Set(visibleUjians(user).map((u) => u.id));
  const ujian = ujianRepo.byId(id);
  const sesis = sesiRepo.all().filter((s) => s.status === "selesai" && s.ujianId === id);
  const users = usersRepo.all();
  const soals = soalRepo.all();

  const items = (() => {
    const soalSet = new Set(soals.filter((s) => s.tipe === "essay").map((s) => s.id));
    return sesis
      .map((s) => {
        const essays = s.jawaban.filter((j) => soalSet.has(j.soalId));
        const belum = essays.filter((j) => typeof j.skor !== "number").length;
        const u = users.find((x) => x.id === s.pesertaId);
        return { sesi: s, total: essays.length, belum, u };
      })
      .filter((x) => x.total > 0)
      .filter((x) => 
        (x.u?.namaLengkap || "").toLowerCase().includes(search.toLowerCase()) ||
        (x.u?.username || "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.belum - a.belum);
  })();

  if (!visibleIds.has(id)) {
    return <div className="py-20 text-center text-sm font-medium text-slate-500">Tidak ada akses atau ujian tidak ditemukan.</div>;
  }
  if (!ujian) return <div className="py-20 text-center text-sm font-medium text-slate-500">Ujian tidak ditemukan.</div>;

  const totalBelum = items.reduce((acc, curr) => acc + curr.belum, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="mb-4">
        <Link to="/admin/evaluasi" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          ← Kembali ke Penilaian Essay
        </Link>
      </div>
      
      <div className="mb-6 bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-[22px] border border-slate-200 dark:border-slate-800 shadow-sleek">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {ujian.nama}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          {totalBelum > 0 
            ? <><span className="font-bold text-slate-700 dark:text-slate-300">{totalBelum}</span> jawaban belum dinilai dari <span className="font-bold text-slate-700 dark:text-slate-300">{items.filter(x => x.belum > 0).length}</span> peserta.</>
            : "Semua jawaban pada ujian ini telah selesai dinilai."}
        </p>

        {/* Filter / Search Bar */}
        <div className="relative mt-6 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari nama peserta atau username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-[20px] border border-slate-200 dark:border-slate-800 shadow-sleek overflow-hidden p-1.5">
        <div className="bg-white dark:bg-slate-950 rounded-2xl overflow-hidden flex flex-col">
          {items.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center">
              {search ? (
                <>
                  <Search className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                  <span className="text-slate-900 dark:text-slate-100 font-bold">Peserta Tidak Ditemukan</span>
                  <span className="text-sm text-slate-500 mt-1">Coba kata kunci lain.</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 opacity-80" />
                  <span className="text-slate-900 dark:text-slate-100 font-bold">Semua Essay Telah Dinilai</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tidak ada jawaban essay yang menunggu penilaian.</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
              {items.map(({ sesi, total, belum, u }) => {
                const isWarning = belum > 0;

                return (
                  <Link
                    key={sesi.id}
                    to="/admin/evaluasi/$id" 
                    params={{ id: sesi.id }}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {u?.namaLengkap || "Peserta Anonim"}
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5 font-mono">
                        {u?.username}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mt-3 sm:mt-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span className="text-slate-700 dark:text-slate-300">{total - belum}</span> / {total} dinilai
                      </div>
                      {isWarning ? (
                        <div className="flex items-center justify-center text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 px-3 py-1.5 rounded-lg shadow-sm">
                          {belum} Perlu Dinilai
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 px-3 py-1.5 rounded-lg shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Selesai
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
    </div>
  );
}
