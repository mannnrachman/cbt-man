import * as React from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "active" | "warn" | "danger";

const TONES: Record<StatusTone, { text: string; dot: string }> = {
  neutral: { text: "text-muted-foreground", dot: "bg-muted-foreground" },
  active: { text: "text-primary", dot: "bg-brand" },
  warn: { text: "text-warn", dot: "bg-warn" },
  danger: { text: "text-destructive", dot: "bg-destructive" },
};

/**
 * One status shape for the whole app: a 6px dot and a 13px label. The label always
 * carries the meaning; the dot colour only reinforces it.
 */
export function StatusBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-2 whitespace-nowrap rounded-md border px-2 text-label font-medium",
        t.text,
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
