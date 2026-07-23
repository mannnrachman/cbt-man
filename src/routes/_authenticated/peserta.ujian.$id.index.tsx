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
    <div className="relative min-h-[calc(100vh-4rem)] bg-slate-50/50 dark:bg-slate-950">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent dark:from-blue-500/10 dark:via-indigo-500/5 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 dark:bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute top-40 -left-40 w-72 h-72 bg-indigo-500/20 dark:bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header Info */}
        <div className="space-y-6">
          <Link to="/peserta" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
            <span className="group-hover:-translate-x-1 transition-transform mr-1">←</span> Kembali ke Daftar Ujian
          </Link>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-800/60 p-6 sm:p-8 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
                  {ujian.nama}
                </h1>
                {mk && (
                  <div className="flex items-center gap-2 mt-4 text-sm sm:text-base font-medium text-blue-600 dark:text-blue-400">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <span>{mk.nama}</span>
                    {smt && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700 mx-1">•</span>
                        <span>{smt.nama}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-row sm:flex-col gap-3 shrink-0">
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 px-4 py-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Durasi</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{ujian.durasiMenit} Menit</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 px-4 py-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                  <div className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Soal</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{ujian.topicSets.reduce((a, b) => a + b.jumlah, 0)} Butir</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Instructions & Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-black/20 p-6 sm:p-8 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-100 to-transparent dark:from-slate-800 rounded-bl-full opacity-50 pointer-events-none" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                Informasi & Instruksi
              </h2>
              <div className="prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base text-slate-600 dark:text-slate-300">
                <RichView html={ujian.deskripsi || "<p><em>Tidak ada instruksi khusus dari pengajar.</em></p>"} />
              </div>
            </div>

            {/* Exam Rules Block */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 backdrop-blur-md p-6 sm:p-8 shadow-inner">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <AlertTriangle className="w-32 h-32 text-amber-500" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-3 font-bold text-amber-900 dark:text-amber-500 mb-4">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg">Aturan & Tata Tertib</h3>
                </div>
                <ul className="grid grid-cols-1 gap-3 text-sm text-amber-800 dark:text-amber-300/80">
                  {ujian.fullscreenWajib && (
                    <li className="flex items-start gap-3 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Ujian wajib dikerjakan dalam mode <strong>Fullscreen</strong> (Layar Penuh).</span>
                    </li>
                  )}
                  {ujian.maxPindahTab > 0 && (
                    <li className="flex items-start gap-3 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Toleransi pindah tab maksimal <strong>{ujian.maxPindahTab} kali</strong>. Lebih dari itu ujian dikumpulkan otomatis.</span>
                    </li>
                  )}
                  {ujian.blokirShortcut && (
                    <li className="flex items-start gap-3 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Fungsi <strong>Copy, Paste, dan Klik Kanan</strong> dinonaktifkan secara sistem.</span>
                    </li>
                  )}
                  <li className="flex items-start gap-3 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                    <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Waktu berjalan mundur dan tidak dapat dihentikan setelah "Mulai".</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sidebar Action Area */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl shadow-blue-500/5 space-y-8">
              
              {!examAllowed && (
                <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-5 flex flex-col items-center text-center gap-3">
                  <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full">
                    <BlockedIcon className="h-6 w-6 text-red-600 dark:text-red-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-400">
                      {availability === "upcoming" ? "Belum Dimulai" : "Telah Berakhir"}
                    </h4>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">{blockedMessage}</p>
                  </div>
                </div>
              )}

              {sesiSelesai && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-5 flex flex-col items-center text-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                    <ShieldOff className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-800 dark:text-emerald-400">Ujian Telah Selesai</h4>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Anda sudah mensubmit ujian ini.</p>
                  </div>
                  <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20">
                    <Link to="/peserta/ujian/$id/hasil" params={{ id: ujian.id }}>
                      Lihat Hasil Ujian
                    </Link>
                  </Button>
                </div>
              )}

              {examAllowed && !sesiSelesai && (
                <div className="space-y-6">
                  {ujian.tokenAktif && (
                    <div className="space-y-3">
                      <Label htmlFor={tokenInputId} className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Token Akses Ujian
                      </Label>
                      <Input 
                        id={tokenInputId} 
                        value={token} 
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Contoh: X7Y9Q"
                        className="h-14 text-center text-xl font-black tracking-[0.2em] uppercase bg-slate-50 dark:bg-slate-950/50 border-slate-300 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                      />
                      <p className="text-[11px] text-center text-slate-500 font-medium uppercase tracking-wider">Minta token ke pengawas ruangan</p>
                    </div>
                  )}
                  
                  <label className="flex items-start gap-3 cursor-pointer group p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50 transition-colors">
                    <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                      <input 
                        type="checkbox" 
                        className="peer appearance-none w-5 h-5 border-2 border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer" 
                        checked={agree} 
                        onChange={(e) => setAgree(e.target.checked)} 
                      />
                      <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity scale-50 peer-checked:scale-100 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors leading-relaxed">
                      Saya siap dan bersedia mengerjakan ujian ini secara jujur.
                    </span>
                  </label>
                  
                  <Button 
                    size="lg" 
                    className="w-full h-14 rounded-xl text-sm font-bold tracking-wide shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5 transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-0" 
                    onClick={mulai} 
                    disabled={!examAllowed || !agree}
                  >
                    MULAI UJIAN
                  </Button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
