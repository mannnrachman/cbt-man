import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/akademik/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/akademik/fakultas" });
  },
});
