import React, { useState, useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { configRepo, hydrateRepos } from "@/lib/cbt/repos";
import { type AppConfig, type NavKey, type Role } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useThemeStore } from "@/lib/cbt/theme-store";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Wrench,
  FolderOpen,
  PenLine,
  Activity,
  Landmark,
  Sun,
  Moon,
  Menu,
  X,
  BookOpenCheck,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_ROUTE_RULES = {
  root: { key: "dashboard", adminOnly: false, paths: ["/admin"] },
  users: { key: "users", adminOnly: true, paths: ["/admin/users"] },
  akademik: { key: "akademik", adminOnly: true, paths: ["/admin/akademik"] },
  peserta: { key: "peserta", adminOnly: false, paths: ["/admin/peserta"] },
  modul: { key: "modul", adminOnly: false, paths: ["/admin/modul", "/admin/topik"] },
  files: { key: "files", adminOnly: false, paths: ["/admin/files"] },
  ujian: { key: "ujian", adminOnly: false, paths: ["/admin/ujian"] },
  hasil: { key: "hasil", adminOnly: false, paths: ["/admin/hasil"] },
  evaluasi: { key: "evaluasi", adminOnly: false, paths: ["/admin/evaluasi"] },
  laporan: { key: "laporan", adminOnly: false, paths: ["/admin/laporan"] },
  leaderboard: { key: "leaderboard", adminOnly: false, paths: ["/admin/leaderboard"] },
  pengaturan: { key: "pengaturan", adminOnly: true, paths: ["/admin/pengaturan"] },
  tools: { key: "tools", adminOnly: true, paths: ["/admin/tools"] },
  panduan: { key: "panduan", adminOnly: false, paths: ["/admin/panduan"] },
} satisfies Record<string, { key: NavKey; adminOnly: boolean; paths: string[] }>;

type AdminRouteRule = (typeof ADMIN_ROUTE_RULES)[keyof typeof ADMIN_ROUTE_RULES];
type RouteUser = { role: Role };

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ]
  },
  {
    label: "Akademik & Pengguna",
    items: [
      { to: "/admin/akademik", label: "Struktur Akademik", icon: Landmark },
      { to: "/admin/users", label: "Pengelola Sistem", icon: Users },
      { to: "/admin/peserta", label: "Mahasiswa / Peserta", icon: GraduationCap, exact: true },
    ]
  },
  {
    label: "Bank Soal & Berkas",
    items: [
      { to: "/admin/modul", label: "Bank Soal", icon: BookOpen },
      { to: "/admin/files", label: "File Manager", icon: FolderOpen },
    ]
  },
  {
    label: "Ujian & Pelaksanaan",
    items: [
      { to: "/admin/ujian", label: "Paket Ujian", icon: FileText },
      { to: "/admin/peserta/online", label: "Pantau Ujian Live", icon: Activity },
    ]
  },
  {
    label: "Pasca Ujian",
    items: [
      { to: "/admin/evaluasi", label: "Evaluasi Essay", icon: PenLine },
      { to: "/admin/analitik", label: "Analitik & Laporan", icon: BarChart3 },
    ]
  },
  {
    label: "Sistem & Bantuan",
    items: [
      { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
      { to: "/admin/tools", label: "Backup & Tools", icon: Wrench },
      { to: "/admin/panduan", label: "Panduan", icon: BookOpenCheck },
    ]
  }
];

const navItems: NavItem[] = navGroups.flatMap(g => g.items);

