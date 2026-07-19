import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { ujianRepo } from "@/lib/cbt/repos";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: CommandCenter,
});

function CommandCenter() {
  const user = useAuthStore((s) => s.user)!;
  const now = Date.now();

  const semuaUjian = ujianRepo.all();
  
  // Real Workflow Logic
  const activeExams = semuaUjian.filter((u) => u.beginAt && u.endAt && now >= u.beginAt && now <= u.endAt);
  const finishedExams = semuaUjian.filter((u) => u.endAt && now > u.endAt);
  
  return (
    <div className="mx-auto max-w-3xl space-y-16 animate-in fade-in duration-700 pb-20 pt-8 px-4 sm:px-0">
      
      {/* 1. Typography-led Header */}
      <header className="space-y-2">
        <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
          Selamat datang, {user.namaLengkap}
        </h1>
      </header>

      {/* 2. Now: Active Exams */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Sedang Berlangsung
        </h2>
        
        {activeExams.length === 0 ? (
          <div className="py-8 border-b border-slate-100 dark:border-slate-800/50">
            <p className="text-slate-500 dark:text-slate-400">Tidak ada ujian yang sedang berjalan saat ini.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {activeExams.map((exam) => (
              <div key={exam.id} className="group flex items-center justify-between py-6 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-start gap-4">
                  <div className="relative flex h-2.5 w-2.5 mt-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-100 leading-tight">
                      {exam.nama}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Berakhir pada {new Date(exam.endAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <Link 
                  to="/admin/peserta/online" 
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500"
                >
                  Pantau Live <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Next: Pending Evaluation */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Perlu Tindakan
        </h2>
        
        {finishedExams.length === 0 ? (
          <div className="py-8 flex items-center gap-3 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/50">
            <CheckCircle2 className="h-5 w-5 opacity-50" />
            <p>Semua ujian telah dievaluasi.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <Link 
              to="/admin/evaluasi" 
              className="group flex items-center justify-between py-6 border-b border-slate-100 dark:border-slate-800/50 hover:pl-2 transition-all duration-300"
            >
              <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors leading-tight">
                  Evaluasi & Laporan Ujian
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Ada <span className="font-medium text-slate-700 dark:text-slate-300">{finishedExams.length} ujian</span> yang sudah selesai dan memerlukan pemeriksaan.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors" />
            </Link>
          </div>
        )}
      </section>

      {/* 4. Minimalist Action Footer */}
      <section className="pt-4">
        <Link 
          to="/admin/ujian"
          className="inline-flex items-center text-sm font-medium text-slate-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors underline underline-offset-4 decoration-slate-200 dark:decoration-slate-800 hover:decoration-blue-600 dark:hover:decoration-blue-400"
        >
          Jadwalkan Ujian Baru
        </Link>
      </section>

    </div>
  );
}
