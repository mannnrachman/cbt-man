import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale in styles.css (text-display, text-title, ...) must be known as font sizes.
// Otherwise tailwind-merge reads them as text colours and drops a real colour such as
// text-primary-foreground that comes earlier in the same class list.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "title", "heading", "body", "ui", "label"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
