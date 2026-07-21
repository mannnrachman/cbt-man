import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { ujianRepo, sesiRepo, mataKuliahRepo, semesterRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { uid } from "@/lib/cbt/storage";
import type { Ujian } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Plus, Users, BarChart3, KeyRound, PlayCircle, Clock, CheckCircle2, Settings2, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { visibleUjians } from "@/lib/cbt/access";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/ujian")({
	component: UjianRoute,
});

/**
 * Parent route for `/admin/ujian/*`. When the path is the index
 * (`/admin/ujian`) we render the list view; when the path descends
 * into a child (e.g. `/admin/ujian/$id`, `/admin/ujian/$id/token`)
 * we delegate to the child's component via `<Outlet />`.
 *
 * This is the same pattern used in `admin.modul.tsx` and is required
 * for the child routes to render at all. Without it, `UjianList`
 * would always be shown for any descendant URL because the parent
 * route's component is treated as a layout by TanStack Router.
 */
function UjianRoute() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isIndexRoute =
		pathname === "/admin/ujian" || pathname === "/admin/ujian/";
	if (!isIndexRoute) {
		return <Outlet />;
	}
	return <UjianList />;
}

function UjianList() {
	const user = useAuthStore((s) => s.user)!;
	const [list, setList] = useState<Ujian[]>(visibleUjians(user));

	function add() {
		const u: Ujian = {
			id: uid("ex_"),
			nama: "Ujian Baru",
			deskripsi: "",
			durasiMenit: 30,
			poinBenar: 1,
			poinSalah: 0,
			poinKosong: 0,
			tokenAktif: false,
			ipRange: "",
			groupIds: [],
			topicSets: [],
			showResult: true,
			showResultDetail: false,
			fullscreenWajib: true,
			maxPindahTab: 3,
			blokirShortcut: true,
			mode: "online",
			createdBy: user.id,
			createdAt: Date.now(),
		};
		ujianRepo.upsert(u);
		setList(visibleUjians(user));
		toast.success("Ujian baru dibuat — silakan edit");
	}
  function remove(id: string) {
    if (!confirm("Hapus ujian beserta riwayat sesi mahasiswa?")) return;
    ujianRepo.remove(id);
    sesiRepo
      .all()
      .filter((s) => s.ujianId === id)
      .forEach((s) => sesiRepo.remove(s.id));
    setList(visibleUjians(user));
  }

  const now = Date.now();

  const persiapan = list.filter((u) => !u.beginAt || !u.endAt || u.beginAt > now);
  const berlangsung = list.filter((u) => u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now);
  const selesai = list.filter((u) => u.endAt && u.endAt < now);

  const renderCard = (u: Ujian, type: "persiapan" | "berlangsung" | "selesai") => {
    const sesiCount = sesiRepo.all().filter((s) => s.ujianId === u.id).length;
    const soalCount = u.topicSets.reduce((a, b) => a + b.jumlah, 0);
    const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;

    return (
      <div key={u.id} className="group flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-sm relative">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{u.nama}</h3>
            {mk && <p className="text-xs text-slate-500 mt-0.5">{mk.nama}</p>}
          </div>
        </div>

        <div className="text-xs text-slate-500 mb-4 flex flex-wrap gap-x-3 gap-y-1 mt-1">
          <span>{soalCount} Soal</span>
          <span>•</span>
          <span>{u.durasiMenit} Menit</span>
          {sesiCount > 0 && (
            <>
              <span>•</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{sesiCount} Sesi</span>
            </>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          {type === "persiapan" && (
            <>
              <Button size="sm" variant="secondary" className="h-8 flex-1" asChild>
                <Link to="/admin/ujian/$id" params={{ id: u.id }}><Settings2 className="mr-1.5 h-3.5 w-3.5"/> Atur Ujian</Link>
              </Button>
              <Button size="sm" variant="outline" className="h-8" asChild title="Kelola Peserta">
                <Link to="/admin/ujian/$id/peserta" params={{ id: u.id }}><Users className="h-3.5 w-3.5"/></Link>
              </Button>
            </>
          )}
          {type === "berlangsung" && (
            <>
              <Button size="sm" className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                <Link to="/admin/ujian/$id/token" params={{ id: u.id }}><KeyRound className="mr-1.5 h-3.5 w-3.5"/> Token</Link>
              </Button>
              <Button size="sm" variant="outline" className="h-8" asChild title="Pantau Peserta">
                <Link to="/admin/peserta/online" search={{ ujianId: u.id }}><PlayCircle className="h-3.5 w-3.5"/></Link>
              </Button>
            </>
          )}
          {type === "selesai" && (
            <>
              <Button size="sm" variant="outline" className="h-8 flex-1" asChild>
                <Link to="/admin/analitik/$id" params={{ id: u.id }}><BarChart3 className="mr-1.5 h-3.5 w-3.5"/> Analitik</Link>
              </Button>
              <Button size="sm" variant="outline" className="h-8" asChild title="Evaluasi Essay">
                <Link to="/admin/evaluasi"><FileSignature className="h-3.5 w-3.5"/></Link>
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminPage className="max-w-6xl">
      <AdminPageHeader
        title="Pipeline Ujian"
        description="Alur kerja paket ujian berdasarkan status pelaksanaannya."
        action={
          <Button onClick={add} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Draft Ujian Baru
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mt-2">
        {/* Kolom 1: Persiapan */}
        <div className="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Persiapan
            </h2>
            <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{persiapan.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {persiapan.map((u) => renderCard(u, "persiapan"))}
            {persiapan.length === 0 && <div className="text-sm text-center text-slate-400 py-8 border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">Kosong</div>}
          </div>
        </div>

        {/* Kolom 2: Berlangsung */}
        <div className="flex flex-col gap-4 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Berlangsung
            </h2>
            <span className="text-xs font-semibold bg-emerald-200/50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">{berlangsung.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {berlangsung.map((u) => renderCard(u, "berlangsung"))}
            {berlangsung.length === 0 && <div className="text-sm text-center text-emerald-400/60 py-8 border-2 border-dashed rounded-xl border-emerald-200 dark:border-emerald-900/50">Tidak ada ujian aktif</div>}
          </div>
        </div>

        {/* Kolom 3: Selesai */}
        <div className="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 min-h-[500px]">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Selesai
            </h2>
            <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{selesai.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {selesai.map((u) => renderCard(u, "selesai"))}
            {selesai.length === 0 && <div className="text-sm text-center text-slate-400 py-8 border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800">Kosong</div>}
          </div>
        </div>
      </div>
    </AdminPage>
  );
}
