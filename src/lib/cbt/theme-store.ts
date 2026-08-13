import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeType = "default" | "neobrutalism";
export type FontType = "sn-pro" | "system";

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
  font: FontType;
  setFont: (font: FontType) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "default",
      font: "sn-pro",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          if (theme !== "default") {
            document.documentElement.setAttribute("data-theme", theme);
          } else {
            document.documentElement.removeAttribute("data-theme");
          }
        }
      },
      setFont: (font) => {
        set({ font });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-font", font);
        }
      },
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === "default" ? "neobrutalism" : "default";
          if (typeof document !== "undefined") {
            if (newTheme !== "default") {
              document.documentElement.setAttribute("data-theme", newTheme);
            } else {
              document.documentElement.removeAttribute("data-theme");
            }
          }
          return { theme: newTheme };
        }),
    }),
    {
      name: "cbt-theme-storage",
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          if (state.theme !== "default") {
            document.documentElement.setAttribute("data-theme", state.theme);
          } else {
            document.documentElement.removeAttribute("data-theme");
          }
          document.documentElement.setAttribute("data-font", state.font || "sn-pro");
        }
      },
    }
  )
);
