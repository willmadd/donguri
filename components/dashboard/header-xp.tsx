"use client";

import { usePathname } from "next/navigation";
import { XpCounter } from "@/components/xp/xp-counter";

// The test-session page shows its own live-updating XP counter (it ticks up
// as each question is answered), so the static header badge would just be a
// stale duplicate there — hide it for that one route.
const TEST_SESSION_PATTERN = /\/decks\/[^/]+\/test(\/|$)/;

export function HeaderXp({ xp }: { xp: number }) {
  const pathname = usePathname();

  if (TEST_SESSION_PATTERN.test(pathname ?? "")) {
    return null;
  }

  return <XpCounter value={xp} />;
}
