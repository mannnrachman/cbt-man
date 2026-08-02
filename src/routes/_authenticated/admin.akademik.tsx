import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Network, Calendar, Clock, BookOpen, ChevronRight, AlertTriangle } from "lucide-react";
import { AdminPageHeader } from "@/components/cbt/AdminPage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useThemeStore } from "@/lib/cbt/theme-store";

export const Route = createFileRoute("/_authenticated/admin/akademik")({
  component: AkademikLayout,
});

const TREE_MENU = [
  {
    section: "Struktur Institusi",
    items: [
      { label: "Fakultas, Prodi & Kelas", to: "/admin/akademik", icon: Network, indent: 0 },
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
  const { theme } = useThemeStore();

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="space-y-4">
        <AdminPageHeader 
          title="Data Akademik" 
          description="Kelola data induk institusi. Konfigurasi di sini akan menjadi fondasi bagi pengelolaan mahasiswa, dosen, dan mata kuliah."
        />

        {/* Informasi Penekanan (Alert) */}
        <Alert
          variant="destructive"
          className={cn(
            "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30",
            theme === "neobrutalism" &&
              "rounded-none border-[3px] border-black bg-[color:var(--neo-accent)] text-black shadow-[4px_4px_0_0_#000]",
          )}
        >
          <AlertTriangle
            className={cn(
              "h-4 w-4 text-amber-600 dark:text-amber-400",
              theme === "neobrutalism" && "text-black dark:text-black stroke-[3]",
            )}
          />
          <AlertTitle
            className={cn(
              "font-semibold text-amber-800 dark:text-amber-300",
              theme === "neobrutalism" && "font-black uppercase tracking-wide text-black dark:text-black",
            )}
          >
            Perhatian: Modifikasi Struktur Induk
          </AlertTitle>
          <AlertDescription
            className={cn(
              "text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed mt-1",
              theme === "neobrutalism" && "font-bold text-black dark:text-black",
            )}
          >
            Penghapusan atau perubahan mendasar pada <strong>Fakultas atau Jurusan</strong> dapat menyebabkan data mahasiswa dan modul bank soal yang terkait menjadi tidak sinkron (<em>orphaned</em>). Pastikan Anda hanya mengubah data ini jika benar-benar diperlukan.
          </AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          {TREE_MENU.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <h4
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2",
                  theme === "neobrutalism" &&
                    "mb-2 inline-block border-b-[3px] border-black px-0 pb-1 font-black text-black dark:text-black",
                )}
              >
                {group.section}
              </h4>
              <nav className="flex flex-col space-y-1">
                {group.items.map((item) => {
                  const active = item.to === "/admin/akademik"
                    ? (pathname === "/admin/akademik" || pathname === "/admin/akademik/")
                    : pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        theme === "neobrutalism"
                          ? cn(
                              "rounded-none border-[3px] font-bold",
                              active
                                ? "-translate-x-0.5 -translate-y-0.5 border-black bg-[color:var(--neo-bg)] text-black shadow-[4px_4px_0_0_#000]"
                                : "border-transparent text-black hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-black hover:bg-white hover:shadow-[4px_4px_0_0_#000]",
                            )
                          : active
                            ? "bg-accent text-accent-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                      style={{
                        marginLeft: theme === "neobrutalism" ? 0 : `${item.indent * 12}px`,
                        paddingLeft: theme === "neobrutalism" ? `${item.indent * 12 + 12}px` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            theme === "neobrutalism"
                              ? "text-black dark:text-black"
                              : active
                                ? "text-foreground"
                                : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        {item.label}
                      </div>
                      {active && <ChevronRight className="h-4 w-4 opacity-50" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 w-full min-h-[500px]">
          <div className="py-1">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}