function normalizedAdminPath(pathname: string) {
  if (pathname === "/admin") return pathname;
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function resolveAdminRouteRule(pathname: string): AdminRouteRule | null {
  const normalized = normalizedAdminPath(pathname);
  const rules = Object.values(ADMIN_ROUTE_RULES).flatMap((rule) =>
    rule.paths.map((path) => ({ path, rule })),
  );
  const match = rules
    .filter(({ path }) => normalized === path || normalized.startsWith(`${path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.rule ?? null;
}

function operatorAccessKeys(cfg: AppConfig, role: Role) {
  return new Set((cfg.roleAccess[role] ?? []) as NavKey[]);
}

export function canAccessAdminPath(user: RouteUser, pathname: string, cfg: AppConfig) {
  if (user.role === "super_admin") return true;
  if (user.role === "mahasiswa") return false;
  const rule = resolveAdminRouteRule(pathname);
  if (!rule) return false;
  if (rule.adminOnly) return false;
  return operatorAccessKeys(cfg, user.role).has(rule.key);
}

function firstAllowedAdminPath(user: RouteUser, cfg: AppConfig) {
  if (user.role === "super_admin") return "/admin";
  const firstVisible = navItems.find((item) => canAccessAdminPath(user, item.to, cfg));
  return firstVisible?.to ?? "/login";
}

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context, location }) => {
    const user = (context as { user: RouteUser }).user;
    if (user.role === "mahasiswa") throw redirect({ to: "/peserta" });

    try {
      await hydrateRepos();
    } catch {
      // gunakan cache terakhir/default agar guard tetap deterministik
    }

    const cfg = configRepo.get();
    if (!canAccessAdminPath(user, location.pathname, cfg)) {
      throw redirect({ to: firstAllowedAdminPath(user, cfg) });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cfg = configRepo.get();
  const appName = cfg.appName;

  const [theme, setTheme] = useState("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      if (stored === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      if (prefersDark) document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isPanduanPage = pathname === "/admin/panduan";
  const globalTheme = useThemeStore((s) => s.theme);

  return (
    <div className={cn("min-h-screen bg-background text-foreground", globalTheme === "neobrutalism" && "neo-ready")}>
      <div className="flex">
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar (Hidden on Panduan full-screen docs mode) */}
        {!isPanduanPage && (
          <aside className={cn(
            "w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block transition-transform duration-200 z-50 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto scrollbar-thin",
            mobileMenuOpen ? "fixed inset-y-0 left-0 h-screen overflow-y-auto shadow-xl" : "hidden"
          )}>
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
              <div className="flex items-center gap-3">
                {cfg.appLogo ? (
                  <img src={cfg.appLogo} alt="Logo" className="h-7 w-auto object-contain" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-base shadow-sm">
                    Z
                  </span>
                )}
                <span className="font-bold text-sidebar-foreground text-base tracking-tight truncate">{appName}</span>
              </div>
              {mobileMenuOpen && (
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>
            <nav className="flex flex-col gap-6 p-4">
              {navGroups.map((group) => {
                const visibleItems = group.items.filter((item) =>
                  canAccessAdminPath(user, item.to, cfg)
                );

                if (visibleItems.length === 0) return null;

                return (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <h3 className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {group.label}
                    </h3>
                    <div className="flex flex-col gap-1">
                      {visibleItems.map((n) => {
                        const Icon = n.icon;
                        return (
                          <Link
                            key={n.to}
                            to={n.to as never}
                            activeOptions={{ exact: n.exact }}
                            activeProps={{
                              className: "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
                            }}
                            inactiveProps={{
                              className: "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            }}
                            className="flex items-center gap-3 px-3 py-2 text-xs md:text-sm rounded-lg transition-colors duration-150"
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="leading-snug">{n.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          </aside>
        )}

        <div className="flex min-h-screen flex-1 flex-col min-w-0">

          <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 lg:px-6 sticky top-0 z-30">
            <div className="flex items-center gap-4">
              {isPanduanPage ? (
                <Button 
                  asChild 
                  variant="outline" 
                  size="sm" 
                  className="font-medium border-border text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Link to="/admin">
                    <ChevronLeft className="h-4 w-4" />
                    Kembali ke Dashboard
                  </Link>
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 text-foreground/60 hover:text-foreground hover:bg-accent -ml-2" onClick={() => setMobileMenuOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="text-sm hidden sm:flex items-center gap-3">
                <span className="font-semibold text-foreground text-sm">{user.namaLengkap}</span>
                <Badge variant="outline" className="font-medium text-[11px] uppercase border-border bg-background text-foreground/70">
                  {user.role}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                onClick={toggleTheme}
                title="Ganti tema"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs font-medium border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-colors"
                onClick={async () => {
                  await logout();
                  navigate({ to: "/login" });
                }}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
