import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeType = "default" | "neumorphism";
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
            document.documentElement.classList.remove("dark");
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
          const newTheme = state.theme === "default" ? "neumorphism" : "default";
          if (typeof document !== "undefined") {
            if (newTheme !== "default") {
              document.documentElement.setAttribute("data-theme", newTheme);
              document.documentElement.classList.remove("dark");
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
          const activeTheme = ((state.theme as string) === "neobrutalism" ? "neumorphism" : state.theme) as ThemeType;
          if (activeTheme !== "default") {
            document.documentElement.setAttribute("data-theme", activeTheme);
            document.documentElement.classList.remove("dark");
          } else {
            document.documentElement.removeAttribute("data-theme");
          }
          document.documentElement.setAttribute("data-font", state.font || "sn-pro");
        }
      },
    }
  )
);
