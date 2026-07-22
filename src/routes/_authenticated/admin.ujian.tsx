import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { ujianRepo, sesiRepo, mataKuliahRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { uid } from "@/lib/cbt/storage";
import type { Ujian } from "@/lib/cbt/types";
import { Plus, Users, BarChart3, KeyRound, PlayCircle, Clock, CheckCircle2, Settings2, FileSignature, FileText, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { visibleUjians } from "@/lib/cbt/access";
import { Button } from "@/components/ui/button";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/ujian")({
  component: UjianRoute,
});

function UjianRoute() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isIndexRoute = pathname === "/admin/ujian" || pathname === "/admin/ujian/";
  if (!isIndexRoute) return <Outlet />;
  return <UjianList />;
}

function UjianList() {
  const user = useAuthStore((s) => s.user)!;
  const [list, setList] = useState<Ujian[]>(visibleUjians(user));
  const [activeTab, setActiveTab] = useState<"semua" | "persiapan" | "berlangsung" | "selesai">("semua");
  const [search, setSearch] = useState("");

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

  const now = Date.now();
  
  const filteredList = list.filter(u => 
    u.nama.toLowerCase().includes(search.toLowerCase())
  );

  const persiapan = filteredList.filter((u) => !u.beginAt || !u.endAt || u.beginAt > now);
  const berlangsung = filteredList.filter((u) => u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now);
  const selesai = filteredList.filter((u) => u.endAt && u.endAt < now);

  const renderRow = (u: Ujian, type: "persiapan" | "berlangsung" | "selesai") => {
    const sesiCount = sesiRepo.all().filter((s) => s.ujianId === u.id).length;
    const soalCount = u.topicSets.reduce((a, b) => a + b.jumlah, 0);
    const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;

    return (
      <div key={u.id} className="group flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {type === "persiapan" && <Clock className="h-5 w-5 text-slate-400" />}
            {type === "berlangsung" && (
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                <PlayCircle className="h-5 w-5 text-emerald-500 relative" />
              </span>
            )}
            {type === "selesai" && <CheckCircle2 className="h-5 w-5 text-slate-400" />}
          </div>
          
          <div className="flex flex-col min-w-0">
            <Link to={type === "persiapan" ? "/admin/ujian/$id" : "/admin/ujian/$id/peserta"} params={{ id: u.id }} className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate hover:text-slate-600 dark:hover:text-slate-300">
              {u.nama}
            </Link>
            <div className="flex items-center gap-2 mt-1">
              {mk && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">{mk.nama}</span>}
              <span className="text-[11px] text-slate-500">{soalCount} Soal • {u.durasiMenit} Menit</span>
              {sesiCount > 0 && <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">• {sesiCount} Peserta</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {type === "persiapan" && (
            <>
              <Link to="/admin/ujian/$id/peserta" params={{ id: u.id }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">
                <Users className="h-3.5 w-3.5"/> Peserta
              </Link>
              <Link to="/admin/ujian/$id" params={{ id: u.id }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-medium hover:bg-slate-800 transition-colors">
                <Settings2 className="h-3.5 w-3.5"/> Edit
              </Link>
            </>
          )}
          {type === "berlangsung" && (
            <>
              <Link to="/admin/ujian/$id/token" params={{ id: u.id }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">
                <KeyRound className="h-3.5 w-3.5"/> Token
              </Link>
              <Link to="/admin/peserta/online" search={{ ujianId: u.id }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 dark:bg-emerald-500 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors">
                <PlayCircle className="h-3.5 w-3.5"/> Pantau
              </Link>
            </>
          )}
          {type === "selesai" && (
            <>
              <Link to="/admin/evaluasi" className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">
                <FileSignature className="h-3.5 w-3.5"/> Evaluasi
              </Link>
              <Link to="/admin/analitik/$id" params={{ id: u.id }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md text-xs font-medium hover:bg-slate-800 transition-colors">
                <BarChart3 className="h-3.5 w-3.5"/> Analitik
              </Link>
            </>
          )}
        </div>
      </div>
    );
  };

  const tabs = [
    { id: "semua", label: "Semua Paket", count: filteredList.length },
    { id: "persiapan", label: "Persiapan", count: persiapan.length },
    { id: "berlangsung", label: "Berlangsung", count: berlangsung.length },
    { id: "selesai", label: "Selesai", count: selesai.length },
  ] as const;

  const currentList = 
    activeTab === "persiapan" ? persiapan :
    activeTab === "berlangsung" ? berlangsung :
    activeTab === "selesai" ? selesai : filteredList;

  return (
    <AdminPage>
      
      <AdminPageHeader
        title="Manajemen Paket Ujian"
        description="Kelola pembuatan ujian, soal, dan akses peserta."
        action={
          <Button onClick={add} size="sm" className="shadow-sm h-9">
            <Plus className="mr-2 h-4 w-4" /> Paket Baru
          </Button>
        }
      />

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-950 p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        <div className="flex w-full md:w-auto overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === tab.id ? "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-64 px-1.5 md:px-0 pb-1.5 md:pb-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari ujian..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-colors"
          />
        </div>
      </div>

      {/* Data List (Compact Table/Row Style) */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Data Kosong</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tidak ada paket ujian yang ditemukan di kategori ini.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {currentList.map(u => {
              const status = (!u.beginAt || !u.endAt || u.beginAt > now) ? "persiapan" : 
                             (u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now) ? "berlangsung" : "selesai";
              return renderRow(u, status);
            })}
          </div>
        )}
      </div>

    </AdminPage>
  );
}
