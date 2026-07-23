import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useExamContext } from "./ExamContext";

export function ExamSidebar() {
  const { sesi, idx, handleNavigateIdx, submit } = useExamContext();

  return (
    <div className="hidden md:flex flex-col w-80 bg-slate-50/50 dark:bg-slate-950/30 border-l border-slate-200 dark:border-slate-800">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-lg tracking-tight">Navigasi Soal</h3>
        
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
          {sesi.soalIds.map((_, i) => {
            const a = sesi.jawaban[i];
            const dijawab = a.jawabanIds.length > 0 || a.jawabanEssay.length > 0;
            
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
          onClick={() => { if (confirm("Yakin ingin mengumpulkan?")) void submit(); }}
        >
          Akhiri Ujian
        </Button>
      </div>
    </div>
  );
}
