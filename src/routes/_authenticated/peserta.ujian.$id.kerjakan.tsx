import { useAuthStore } from "@/lib/cbt/auth-store";
import { soalRepo, sesiRepo, ujianRepo, invalidateReposCache, hydrateRepos } from "@/lib/cbt/repos";
import type { SesiUjian, Ujian } from "@/lib/cbt/types";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LayoutGrid, X, ChevronLeft, ChevronRight, Flag, CheckCircle2, AlertCircle, Type, Clock, Calculator, ClipboardList } from "lucide-react";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/cbt/AudioPlayer";
import { RichView } from "@/components/cbt/RichEditor";
import { ExamCalculator } from "@/components/cbt/ExamCalculator";
import { NilaiNormalTable } from "@/components/cbt/NilaiNormal";
// dialog imports removed

export const Route = createFileRoute(
  "/_authenticated/peserta/ujian/$id/kerjakan",
)({
  component: RouteComponent,
  loader: async () => {
    invalidateReposCache();
    return null;
  },
});

function gradeSesi(sesi: SesiUjian, ujian: Ujian) {
  const currentSesi = JSON.parse(JSON.stringify(sesi)) as SesiUjian;
  let score = 0;
  for (let i = 0; i < currentSesi.soalIds.length; i++) {
    const soalId = currentSesi.soalIds[i];
    const soal = soalRepo.byId(soalId);
    const j = currentSesi.jawaban[i];
    if (!soal || !j) continue;

    if (soal.tipe === "multi") {
      const correctIds = soal.jawaban.filter((x) => x.benar).map((x) => x.id);
      const isCorrect =
        j.jawabanIds.length === correctIds.length &&
        j.jawabanIds.every((id) => correctIds.includes(id));
      if (isCorrect) score += ujian.poinBenar;
    } else {
      const correctOpt = soal.jawaban.find((x) => x.benar);
      if (correctOpt && j.jawabanIds.includes(correctOpt.id)) {
        score += ujian.poinBenar;
      }
    }
  }
  currentSesi.status = "selesai";
  currentSesi.skorTotal = score;
  currentSesi.selesaiAt = Date.now();
  
  if (currentSesi.mulaiAt) {
    const maxDur = ujian.durasiMenit || 60;
    const start = currentSesi.mulaiAt;
    const now = Date.now();
    const elapsedMinutes = (now - start) / 60000;
    if (elapsedMinutes > maxDur + 5) {
      currentSesi.selesaiAt = start + maxDur * 60000;
    }
  }

  return currentSesi;
}

function AlatBantuUjian({ ujian }: { ujian: Ujian }) {
  const [activeTab, setActiveTab] = useState<"calc" | "nilai" | null>(null);

  if (!ujian.allowCalculator && !ujian.allowNilaiNormal) return null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex gap-2">
        {ujian.allowCalculator && (
          <button
            onClick={() => setActiveTab(activeTab === "calc" ? null : "calc")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 transition-all active:scale-95 select-none",
              activeTab === "calc"
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <Calculator className="w-4 h-4" />
            Kalkulator
          </button>
        )}
        {ujian.allowNilaiNormal && (
          <button
            onClick={() => setActiveTab(activeTab === "nilai" ? null : "nilai")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-bold rounded-xl border-2 transition-all active:scale-95 select-none",
              activeTab === "nilai"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm dark:bg-indigo-500 dark:border-indigo-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-700 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700"
            )}
          >
            <ClipboardList className="w-4 h-4" />
            Nilai Normal
          </button>
        )}
      </div>

      {activeTab === "calc" && ujian.allowCalculator && (
        <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl dark:bg-slate-900/80 dark:border-slate-800 animate-in zoom-in-95 fade-in duration-200 max-h-[60vh] overflow-x-auto overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <ExamCalculator />
        </div>
      )}

      {activeTab === "nilai" && ujian.allowNilaiNormal && (
        <div className="p-2 bg-indigo-50/40 border border-indigo-100 rounded-xl dark:bg-indigo-950/20 dark:border-indigo-900/40 animate-in zoom-in-95 fade-in duration-200">
          <NilaiNormalTable />
        </div>
      )}
    </div>
  );
}

