import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeType = "default" | "neobrutalism";

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "default",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          if (theme !== 'default') {
            document.documentElement.setAttribute('data-theme', theme);
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
      },
      toggleTheme: () =>
        set((state) => {
          // toggleTheme is mostly deprecated now that there are 4 themes
          const newTheme = state.theme === "default" ? "neobrutalism" : "default";
          if (typeof document !== 'undefined') {
            if (newTheme !== 'default') {
              document.documentElement.setAttribute('data-theme', newTheme);
            } else {
              document.documentElement.removeAttribute('data-theme');
            }
          }
          return { theme: newTheme };
        }),
    }),
    {
      name: "cbt-theme-storage",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== 'undefined') {
          if (state.theme !== 'default') {
            document.documentElement.setAttribute('data-theme', state.theme);
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
      },
    }
  )
);
