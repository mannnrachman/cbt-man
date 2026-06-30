import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ujianRepo, sesiRepo, tokenRepo, hydrateRepos, claimExamToken } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { findOrCreateSesi, startSesi } from "@/lib/cbt/exam";
import {
  getExamAvailabilityMessage,
  getExamAvailabilityStatus,
  isExamAvailable,
} from "@/lib/cbt/availability";
import { isParticipantAssignedToExam, PesertaNotAssignedToExamError } from "@/lib/cbt/access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RichView } from "@/components/cbt/RichEditor";
import { Clock, AlertTriangle, CalendarClock, CalendarX, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/peserta/ujian/$id")({
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
  const { id } = useParams({ from: "/_authenticated/peserta/ujian/$id" });
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
    <div className="max-w-2xl mx-auto space-y-4">
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
            className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm space-y-1"
          >
            <div className="flex items-center gap-2 font-medium">
              <ShieldOff className="h-4 w-4" />
              Anda tidak terdaftar pada ujian ini
            </div>
            <p className="text-xs text-muted-foreground">
              Ujian ini tidak di-assign ke kelas Anda. Hubungi pengawas atau operator jika Anda
              merasa seharusnya memiliki akses.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
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
  const blockedMessage = getExamAvailabilityMessage(availability, ujian);
  const BlockedIcon = availability === "upcoming" ? CalendarClock : CalendarX;

  const sesiSelesai = sesiRepo
    .all()
    .find((s) => s.ujianId === ujian.id && s.pesertaId === user.id && s.status === "selesai");

  async function mulai() {
    if (!examAllowed) {
      toast.error(blockedMessage || "Ujian tidak dapat dimulai saat ini");
      return;
    }
    if (!agree) {
      toast.error("Centang persetujuan dulu");
      return;
    }
    if (ujian.tokenAktif) {
      const kode = token.trim().toUpperCase();
      if (kode.length === 0) {
        toast.error("Masukkan token");
        return;
      }
      // Advisory pre-check only: surface an obvious "already used by someone
      // else" from the local cache for a snappier message. On a cache miss or
      // any stale state we FALL THROUGH to the server — `claimExamToken` is the
      // sole authority and must not be short-circuited by the client cache
      // (e.g. a token generated after this client hydrated).
      const tokenRow = tokenRepo
        .all()
        .find((t) => t.ujianId === ujian.id && t.kode.toUpperCase() === kode);
      if (tokenRow?.dipakaiOleh && tokenRow.dipakaiOleh !== user.id) {
        toast.error("Token sudah dipakai peserta lain");
        return;
      }
      // Atomic claim (Issue #9): must succeed before any session is created.
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
      const sesi = findOrCreateSesi(ujian.id, user.id, user);
      const started = sesi.status === "sedang" ? sesi : startSesi(sesi, ujian);
      sesiRepo.upsert(started);
      navigate({ to: "/peserta/ujian/$id/kerjakan", params: { id: ujian.id } });
    } catch (err) {
      if (err instanceof PesertaNotAssignedToExamError) {
        toast.error("Anda tidak terdaftar pada ujian ini");
        navigate({ to: "/peserta" });
        return;
      }
      toast.error("Gagal memulai ujian. Silakan coba lagi.");
      return;
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link to="/peserta" className="text-sm text-muted-foreground hover:underline">
        ← Daftar ujian
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{ujian.nama}</h1>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Durasi {ujian.durasiMenit} menit · {ujian.topicSets.reduce((a, b) => a + b.jumlah, 0)}{" "}
            soal
          </div>
          <RichView html={ujian.deskripsi || "<p><em>Tidak ada deskripsi.</em></p>"} />
          {!examAllowed && (
            <div
              role="alert"
              data-testid="exam-availability-blocked"
              className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm space-y-1"
            >
              <div className="flex items-center gap-2 font-medium">
                <BlockedIcon className="h-4 w-4" />
                {availability === "upcoming" ? "Ujian belum dimulai" : "Ujian sudah berakhir"}
              </div>
              <p className="text-xs text-muted-foreground">{blockedMessage}</p>
            </div>
          )}
          {sesiSelesai && (
            <div className="rounded border bg-accent p-3 text-sm">
              Anda sudah menyelesaikan ujian ini.{" "}
              <Link
                to="/peserta/ujian/$id/hasil"
                params={{ id: ujian.id }}
                className="text-primary underline"
              >
                Lihat hasil
              </Link>
              .
            </div>
          )}
          <div className="rounded border border-warning/30 bg-warning/10 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Aturan
            </div>
            <ul className="ml-5 list-disc text-xs">
              {ujian.fullscreenWajib && <li>Ujian wajib dalam mode fullscreen.</li>}
              {ujian.maxPindahTab > 0 && (
                <li>Pindah tab/aplikasi maksimal {ujian.maxPindahTab}× sebelum auto-submit.</li>
              )}
              {ujian.blokirShortcut && <li>Copy, paste, dan klik kanan dinonaktifkan.</li>}
              <li>Waktu berjalan otomatis sejak Anda menekan "Mulai".</li>
            </ul>
          </div>
          {ujian.tokenAktif && (
            <div>
              <Label htmlFor={tokenInputId}>Token ujian</Label>
              <Input id={tokenInputId} value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            Saya bersedia mengikuti ujian dengan jujur.
          </label>
          <Button className="w-full" onClick={mulai} disabled={!!sesiSelesai || !examAllowed}>
            Mulai Ujian
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
