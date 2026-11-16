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
    return <div className="py-20 text-center text-sm font-medium text-muted-foreground">Tidak ada akses atau ujian tidak ditemukan.</div>;
  }
  if (!ujian) return <div className="py-20 text-center text-sm font-medium text-muted-foreground">Ujian tidak ditemukan.</div>;

  const totalBelum = items.reduce((acc, curr) => acc + curr.belum, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="mb-4">
        <Link to="/admin/evaluasi" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          ← Kembali ke Penilaian Essay
        </Link>
      </div>
      
      <div className="mb-6 bg-card p-6 sm:p-8 rounded-lg border border-border">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {ujian.nama}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {totalBelum > 0 
            ? <><span className="font-semibold text-foreground">{totalBelum}</span> jawaban belum dinilai dari <span className="font-semibold text-foreground">{items.filter(x => x.belum > 0).length}</span> peserta.</>
            : "Semua jawaban pada ujian ini telah selesai dinilai."}
        </p>

        {/* Filter / Search Bar */}
        <div className="relative mt-6 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama peserta atau username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted border-border"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden p-1.5">
        <div className="bg-card rounded-lg overflow-hidden flex flex-col">
          {items.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center">
              {search ? (
                <>
                  <Search className="h-10 w-10 text-muted-foreground mb-3" />
                  <span className="text-foreground font-semibold">Peserta Tidak Ditemukan</span>
                  <span className="text-sm text-muted-foreground mt-1">Coba kata kunci lain.</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-10 w-10 text-primary mb-3 opacity-80" />
                  <span className="text-foreground font-semibold">Semua Essay Telah Dinilai</span>
                  <span className="text-sm text-muted-foreground mt-1">Tidak ada jawaban essay yang menunggu penilaian.</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {items.map(({ sesi, total, belum, u }) => {
                const isWarning = belum > 0;

                return (
                  <Link
                    key={sesi.id}
                    to="/admin/evaluasi/$id" 
                    params={{ id: sesi.id }}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-foreground group-hover:text-muted-foreground transition-colors">
                        {u?.namaLengkap || "Peserta Anonim"}
                      </span>
                      <span className="text-label text-muted-foreground mt-0.5 font-mono">
                        {u?.username}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mt-3 sm:mt-0">
                      <div className="text-label font-semibold text-muted-foreground">
                        <span className="text-foreground">{total - belum}</span> / {total} dinilai
                      </div>
                      {isWarning ? (
                        <div className="flex items-center justify-center text-label font-semibold text-warn bg-warn/10 border border-warn/30 px-3 py-1.5 rounded-lg">
                          {belum} Perlu Dinilai
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-label font-semibold text-primary bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-lg">
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
