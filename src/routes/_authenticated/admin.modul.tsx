import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { modulRepo, topikRepo, soalRepo, mataKuliahRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import { ModulSchema, TopikSchema, SoalSchema, type Modul } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronRight, Upload, FileText, Download, FileUp, Lock } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { visibleModuls, allowedTopikIdSet, isUnrestricted } from "@/lib/cbt/access";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/modul")({
  component: ModulRoute,
});

const BankSchema = z.object({
  app: z.literal("cbtman-bank"),
  version: z.literal(1),
  modul: ModulSchema,
  topik: z.array(TopikSchema),
  soal: z.array(SoalSchema),
});
type Bank = z.infer<typeof BankSchema>;

function ModulRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isIndexRoute = pathname === "/admin/modul" || pathname === "/admin/modul/";

  if (!isIndexRoute) {
    return <Outlet />;
  }

  return <ModulPage />;
}

function ModulPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = isUnrestricted(user);
  const [moduls, setModuls] = useState<Modul[]>(visibleModuls(user));
  const allowedSet = allowedTopikIdSet(user);
  const mkList = mataKuliahRepo.all();
  const [nama, setNama] = useState("");
  const [mkId, setMkId] = useState<string>("none");
  const [query, setQuery] = useState("");
  const [filterMk, setFilterMk] = useState("all");
  const importRef = useRef<HTMLInputElement>(null);

  const shown = moduls.filter(m => {
    if (filterMk !== "all" && m.mataKuliahId !== filterMk) return false;
    if (query && !m.nama.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  function add() {
    if (!canEdit) return;
    if (!nama.trim()) return;
    modulRepo.upsert({ id: uid("m_"), nama: nama.trim(), aktif: true, mataKuliahId: (mkId === "none" || !mkId) ? undefined : mkId });
    setNama("");
    setMkId("none");
    setModuls(visibleModuls(user));
    toast.success("Modul ditambahkan");
  }
  function remove(id: string) {
    if (!canEdit) return;
    const topiks = topikRepo.all().filter((t) => t.modulId === id);
    if (topiks.length) {
      toast.error("Hapus topik di dalam modul ini dulu");
      return;
    }
    if (!confirm("Hapus modul?")) return;
    modulRepo.remove(id);
    setModuls(visibleModuls(user));
  }

  function exportBank(modul: Modul) {
    let topik = topikRepo.all().filter((t) => t.modulId === modul.id);
    if (!canEdit && allowedSet) {
      topik = topik.filter((t) => allowedSet.has(t.id));
    }
    const tIds = new Set(topik.map((t) => t.id));
    const soal = soalRepo.all().filter((s) => tIds.has(s.topikId));
    const bank: Bank = { app: "cbtman-bank", version: 1, modul, topik, soal };
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modul.nama.replace(/\s+/g, "_")}.bank.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBank(file: File) {
    if (!canEdit) {
      toast.error("Import bank JSON hanya untuk admin / operator tanpa batasan topik");
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      const bank = BankSchema.parse(raw);
      // Re-id supaya tidak bentrok
      const newModul = { ...bank.modul, id: uid("m_"), nama: bank.modul.nama + " (import)" };
      const idMap: Record<string, string> = {};
      const newTopik = bank.topik.map((t) => {
        const nid = uid("t_");
        idMap[t.id] = nid;
        return { ...t, id: nid, modulId: newModul.id };
      });
      const newSoal = bank.soal.map((s) => ({
        ...s,
        id: uid("s_"),
        topikId: idMap[s.topikId] ?? s.topikId,
        jawaban: s.jawaban.map((j) => ({ ...j, id: uid("j_") })),
      }));
      modulRepo.upsert(newModul);
      newTopik.forEach((t) => topikRepo.upsert(t));
      newSoal.forEach((s) => soalRepo.upsert(s));
      setModuls(visibleModuls(user));
      toast.success(
        `Bank diimport: ${newModul.nama} — ${newTopik.length} topik, ${newSoal.length} soal`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Gagal: format file tidak valid");
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Bank Soal (Modul)"
        description="Pusat penyimpanan referensi soal-soal ujian berdasarkan mata kuliah."
        action={
          canEdit && (
            <>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importBank(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} className="h-9">
                <FileUp className="mr-2 h-4 w-4" /> Import JSON
              </Button>
              <Button size="sm" variant="outline" className="h-9" asChild>
                <Link to="/admin/modul/import"><Upload className="mr-2 h-4 w-4" /> Excel</Link>
              </Button>
            </>
          )
        }
      />

      {/* Toolbar & Add New */}
      <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
          <Input 
            placeholder="Cari modul..." 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            className="max-w-xs" 
          />
          <Select value={filterMk} onValueChange={setFilterMk}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Semua Mata Kuliah" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Mata Kuliah</SelectItem>
              {mkList.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {canEdit && (
          <form
            onSubmit={(e) => { e.preventDefault(); add(); }}
            className="flex gap-2 w-full sm:w-auto shrink-0"
          >
            <Select value={mkId} onValueChange={setMkId}>
              <SelectTrigger className="w-32 sm:w-40">
                <SelectValue placeholder="Mata Kuliah (Opsional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Tidak Ada --</SelectItem>
                {mkList.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Modul Baru"
              className="w-full sm:w-48"
            />
            <Button type="submit" size="icon" disabled={!nama.trim()} className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>

      <AdminPageContent className="bg-transparent border-0 p-0 shadow-none">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((m) => {
            const tAll = topikRepo.all().filter((t) => t.modulId === m.id);
            const t = allowedSet ? tAll.filter((x) => allowedSet.has(x.id)) : tAll;
            const tIds = new Set(t.map((x) => x.id));
            const sCount = soalRepo.all().filter((s) => tIds.has(s.topikId)).length;
            const mkName = m.mataKuliahId ? mkList.find((x) => x.id === m.mataKuliahId)?.nama : null;

            return (
              <div key={m.id} className="group relative flex flex-col justify-between p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-primary/40 dark:hover:border-primary/40 shadow-sm hover:shadow-sleek transition-all duration-300 ease-spring gap-4 overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/10 text-primary group-hover:bg-primary/15 dark:group-hover:bg-primary/20 transition-colors duration-300 ease-spring">
                    <FileText className="h-6 w-6 -translate-y-[0.5px]" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                    <Link to="/admin/modul/$id/topik" params={{ id: m.id }} className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-primary dark:hover:text-primary transition-colors duration-300 ease-spring line-clamp-2 after:absolute after:inset-0">

                      {m.nama}
                    </Link>
                    {mkName && (
                      <div className="relative z-10">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold tracking-widest uppercase text-slate-500">

                          {mkName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-slate-400 -translate-y-[0.5px]"/> {t.length} Topik</span>
                    <span className="flex items-center gap-1.5"><ChevronRight className="w-4 h-4 text-slate-400 -translate-y-[0.5px]"/> {sCount} Soal</span>
                  </div>

                  <div className="flex items-center gap-1 relative z-10">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-300" onClick={() => exportBank(m)} title="Export JSON">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors duration-300" onClick={() => remove(m.id)} title="Hapus">

                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[20px]">

              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <FileText className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium">Belum ada modul bank soal.</p>
              </div>
            </div>
          )}
        </div>
      </AdminPageContent>
    </AdminPage>
  );
}
