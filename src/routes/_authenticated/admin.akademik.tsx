import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Building2, GraduationCap, Library, Network, Calendar, Clock, BookOpen, ChevronRight, Info } from "lucide-react";

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
    <div className="relative min-h-screen pb-24">
      {/* Studio-Tier Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-zinc-950 dark:to-zinc-950 -z-10" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Data Akademik
          </h1>
          <p className="text-base text-slate-500 dark:text-zinc-400 font-medium max-w-2xl leading-relaxed">
            Kelola data induk institusi. Konfigurasi di sini akan menjadi fondasi bagi pengelolaan mahasiswa, dosen, dan mata kuliah.
          </p>
        </div>

        {/* Info Alert - Studio Tier */}
        <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 p-5 flex gap-4 items-start shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900 dark:text-indigo-200">Struktur Hierarki</h3>
            <p className="mt-1 text-sm text-indigo-700/80 dark:text-indigo-300/80 font-medium leading-relaxed">
              Data akademik saling terikat secara vertikal. Anda harus membuat tingkat tertinggi (Fakultas) terlebih dahulu sebelum dapat menambahkan turunannya (Jurusan & Program Studi).
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-72 shrink-0 space-y-8">
            {TREE_MENU.map((group, idx) => (
              <div key={idx} className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 px-1">
                  {group.section}
                </h4>
                <nav className="flex flex-col space-y-1">
                  {group.items.map((item) => {
                    const active = pathname.startsWith(item.to);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "group flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200",
                          active
                            ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md shadow-slate-900/10"
                            : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-zinc-100"
                        )}
                        style={{ marginLeft: `${item.indent * 12}px` }}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn(
                            "w-4 h-4 shrink-0 transition-colors", 
                            active ? "text-white/80 dark:text-zinc-900/80" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300"
                          )} />
                          {item.label}
                        </div>
                        {active && <ChevronRight className="w-4 h-4 opacity-70" />}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </aside>

          {/* Content Outlet */}
          <main className="flex-1 w-full bg-white/80 dark:bg-zinc-900/40 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm min-h-[600px] overflow-hidden">
            <div className="p-6 md:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
