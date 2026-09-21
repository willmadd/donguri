import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Without this, tailwind-merge doesn't know our custom color tokens (defined
// in app/globals.css's `@theme inline` block) belong to the same color
// scale, so e.g. cn("text-sumi", "text-washi") keeps both classes instead of
// letting the later one win — which one then applies depends on unrelated
// CSS source order, not the intended override.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "outer",
        "washi",
        "washi-soft",
        "card-border",
        "header",
        "header-border",
        "sumi",
        "sumi-soft",
        "neutral-soft",
        "ink-on-light",
        "ink-on-dark",
        "ai",
        "ai-dark",
        "ai-soft",
        "sakura",
        "sakura-dark",
        "sakura-soft",
        "matcha",
        "matcha-dark",
        "matcha-soft",
        "shu",
        "shu-dark",
        "kin",
        "pill",
        "pill-foreground",
        "pill-accent",
        "pill-accent-foreground",
        "pill-icon",
        "ghost-border",
        "ghost-text",
        "ghost-hover",
        "tag",
        "tag-foreground",
        "chart-line",
        "chart-area",
        "background",
        "foreground",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseRgb(color: string): [number, number, number] | null {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const num = parseInt(full, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

// Picks readable text for a given background color using perceived
// brightness (YIQ), so dark backgrounds get light ink and light backgrounds
// get dark ink. Uses the fixed --ink-on-light/--ink-on-dark tokens rather
// than --sumi/--washi, since those invert in .dark mode (they're the site's
// own background/ink pair) while the colors passed in here are arbitrary,
// theme-independent values from the database. Falls back to light ink when
// the color is missing or unparseable, since most dynamic backgrounds in
// this app are dark.
export function getContrastTextClass(backgroundColor?: string | null): "text-ink-on-dark" | "text-ink-on-light" {
  const rgb = backgroundColor ? parseRgb(backgroundColor) : null;
  if (!rgb) return "text-ink-on-dark";
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? "text-ink-on-light" : "text-ink-on-dark";
}
