import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The page-title/subtitle pair repeated at the top of nearly every
// dashboard, admin and auth page (usually right under <Breadcrumbs />).
// `className` lets a caller add e.g. a top margin for the handful of
// mid-page uses (a session's "done" screen) without duplicating the base
// styling.
export function PageTitle({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <h1
      className={cn("text-2xl font-extrabold text-sumi", className)}
      style={style}
    >
      {children}
    </h1>
  );
}

export function PageSubtitle({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p className={cn("mt-1 text-sumi-soft", className)} style={style}>
      {children}
    </p>
  );
}
