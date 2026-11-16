import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { ujianRepo, sesiRepo, mataKuliahRepo, penawaranRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { uid } from "@/lib/cbt/storage";
import type { Ujian } from "@/lib/cbt/types";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { visibleUjians } from "@/lib/cbt/access";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const navigate = useNavigate();
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
      status: "draft",
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
      allowCalculator: false,
      allowNilaiNormal: false,
      createdBy: user.id,
      createdAt: Date.now(),
    };
    ujianRepo.upsert(u);
    const result = await ujianRepo.flush();
    setIsAdding(false);
    if (!result.ok) {
      toast.error(result.error || "Gagal membuat ujian");
      return;
    }
    toast.success("Ujian baru dibuat");
    navigate({ to: "/admin/ujian/$id", params: { id: u.id } });
  }

  const now = Date.now();
  
  const filteredList = list.filter(u => 
    u.nama.toLowerCase().includes(search.toLowerCase())
  );

  const persiapan = filteredList.filter(
    (u) => u.status === "draft" || !u.beginAt || !u.endAt || u.beginAt > now,
  );
  const berlangsung = filteredList.filter(
    (u) => u.status === "published" && u.beginAt && u.endAt && u.beginAt <= now && u.endAt >= now,
  );
  const selesai = filteredList.filter(
    (u) => u.status === "published" && u.endAt && u.endAt < now,
  );

  const renderRow = (u: Ujian, type: "persiapan" | "berlangsung" | "selesai") => {
    const sesiCount = sesiRepo.all().filter((s) => s.ujianId === u.id).length;
    const soalCount = u.topicSets.reduce((a, b) => a + b.jumlah, 0);
    const mk = u.mataKuliahId ? mataKuliahRepo.byId(u.mataKuliahId) : null;
    const kelas = u.penawaranId ? penawaranRepo.byId(u.penawaranId) : undefined;

    return (
      <div
        key={u.id}
        className="group flex flex-col gap-3 border-b bg-card p-3 transition-colors last:border-b-0 hover:bg-accent sm:flex-row sm:items-center sm:justify-between sm:p-4"
      >
        <Link
          to="/admin/ujian/$id"
          params={{ id: u.id }}
          className="flex items-center gap-4 flex-1 min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <div className="flex flex-col min-w-0">
            <span className="truncate text-ui font-medium text-foreground">
              {u.nama}
            </span>
            <div className="flex items-center gap-2 mt-1">
              {mk && <span className="text-label font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[150px]">{mk.nama}</span>}
              {kelas && <span className="text-label font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Kelas {kelas.kodeKelas || "-"} · {kelas.pesertaIds.length} peserta</span>}
              <span className={u.status === "published" ? "text-label text-primary" : "text-label text-warn"}>{u.status === "published" ? "Published" : "Draft"}</span>
              <span className="text-label text-muted-foreground">{soalCount} Soal • {u.durasiMenit} Menit</span>
              {sesiCount > 0 && <span className="text-label font-medium text-foreground">• {sesiCount} Peserta</span>}
            </div>
          </div>
        </Link>

        <div
          className="flex flex-wrap items-center gap-2 shrink-0 sm:ml-4"
          onClick={(e) => e.stopPropagation()}
        >
          {type === "berlangsung" && (
            <Button asChild size="sm">
              <Link to="/admin/peserta/online" search={{ ujianId: u.id }}>
                Pantau
              </Link>
            </Button>
          )}
          {type === "selesai" && (
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/analitik/$id" params={{ id: u.id }}>
                Analitik
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/ujian/$id/peserta" params={{ id: u.id }}>
              Peserta{sesiCount > 0 ? ` (${sesiCount})` : ""}
            </Link>
          </Button>
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
    <AdminPage className="">
      
      <AdminPageHeader
        title="Manajemen Paket Ujian"
        description="Kelola pembuatan ujian, soal, dan akses peserta."
        action={
          <Button onClick={add} disabled={isAdding}>
            <Plus className="h-4 w-4" /> Paket baru
          </Button>
        }
      />

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-1.5 border border-border rounded-lg">
        <div className="flex w-full md:w-auto overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-ui font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id 
                  ? "bg-muted text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {tab.label}
              <span className={cn(
                "px-1.5 py-0.5 text-label rounded",
                activeTab === tab.id ? "bg-card text-foreground" : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-64 px-1.5 md:px-0 pb-1.5 md:pb-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari ujian"
            aria-label="Cari ujian"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Data List (Compact Table/Row Style) */}
      <div className="overflow-hidden bg-card border border-border/80 rounded-lg">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <h3 className="text-ui font-medium text-foreground">Tidak ada paket ujian</h3>
            <p className="mt-1 text-ui text-muted-foreground">Tidak ada paket ujian yang cocok di kategori ini.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {currentList.map(u => {
              const status = u.status === "draft" || !u.beginAt || !u.endAt || u.beginAt > now
                ? "persiapan"
                : u.beginAt <= now && u.endAt >= now
                  ? "berlangsung"
                  : "selesai";
              return renderRow(u, status);
            })}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
