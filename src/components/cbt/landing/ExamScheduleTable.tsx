import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { CalendarDays, GraduationCap, Clock, Timer } from "lucide-react";
import { getExamCountdown, getExamStatus } from "@/lib/cbt/time";

interface ExamScheduleTableProps {
  exams: any[];
  activeTab: "online" | "offline";
  groupsMap: Record<string, string>;
  now: number;
}

export function ExamScheduleTable({ exams, activeTab, groupsMap, now }: ExamScheduleTableProps) {
  return (
    <div className="border border-white/50 dark:border-white/10 rounded-2xl bg-white/40 dark:bg-black/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md relative z-10 overflow-y-auto overflow-x-auto max-h-[250px] custom-scrollbar">
      <Table>
        <TableHeader className="bg-white/60 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/10">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-16 text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
              No
            </TableHead>
            <TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
              Nama Ujian
            </TableHead>
            <TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
              Program Studi
            </TableHead>
            <TableHead className="font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
              Waktu
            </TableHead>
            <TableHead className="text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
              Durasi
            </TableHead>
            <TableHead className="text-center font-sans font-extrabold text-xs uppercase tracking-wider py-4 text-slate-500 dark:text-slate-400">
              Countdown
            </TableHead>
            <TableHead className="text-right font-sans font-extrabold text-xs uppercase tracking-wider py-4 pr-6 text-slate-500 dark:text-slate-400">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exams.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                    <CalendarDays className="h-6 w-6 opacity-50" />
                  </div>
                  <p>Tidak ada ujian {activeTab === "online" ? "online" : "offline"} yang dijadwalkan hari ini.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            exams.map((exam, index) => (
              <TableRow
                key={exam.id}
                className="transition-colors border-b border-slate-200/50 dark:border-white/5 group"
              >
                <TableCell className="text-center font-bold text-slate-400 dark:text-slate-500 py-4">
                  {String(index + 1).padStart(2, '0')}
                </TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-100 py-4 transition-colors">
                  {exam.nama}
                </TableCell>
                <TableCell className="py-4">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-white/60 dark:bg-black/30 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/50 dark:border-white/5">
                    <GraduationCap className="h-3.5 w-3.5 text-[#03A559]" />
                    {exam.groupIds[0] && groupsMap[exam.groupIds[0]] ? groupsMap[exam.groupIds[0]] : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300 font-bold text-sm py-4">
                  <span suppressHydrationWarning className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    {exam.beginAt
                      ? new Date(Number(exam.beginAt)).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" },
                        )
                      : "—"}{" "}
                    —
                    {exam.endAt
                      ? new Date(Number(exam.endAt)).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" },
                        )
                      : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-center py-4">
                  <span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 px-2.5 py-1 rounded-md text-green-600 dark:text-green-300 text-xs font-bold border border-green-100 dark:border-green-500/20">
                    <Timer className="h-3.5 w-3.5" />
                    {exam.durasiMenit} mnt
                  </span>
                </TableCell>
                <TableCell className="text-center py-4">
                  {(() => {
                    const countdown = getExamCountdown(exam.beginAt, exam.endAt, now);
                    return (
                      <span className={`inline-flex items-center text-sm font-bold tracking-wider ${countdown.color}`}>
                        {countdown.text}
                      </span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right pr-6 py-4">
                  {(() => {
                    const status = getExamStatus(exam.beginAt, exam.endAt, now);
                    let colorClasses = "";
                    if (status.text === "Ujian Sudah Berlalu") {
                      colorClasses =
                        "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
                    } else if (
                      status.text === "Ujian Sedang Berlangsung"
                    ) {
                      colorClasses =
                        "bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.2)]";
                    } else {
                      colorClasses =
                        "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
                    }
                    return (
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border whitespace-nowrap ${colorClasses}`}>
                        {status.text}
                      </span>
                    );
                  })()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
