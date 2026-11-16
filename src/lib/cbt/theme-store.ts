import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontType = "sn-pro" | "system";

interface FontState {
  font: FontType;
  setFont: (font: FontType) => void;
}

/**
 * Light/dark is a class on <html> managed by each layout. The only persisted appearance
 * choice is the font. Older versions also stored a "neumorphism" theme under the same key;
 * that theme is gone, so any leftover data-theme attribute is cleared on load.
 */
export const useThemeStore = create<FontState>()(
  persist(
    (set) => ({
      font: "sn-pro",
      setFont: (font) => {
        set({ font });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-font", font);
        }
      },
    }),
    {
      name: "cbt-theme-storage",
      partialize: (state) => ({ font: state.font }),
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.removeAttribute("data-theme");
          document.documentElement.setAttribute("data-font", state.font || "sn-pro");
        }
      },
    },
  ),
);
