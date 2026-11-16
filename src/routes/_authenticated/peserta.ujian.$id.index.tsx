import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ujianRepo,
  sesiRepo,
  hydrateRepos,
  invalidateReposCache,
  claimExamToken,
  createExamSession,
  mataKuliahRepo,
  semesterRepo,
} from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import {
  getExamAvailabilityMessage,
  getExamAvailabilityStatus,
  isExamAvailable,
} from "@/lib/cbt/availability";
import { isParticipantAssignedToExam } from "@/lib/cbt/access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { armExamAlarm } from "@/lib/cbt/exam-alarm";
import { toast } from "sonner";
import { RichView } from "@/components/cbt/RichEditor";
import { ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/peserta/ujian/$id/")({
  loader: async () => {
    // Ensure the peserta-side snapshot is up to date. The cache is
    // server-side filtered to only ujian the participant's group is
    // allowed to see, so a direct URL to a blocked ujian will not be
    // in the local cache; we still need `user` to be present for the
    // policy check below.
    try {
      await hydrateRepos();
    } catch {
      // Cache may already be hydrated or the snapshot endpoint is
      // temporarily unavailable; fall through and let the component
      // render the locked state.
    }
  },
  component: PreUjian,
});

function PreUjian() {
  const { id } = useParams({ from: "/_authenticated/peserta/ujian/$id/" });
  const user = useAuthStore((s) => s.user);
  const ujian = ujianRepo.byId(id);

  if (!user) return <div>Pengguna tidak ditemukan</div>;

  // Direct-URL guard (Issue #8). The dashboard already filters exams by
  // group, but a participant who knows/guesses an id can otherwise open
  // this route, redeem a token, and start a session. Block before any
  // side-effects so the assignment policy is enforced at the route layer.
  //
  // The peserta-side snapshot strips ujian the participant's group is
  // not allowed to see, so `ujianRepo.byId(id)` returns `undefined` for
  // a blocked (or non-existent) ujian. In both cases the participant
  // must not see the exam content; render the blocked card.
  if (!ujian || !isParticipantAssignedToExam(user, ujian)) {
    return <PreUjianBlocked user={user} ujian={ujian} />;
  }

  return <PreUjianContent user={user} ujian={ujian} />;
}

