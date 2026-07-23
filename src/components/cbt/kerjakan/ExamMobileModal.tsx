import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutGrid, X } from "lucide-react";
import { useExamContext } from "./ExamContext";

export function ExamMobileModal() {
  const { sesi, idx, showList, setShowList, handleNavigateIdx, submit } = useExamContext();

  if (!showList) return null;

  return (
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
          
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-8 shadow-sm">
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
            {sesi.soalIds.map((_, i) => {
              const a = sesi.jawaban[i];
              const dijawab = a.jawabanIds.length > 0 || a.jawabanEssay.length > 0;
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
                if (confirm("Kumpulkan sekarang?")) void submit();
              }}
            >
              Akhiri Ujian
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
