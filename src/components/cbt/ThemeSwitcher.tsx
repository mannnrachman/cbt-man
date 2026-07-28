import { Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/lib/cbt/theme-store";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      title={`Beralih ke Tema ${theme === "default" ? "Neobrutalism" : "Modern"}`}
      aria-label="Ganti Template"
      className="h-10 w-10 border-[length:var(--neo-border-width)] border-[color:var(--neo-border-color)] bg-background text-foreground shadow-[var(--neo-shadow)] transition-all hover:bg-[color:var(--neo-hover)] hover:translate-x-[2px] hover:translate-y-[2px]"
      style={{
        borderRadius: 'var(--neo-radius)'
      }}
    >
      <Paintbrush className="h-5 w-5 stroke-[2]" />
    </Button>
  );
}
