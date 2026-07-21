import { create } from "zustand";
import { hydrateRepos, invalidateReposCache } from "./repos";
import { loginServer, logoutServer, validateSessionServer } from "@/lib/server/auth/functions";
import type { Role, User } from "./types";

type AuthState = {
  userId: string | null;
  user: User | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; role?: Role }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  userId: null,
  user: null,
  setUser: (user) => set({ user, userId: user?.id ?? null }),
  login: async (username, password) => {
    const res = await loginServer({ data: { username, password } });
    if (!res.ok) return res;

    invalidateReposCache();
    await hydrateRepos();
    set({ userId: res.user.id, user: res.user });
    return { ok: true, role: res.user.role };
  },
  logout: async () => {
    try {
      await logoutServer();
    } catch (err) {
      console.error("logoutServer gagal; sesi mungkin masih aktif", err);
    }
    invalidateReposCache();
    set({ userId: null, user: null });
  },
  refresh: async () => {
    try {
      const { user } = await validateSessionServer();
      get().setUser(user);
    } catch {
      get().setUser(null);
    }
  },
}));
