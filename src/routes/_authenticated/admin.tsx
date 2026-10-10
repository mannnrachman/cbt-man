import React, { useState, useEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { configRepo, hydrateRepos } from "@/lib/cbt/repos";
import { useThemeStore } from "@/lib/cbt/theme-store";
import { type AppConfig, type NavKey, type Role } from "@/lib/cbt/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Trophy,
  Wrench,
  FolderOpen,
  PenLine,
  Activity,
  Landmark,
  Sun,
  Moon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpenCheck,
  ChevronDown,
  ScrollText,
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
  audit: { key: "audit", adminOnly: true, paths: ["/admin/audit"] },
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
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const dashboardNavItem: NavItem = {
  to: "/admin",
  label: "Dashboard",
  icon: LayoutDashboard,
  exact: true,
};

const navGroups: NavGroup[] = [
  {
    id: "akademik-pengguna",
    label: "Akademik & Pengguna",
    icon: Landmark,
    items: [
      { to: "/admin/akademik", label: "Struktur Akademik", icon: Landmark },
      { to: "/admin/akademik/kelas-mata-kuliah", label: "Kelas Mata Kuliah", icon: GraduationCap },
      { to: "/admin/users", label: "Pengelola Sistem", icon: Users },
      { to: "/admin/peserta", label: "Mahasiswa / Peserta", icon: GraduationCap },
    ],
  },
  {
    id: "bank-soal-berkas",
    label: "Bank Soal & Berkas",
    icon: BookOpen,
    items: [
      { to: "/admin/modul", label: "Bank Soal", icon: BookOpen },
      { to: "/admin/files", label: "File Manager", icon: FolderOpen },
    ],
  },
  {
    id: "ujian-pelaksanaan",
    label: "Ujian & Pelaksanaan",
    icon: FileText,
    items: [
      { to: "/admin/ujian", label: "Paket Ujian", icon: FileText },
      { to: "/admin/peserta/online", label: "Pantau Ujian Live", icon: Activity },
    ],
  },
  {
    id: "hasil-pelaporan",
    label: "Hasil & Pelaporan",
    icon: BarChart3,
    items: [
      { to: "/admin/evaluasi", label: "Evaluasi Essay", icon: PenLine },
      { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    id: "sistem-bantuan",
    label: "Sistem & Bantuan",
    icon: Settings,
    items: [
      { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
      { to: "/admin/tools", label: "Backup & Tools", icon: Wrench },
      { to: "/admin/audit", label: "Audit Trail", icon: ScrollText },
      { to: "/admin/panduan", label: "Panduan", icon: BookOpenCheck },
    ],
  },
];

const navItems: NavItem[] = [dashboardNavItem, ...navGroups.flatMap((group) => group.items)];

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

function isNavItemActive(item: NavItem, pathname: string) {
  const normalized = normalizedAdminPath(pathname);
  if (item.exact) return normalized === item.to;

  let matches = normalized === item.to || normalized.startsWith(`${item.to}/`);
  if (!matches) {
    const routeRule = resolveAdminRouteRule(pathname);
    const itemRule = resolveAdminRouteRule(item.to);
    matches = !!(
      routeRule &&
      itemRule &&
      routeRule.key === itemRule.key &&
      item.to === routeRule.paths[0]
    );
  }

  if (!matches) return false;

  const hasMoreSpecificItem = navItems.some(
    (other) =>
      other.to !== item.to &&
      other.to.length > item.to.length &&
      (normalized === other.to || normalized.startsWith(`${other.to}/`)),
  );

  return !hasMoreSpecificItem;
}

function activeGroupId(pathname: string, groups: NavGroup[]) {
  return groups.find((group) => group.items.some((item) => isNavItemActive(item, pathname)))?.id;
}

function SidebarLink({ item, isActive, sidebarCollapsed }: { item: NavItem; isActive: boolean; sidebarCollapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to as never}
      activeOptions={{ exact: true, includeSearch: false }}
      aria-current={isActive ? "page" : undefined}
      title={sidebarCollapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors duration-150 md:text-sm",
        sidebarCollapsed && "lg:justify-center lg:px-0",
        isActive
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn("leading-snug", sidebarCollapsed && "lg:sr-only")}>{item.label}</span>
    </Link>
  );
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
  const { user } = Route.useRouteContext();
  const logout = useAuthStore((s) => s.logout);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cfg = configRepo.get();
  const appName = cfg.appName;
  const setAppTheme = useThemeStore((s) => s.setTheme);

  const [theme, setTheme] = useState("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const visibleNavGroups = React.useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canAccessAdminPath(user, item.to, cfg)),
        }))
        .filter((group) => group.items.length > 0),
    [user, cfg],
  );
  const activeGroup = visibleNavGroups.find((group) =>
    group.items.some((item) => isNavItemActive(item, pathname)),
  );
  const activeNavItem = activeGroup?.items.find((item) => isNavItemActive(item, pathname))
    ?? (isNavItemActive(dashboardNavItem, pathname) ? dashboardNavItem : undefined);
  const userInitials = user.namaLengkap
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";
  const [openGroupId, setOpenGroupId] = useState<string | undefined>(() =>
    activeGroupId(pathname, visibleNavGroups),
  );

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
    if (next === "dark") setAppTheme("default");
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  useEffect(() => {
    setOpenGroupId(activeGroupId(pathname, visibleNavGroups));
    setMobileMenuOpen(false);
  }, [pathname, visibleNavGroups]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex">
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
            "w-64 shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            sidebarCollapsed ? "lg:w-16" : "lg:w-64",
            mobileMenuOpen ? "fixed inset-y-0 left-0 z-50 h-screen overflow-y-auto shadow-xl" : "hidden",
          )} id="admin-sidebar">
            <div className={cn(
              "flex h-16 items-center border-b border-slate-200 dark:border-slate-800",
              sidebarCollapsed ? "justify-between px-2 lg:flex-col lg:justify-center lg:gap-1" : "justify-between px-5",
            )}>
              <div className={cn("flex min-w-0 items-center gap-3", sidebarCollapsed && "lg:justify-center")} title={sidebarCollapsed ? appName : undefined}>
                {cfg.appLogo ? (
                  <img src={cfg.appLogo} alt="Logo" className={cn("h-7 w-auto object-contain", sidebarCollapsed && "lg:h-7 lg:w-7")} />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-base shadow-sm">
                    Z
                  </span>
                )}
                <span className={cn("truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100", sidebarCollapsed && "lg:hidden")}>{appName}</span>
              </div>
              <div className="flex items-center gap-1">
                {mobileMenuOpen && (
                  <Button variant="ghost" size="icon" title="Tutup menu navigasi" aria-label="Tutup menu navigasi" className="lg:hidden h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title={sidebarCollapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
                  aria-label={sidebarCollapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
                  aria-controls="admin-sidebar"
                  aria-pressed={sidebarCollapsed}
                  className="hidden h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:inline-flex dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                  onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <nav aria-label="Navigasi administrasi" className="flex flex-col gap-5 p-3">
              {canAccessAdminPath(user, dashboardNavItem.to, cfg) && (
                <SidebarLink
                  item={dashboardNavItem}
                  isActive={isNavItemActive(dashboardNavItem, pathname)}
                  sidebarCollapsed={sidebarCollapsed}
                />
              )}

              {visibleNavGroups.map((group) => {
                const isOpen = openGroupId === group.id;
                const GroupIcon = group.icon;
                const panelId = `admin-nav-${group.id}`;

                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      title={sidebarCollapsed ? group.label : undefined}
                      onClick={() => setOpenGroupId(isOpen ? undefined : group.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider transition-colors duration-150",
                        sidebarCollapsed && "lg:justify-center lg:px-0",
                        group.items.some((item) => isNavItemActive(item, pathname))
                          ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <GroupIcon className="h-4 w-4 shrink-0" />
                        <span className={cn("truncate", sidebarCollapsed && "lg:sr-only")}>{group.label}</span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-150",
                          sidebarCollapsed && "lg:hidden",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div id={panelId} className={cn("ml-4 mt-1 flex flex-col gap-1 border-l border-slate-200 pl-2 dark:border-slate-800", sidebarCollapsed && "lg:ml-0 lg:border-l-0 lg:pl-0")}>
                        {group.items.map((item) => (
                          <SidebarLink
                            key={item.to}
                            item={item}
                            isActive={isNavItemActive(item, pathname)}
                            sidebarCollapsed={sidebarCollapsed}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </aside>

        <div className="flex min-h-screen flex-1 flex-col min-w-0">

          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm lg:px-6 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                title="Buka menu navigasi"
                aria-label="Buka menu navigasi"
                className="lg:hidden h-9 w-9 rounded-lg bg-[#e6f5f3] hover:bg-[#d4efec]"
                onClick={() => setMobileMenuOpen(true)}
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[#0f766e]"><Menu className="h-4 w-4 text-white" /></span>
              </Button>
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-sm">
                {activeGroup && (
                  <>
                    <span className="hidden max-w-48 truncate text-xs font-medium text-slate-500 sm:inline">{activeGroup.label}</span>
                    <ChevronRight aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 sm:block" />
                  </>
                )}
                <span aria-current="page" className="truncate text-sm font-semibold text-slate-900">
                  {activeNavItem?.label ?? "Administrasi"}
                </span>
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div role="group" aria-label={`Akun ${user.namaLengkap}`} className="hidden max-w-[260px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm sm:flex">
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0f766e] text-xs font-bold text-white">
                  {userInitials}
                </span>
                <span className="max-w-36 truncate text-sm font-semibold text-slate-900">{user.namaLengkap}</span>
                <Badge variant="outline" className="shrink-0 border-[#0f9b8e]/30 bg-[#0f9b8e]/10 px-2 text-[10px] font-semibold uppercase text-[#0b5f58]">
                  {user.role}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg bg-slate-100 hover:bg-slate-200"
                onClick={toggleTheme}
                title="Ganti tema"
                aria-label="Ganti tema"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[#0f766e]">
                  {theme === "dark" ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-white" />}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-slate-200 bg-white text-xs font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
                title="Keluar"
                aria-label="Keluar"
                onClick={async () => {
                  await logout();
                  window.location.assign("/login-admin");
                }}
              >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#0f766e]"><LogOut className="h-3.5 w-3.5 text-white" /></span>
                <span className="hidden sm:inline">Keluar</span>
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