function RouteComponent() {
  const { id } = useParams({ strict: false });
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const ujian = ujianRepo.all().find((u) => u.id === id);

  const [sesiDicari, setSesiDicari] = useState(false);
  const [sesi, setSesi] = useState<SesiUjian | null>(null);

  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(Date.now());
  const submittingRef = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const [showList, setShowList] = useState(false);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");

  useEffect(() => {
    if (!user || !ujian) return;
    const active = sesiRepo.all().find(
      (x) => x.ujianId === ujian.id && x.pesertaId === user.id && x.status === "sedang"
    );
    setSesi(active || null);
    setSesiDicari(true);
  }, [user, ujian]);

  useEffect(() => {
    if (sesi && sesi.status === "selesai") {
      navigate({
        to: "/peserta/ujian/$id/hasil",
        params: { id: sesi.ujianId },
      });
    }
  }, [sesi, navigate]);

  const endsAt = useMemo(() => {
    if (!sesi || !ujian) return 0;
    if (sesi.endsAt) return sesi.endsAt;
    const start = sesi.mulaiAt || Date.now();
    return start + (ujian.durasiMenit || 60) * 60 * 1000;
  }, [sesi, ujian]);

  const remaining = Math.max(0, endsAt - now);

  const sesiRef = useRef(sesi);
  useEffect(() => {
    sesiRef.current = sesi;
  }, [sesi]);

  useEffect(() => {
    if (!sesi || !ujian || sesi.status === "selesai") return;
    const interval = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endsAt) {
        clearInterval(interval);
        submit("Waktu Habis");
      }
    }, 1000);

    const pollInterval = setInterval(async () => {
      try {
        await hydrateRepos();
        const latestSesi = sesiRepo.byId(sesi.id);
        if (latestSesi) {
          if (latestSesi.status === "selesai") {
            toast.warning("Ujian telah dihentikan oleh pengawas.");
            navigate({
              to: "/peserta/ujian/$id/hasil",
              params: { id: ujian.id },
            });
          } else if (latestSesi.endsAt && sesiRef.current && latestSesi.endsAt !== sesiRef.current.endsAt) {
            // Safely merge endsAt without wiping local un-flushed answers
            setSesi(prev => prev ? { ...prev, endsAt: latestSesi.endsAt } : prev);
            toast.info("Waktu ujian Anda telah diperbarui oleh pengawas.");
          }
        }
      } catch (e) {
        // silent error fallback
      }
    }, 10000);

    const handleBeforeUnload = () => {
      if (sesiRef.current) {
        sesiRepo.upsert(sesiRef.current);
        sesiRepo.flush();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesi, ujian, endsAt]);

  function updateJawaban(partial: Partial<SesiUjian["jawaban"][0]>) {
    if (!sesi) return;
    const nextSesi = { ...sesi };
    nextSesi.jawaban = [...nextSesi.jawaban];
    nextSesi.jawaban[idx] = { ...nextSesi.jawaban[idx], ...partial };
    setSesi(nextSesi);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      sesiRepo.upsert(nextSesi);
      sesiRepo.flush();
    }, 2000);
  }

  function toggleOption(jawabanId: string) {
    if (!sesi || !soal) return;
    const currentJawaban = sesi.jawaban[idx];
    const currentSoal = soal;
    let nextJawabanIds = [...currentJawaban.jawabanIds];

    if (currentSoal.tipe === "multi") {
      const has = currentJawaban.jawabanIds.includes(jawabanId);
      nextJawabanIds = has
        ? currentJawaban.jawabanIds.filter((x) => x !== jawabanId)
        : [...currentJawaban.jawabanIds, jawabanId];
    } else {
      nextJawabanIds = [jawabanId];
    }

    updateJawaban({ jawabanIds: nextJawabanIds });
  }

  function handleNavigateIdx(newIdx: number) {
    if (!sesi) return;
    // Flush pending answer updates before moving to the next question
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (sesiRef.current) {
        sesiRepo.upsert(sesiRef.current);
        sesiRepo.flush().catch(() => {});
      }
    }
    setIdx(newIdx);
  }

  async function submit(reason?: string) {
    if (submittingRef.current || !ujian || !sesiRef.current) return;
    submittingRef.current = true;
    try {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const graded = gradeSesi(sesiRef.current, ujian);
      sesiRepo.upsert(graded);
      const result = await sesiRepo.flush();
      if (!result.ok) {
        toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
        submittingRef.current = false;
        return;
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast.success(
        reason ? `Ujian disubmit (${reason})` : "Ujian berhasil disubmit",
      );
      navigate({
        to: "/peserta/ujian/$id/hasil",
        params: { id: ujian.id },
      });
    } catch {
      toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
      submittingRef.current = false;
    }
  }

  if (!user) return <div className="p-8 text-center font-medium">Anda harus login.</div>;
  if (!ujian) return <div className="p-8 text-center font-medium">Data ujian tidak ditemukan.</div>;
  if (!sesiDicari) return <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="animate-pulse flex flex-col items-center gap-4"><div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" /><p className="text-slate-500 font-medium tracking-widest uppercase text-sm">Menyiapkan Mesin Ujian...</p></div></div>;
  if (!sesi) return <div className="p-8 text-center font-medium">Sesi tidak valid.</div>;

  const soalId = sesi.soalIds[idx];
  const soal = soalId ? soalRepo.byId(soalId) : undefined;
  const j = sesi.jawaban[idx];

  if (!soal || !j) return <div className="p-8 text-center font-medium">Soal bermasalah.</div>;

  const currentSesi = sesi;
  const currentSoal = soal;
  const currentJawaban = j;
  const optOrder = currentSesi.jawabanOrder[currentSoal.id] ?? currentSoal.jawaban.map((o) => o.id);

  const isAnswered =
    currentJawaban.jawabanIds.length > 0 ||
    Boolean(currentJawaban.jawabanEssay?.trim());

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 300_000; // < 5 minutes
  const critical = remaining < 60_000; // < 1 minute

  const textSizeClass = 
    fontSize === "sm" ? "text-xs sm:text-sm prose-sm" : 
    fontSize === "lg" ? "text-base sm:text-lg prose-lg" : "text-sm sm:text-base prose-base";

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950/50 font-sans">
      <div className="flex-1 flex mx-auto w-full max-w-[1600px] h-full relative">
        
        {/* LEFT PANEL: MAIN EXAM AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 relative z-10 shadow-2xl md:shadow-none">
          
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between transition-colors">
            
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold text-base border border-primary/20 shadow-sm">
                {idx + 1}
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Soal Ke-</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-none">Dari {currentSesi.soalIds.length} Soal</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-4">
              {/* Font Size Controls */}
              <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/50">
                <button onClick={() => setFontSize("sm")} className={cn("flex items-center justify-center w-7 h-7 rounded-md font-bold text-xs transition-all", fontSize === "sm" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")} title="Perkecil Teks">
                  <Type className="w-3 h-3" />
                </button>
                <button onClick={() => setFontSize("base")} className={cn("flex items-center justify-center w-7 h-7 rounded-md font-bold text-sm transition-all", fontSize === "base" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")} title="Teks Normal">
                  <Type className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setFontSize("lg")} className={cn("flex items-center justify-center w-7 h-7 rounded-md font-bold text-base transition-all", fontSize === "lg" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")} title="Perbesar Teks">
                  <Type className="w-4 h-4" />
                </button>
              </div>

              {/* Timer */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm transition-colors",
                critical ? "bg-red-500 text-white border-red-600 animate-pulse" : 
                danger ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900" : 
                "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              )}>
                <Clock className={cn("w-4 h-4", critical ? "text-white" : danger ? "text-red-500" : "text-slate-400")} />
                <span className="font-mono font-bold text-sm sm:text-base tracking-tight tabular-nums mt-0.5">
                  {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </span>
              </div>

              <Button variant="outline" size="icon" className="md:hidden w-9 h-9 rounded-lg border-slate-200 dark:border-slate-700" onClick={() => setShowList(true)}>
                <LayoutGrid className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Question & Options Scrollable Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8 pb-28">
              
              {/* Question Text */}
              <div 
                aria-live="polite"
                className={cn("prose prose-slate dark:prose-invert max-w-none mb-6 text-slate-800 dark:text-slate-200 leading-relaxed", textSizeClass)}
              >
                <RichView html={currentSoal.detail} />
              </div>
              
              {/* Audio Player if present */}
              {currentSoal.audioFileId && (
                <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-widest">Audio Pendukung</p>
                  <AudioPlayer
                    fileId={currentSoal.audioFileId}
                    playOnce={currentSoal.audioPlayOnce}
                    storageKey={`cbtman:audio:${currentSesi.id}:${currentSoal.id}`}
                  />
                </div>
              )}

              {/* Options / Essay Input */}
              <div className="space-y-3">
                {currentSoal.tipe === "essay" ? (
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary opacity-0 group-focus-within:opacity-100 rounded-xl blur transition duration-300" />
                    <Textarea
                      rows={8}
                      value={currentJawaban.jawabanEssay ?? ""}
                      onChange={(e) => updateJawaban({ jawabanEssay: e.target.value })}
                      placeholder="Ketik jawaban esai Anda secara lengkap dan jelas di sini..."
                      className={cn(
                        "relative bg-white dark:bg-slate-950 resize-y p-4 sm:p-5 rounded-xl border-2 border-slate-200 dark:border-slate-800 focus-visible:ring-0 focus-visible:border-primary shadow-inner transition-colors",
                        textSizeClass
                      )}
                    />
                  </div>
                ) : (
                  optOrder.map((oid, i) => {
                    const opt = currentSoal.jawaban.find((x) => x.id === oid);
                    if (!opt) return null;
                    const isChecked = currentJawaban.jawabanIds.includes(oid);
                    const optLetter = String.fromCharCode(65 + i);

                    return (
                      <label 
                        key={oid}
                        className={cn(
                          "group relative flex items-start p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5",
                          "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/40 has-[:focus-visible]:border-primary", // a11y focus ring
                          isChecked 
                            ? "bg-primary/5 border-primary shadow-[0_0_0_1px_rgba(3,165,89,1)] dark:bg-primary/10 dark:shadow-[0_0_0_1px_rgba(3,165,89,0.5)]" 
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                        )}
                      >
                        <input
                          type={currentSoal.tipe === "multi" ? "checkbox" : "radio"}
                          name={`soal-${currentSoal.id}`}
                          className="sr-only"
                          checked={isChecked}
                          onChange={() => toggleOption(oid)}
                        />
                        
                        <div className="flex shrink-0 items-center justify-center mt-0.5 mr-3 sm:mr-4">
                          <div className={cn(
                            "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 font-bold text-xs sm:text-sm transition-all duration-300",
                            isChecked
                              ? "bg-primary border-primary text-white scale-105 shadow-sm"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:border-primary/50 group-hover:text-primary"
                          )}>
                            {optLetter}
                          </div>
                        </div>

                        <div className={cn(
                          "flex-1 min-w-0 prose prose-slate dark:prose-invert max-w-none prose-p:my-0 leading-relaxed transition-colors",
                          textSizeClass,
                          isChecked ? "text-slate-900 dark:text-white font-medium" : "text-slate-600 dark:text-slate-300"
                        )}>
                          <RichView html={opt.detail} />
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="sticky bottom-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
              
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="default"
                  className="font-bold rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 h-11 px-4 sm:px-5 transition-all text-xs sm:text-sm"
                  disabled={idx === 0}
                  onClick={() => handleNavigateIdx(idx - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> SEBELUMNYA
                </Button>

                <label className={cn(
                  "flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-lg font-bold uppercase tracking-wider transition-all border-2 select-none text-xs sm:text-sm",
                  !isAnswered
                    ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800"
                    : currentJawaban.ragu 
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shadow-sm cursor-pointer" 
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-200 dark:hover:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer"
                )}>
                  <input 
                    type="checkbox" 
                    disabled={!isAnswered}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer disabled:cursor-not-allowed"
                    checked={currentJawaban.ragu}
                    onChange={(e) => isAnswered && updateJawaban({ ragu: e.target.checked })}
                  />
                  RAGU-RAGU
                </label>
              </div>

              {idx < currentSesi.soalIds.length - 1 ? (
                <Button
                  size="default"
                  className="h-11 px-5 sm:px-6 rounded-lg font-bold uppercase tracking-wider shadow-sm hover:shadow-md transition-all text-xs sm:text-sm"
                  disabled={!isAnswered}
                  onClick={() => handleNavigateIdx(idx + 1)}
                >
                  BERIKUTNYA <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="default"
                  variant="destructive"
                  className="h-11 px-5 sm:px-6 rounded-lg font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all text-xs sm:text-sm"
                  disabled={!isAnswered}
                  onClick={() => {
                    if (confirm("Yakin ingin mengumpulkan ujian?")) void submit();
                  }}
                >
                  AKHIRI UJIAN
                </Button>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT PANEL: GRID NAVIGATION (Desktop Only) */}
        <div className="hidden md:flex flex-col w-[300px] lg:w-[340px] bg-slate-50/50 dark:bg-slate-950/30 border-l border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm tracking-tight">Alat Bantu Ujian</h3>
            <AlatBantuUjian ujian={ujian} />

            <div className="mt-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <div className="w-3.5 h-3.5 rounded-full bg-primary shadow-sm" /> Sudah Dijawab
              </div>
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <div className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-sm" /> Ragu-ragu
              </div>
              <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <div className="w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm" /> Belum Dijawab
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
              {currentSesi.soalIds.map((_, i) => {
                const a = currentSesi.jawaban[i];
                const dijawab = (a?.jawabanIds?.length ?? 0) > 0 || (a?.jawabanEssay ? a.jawabanEssay.length > 0 : false);
                const isBlocked = i > idx && !isAnswered;
                
                return (
                  <button
                    key={i}
                    disabled={isBlocked}
                    onClick={() => {
                      if (isBlocked) {
                        toast.warning("Pilih atau isi jawaban terlebih dahulu untuk melanjutkan.");
                        return;
                      }
                      handleNavigateIdx(i);
                    }}
                    className={cn(
                      "relative aspect-square flex items-center justify-center rounded-lg text-xs sm:text-sm font-bold border-2 transition-all",
                      isBlocked
                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                        : "hover:scale-105",
                      i === idx && "ring-2 ring-primary/40 dark:ring-primary/60",
                      !isBlocked && (
                        a.ragu
                          ? "bg-amber-400 text-white border-amber-500 shadow-sm"
                          : dijawab
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                      )
                    )}
                  >
                    {i + 1}
                    {i === idx && (
                      <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-white dark:bg-slate-800 ring-1 ring-primary/20">
                        <span className="h-1 w-1 rounded-full bg-primary" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <Button
              variant="destructive"
              className="w-full h-11 font-bold tracking-widest shadow-md"
              onClick={() => { if (confirm("Yakin ingin mengumpulkan?")) void submit(); }}
            >
              Akhiri Ujian
            </Button>
          </div>
        </div>

      </div>

      {/* MOBILE LIST MODAL (Show when showList is true) */}
      {showList && (
        <div className="fixed inset-0 z-50 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-6 py-5 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 text-lg font-black text-slate-800 dark:text-white">
              <LayoutGrid className="w-5 h-5 text-primary" /> DAFTAR SOAL
            </div>
            <button 
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300"
              onClick={() => setShowList(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-xl mx-auto">
              <AlatBantuUjian ujian={ujian} />

              <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-8 mt-6 shadow-sm">
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-primary shadow-sm mb-1" />
                  <span className="text-xs font-semibold text-slate-500">Sudah</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-amber-400 shadow-sm mb-1" />
                  <span className="text-xs font-semibold text-slate-500">Ragu</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm mb-1" />
                  <span className="text-xs font-semibold text-slate-500">Kosong</span>
                </div>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {currentSesi.soalIds.map((_, i) => {
                  const a = currentSesi.jawaban[i];
                  const dijawab = (a?.jawabanIds?.length ?? 0) > 0 || (a?.jawabanEssay ? a.jawabanEssay.length > 0 : false);
                  const isBlocked = i > idx && !isAnswered;
                  return (
                    <button
                      key={i}
                      disabled={isBlocked}
                      onClick={() => { 
                        if (isBlocked) {
                          toast.warning("Pilih atau isi jawaban terlebih dahulu untuk melanjutkan.");
                          return;
                        }
                        handleNavigateIdx(i); 
                        setShowList(false); 
                      }}
                      className={cn(
                        "relative aspect-square rounded-2xl text-lg font-bold border-2 transition-all shadow-sm",
                        isBlocked
                          ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                          : "active:scale-95",
                        i === idx && "ring-4 ring-primary/30",
                        !isBlocked && (
                          a.ragu
                            ? "bg-amber-400 text-white border-amber-500"
                            : dijawab
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        )
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-12 pb-12">
                <Button 
                  size="lg"
                  variant="destructive"
                  className="w-full h-14 font-black text-lg uppercase tracking-widest shadow-lg"
                  onClick={() => {
                    setShowList(false);
                    if (confirm("Kumpulkan sekarang?")) void submit();
                  }}
                >
                  Akhiri Ujian
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
