import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Building2, GraduationCap, Library, Network, Calendar, Clock, BookOpen, ChevronRight } from "lucide-react";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/akademik")({
  component: AkademikLayout,
});

const TREE_MENU = [
  {
    section: "Struktur Institusi",
    items: [
      { label: "Fakultas", to: "/admin/akademik/fakultas", icon: Building2, indent: 0 },
      { label: "Jurusan", to: "/admin/akademik/jurusan", icon: Network, indent: 1 },
      { label: "Program Studi", to: "/admin/akademik/prodi", icon: GraduationCap, indent: 2 },
    ]
  },
  {
    section: "Waktu Perkuliahan",
    items: [
      { label: "Tahun Akademik", to: "/admin/akademik/tahun-akademik", icon: Calendar, indent: 0 },
      { label: "Semester", to: "/admin/akademik/semester", icon: Clock, indent: 1 },
    ]
  },
  {
    section: "Kurikulum",
    items: [
      { label: "Mata Kuliah", to: "/admin/akademik/mata-kuliah", icon: BookOpen, indent: 0 },
    ]
  }
];

function AkademikLayout() {
  const { pathname } = useLocation();

  return (
    <AdminPage className="max-w-6xl">
      <AdminPageHeader
        title="Data Akademik"
        description="Kelola data induk institusi. Data ini disusun dalam bentuk hierarki pohon (Tree Structure)."
      />

      {/* Info Alert */}
      <div className="mb-8 p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <Network className="w-5 h-5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div>
          <strong className="font-semibold block text-blue-900 dark:text-blue-200">Struktur Hierarki (Tree)</strong>
          <p className="mt-1">
            Data akademik saling terikat secara vertikal ke bawah. Anda harus membuat tingkat tertinggi (Fakultas) terlebih dahulu sebelum dapat membuat turunannya (Jurusan & Program Studi).
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Tree Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-6">
          {TREE_MENU.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2">
                {group.section}
              </h4>
              <nav className="flex flex-col relative">
                {/* Continuous vertical line for the tree branch */}
                {group.section === "Struktur Institusi" && (
                  <div className="absolute left-6 top-6 bottom-6 w-px bg-slate-200 dark:bg-slate-700/60 z-0" />
                )}
                
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group relative z-10 flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
                        active
                          ? "bg-primary/10 text-primary dark:text-primary"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                      )}
                      style={{ marginLeft: `${item.indent * 16}px` }}
                    >
                      <div className="flex items-center gap-3">
                        {item.indent > 0 && (
                          <div className="absolute left-[-10px] w-3 border-t-2 border-slate-200 dark:border-slate-700 rounded-bl-sm" />
                        )}
                        <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
                        {item.label}
                      </div>
                      {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-[500px] p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </AdminPage>
  );
}
