import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ujianRepo, sesiRepo, tokenRepo, hydrateRepos, claimExamToken, mataKuliahRepo, semesterRepo } from "@/lib/cbt/repos";
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
import { Clock, AlertTriangle, CalendarClock, CalendarX, ShieldOff, FileText, BookOpen } from "lucide-react";

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

  const mk = ujian.mataKuliahId ? mataKuliahRepo.byId(ujian.mataKuliahId) : null;
  const smt = ujian.semesterId ? semesterRepo.byId(ujian.semesterId) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header Info */}
      <div className="space-y-4">
        <Link to="/peserta" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-2">
          ← Kembali ke Daftar Ujian
        </Link>
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            {ujian.nama}
          </h1>
          {mk && (
            <div className="flex items-center gap-2 mt-3 text-lg font-medium text-primary/80 dark:text-primary/70">
              <BookOpen className="h-5 w-5" />
              <span>{mk.nama}</span>
              {smt && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span>{smt.nama}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Exam Stats Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{ujian.durasiMenit} Menit</span>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <FileText className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{ujian.topicSets.reduce((a, b) => a + b.jumlah, 0)} Soal</span>
          </div>
        </div>
        
        {/* Exam Instructions */}
        <div className="p-6 sm:p-8 space-y-8">
          <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base text-slate-600 dark:text-slate-300">
            <RichView html={ujian.deskripsi || "<p><em>Tidak ada instruksi khusus dari pengajar.</em></p>"} />
          </div>

          {!examAllowed && (
            <div
              role="alert"
              data-testid="exam-availability-blocked"
              className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3"
            >
              <BlockedIcon className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-800 dark:text-red-400">
                  {availability === "upcoming" ? "Ujian Belum Dimulai" : "Ujian Telah Berakhir"}
                </h4>
                <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">{blockedMessage}</p>
              </div>
            </div>
          )}

          {sesiSelesai && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-800 dark:text-emerald-400">Anda sudah menyelesaikan ujian ini</h4>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400/80">Tidak dapat mengulang ujian yang telah disubmit.</p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link to="/peserta/ujian/$id/hasil" params={{ id: ujian.id }}>
                  Lihat Nilai
                </Link>
              </Button>
            </div>
          )}

          {/* Exam Rules Block */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h3>Aturan & Tata Tertib Ujian</h3>
            </div>
            <ul className="ml-5 list-disc text-sm text-amber-700/80 dark:text-amber-400/80 space-y-2">
              {ujian.fullscreenWajib && (
                <li>Ujian wajib dikerjakan dalam mode <strong className="text-amber-900 dark:text-amber-300">Fullscreen</strong> (Layar Penuh). Menutup layar penuh mungkin akan dianggap sebagai kecurangan.</li>
              )}
              {ujian.maxPindahTab > 0 && (
                <li>Toleransi pindah tab/aplikasi maksimal <strong className="text-amber-900 dark:text-amber-300">{ujian.maxPindahTab} kali</strong>. Lebih dari itu, ujian akan dikumpulkan otomatis secara paksa.</li>
              )}
              {ujian.blokirShortcut && (
                <li>Fungsi <strong className="text-amber-900 dark:text-amber-300">Copy, Paste, dan Klik Kanan</strong> dinonaktifkan secara sistem.</li>
              )}
              <li>Waktu akan terus berjalan mundur dan tidak dapat dihentikan (*pause*) begitu Anda menekan tombol "Mulai".</li>
              <li>Pastikan koneksi internet Anda stabil. Jawaban akan disinkronkan secara otomatis.</li>
            </ul>
          </div>

          {/* Action Area */}
          <div className="bg-slate-50 dark:bg-slate-800/30 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
            {ujian.tokenAktif && (
              <div className="space-y-2 max-w-sm">
                <Label htmlFor={tokenInputId} className="text-base font-semibold text-slate-900 dark:text-white">Token Akses Ujian</Label>
                <div className="relative">
                  <Input 
                    id={tokenInputId} 
                    value={token} 
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Contoh: X7Y9Q"
                    className="h-12 text-center text-xl font-bold tracking-[0.3em] uppercase bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500">Minta token akses ujian kepada pengawas ruangan Anda.</p>
              </div>
            )}
            
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                <input 
                  type="checkbox" 
                  className="peer appearance-none w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 checked:bg-primary checked:border-primary transition-colors cursor-pointer" 
                  checked={agree} 
                  onChange={(e) => setAgree(e.target.checked)} 
                />
                <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-relaxed">
                Saya telah membaca aturan ujian di atas. Saya siap dan bersedia mengerjakan ujian ini dengan jujur dan tanpa bantuan dari pihak manapun.
              </span>
            </label>
            
            <Button 
              size="lg" 
              className="w-full h-14 text-base font-bold uppercase tracking-wide shadow-md hover:shadow-lg transition-all disabled:opacity-50" 
              onClick={mulai} 
              disabled={!!sesiSelesai || !examAllowed || !agree}
            >
              {sesiSelesai ? "Anda Telah Selesai" : "Mulai Ujian Sekarang"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
