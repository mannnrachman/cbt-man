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
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/lib/cbt/theme-store";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const { theme } = useThemeStore();
  const [list, setList] = useState<Ujian[]>(visibleUjians(user));
  const [activeTab, setActiveTab] = useState<"semua" | "persiapan" | "berlangsung" | "selesai">("semua");
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  async function add() {
    if (isAdding) return;
    setIsAdding(true);
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
    await ujianRepo.flush();
    setList((current) => [...current, u]);
    toast.success("Ujian baru dibuat — silakan edit");
    setIsAdding(false);
  }

  const now = Date.now();
  
  const filteredList = list.filter(u => 
    u.nama.toLowerCase().includes(search.toLowerCase())
  );

  const persiapan = filteredList.filter((u) => !u.beginAt || !u.endAt || u.beginAt > now);
  const berlangsung = filteredList.filter((u) => u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now);
  const selesai = filteredList.filter((u) => u.endAt && u.endAt < now);

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

  const renderNeoRow = (u: Ujian, type: "persiapan" | "berlangsung" | "selesai") => {
    const sesiCount = sesiRepo.all().filter((s) => s.ujianId === u.id).length;
    const soalCount = u.topicSets.reduce((a, b) => a + b.jumlah, 0);
    const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;

    return (
      <div key={u.id} className="group flex items-center justify-between p-3 sm:p-4 transition-colors bg-[color:var(--neo-hover)] hover:bg-white border-b-[3px] border-black last:border-b-0">
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

  if (theme === "neobrutalism") {
    return (
      <AdminPage className="">
        <AdminPageHeader
          title="Manajemen Paket Ujian"
          description="Kelola pembuatan ujian, soal, dan akses peserta."
          action={
            <Button onClick={add} size="sm" className="shadow-sm h-9">
              <Plus className="mr-2 h-4 w-4" /> Paket Baru
            </Button>
          }
        />

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
                <span className="px-1.5 py-0.5 text-[10px] rounded-none border-[2px] border-black font-black text-black bg-[color:var(--neo-bg)]">
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
              className="w-full pl-9 pr-4 py-1.5 text-sm transition-colors focus:outline-none bg-white text-black border-[3px] border-black rounded-none shadow-[2px_2px_0_0_#000] font-bold focus:shadow-[4px_4px_0_0_#000] focus:translate-x-[-2px] focus:translate-y-[-2px]"
            />
          </div>
        </div>

        <div className="overflow-hidden bg-[color:var(--neo-bg)] border-[3px] border-black shadow-[4px_4px_0_0_#000] rounded-none">
          {currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <FileText className="h-10 w-10 mb-3 text-black" />
              <h3 className="text-sm font-black uppercase tracking-wider text-black">Data Kosong</h3>
              <p className="text-sm mt-1 font-bold text-black">Tidak ada paket ujian yang ditemukan di kategori ini.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {currentList.map(u => {
                const status = (!u.beginAt || !u.endAt || u.beginAt > now) ? "persiapan" : 
                               (u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now) ? "berlangsung" : "selesai";
                return renderNeoRow(u, status);
              })}
            </div>
          )}
        </div>
      </AdminPage>
    );
  }

  // CLEAN LAYOUT
  return (
    <AdminPage>
      <AdminPageHeader
        title="Manajemen Paket Ujian"
        description="Kelola pembuatan ujian, soal, dan akses peserta secara komprehensif."
        action={
<<<<<<< HEAD
          <Button onClick={add} size="sm" className="shadow-sm">
=======
          <Button onClick={add} disabled={isAdding} size="sm" className="shadow-sm h-9">
>>>>>>> main
            <Plus className="mr-2 h-4 w-4" /> Paket Baru
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50 border border-border">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                {tab.label}
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[10px] bg-muted-foreground/15 hover:bg-muted-foreground/20 text-foreground border-transparent shadow-none">{tab.count}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari ujian..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card shadow-sm"
          />
        </div>
      </div>

      <Card className="shadow-sm border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[35%]">Nama Ujian</TableHead>
              <TableHead className="w-[30%]">Detail</TableHead>
              <TableHead className="w-[15%]">Status</TableHead>
              <TableHead className="w-[20%] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm font-medium text-foreground">Tidak ada paket ujian</p>
                    <p className="text-xs">Ujian belum dibuat atau tidak sesuai kriteria pencarian.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentList.map(u => {
                const status = (!u.beginAt || !u.endAt || u.beginAt > now) ? "persiapan" : 
                               (u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now) ? "berlangsung" : "selesai";
                const sesiCount = sesiRepo.all().filter((s) => s.ujianId === u.id).length;
                const soalCount = u.topicSets.reduce((a, b) => a + b.jumlah, 0);
                const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;

                return (
                  <TableRow key={u.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium align-top">
                      <Link to={status === "persiapan" ? "/admin/ujian/$id" : "/admin/ujian/$id/peserta"} params={{ id: u.id }} className="text-sm font-semibold hover:text-primary transition-colors text-foreground">
                        {u.nama}
                      </Link>
                      {mk && (
                        <div className="mt-1.5">
                          <Badge variant="outline" className="text-[10px] shadow-none bg-background text-muted-foreground font-normal">{mk.nama}</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs align-top">
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5"/> {soalCount} Soal</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> {u.durasiMenit} Menit</span>
                        {sesiCount > 0 && <span className="flex items-center gap-1.5 font-medium text-foreground"><Users className="h-3.5 w-3.5"/> {sesiCount} Peserta</span>}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="mt-0.5">
                        {status === "persiapan" && <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent shadow-none"><Clock className="mr-1.5 h-3 w-3"/> Persiapan</Badge>}
                        {status === "berlangsung" && (
                          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 border-transparent shadow-none text-white">
                            <span className="relative flex h-2 w-2 mr-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-100 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            Berlangsung
                          </Badge>
                        )}
                        {status === "selesai" && <Badge variant="outline" className="text-muted-foreground shadow-none bg-transparent"><CheckCircle2 className="mr-1.5 h-3 w-3"/> Selesai</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        {status === "persiapan" && (
                          <>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-medium" asChild>
                              <Link to="/admin/ujian/$id/peserta" params={{ id: u.id }}><Users className="mr-1.5 h-3.5 w-3.5"/> Peserta</Link>
                            </Button>
                            <Button size="sm" className="h-8 text-xs font-medium" asChild>
                              <Link to="/admin/ujian/$id" params={{ id: u.id }}><Settings2 className="mr-1.5 h-3.5 w-3.5"/> Edit</Link>
                            </Button>
                          </>
                        )}
                        {status === "berlangsung" && (
                          <>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-medium" asChild>
                              <Link to="/admin/ujian/$id/token" params={{ id: u.id }}><KeyRound className="mr-1.5 h-3.5 w-3.5"/> Token</Link>
                            </Button>
                            <Button size="sm" className="h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                              <Link to="/admin/peserta/online" search={{ ujianId: u.id }}><PlayCircle className="mr-1.5 h-3.5 w-3.5"/> Pantau</Link>
                            </Button>
                          </>
                        )}
                        {status === "selesai" && (
                          <>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-medium" asChild>
                              <Link to="/admin/evaluasi"><FileSignature className="mr-1.5 h-3.5 w-3.5"/> Evaluasi</Link>
                            </Button>
                            <Button size="sm" className="h-8 text-xs font-medium" asChild>
                              <Link to="/admin/analitik/$id" params={{ id: u.id }}><BarChart3 className="mr-1.5 h-3.5 w-3.5"/> Analitik</Link>
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </AdminPage>
  );
}
