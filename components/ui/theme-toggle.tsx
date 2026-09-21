"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/components/i18n/locale-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations();
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is undefined until mounted, since the real value depends
  // on system preference / localStorage that isn't known during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount flag so the icon (which depends on resolvedTheme, unknown during SSR) only renders once the client value is available.
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={
        isDark
          ? t("theme_toggle.switch_to_light", "Switch to light mode")
          : t("theme_toggle.switch_to_dark", "Switch to dark mode")
      }
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sumi/15 text-sumi-soft transition hover:border-sumi/30 hover:text-sumi",
        className,
      )}
    >
      {mounted && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4.5 w-4.5"
          aria-hidden="true"
        >
          {isDark ? (
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </>
          )}
        </svg>
      )}
    </button>
  );
}
