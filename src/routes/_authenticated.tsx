import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { validateSessionServer } from "@/lib/server/auth/functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Validasi otoritatif via cookie httpOnly + row Session (BUKAN state client).
    // Tutup window deaktivasi: aktif=false / sesi expired / cookie tamper → redirect /login.
    const { user } = await validateSessionServer();
    useAuthStore.getState().setUser(user);
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    return { user };
  },
  component: () => <Outlet />,
});
