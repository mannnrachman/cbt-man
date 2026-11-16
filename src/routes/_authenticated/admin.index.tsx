import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  usersRepo,
  modulRepo,
  soalRepo,
  ujianRepo,
  sesiRepo,
  configRepo,
} from "@/lib/cbt/repos";
import { canAccessAdminPath } from "./admin";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";
import { StatusBadge } from "@/components/cbt/StatusBadge";

const MAX_ACTIVE_ROWS = 6;

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user);
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Data fetching & calculations
  const pesertaList = usersRepo.all().filter((u) => u.role === "mahasiswa");
  const soalList = soalRepo.all();
  const semuaUjian = ujianRepo.all();
  const cfg = configRepo.get();
  if (!user) return null;
  const canAccess = (path: string) => canAccessAdminPath(user, path, cfg);

  const newPeserta = pesertaList.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;
  const newSoal = soalList.filter(s => s.createdAt && (now - s.createdAt) < ONE_WEEK).length;
  const newUjian = semuaUjian.filter(u => u.createdAt && (now - u.createdAt) < ONE_WEEK).length;

  const counts = {
    peserta: pesertaList.length,
    modul: modulRepo.all().length,
    soal: soalList.length,
    ujian: semuaUjian.length,
    sesi: sesiRepo.all().length,
  };

  const activeExams = semuaUjian.filter(
    (u): u is typeof u & { beginAt: number; endAt: number } =>
      typeof u.beginAt === "number" &&
      typeof u.endAt === "number" &&
      now >= u.beginAt &&
      now <= u.endAt,
  );
  const upcoming = semuaUjian
    .filter((u): u is typeof u & { beginAt: number } => typeof u.beginAt === "number" && now < u.beginAt)
    .sort((a, b) => a.beginAt - b.beginAt);
  const upcomingExamCount = upcoming.length;
  const upcomingExams = upcoming.slice(0, 4);
  const finishedExams = semuaUjian.filter((u) => u.endAt && now > u.endAt);

  const pendingTasks = finishedExams.length > 0 && canAccess("/admin/evaluasi")
    ? [{
        id: "eval-reports",
        title: "Ujian selesai menunggu evaluasi",
        desc: `${finishedExams.length} ujian sudah selesai dan siap dinilai dan direkap.`,
        action: "Buka evaluasi",
        route: "/admin/evaluasi" as const,
      }]
    : [];

  // Format Helper for Numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}rb`;
    return num.toString();
  };

  const jakarta = { timeZone: "Asia/Jakarta" } as const;
  const stats = [
    { label: "Peserta", value: formatNumber(counts.peserta), note: newPeserta > 0 ? `+${newPeserta} minggu ini` : "Terdaftar" },
    { label: "Ujian", value: formatNumber(counts.ujian), note: `${activeExams.length} berlangsung, ${upcomingExamCount} mendatang` },
    { label: "Soal", value: formatNumber(counts.soal), note: newSoal > 0 ? `+${newSoal} minggu ini` : "Di bank soal" },
    { label: "Sesi ujian", value: formatNumber(counts.sesi), note: `${counts.modul} modul` },
  ];

  return (
    <AdminPage className="pb-16">
      <AdminPageHeader
        title="Dashboard"
        description={
          activeExams.length > 0
            ? `${activeExams.length} ujian sedang berlangsung.`
            : "Tidak ada ujian yang sedang berlangsung."
        }
        action={
          <>
            {canAccess("/admin/peserta/online") && (
              <Button variant="outline" asChild>
                <Link to="/admin/peserta/online">Pantau peserta</Link>
              </Button>
            )}
            {canAccess("/admin/ujian") && (
              <Button asChild>
                <Link to="/admin/ujian">Buat ujian</Link>
              </Button>
            )}
          </>
        }
      />

      <section aria-labelledby="dash-ringkasan" className="space-y-3">
        <h2 id="dash-ringkasan" className="sr-only">Ringkasan</h2>
        <dl className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card lg:grid-cols-4 lg:divide-y-0">
          {stats.map((item) => (
            <div key={item.label} className="space-y-1 p-4">
              <dt className="text-label text-muted-foreground">{item.label}</dt>
              <dd className="text-display font-medium tabular-nums text-foreground">{item.value}</dd>
              <dd className="text-label text-muted-foreground">{item.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      {pendingTasks.length > 0 && (
        <section className="space-y-3" aria-labelledby="dash-tindak-lanjut">
          <h2 id="dash-tindak-lanjut" className="text-heading font-medium text-foreground">Perlu ditindaklanjuti</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {pendingTasks.map((task) => (
              <li key={task.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="text-ui text-muted-foreground">{task.desc}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to={task.route}>{task.action}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="dash-berlangsung">
        <h2 id="dash-berlangsung" className="text-heading font-medium text-foreground">Ujian berlangsung</h2>
        {activeExams.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-ui text-muted-foreground">
            Tidak ada ujian yang sedang berlangsung.
            {canAccess("/admin/ujian") && (
              <>
                {" "}
                <Link to="/admin/ujian" className="text-primary underline-offset-4 hover:underline">
                  Lihat jadwal ujian
                </Link>
              </>
            )}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {activeExams.slice(0, MAX_ACTIVE_ROWS).map((exam) => (
              <li key={exam.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{exam.nama}</p>
                  <p className="text-ui text-muted-foreground">
                    <span suppressHydrationWarning>
                      Berakhir pukul {new Date(exam.endAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", ...jakarta })} WIB
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge tone="active">Berlangsung</StatusBadge>
                  {canAccess("/admin/peserta/online") && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/admin/peserta/online">Pantau peserta</Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {activeExams.length > MAX_ACTIVE_ROWS && canAccess("/admin/ujian") && (
          <p className="text-ui text-muted-foreground">
            Menampilkan {MAX_ACTIVE_ROWS} dari {activeExams.length} ujian.{" "}
            <Link to="/admin/ujian" className="text-primary underline-offset-4 hover:underline">
              Lihat semua ujian
            </Link>
          </p>
        )}
      </section>

      {upcomingExams.length > 0 && (
        <section className="space-y-3" aria-labelledby="dash-mendatang">
          <div className="flex items-baseline justify-between">
            <h2 id="dash-mendatang" className="text-heading font-medium text-foreground">Ujian mendatang</h2>
            <p className="text-ui text-muted-foreground">{upcomingExamCount} terjadwal</p>
          </div>
          <ul className="divide-y rounded-lg border bg-card">
            {upcomingExams.map((exam) => (
              <li key={exam.id} className="flex flex-col justify-between gap-1 p-4 sm:flex-row sm:items-center">
                <p className="font-medium text-foreground">{exam.nama}</p>
                <p className="text-ui tabular-nums text-muted-foreground" suppressHydrationWarning>
                  {new Date(exam.beginAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", ...jakarta })},{" "}
                  {new Date(exam.beginAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", ...jakarta })} WIB
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

    </AdminPage>
  );
}
