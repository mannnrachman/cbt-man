import { cn } from "@/lib/utils";
import { Globe, Monitor } from "lucide-react";

interface ExamTabsProps {
  activeTab: "online" | "offline";
  setActiveTab: (tab: "online" | "offline") => void;
  onlineCount: number;
  offlineCount: number;
}

export function ExamTabs({ activeTab, setActiveTab, onlineCount, offlineCount }: ExamTabsProps) {
  return (
    <div className="relative grid grid-cols-2 bg-slate-200/50 dark:bg-black/20 p-1.5 rounded-xl border border-slate-300/50 dark:border-white/5 w-full sm:w-[320px]">
      <div
        className={cn(
          "absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-transform duration-300 ease-out z-0",
          activeTab === "online" ? "translate-x-0" : "translate-x-full"
        )}
      />

      <button
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-bold rounded-lg transition-colors duration-300",
          activeTab === "online"
            ? "text-[#03A559] dark:text-green-400"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
        onClick={() => setActiveTab("online")}
      >
        <Globe className="h-4 w-4" /> Online 
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-xs transition-colors duration-300",
          activeTab === "online" ? "bg-slate-100 dark:bg-slate-900" : "bg-white/50 dark:bg-black/10"
        )}>
          {onlineCount}
        </span>
      </button>

      <button
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 px-2 py-2.5 text-sm font-bold rounded-lg transition-colors duration-300",
          activeTab === "offline"
            ? "text-[#03A559] dark:text-green-400"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
        onClick={() => setActiveTab("offline")}
      >
        <Monitor className="h-4 w-4" /> Offline
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-xs transition-colors duration-300",
          activeTab === "offline" ? "bg-slate-100 dark:bg-slate-900" : "bg-white/50 dark:bg-black/10"
        )}>
          {offlineCount}
        </span>
      </button>
    </div>
  );
}
