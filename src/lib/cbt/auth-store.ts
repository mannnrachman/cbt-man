import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { hydrateRepos, usersRepo } from "./repos";
import { loginServer } from "@/lib/server/repos/functions";
import type { Role, User } from "./types";

type AuthState = {
  userId: string | null;
  user: User | null;
  hydrated: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; role?: Role }>;
  logout: () => void;
  refresh: () => Promise<void>;
  setHydrated: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      user: null,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      login: async (username, password) => {
        await hydrateRepos();
        const res = await loginServer({ data: { username, password } });
        if (!res.ok) return res;
        set({ userId: res.user.id, user: res.user });
        return { ok: true, role: res.user.role };
      },
      logout: () => set({ userId: null, user: null }),
      refresh: async () => {
        const id = get().userId;
        await hydrateRepos();
        if (!id) return;
        const u = usersRepo.byId(id) ?? null;
        set({ user: u, userId: u?.id ?? null });
      },
    }),
    {
      name: "cbtman:auth",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as never))),
      partialize: (s) => ({ userId: s.userId }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
        void state?.refresh();
      },
    },
  ),
);