function PreUjianBlocked({
  user,
  ujian,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>;
  ujian: NonNullable<ReturnType<typeof ujianRepo.byId>> | undefined;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
      <Link to="/peserta" className="text-sm text-muted-foreground hover:underline">
        ← Daftar ujian
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {ujian ? ujian.nama : "Ujian tidak tersedia"}
      </h1>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            role="alert"
            data-testid="peserta-not-assigned-blocked"
            className="space-y-1 rounded-lg border border-destructive/40 p-3 text-ui"
          >
            <div className="flex items-center gap-2 font-medium">
              <ShieldOff className="h-4 w-4" />
              Anda tidak terdaftar pada ujian ini
            </div>
            <p className="text-label text-muted-foreground">
              Ujian ini tidak di-assign ke kelas Anda. Hubungi pengawas atau operator jika Anda
              merasa seharusnya memiliki akses.
            </p>
          </div>
          <div className="text-label text-muted-foreground">
            Login sebagai <span className="font-medium">{user.namaLengkap}</span> ({user.username})
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/peserta">Kembali ke daftar ujian</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PreUjianContent({
  user,
  ujian,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>;
  ujian: NonNullable<ReturnType<typeof ujianRepo.byId>>;
}) {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [agree, setAgree] = useState(false);
  const tokenInputId = `token-ujian-${ujian.id}`;
  const availability = getExamAvailabilityStatus(ujian);
  const examAllowed = isExamAvailable(ujian);
  const sesiBerlangsung = sesiRepo
    .all()
    .find((s) => s.ujianId === ujian.id && s.pesertaId === user.id && s.status === "sedang" &&
      s.endsAt !== undefined && s.endsAt > Date.now() &&
      (ujian.endAt === undefined || ujian.endAt > Date.now()));
  const canOpen = examAllowed;
  const blockedMessage = getExamAvailabilityMessage(availability, ujian);

  const sesiSelesai = sesiRepo
    .all()
    .find((s) => s.ujianId === ujian.id && s.pesertaId === user.id && s.status === "selesai");

  async function mulai() {
    if (!canOpen) {
      toast.error(blockedMessage || "Ujian tidak dapat dimulai saat ini");
      return;
    }
    if (!agree) {
      toast.error("Centang persetujuan dulu");
      return;
    }
    armExamAlarm();
    if (ujian.tokenAktif && !sesiBerlangsung) {
      const kode = token.trim().toUpperCase();
      if (kode.length === 0) {
        toast.error("Masukkan token");
        return;
      }
      // TokenClaim on the server is the only authority for token access.
      // Two participants racing the same unused token cannot both win here.
      const claim = await claimExamToken(ujian.id, kode);
      if (!claim.ok) {
        toast.error(claim.error);
        return;
      }
    }
    if (ujian.fullscreenWajib) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* ignore */
      }
    }
    try {
      const createRes = await createExamSession(ujian.id);
      if (!createRes.ok) {
        toast.error(createRes.error);
        return;
      }

      invalidateReposCache();
      await hydrateRepos();
      navigate({ to: "/peserta/ujian/$id/kerjakan", params: { id: ujian.id } });
    } catch {
      toast.error("Gagal memulai ujian. Silakan coba lagi.");
      return;
    }
  }

  const mk = ujian.mataKuliahId ? mataKuliahRepo.byId(ujian.mataKuliahId) : null;
  const smt = ujian.semesterId ? semesterRepo.byId(ujian.semesterId) : null;

  const jumlahSoal = ujian.topicSets.reduce((a, b) => a + b.jumlah, 0);
  const agreeId = `setuju-ujian-${ujian.id}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="space-y-4">
        <Link to="/peserta" className="inline-flex text-ui text-muted-foreground hover:text-foreground">
          ← Kembali ke daftar ujian
        </Link>
        <div className="space-y-2">
          <h1 className="text-title font-medium tracking-tight text-foreground">{ujian.nama}</h1>
          {mk && (
            <p className="text-ui text-muted-foreground">
              {mk.nama}
              {smt ? ` · ${smt.nama}` : ""}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-6 border-y py-4 sm:max-w-sm">
          <div>
            <dt className="text-label text-muted-foreground">Durasi</dt>
            <dd className="text-heading font-medium tabular-nums">{ujian.durasiMenit} menit</dd>
          </div>
          <div>
            <dt className="text-label text-muted-foreground">Jumlah soal</dt>
            <dd className="text-heading font-medium tabular-nums">{jumlahSoal} soal</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="space-y-3">
            <h2 className="text-heading font-medium text-foreground">Petunjuk</h2>
            <div className="prose prose-slate max-w-none text-body dark:prose-invert">
              <RichView html={ujian.deskripsi || "<p>Tidak ada petunjuk khusus dari pengajar.</p>"} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-heading font-medium text-foreground">Aturan ujian</h2>
            <ul className="list-disc space-y-2 pl-5 text-body text-foreground">
              {ujian.fullscreenWajib && <li>Ujian wajib dikerjakan dalam mode layar penuh.</li>}
              {ujian.maxPindahTab > 0 && (
                <li>
                  Pindah tab diizinkan paling banyak {ujian.maxPindahTab} kali. Lebih dari itu ujian dikumpulkan otomatis.
                </li>
              )}
              {ujian.blokirShortcut && <li>Salin, tempel, dan klik kanan dinonaktifkan.</li>}
              {ujian.allowNilaiNormal && <li>Tabel nilai normal laboratorium tersedia selama ujian.</li>}
              <li>Waktu berjalan mundur dan tidak bisa dihentikan setelah ujian dimulai.</li>
            </ul>
          </section>
        </div>

        <aside className="lg:col-span-1">
          <div className="space-y-6 rounded-lg border bg-card p-6 lg:sticky lg:top-8">
            {!canOpen && (
              <div role="status" className="space-y-1 rounded-lg border border-destructive/40 p-4">
                <p className="font-medium text-destructive">
                  {availability === "upcoming" ? "Ujian belum dimulai" : "Ujian sudah berakhir"}
                </p>
                <p className="text-ui text-muted-foreground">{blockedMessage}</p>
              </div>
            )}

            {sesiSelesai && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Ujian sudah selesai</p>
                  <p className="text-ui text-muted-foreground">Jawaban Anda sudah dikumpulkan.</p>
                </div>
                <Button asChild className="w-full">
                  <Link to="/peserta/ujian/$id/hasil" params={{ id: ujian.id }}>
                    Lihat hasil
                  </Link>
                </Button>
              </div>
            )}

            {canOpen && !sesiSelesai && (
              <div className="space-y-6">
                {ujian.tokenAktif && !sesiBerlangsung && (
                  <div className="space-y-2">
                    <Label htmlFor={tokenInputId}>Token ujian</Label>
                    <Input
                      id={tokenInputId}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="h-12 text-center font-mono text-heading"
                    />
                    <p className="text-label text-muted-foreground">Minta token ke pengawas ruangan.</p>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Checkbox
                    id={agreeId}
                    checked={agree}
                    onCheckedChange={(checked) => setAgree(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={agreeId} className="cursor-pointer text-ui font-normal leading-snug">
                    Saya siap dan bersedia mengerjakan ujian ini dengan jujur.
                  </Label>
                </div>

                <Button size="lg" className="w-full" onClick={mulai} disabled={!canOpen || !agree}>
                  Mulai ujian
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
