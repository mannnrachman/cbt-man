import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { ujianRepo, sesiRepo } from "@/lib/cbt/repos";
import { isParticipantAssignedToExam } from "@/lib/cbt/access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText, CalendarClock, CalendarX } from "lucide-react";
import { getExamAvailabilityStatus } from "@/lib/cbt/availability";
import { RichView } from "@/components/cbt/RichEditor";

export const Route = createFileRoute("/_authenticated/peserta/")({
  component: PesertaDashboard,
});

function PesertaDashboard() {
  const user = useAuthStore((s) => s.user)!;
  // Group-assignment filter uses the shared policy helper so the
  // dashboard and the pre-exam route can't drift apart (Issue #8).
  const ujian = ujianRepo.all().filter((u) => isParticipantAssignedToExam(user, u));
  const sesi = sesiRepo.all().filter((s) => s.pesertaId === user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Halo, {user.namaLengkap}</h1>
        <p className="text-sm text-muted-foreground">
          Berikut daftar ujian yang tersedia untuk Anda.
        </p>
      </div>

      {ujian.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada ujian yang diberikan untuk Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ujian.map((u) => {
            const s = sesi.find((x) => x.ujianId === u.id);
            const status = s?.status ?? "belum";
            const selesai = status === "selesai";
            const availability = getExamAvailabilityStatus(u);
            const isStartable = availability === "active" || availability === "open";
            return (
              <Card key={u.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    {u.nama}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" /> Durasi {u.durasiMenit} menit ·{" "}
                    {u.topicSets.reduce((a, b) => a + b.jumlah, 0)} soal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RichView
                    className="text-sm text-muted-foreground line-clamp-3"
                    html={u.deskripsi}
                  />
                  {availability === "upcoming" && (
                    <div className="flex items-start gap-2 rounded border border-info/30 bg-info/10 p-2 text-xs">
                      <CalendarClock className="h-4 w-4 shrink-0 text-info-foreground" />
                      <span>
                        Dibuka {u.beginAt ? new Date(u.beginAt).toLocaleString("id-ID") : ""}
                      </span>
                    </div>
                  )}
                  {availability === "ended" && (
                    <div className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs">
                      <CalendarX className="h-4 w-4 shrink-0 text-destructive" />
                      <span>
                        Ditutup {u.endAt ? new Date(u.endAt).toLocaleString("id-ID") : ""}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {status}
                    </span>
                    {selesai ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/peserta/ujian/$id/hasil" params={{ id: u.id }}>
                          Lihat Hasil
                        </Link>
                      </Button>
                    ) : isStartable ? (
                      <Button asChild size="sm">
                        <Link to="/peserta/ujian/$id" params={{ id: u.id }}>
                          {status === "sedang" ? "Lanjutkan" : "Mulai"}
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        {availability === "upcoming" ? "Belum Dibuka" : "Sudah Berakhir"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
