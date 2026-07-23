import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Type, Clock, LayoutGrid } from "lucide-react";
import { useExamContext } from "./ExamContext";

export function ExamHeader() {
  const { sesi, idx, remaining, fontSize, setFontSize, setShowList } = useExamContext();

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 300_000; // < 5 minutes
  const critical = remaining < 60_000; // < 1 minute

  return (
    <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary font-black text-xl border border-primary/20 shadow-sm">
          {idx + 1}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Soal Ke-</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-none">Dari {sesi.soalIds.length} Soal</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
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

        <Button variant="outline" size="icon" className="md:hidden w-10 h-10 rounded-xl border-slate-200 dark:border-slate-700" onClick={() => setShowList(true)}>
          <LayoutGrid className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Button>
      </div>
    </div>
  );
}
