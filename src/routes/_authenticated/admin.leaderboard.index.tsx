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
    <AdminPage className="">
      <div className="max-w-4xl pb-20 w-full">
      <AdminPageHeader
        title="Leaderboard"
        description="Pilih paket ujian untuk melihat peringkat."
      />

      <div className="bg-card rounded-lg border border-border overflow-hidden divide-y divide-border">
        {ujian.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Belum ada paket ujian.</div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {ujian.map((u) => {
              const n = sesi.filter((s) => s.ujianId === u.id && s.status === "selesai").length;
              return (
                <Link
                  key={u.id}
                  to="/admin/leaderboard/$id"
                  params={{ id: u.id }}
                  className="flex items-center justify-between p-4 hover:bg-accent transition-colors group"
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {u.nama}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground truncate">
                      {n} sesi selesai
                    </span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warn/10 text-warn text-label font-medium border border-warn/50">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>Lihat Peringkat</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </AdminPage>
  );
}
