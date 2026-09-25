"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resetDailyChallengeToday } from "@/lib/actions/daily-challenge";
import { useDevMode } from "@/components/dashboard/dev-mode-context";
import { useTranslations } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";

type Props = {
  courseSlug: string;
  attemptsToday: number;
  maxAttemptsPerDay: number;
};

// Dev mode only (the toggle is admin-only, and the action re-checks the
// role): every visit to the course page wipes today's daily-challenge
// attempts, so testing is never capped at three — plus a button to do it
// by hand. The action revalidates the page, which then shows the full
// count again.
export function DailyChallengeDevReset({ courseSlug, attemptsToday, maxAttemptsPerDay }: Props) {
  const t = useTranslations();
  const { enabled } = useDevMode();
  const [status, setStatus] = useState<"idle" | "resetting" | "failed">("idle");
  // Guards against a second call while the first is still in flight (and
  // against Strict Mode's double effect run in development).
  const resetting = useRef(false);
  // The automatic reset runs once per visit (this component remounts on
  // each navigation to the course page). Re-running it whenever
  // attemptsToday > 0 looped: the action resolves before the revalidated
  // page (with the new count) has rendered, so the stale count triggered
  // another reset, which revalidated again, and so on.
  const autoResetDone = useRef(false);

  const reset = useCallback(() => {
    if (resetting.current) return;
    resetting.current = true;
    setStatus("resetting");
    resetDailyChallengeToday(courseSlug)
      .then((result) => setStatus(result.ok ? "idle" : "failed"))
      .catch(() => setStatus("failed"))
      .finally(() => {
        resetting.current = false;
      });
  }, [courseSlug]);

  useEffect(() => {
    if (!enabled || attemptsToday === 0 || autoResetDone.current) return;
    autoResetDone.current = true;
    reset();
  }, [enabled, attemptsToday, reset]);

  if (!enabled) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-kin bg-kin/10 px-4 py-2.5 text-sm">
      <div className="flex flex-col">
        <span className="text-sumi">
          <strong>{t("daily_challenge.dev_label", "Dev")}</strong> ·{" "}
          {t("daily_challenge.dev_attempts", "{{used}}/{{max}} daily challenges used today", {
            used: attemptsToday,
            max: maxAttemptsPerDay,
          })}
        </span>
        <span className={status === "failed" ? "text-shu" : "text-sumi-soft"}>
          {status === "failed"
            ? t(
                "daily_challenge.dev_reset_failed",
                "Reset failed — check the server log (has the daily-challenge SQL migration been run?).",
              )
            : t("daily_challenge.dev_auto_reset", "Resets automatically each time you open this page.")}
        </span>
      </div>
      <Button variant="outline" size="sm" disabled={status === "resetting"} onClick={reset}>
        {status === "resetting"
          ? t("daily_challenge.dev_resetting", "Resetting…")
          : t("daily_challenge.dev_reset", "Reset daily challenges")}
      </Button>
    </div>
  );
}
