import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { modulRepo, topikRepo, soalRepo, mataKuliahRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import { ModulSchema, TopikSchema, SoalSchema, type Modul } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronRight, Upload, FileText, Download, FileUp, Search } from "lucide-react";
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
    toast.success("Modul dihapus");
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
            <div className="flex items-center gap-2">
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
                <Link to="/admin/modul/import"><Upload className="mr-2 h-4 w-4" /> Import Excel</Link>
              </Button>
            </div>
          )
        }
      />

      {/* Toolbar & Add New */}
      <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari modul..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              className="pl-9 h-9" 
            />
          </div>
          <Select value={filterMk} onValueChange={setFilterMk}>
            <SelectTrigger className="w-full sm:w-56 h-9">
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
              <SelectTrigger className="w-36 sm:w-44 h-9">
                <SelectValue placeholder="Mata Kuliah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Tanpa MK --</SelectItem>
                {mkList.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama Modul Baru"
              className="w-full sm:w-48 h-9"
            />
            <Button type="submit" size="sm" disabled={!nama.trim()} className="shrink-0 h-9">
              <Plus className="h-4 w-4 mr-1" /> Tambah
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
              <Card key={m.id} className="group relative flex flex-col justify-between p-5 border-border hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <Link 
                      to="/admin/modul/$id/topik" 
                      params={{ id: m.id }} 
                      className="text-base font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 after:absolute after:inset-0"
                    >
                      {m.nama}
                    </Link>
                    {mkName && (
                      <div className="relative z-10 pt-0.5">
                        <Badge variant="outline" className="text-[10px] font-medium bg-muted/50 text-muted-foreground border-border">
                          {mkName}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5"/> {t.length} Topik</span>
                    <span className="flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5"/> {sCount} Soal</span>
                  </div>

                  <div className="flex items-center gap-1 relative z-10">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground" 
                      onClick={() => exportBank(m)} 
                      aria-label={`Export JSON ${m.nama}`}
                      title="Export JSON"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                        onClick={() => remove(m.id)} 
                        aria-label={`Hapus modul ${m.nama}`}
                        title="Hapus Modul"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          {shown.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-border rounded-xl bg-card">
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">Belum ada modul bank soal ditemukan.</p>
              </div>
            </div>
          )}
        </div>
      </AdminPageContent>
    </AdminPage>
  );
}
