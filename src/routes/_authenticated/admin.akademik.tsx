import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Network, Calendar, Clock, BookOpen, ChevronRight, AlertTriangle, X } from "lucide-react";
import { AdminPageHeader } from "@/components/cbt/AdminPage";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
  const [showAlert, setShowAlert] = useState(true);

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="space-y-4">
        <AdminPageHeader 
          title="Data Akademik" 
          description="Kelola data induk institusi. Konfigurasi di sini akan menjadi fondasi bagi pengelolaan mahasiswa, dosen, dan mata kuliah."
        />

        {/* Informasi Penekanan (Alert) dengan Tombol Tutup */}
        {showAlert && (
          <Alert variant="destructive" className="relative bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30 pr-10">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="font-semibold text-amber-800 dark:text-amber-300">Perhatian: Modifikasi Struktur Induk</AlertTitle>
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-400/90 leading-relaxed mt-1">
              Penghapusan atau perubahan mendasar pada <strong>Fakultas atau Jurusan</strong> dapat menyebabkan data mahasiswa dan modul bank soal yang terkait menjadi tidak sinkron (<em>orphaned</em>). Pastikan Anda hanya mengubah data ini jika benar-benar diperlukan.
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
              onClick={() => setShowAlert(false)}
              title="Tutup perhatian"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Alert>
        )}
      </div>

      {/* Main Container with Compact Sub-Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Compact Sub-Sidebar Navigation */}
        <aside className="w-full lg:w-56 shrink-0 bg-card/60 backdrop-blur-sm p-3 rounded-xl border space-y-5">
          {TREE_MENU.map((group, idx) => (
            <div key={idx} className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2.5">
                {group.section}
              </h4>
              <nav className="flex flex-col space-y-0.5">
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
                        "group flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all",
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )} />
                        {item.label}
                      </div>
                      {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        {/* Content Outlet */}
        <main className="flex-1 w-full min-h-[500px]">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
