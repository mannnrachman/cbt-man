import { create } from "zustand";
import { hydrateRepos, invalidateReposCache } from "./repos";
import { loginServer, logoutServer, validateSessionServer } from "@/lib/server/auth/functions";
import { AUTH_INITIAL_PHASE, authPhaseOfUser, type AuthPhase } from "./state-machines";
import type { Role, User } from "./types";

type AuthState = {
  phase: AuthPhase;
  userId: string | null;
  user: User | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string; role?: Role }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  phase: AUTH_INITIAL_PHASE,
  userId: null,
  user: null,
  setUser: (user) => set({ user, userId: user?.id ?? null, phase: authPhaseOfUser(user) }),
  login: async (username, password) => {
    const res = await loginServer({ data: { username, password } });
    if (!res.ok) return res;

    invalidateReposCache();
    await hydrateRepos();
    set({ phase: "authenticated", userId: res.user.id, user: res.user });
    return { ok: true, role: res.user.role };
  },
  logout: async () => {
    try {
      await logoutServer();
    } catch (err) {
      console.error("logoutServer gagal; sesi mungkin masih aktif", err);
    }
    invalidateReposCache();
    set({ phase: "anonymous", userId: null, user: null });
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
