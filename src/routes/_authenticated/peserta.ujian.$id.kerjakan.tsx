import { useAuthStore } from "@/lib/cbt/auth-store";
import { soalBySessionId, sesiRepo, ujianRepo, getParticipantSessionState, invalidateReposCache, hydrateRepos, saveParticipantSession } from "@/lib/cbt/repos";
import type { SesiUjian, Ujian } from "@/lib/cbt/types";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LayoutGrid, X, ChevronLeft, ChevronRight, Flag, CheckCircle2, AlertCircle, Type, Clock, Calculator, FileText } from "lucide-react";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute(
  "/_authenticated/peserta/ujian/$id/kerjakan",
)({
  component: RouteComponent,
  loader: async () => {
    invalidateReposCache();
    return null;
  },
});

function CalculatorAction({ ujian }: { ujian: Ujian }) {
  if (!ujian.allowCalculator) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-4 w-full">
          <Calculator className="mr-2 h-4 w-4" aria-hidden="true" />
          Buka Kalkulator
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kalkulator Ujian</DialogTitle>
        </DialogHeader>
        <ExamCalculator />
      </DialogContent>
    </Dialog>
  );
}

function NilaiNormalAction({ ujian }: { ujian: Ujian }) {
  if (!ujian.allowNilaiNormal) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 w-full">
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
          Tabel Nilai Normal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tabel Nilai Normal Laboratorium</DialogTitle>
        </DialogHeader>
        <NilaiNormalTable />
      </DialogContent>
    </Dialog>
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
  const [pollingError, setPollingError] = useState(false);
  const submittingRef = useRef(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const [showList, setShowList] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
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

  const activeSesiId = sesi?.id;
  const activeSesiStatus = sesi?.status;
  const activeUjianId = ujian?.id;

  useEffect(() => {
    if (!activeSesiId || !activeUjianId || activeSesiStatus === "selesai") return;
    const interval = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endsAt) {
        clearInterval(interval);
        submit("Waktu Habis");
      }
    }, 1000);

    let pollInFlight = false;
    let pollingActive = true;
    const pollInterval = setInterval(async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const result = await getParticipantSessionState(activeSesiId);
        if (!pollingActive) return;
        if (result.ok) {
          setPollingError(false);
          if (result.sesi.status === "selesai") {
            invalidateReposCache();
            await hydrateRepos();
            if (!pollingActive) return;
            toast.warning("Ujian telah dihentikan oleh pengawas.");
            navigate({
              to: "/peserta/ujian/$id/hasil",
              params: { id: activeUjianId },
            });
          } else if (result.sesi.endsAt && sesiRef.current && result.sesi.endsAt !== sesiRef.current.endsAt) {
            // Safely merge endsAt without wiping local un-flushed answers
            setSesi(prev => prev ? { ...prev, endsAt: result.sesi.endsAt } : prev);
            toast.info("Waktu ujian Anda telah diperbarui oleh pengawas.");
          }
        } else {
          setPollingError(true);
        }
      } catch {
        if (pollingActive) setPollingError(true);
      } finally {
        pollInFlight = false;
      }
    }, 10000);

    const handleBeforeUnload = () => {
      if (sesiRef.current) {
        void saveParticipantSession(sesiRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      pollingActive = false;
      clearInterval(interval);
      clearInterval(pollInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSesiId, activeSesiStatus, activeUjianId, endsAt]);

  function updateJawaban(partial: Partial<SesiUjian["jawaban"][0]>) {
    if (!sesi) return;
    const nextSesi = { ...sesi };
    nextSesi.jawaban = [...nextSesi.jawaban];
    nextSesi.jawaban[idx] = { ...nextSesi.jawaban[idx], ...partial };
    // Keep the ref in sync synchronously: submit() reads sesiRef.current and
    // must never finalize a session missing the very latest answer (the
    // useEffect-based sync only runs after the next render commit).
    sesiRef.current = nextSesi;
    setSesi(nextSesi);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveParticipantSession(nextSesi);
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
        void saveParticipantSession(sesiRef.current);
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
      const result = await saveParticipantSession(sesiRef.current, true);
      if (!result.ok) {
        toast.error("Gagal menyimpan jawaban. Coba kumpulkan lagi.");
        submittingRef.current = false;
        return;
      }
      // Re-hydrate from the server so the hasil page reads the authoritative
      // server-computed score and the post-submit snapshot (answer keys and
      // pembahasan are only exposed after selesai when the exam allows it).
      // Non-fatal: the submit already persisted; a fresh load re-fetches.
      try {
        invalidateReposCache();
        await hydrateRepos();
      } catch {
        invalidateReposCache();
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
  const soal = soalId ? soalBySessionId(sesi.id, soalId) : undefined;
  const j = sesi.jawaban[idx];

  if (!soal || !j) return <div className="p-8 text-center font-medium">Soal bermasalah.</div>;

  const currentSesi = sesi;
  const currentSoal = soal;
  const currentJawaban = j;
  const optOrder = currentSesi.jawabanOrder[currentJawaban.soalId] ?? currentSoal.jawaban.map((o) => o.id);

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 300_000; // < 5 minutes
  const critical = remaining < 60_000; // < 1 minute

  const textSizeClass = 
    fontSize === "sm" ? "text-sm sm:text-base prose-sm" : 
    fontSize === "lg" ? "text-xl sm:text-2xl prose-xl" : "text-base sm:text-lg prose-base";

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950/50 font-sans">
      <div className="flex-1 flex mx-auto w-full max-w-[1600px] h-full relative">

        {/* LEFT PANEL: MAIN EXAM AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 relative z-10 shadow-2xl md:shadow-none">
          
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between transition-colors">
            
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-xl border border-primary/20 shadow-sm">
                {idx + 1}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Soal Ke-</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-none">Dari {currentSesi.soalIds.length} Soal</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {/* Font Size Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <button onClick={() => setFontSize("sm")} className={cn("flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm transition-all", fontSize === "sm" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")} title="Perkecil Teks">
                  <Type className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setFontSize("base")} className={cn("flex items-center justify-center w-8 h-8 rounded-lg font-bold text-base transition-all", fontSize === "base" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")} title="Teks Normal">
                  <Type className="w-4 h-4" />
                </button>
                <button onClick={() => setFontSize("lg")} className={cn("flex items-center justify-center w-8 h-8 rounded-lg font-bold text-lg transition-all", fontSize === "lg" ? "bg-white dark:bg-slate-700 text-primary shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")} title="Perbesar Teks">
                  <Type className="w-5 h-5" />
                </button>
              </div>

              {/* Timer */}
              <div className={cn(
                "flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border shadow-sm transition-colors",
                critical ? "bg-red-500 text-white border-red-600 animate-pulse" : 
                danger ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900" : 
                "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              )}>
                <Clock className={cn("w-4 h-4 sm:w-5 sm:h-5", critical ? "text-white" : danger ? "text-red-500" : "text-slate-400")} />
                <span className="font-mono font-bold text-base sm:text-lg tracking-tight tabular-nums mt-0.5">
                  {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </span>
              </div>

              {pollingError && (
                <p role="status" className="max-w-[9rem] text-right text-[11px] font-medium leading-tight text-amber-600 dark:text-amber-400 sm:text-xs">
                  Sinkronisasi tertunda — mencoba lagi.
                </p>
              )}

              <Button variant="outline" size="icon" className="md:hidden w-10 h-10 rounded-xl border-slate-200 dark:border-slate-700" onClick={() => setShowList(true)}>
                <LayoutGrid className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Question & Options Scrollable Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="max-w-5xl mx-auto px-5 sm:px-10 py-6 sm:py-10 pb-32">

              {/* Question Text */}
              <div 
                aria-live="polite"
                className={cn("prose prose-slate dark:prose-invert max-w-none mb-10 text-slate-800 dark:text-slate-200 leading-loose", textSizeClass)}
              >
                <RichView html={currentSoal.detail} />
              </div>
              
              {/* Audio Player if present */}
              {currentSoal.audioFileId && (
                <div className="mb-10 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest">Audio Pendukung</p>
                  <AudioPlayer
                    fileId={currentSoal.audioFileId}
                    playOnce={currentSoal.audioPlayOnce}
                    storageKey={`cbtman:audio:${currentSesi.id}:${currentSoal.id}`}
                  />
                </div>
              )}

              {/* Options / Essay Input */}
              <div className="space-y-4">
                {currentSoal.tipe === "essay" ? (
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary opacity-0 group-focus-within:opacity-100 rounded-2xl blur transition duration-300" />
                    <Textarea
                      rows={10}
                      value={currentJawaban.jawabanEssay ?? ""}
                      onChange={(e) => updateJawaban({ jawabanEssay: e.target.value })}
                      placeholder="Ketik jawaban esai Anda secara lengkap dan jelas di sini..."
                      className={cn(
                        "relative bg-white dark:bg-slate-950 resize-y p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 focus-visible:ring-0 focus-visible:border-primary shadow-inner transition-colors",
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
                          "group relative flex items-start p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5",
                          "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/40 has-[:focus-visible]:border-primary", // a11y focus ring
                          isChecked 
                            ? "bg-primary/5 border-primary shadow-[0_0_0_1px_rgba(3,165,89,1)] dark:bg-primary/10 dark:shadow-[0_0_0_1px_rgba(3,165,89,0.5)]" 
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                        )}
                      >
                        <input
                          type={currentSoal.tipe === "multi" ? "checkbox" : "radio"}
                          name={`soal-${currentSoal.id}`}
                          className="sr-only"
                          checked={isChecked}
                          onChange={() => toggleOption(oid)}
                        />
                        
                        <div className="flex shrink-0 items-center justify-center mt-0.5 sm:mt-1 mr-4 sm:mr-6">
                          <div className={cn(
                            "flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 font-bold transition-all duration-300",
                            isChecked
                              ? "bg-primary border-primary text-white scale-110 shadow-md"
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
          <div className="sticky bottom-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 sm:p-6">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">

              <div className="flex w-full sm:w-auto items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 h-14 px-6 transition-all"
                  disabled={idx === 0}
                  onClick={() => handleNavigateIdx(idx - 1)}
                >
                  <ChevronLeft className="w-5 h-5 mr-1" /> SEBELUMNYA
                </Button>

                <label className={cn(
                  "flex-1 sm:flex-none flex items-center justify-center gap-2 cursor-pointer h-14 px-6 rounded-xl font-bold uppercase tracking-wider transition-all border-2 select-none",
                  currentJawaban.ragu 
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 shadow-sm" 
                    : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-200 dark:hover:border-amber-800/50 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                )}>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                    checked={currentJawaban.ragu}
                    onChange={(e) => updateJawaban({ ragu: e.target.checked })}
                  />
                  RAGU-RAGU
                </label>
              </div>

              {idx < currentSesi.soalIds.length - 1 ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-14 px-8 rounded-xl font-bold uppercase tracking-widest shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                  onClick={() => handleNavigateIdx(idx + 1)}
                >
                  SELANJUTNYA <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full sm:w-auto h-14 px-8 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:-translate-y-0.5"
                  onClick={() => setShowSubmitDialog(true)}
                >
                  KUMPULKAN
                </Button>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT PANEL: GRID NAVIGATION (Desktop Only) */}
        <div className="hidden md:flex flex-col w-80 bg-slate-50/50 dark:bg-slate-950/30 border-l border-slate-200 dark:border-slate-800">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-lg tracking-tight">Navigasi Soal</h3>
            <CalculatorAction ujian={ujian} />
            <NilaiNormalAction ujian={ujian} />

            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 rounded-full bg-primary shadow-sm" /> Sudah Dijawab
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 rounded-full bg-amber-400 shadow-sm" /> Ragu-ragu
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                <div className="w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm" /> Belum Dijawab
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-5 gap-2.5">
              {currentSesi.soalIds.map((_, i) => {
                const a = currentSesi.jawaban[i];
                const dijawab = (a?.jawabanIds?.length ?? 0) > 0 || (a?.jawabanEssay ? a.jawabanEssay.length > 0 : false);
                
                return (
                  <button
                    key={i}
                    onClick={() => handleNavigateIdx(i)}
                    className={cn(
                      "relative aspect-square flex items-center justify-center rounded-xl text-sm font-bold border-2 transition-all hover:scale-105",
                      i === idx && "ring-4 ring-primary/20 dark:ring-primary/40",
                      a.ragu
                        ? "bg-amber-400 text-white border-amber-500 shadow-sm"
                        : dijawab
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                    )}
                  >
                    {i + 1}
                    {i === idx && (
                      <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white dark:bg-slate-800 ring-2 ring-primary/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <Button
              variant="destructive"
              className="w-full h-12 font-bold uppercase tracking-widest shadow-md"
              onClick={() => setShowSubmitDialog(true)}
            >
              Akhiri Ujian
            </Button>
          </div>
        </div>

      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="w-[calc(100%_-_2rem)] max-w-md overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-red-50 to-white p-6 dark:from-red-950/40 dark:to-slate-950">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl">Kumpulkan ujian sekarang?</DialogTitle>
              <DialogDescription className="pt-2 leading-relaxed">
                Pastikan semua jawaban telah terisi dengan benar. Setelah dikumpulkan, jawaban tidak dapat diubah kembali.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-2 sm:space-x-0">
              <DialogClose asChild>
                <Button variant="outline" className="h-11 rounded-xl">Periksa Kembali</Button>
              </DialogClose>
              <Button
                variant="destructive"
                className="h-11 rounded-xl font-bold"
                onClick={() => {
                  setShowSubmitDialog(false);
                  void submit();
                }}
              >
                Ya, Kumpulkan
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

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
              <CalculatorAction ujian={ujian} />
              <NilaiNormalAction ujian={ujian} />

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

              <div className="grid grid-cols-5 sm:grid-cols-6 gap-3">
                {currentSesi.soalIds.map((_, i) => {
                  const a = currentSesi.jawaban[i];
                  const dijawab = (a?.jawabanIds?.length ?? 0) > 0 || (a?.jawabanEssay ? a.jawabanEssay.length > 0 : false);
                  return (
                    <button
                      key={i}
                      onClick={() => { handleNavigateIdx(i); setShowList(false); }}
                      className={cn(
                        "relative aspect-square rounded-2xl text-lg font-bold border-2 transition-all shadow-sm active:scale-95",
                        i === idx && "ring-4 ring-primary/30",
                        a.ragu
                          ? "bg-amber-400 text-white border-amber-500"
                          : dijawab
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
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
                    setShowSubmitDialog(true);
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
