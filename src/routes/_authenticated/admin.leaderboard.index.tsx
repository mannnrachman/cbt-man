import { createFileRoute, Link } from "@tanstack/react-router";
import { ujianRepo, sesiRepo } from "@/lib/cbt/repos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ChevronRight } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/leaderboard/")({
  component: LeaderboardIndex,
});

function LeaderboardIndex() {
  const ujian = ujianRepo.all();
  const sesi = sesiRepo.all();

  return (
    <AdminPage>
      <AdminPageHeader
        title="Leaderboard"
        description="Pilih paket ujian untuk melihat peringkat."
      />

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {ujian.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Belum ada paket ujian.</div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60">
            {ujian.map((u) => {
              const n = sesi.filter((s) => s.ujianId === u.id && s.status === "selesai").length;
              return (
                <Link
                  key={u.id}
                  to="/admin/leaderboard/$id"
                  params={{ id: u.id }}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {u.nama}
                      </span>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {n} sesi selesai
                    </span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-200/50 dark:border-amber-800/50">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>Lihat Peringkat</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
