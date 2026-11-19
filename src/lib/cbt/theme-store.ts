import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type FontType = "sn-pro" | "system" | "serif" | "mono";
export type FontSize = "kecil" | "normal" | "besar" | "sangat-besar";
export type Accent = "biru" | "hitam" | "hijau";

export const FONT_TYPES: readonly FontType[] = ["sn-pro", "system", "serif", "mono"];
export const FONT_SIZES: readonly FontSize[] = ["kecil", "normal", "besar", "sangat-besar"];
export const ACCENTS: readonly Accent[] = ["biru", "hitam", "hijau"];

interface AppearanceState {
  font: FontType;
  fontSize: FontSize;
  accent: Accent;
  setFont: (font: FontType) => void;
  setFontSize: (size: FontSize) => void;
  setAccent: (accent: Accent) => void;
}

export const STORAGE_KEY = "cbt-theme-storage";

/** Writes the three choices onto <html>; styles.css reads them as attribute selectors. */
function apply(font: FontType, fontSize: FontSize, accent: Accent) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-font", font);
  root.setAttribute("data-font-size", fontSize);
  root.setAttribute("data-accent", accent);
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/**
 * Persistence must never break the appearance itself: a full quota or a
 * privacy-mode rejection only means the choice will not survive a reload, so
 * the write failure is swallowed and the in-memory update plus the apply()
 * DOM update still happen. Reads fail open to "nothing saved".
 */
const safeAppearanceStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      // Quota exceeded or storage disabled: keep memory and DOM in sync anyway.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Idem: losing the persisted choice is acceptable, throwing is not.
    }
  },
};

/**
 * Light/dark is a class on <html> managed by each layout. The persisted appearance choices
 * are the font, the text size and the colour theme; they are per browser, not per account.
 * Older versions stored only `font` (and, before that, a "neumorphism" theme under the same
 * key), so every value is validated on load and any leftover data-theme attribute is cleared.
 */
export const useThemeStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      font: "sn-pro",
      fontSize: "normal",
      accent: "biru",
      setFont: (font) => {
        set({ font });
        apply(font, get().fontSize, get().accent);
      },
      setFontSize: (fontSize) => {
        set({ fontSize });
        apply(get().font, fontSize, get().accent);
      },
      setAccent: (accent) => {
        set({ accent });
        apply(get().font, get().fontSize, accent);
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeAppearanceStorage),
      partialize: (state) => ({ font: state.font, fontSize: state.fontSize, accent: state.accent }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppearanceState>;
        return {
          ...current,
          font: pick(saved.font, FONT_TYPES, "sn-pro"),
          fontSize: pick(saved.fontSize, FONT_SIZES, "normal"),
          accent: pick(saved.accent, ACCENTS, "biru"),
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && typeof document !== "undefined") {
          document.documentElement.removeAttribute("data-theme");
          apply(state.font, state.fontSize, state.accent);
        }
      },
    },
  ),
);

/**
 * Runs inline in <head> before first paint, so a saved colour theme or text size does not
 * flash the defaults. Mirrors the validation above; any failure leaves the defaults.
 */
export const APPEARANCE_INIT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}").state||{};var r=document.documentElement;var f=${JSON.stringify(FONT_TYPES)},z=${JSON.stringify(FONT_SIZES)},a=${JSON.stringify(ACCENTS)};r.setAttribute("data-font",f.indexOf(s.font)>-1?s.font:"sn-pro");r.setAttribute("data-font-size",z.indexOf(s.fontSize)>-1?s.fontSize:"normal");r.setAttribute("data-accent",a.indexOf(s.accent)>-1?s.accent:"biru")}catch(e){}})();`;
