import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExamContext } from "./ExamContext";

export function ExamFooter() {
  const { sesi, idx, handleNavigateIdx, updateJawaban, submit } = useExamContext();
  const currentJawaban = sesi.jawaban[idx];

  return (
    <div className="sticky bottom-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        
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

        {idx < sesi.soalIds.length - 1 ? (
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
            onClick={() => {
              if (confirm("Pastikan semua jawaban telah terisi dengan benar. Yakin kumpulkan ujian sekarang?")) void submit();
            }}
          >
            KUMPULKAN
          </Button>
        )}

      </div>
    </div>
  );
}
