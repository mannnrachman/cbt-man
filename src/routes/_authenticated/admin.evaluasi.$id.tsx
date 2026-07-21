import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { sesiRepo, ujianRepo, soalRepo, usersRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { recomputeSkor } from "@/lib/cbt/exam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RichView } from "@/components/cbt/RichEditor";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertCircle, Save, FileSignature } from "lucide-react";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/evaluasi/$id")({
  loader: async () => {
    try {
      await hydrateRepos();
    } catch {
      // Fallback ke cache
    }
  },
  component: EvaluasiSesi,
});

function EvaluasiSesi() {
  const { id } = useParams({ from: "/_authenticated/admin/evaluasi/$id" });
  const me = useAuthStore((s) => s.user);
  const [sesi, setSesi] = useState(sesiRepo.byId(id));
  
  if (!me) return <div className="p-8 text-center text-slate-500">Anda harus login terlebih dahulu</div>;
  if (!sesi) return <div className="p-8 text-center text-slate-500">Sesi tidak ditemukan</div>;
  
  const ujian = ujianRepo.byId(sesi.ujianId);
  if (!ujian) return <div className="p-8 text-center text-slate-500">Ujian untuk sesi ini tidak ditemukan</div>;
  
  const peserta = usersRepo.byId(sesi.pesertaId);
  const currentUjian = ujian;
  const currentMe = me;
  const items = sesi.jawaban
    .map((j, idx) => ({ j, idx, soal: soalRepo.byId(j.soalId) }))
    .filter((x) => x.soal?.tipe === "essay" || x.j.jawabanEssay.trim().length > 0);

  const totalUngraded = items.filter(x => typeof x.j.skor !== 'number').length;

  function normalizeSkor(skor: number | undefined): number | undefined {
    if (skor === undefined) return undefined;
    if (!Number.isFinite(skor)) return undefined;
    return Math.max(0, Math.min(currentUjian.poinBenar, skor));
  }

  function setSkor(idx: number, skor: number | undefined, catatan: string) {
    if (!sesi) return;
    const next = {
      ...sesi,
      jawaban: sesi.jawaban.map((x, i) =>
        i === idx ? { ...x, skor: normalizeSkor(skor), catatanGrader: catatan } : x,
      ),
    };
    sesiRepo.upsert(next);
    setSesi(next);
  }

  function selesaikan() {
    if (!sesi) return;
    const final = recomputeSkor(sesi, currentUjian);
    const withMeta = { ...final, gradedAt: Date.now(), gradedBy: currentMe.id };
    sesiRepo.upsert(withMeta);
    setSesi(withMeta);
    toast.success(`Tersimpan. Nilai: ${withMeta.skorTotal} / ${withMeta.maxSkor}`);
  }

  return (
    <AdminPage className="max-w-5xl">
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 dark:hover:text-white -ml-3" asChild>
          <Link to="/admin/evaluasi">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Evaluasi
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1 space-y-6">
          {items.map(({ j, idx, soal }) => {
            const isGraded = typeof j.skor === 'number';
            
            if (!soal) {
              return (
                <Card key={idx} className="border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20">
                  <CardHeader>
                    <CardTitle className="text-red-600 text-sm">Soal #{idx + 1} tidak ditemukan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm bg-white dark:bg-slate-950 p-4 rounded-md border border-slate-200 dark:border-slate-800">
                      {j.jawabanEssay || <span className="text-slate-400 italic">Peserta tidak mengisi jawaban</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={idx} className={`transition-colors ${isGraded ? 'border-slate-200 dark:border-slate-800' : 'border-amber-200 dark:border-amber-900/50 shadow-sm'}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-1 px-2.5 rounded-md">#{idx + 1}</span>
                      <span className="text-slate-500 uppercase tracking-wider text-xs">Pertanyaan Essay</span>
                    </CardTitle>
                    {isGraded ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Dinilai
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-500">
                        <AlertCircle className="mr-1 h-3 w-3" /> Menunggu Penilaian
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Pertanyaan */}
                  <div className="prose dark:prose-invert prose-sm max-w-none text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-lg border border-slate-100 dark:border-slate-800/60">
                    <RichView html={soal.detail} />
                  </div>

                  {/* Jawaban */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <FileSignature className="h-4 w-4" /> Jawaban Peserta
                    </div>
                    <div className="text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap min-h-[100px]">
                      {j.jawabanEssay ? j.jawabanEssay : <span className="text-slate-400 italic">Peserta tidak mengisi jawaban ini.</span>}
                    </div>
                  </div>
                </CardContent>
                <Separator />
                <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 rounded-b-xl">
                  {/* Input Penilaian */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Poin Nilai</label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={currentUjian.poinBenar}
                          value={j.skor ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? undefined : Number(e.target.value);
                            setSkor(idx, v, j.catatanGrader ?? "");
                          }}
                          className={`font-semibold h-10 w-28 text-lg text-center ${isGraded ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : ''}`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="text-sm font-medium text-slate-400 pt-5">
                      / {currentUjian.poinBenar} pts
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Catatan Pemeriksa (Opsional)</label>
                    <Input
                      value={j.catatanGrader ?? ""}
                      onChange={(e) => setSkor(idx, j.skor, e.target.value)}
                      placeholder="Tambahkan feedback untuk jawaban ini..."
                      className="h-10 bg-white dark:bg-slate-950"
                    />
                  </div>
                </CardFooter>
              </Card>
            );
          })}

          {items.length === 0 && (
            <Card className="py-12 border-dashed border-2 text-center text-slate-500 shadow-none">
              Tidak ada soal essay dalam ujian ini.
            </Card>
          )}
        </div>

        {/* Floating Summary Sidebar */}
        <div className="w-full md:w-80 shrink-0 sticky top-6">
          <Card className="shadow-lg border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="h-2 bg-primary"></div>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Ringkasan Evaluasi</CardTitle>
              <CardDescription>Informasi nilai akhir peserta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1">
                <p className="text-sm text-slate-500 font-medium">Peserta</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white truncate" title={peserta?.namaLengkap}>
                  {peserta?.namaLengkap || "Peserta Anonim"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-slate-500 font-medium">Ujian</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate" title={currentUjian.nama}>
                  {currentUjian.nama}
                </p>
              </div>
              
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Progress</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {items.length - totalUngraded} / {items.length} Dinilai
                  </p>
                </div>
                {totalUngraded > 0 ? (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                    Sisa {totalUngraded}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                    Lengkap
                  </Badge>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Skor Sementara</p>
                <div className="text-3xl font-black text-slate-900 dark:text-white">
                  {sesi.skorTotal ?? 0}
                </div>
                <p className="text-sm text-slate-400 font-medium">
                  dari maksimal {sesi.maxSkor ?? 0}
                </p>
              </div>
            </CardContent>
            <CardFooter className="pt-0 flex-col gap-2">
              <Button 
                onClick={selesaikan} 
                className="w-full h-10 shadow-sm"
                variant={totalUngraded > 0 ? "secondary" : "default"}
              >
                <Save className="mr-2 h-4 w-4" /> 
                {totalUngraded > 0 ? "Simpan Progress" : "Simpan Nilai Akhir"}
              </Button>
              {sesi.gradedAt && (
                <p suppressHydrationWarning className="text-[11px] text-center text-slate-400 mt-2">
                  Tersimpan pada {new Date(sesi.gradedAt).toLocaleString("id-ID", { hour: '2-digit', minute:'2-digit', day:'numeric', month:'short' })}
                </p>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
