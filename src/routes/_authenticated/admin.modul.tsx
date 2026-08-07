import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { unitAkademikRepo, topikRepo, soalRepo } from "@/lib/cbt/repos";
import type { UnitAkademik } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, FileText, Download, Search, Building2 } from "lucide-react";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { allowedTopikIdSet, isUnrestricted } from "@/lib/cbt/access";
import { AdminPage, AdminPageHeader, AdminPageContent } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/modul")({
  component: ModulRoute,
});

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
  // Jurusan = UnitAkademik
  const [units] = useState<UnitAkademik[]>(unitAkademikRepo.all());
  const allowedSet = allowedTopikIdSet(user);
  const [query, setQuery] = useState("");

  const shown = units.filter(u => {
    const isQueryMatch = !query || u.nama.toLowerCase().includes(query.toLowerCase());
    if (!isQueryMatch) return false;
    
    // Check if operator has access to any topik in this unit (or if unrestricted)
    if (canEdit) return true;
    const unitTopiks = topikRepo.all().filter((t) => t.unitId === u.id);
    if (allowedSet) {
      return unitTopiks.some(t => allowedSet.has(t.id));
    }
    return true;
  });

  function exportBank(unit: UnitAkademik) {
    let topik = topikRepo.all().filter((t) => t.unitId === unit.id);
    if (!canEdit && allowedSet) {
      topik = topik.filter((t) => allowedSet.has(t.id));
    }
    const tIds = new Set(topik.map((t) => t.id));
    const soal = soalRepo.all().filter((s) => tIds.has(s.topikId));
    // Provide a simple export structure for now
    const bank = { app: "cbtman-bank", version: 1, unit, topik, soal };
    const blob = new Blob([JSON.stringify(bank, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${unit.nama.replace(/\s+/g, "_")}.bank.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Bank Soal (Per Jurusan)"
        description="Kelola topik dan soal berdasarkan Program Studi / Jurusan"
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari jurusan..."
            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>
      </div>

      <AdminPageContent className="bg-transparent border-0 p-0 shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((u) => {
            const tAll = topikRepo.all().filter((t) => t.unitId === u.id);
            const t = allowedSet ? tAll.filter((x) => allowedSet.has(x.id)) : tAll;
            const tIds = new Set(t.map((x) => x.id));
            const sCount = soalRepo.all().filter((s) => tIds.has(s.topikId)).length;

            return (
              <div key={u.id} className="group relative flex flex-col justify-between p-5 rounded-[20px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-primary/40 dark:hover:border-primary/40 shadow-sm hover:shadow-sleek transition-all duration-300 ease-spring gap-4 overflow-hidden">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/10 text-primary group-hover:bg-primary/15 dark:group-hover:bg-primary/20 transition-colors duration-300 ease-spring">
                    <Building2 className="h-6 w-6 -translate-y-[0.5px]" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                    <Link to="/admin/modul/$id/topik" params={{ id: u.id }} className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-primary dark:hover:text-primary transition-colors duration-300 ease-spring line-clamp-2 after:absolute after:inset-0">
                      {u.nama}
                    </Link>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-slate-400 -translate-y-[0.5px]"/> {t.length} Topik</span>
                    <span className="flex items-center gap-1.5"><ChevronRight className="w-4 h-4 text-slate-400 -translate-y-[0.5px]"/> {sCount} Soal</span>
                  </div>

                  <div className="flex items-center gap-1 relative z-10">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-300" onClick={() => exportBank(u)} title="Export JSON">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[20px]">
              <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                <Building2 className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium">Belum ada data jurusan/program studi.</p>
              </div>
            </div>
          )}
        </div>
      </AdminPageContent>
    </AdminPage>
  );
}
