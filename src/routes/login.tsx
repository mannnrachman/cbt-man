import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateSessionServer } from "@/lib/server/auth/functions";

type SearchParams = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { user } = await validateSessionServer();
    if (user) {
      throw redirect({ to: user.role === "mahasiswa" ? "/peserta" : "/admin" });
    }
    throw redirect({
      to: "/",
      search: {
        login: true,
        redirect: search.redirect,
      },
    });
  },
  component: () => null,
});
