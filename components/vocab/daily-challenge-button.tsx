"use client";

import { useState, useTransition } from "react";
import { completeDailyChallenge } from "@/lib/actions/daily-challenge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

type Props = {
  courseSlug: string;
  initialAttemptsToday: number;
  maxAttemptsPerDay: number;
};

export function DailyChallengeButton({
  courseSlug,
  initialAttemptsToday,
  maxAttemptsPerDay,
}: Props) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [attemptsToday, setAttemptsToday] = useState(initialAttemptsToday);
  const [justCompleted, setJustCompleted] = useState(false);

  const remaining = Math.max(0, maxAttemptsPerDay - attemptsToday);
  const exhausted = remaining === 0;

  function handleClick() {
    setJustCompleted(false);
    startTransition(async () => {
      const result = await completeDailyChallenge(courseSlug);
      if (result.ok) {
        setAttemptsToday(result.attemptsToday);
        setJustCompleted(true);
      } else if (result.reason === "limit_reached") {
        setAttemptsToday(maxAttemptsPerDay);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: maxAttemptsPerDay }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full transition-colors ${
              i < attemptsToday ? "bg-matcha" : "bg-neutral-soft"
            }`}
          />
        ))}
      </div>

      <Button
        variant="secondary"
        size="lg"
        disabled={pending || exhausted}
        onClick={handleClick}
      >
        {pending
          ? t("daily_challenge.loading", "Working through it…")
          : exhausted
            ? t("daily_challenge.exhausted", "Come back tomorrow")
            : t("daily_challenge.cta", "Take the daily challenge")}
      </Button>

      <p className="max-w-xs text-sm text-sumi-soft">
        {exhausted
          ? t(
              "daily_challenge.exhausted_subtitle",
              "You've used all {{max}} attempts today — new ones unlock at midnight UTC.",
              { max: maxAttemptsPerDay },
            )
          : t(
              "daily_challenge.remaining",
              "{{count}} of {{max}} attempts left today",
              { count: remaining, max: maxAttemptsPerDay },
            )}
      </p>

      {justCompleted && (
        <p className="text-sm font-medium text-matcha-dark" role="status">
          {t("daily_challenge.success", "Nice! Challenge complete.")}
        </p>
      )}
    </div>
  );
}
