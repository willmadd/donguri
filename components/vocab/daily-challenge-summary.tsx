import Image from "next/image";
import { Suspense } from "react";
import type { DailyChallengeResult } from "@/lib/daily-challenge";
import type { DailyChallengeReview } from "@/lib/daily-challenge-review";
import { DAILY_CHALLENGE_FLAWLESS_XP } from "@/lib/srs";
import { getTranslator } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { scoreTone } from "@/components/vocab/challenge-score";
import { cn } from "@/lib/utils";

type Props = {
  courseSlug: string;
  results: DailyChallengeResult[];
  maxAttemptsPerDay: number;
  reviewPromise: Promise<DailyChallengeReview | null>;
};

type ScoreKey =
  "grammarScore" | "naturalnessScore" | "relevanceScore" | "complexityScore";

function average(
  results: DailyChallengeResult[],
  key: ScoreKey,
): number | null {
  const scores = results
    .map((result) => result[key])
    .filter((score): score is number => score !== null);
  if (scores.length === 0) return null;
  return (
    Math.round(
      (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
    ) / 10
  );
}

// End-of-day screen once all of today's daily-challenge attempts are used:
// XP earned, average scores, Charles's look back over the day (streamed in —
// see getDailyChallengeReview), and each attempt's sentence.
export async function DailyChallengeSummary({
  courseSlug,
  results,
  maxAttemptsPerDay,
  reviewPromise,
}: Props) {
  const { t } = await getTranslator();
  const totalXp = results.reduce((sum, result) => sum + result.xpEarned, 0);
  const maxXp = maxAttemptsPerDay * DAILY_CHALLENGE_FLAWLESS_XP;

  const averages: { key: ScoreKey; label: string }[] = [
    {
      key: "grammarScore",
      label: t("daily_challenge.summary_grammar", "Grammar"),
    },
    {
      key: "naturalnessScore",
      label: t("daily_challenge.summary_naturalness", "Natural phrasing"),
    },
    {
      key: "relevanceScore",
      label: t("daily_challenge.summary_relevance", "Relevance"),
    },
    {
      key: "complexityScore",
      label: t("daily_challenge.summary_complexity", "Complexity"),
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-card-border bg-washi shadow-sm">
      <div className="flex flex-col items-center gap-2 bg-kin/15 px-6 pb-6 pt-8 text-center">
        <span className="text-4xl" aria-hidden>
          🎉
        </span>
        <h2 className="text-2xl font-bold text-sumi">
          {t(
            "daily_challenge.day_complete_title",
            "Today's challenges complete!",
          )}
        </h2>
        <p className="text-sm text-sumi-soft">
          {t(
            "daily_challenge.day_complete_subtitle",
            "You finished all {{max}} of today's challenges. New ones unlock at midnight UTC.",
            { max: maxAttemptsPerDay },
          )}
        </p>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-matcha-soft/60 px-8 py-5 text-center">
            <p className="text-sm text-sumi-soft">
              {t("daily_challenge.xp_earned", "XP earned")}
            </p>
            <p className="text-4xl font-bold text-matcha-dark tabular-nums">
              +{totalXp}
            </p>
            <p className="text-xs text-sumi-soft">
              {t("daily_challenge.xp_out_of", "out of {{max}} possible", {
                max: maxXp,
              })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {averages.map(({ key, label }) => {
              const value = average(results, key);
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-card-border px-4 py-3"
                >
                  <p className="text-xs text-sumi-soft">
                    {t("daily_challenge.average_label", "Avg. {{label}}", {
                      label,
                    })}
                  </p>
                  <p
                    className={cn(
                      "text-xl font-bold tabular-nums",
                      value === null
                        ? "text-sumi-soft"
                        : scoreTone(Math.round(value)).text,
                    )}
                  >
                    {value ?? "—"}
                    <span className="text-sm font-semibold opacity-70">
                      /10
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <Suspense
          fallback={
            <ReviewSkeleton
              label={t(
                "daily_challenge.review_loading",
                "Charles is looking back over today…",
              )}
            />
          }
        >
          <CharlesReview reviewPromise={reviewPromise} />
        </Suspense>

        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
            {t("daily_challenge.your_sentences", "Your sentences today")}
          </h3>
          <ol className="flex flex-col gap-3">
            {results.map((result, index) => {
              const showBetter =
                result.message !== null &&
                result.betterVersion !== null &&
                result.betterVersion.trim().toLowerCase() !==
                  result.message.trim().toLowerCase();

              return (
                <li
                  key={result.id}
                  className="rounded-2xl border border-card-border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-sumi-soft">
                      {t("daily_challenge.attempt_number", "Challenge {{n}}", {
                        n: index + 1,
                      })}
                    </span>
                    {result.targetTerms.map((term) => (
                      <span
                        key={term}
                        className="rounded-full bg-matcha-soft/70 px-2.5 py-0.5 text-xs font-medium text-matcha-dark"
                      >
                        {term}
                      </span>
                    ))}
                    <span
                      className={cn(
                        "ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        result.xpEarned > 0
                          ? "bg-kin/20 text-sumi"
                          : "bg-washi-soft text-sumi-soft",
                      )}
                    >
                      +{result.xpEarned} XP
                    </span>
                  </div>

                  {result.message && (
                    <p className="mt-3 rounded-xl bg-ai-soft px-3 py-2 text-sm font-medium text-sumi">
                      {result.message}
                    </p>
                  )}
                  {showBetter && (
                    <p className="mt-2 text-sm text-sumi">
                      <span className="text-sumi-soft">
                        {t(
                          "daily_challenge.more_natural",
                          "More natural:",
                        )}{" "}
                      </span>
                      <span className="font-medium text-ai">
                        {result.betterVersion}
                      </span>
                    </p>
                  )}
                  {result.grammarScore !== null && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-sumi-soft">
                      {averages.map(({ key, label }) => {
                        const score = result[key];
                        if (score === null) return null;
                        return (
                          <span key={key}>
                            {label}{" "}
                            <strong className={scoreTone(score).text}>
                              {score}
                            </strong>
                            /10
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <Button
          variant="secondary"
          size="lg"
          href={`/dashboard/courses/${courseSlug}`}
          fullWidth
        >
          {t("daily_challenge.finish", "Finish")}
        </Button>
      </div>
    </section>
  );
}

async function CharlesReview({
  reviewPromise,
}: {
  reviewPromise: Promise<DailyChallengeReview | null>;
}) {
  const [review, { t }] = await Promise.all([reviewPromise, getTranslator()]);
  if (!review) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-washi-soft p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Image
          src="/images/charles.webp"
          alt=""
          width={80}
          height={80}
          className="h-10 w-10 rounded-full border border-card-border bg-washi object-cover"
        />
        <h3 className="font-semibold text-sumi">
          {t("daily_challenge.charles_notes", "Charles's notes on today")}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-sumi">{review.feedback}</p>
      <div className="rounded-xl bg-kin/10 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
          {t("daily_challenge.next_time", "Next time, try")}
        </p>
        <p className="mt-0.5 text-sm text-sumi">{review.focus}</p>
      </div>
    </section>
  );
}

function ReviewSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl bg-washi-soft p-4 sm:p-5"
      aria-busy
    >
      <p className="text-sm text-sumi-soft">{label}</p>
      <div className="h-3 w-full animate-pulse rounded-full bg-neutral-soft" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-neutral-soft" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-soft/70" />
    </div>
  );
}
