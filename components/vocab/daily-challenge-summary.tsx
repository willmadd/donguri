import Image from "next/image";
import { Suspense } from "react";
import type { DailyChallengeResult } from "@/lib/daily-challenge";
import type { DailyChallengeReview } from "@/lib/daily-challenge-review";
import { DAILY_CHALLENGE_MAX_XP } from "@/lib/srs";
import { getTranslator } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { scoreTone } from "@/components/vocab/challenge-score";
import { BilingualText } from "@/components/vocab/bilingual-text";
import { cn } from "@/lib/utils";
import { RainbowAvatar } from "@/components/donguri/rainbow-avatar";
import { ScoreBar } from "@/components/vocab/score-bar";
import type { AccessoryId } from "@/lib/levels";

type Props = {
  courseSlug: string;
  results: DailyChallengeResult[];
  maxAttemptsPerDay: number;
  equippedAccessory: AccessoryId | null;
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

// End-of-day screen once all of today's daily-challenge attempts are used,
// full width: a header with the day's XP and the way out, Charles's look
// back over the day (streamed in — see getDailyChallengeReview) beside the
// average scores, then one card per attempt.
export async function DailyChallengeSummary({
  courseSlug,
  results,
  maxAttemptsPerDay,
  equippedAccessory,
  reviewPromise,
}: Props) {
  const { t } = await getTranslator();
  const totalXp = results.reduce((sum, result) => sum + result.xpEarned, 0);
  const maxXp = maxAttemptsPerDay * DAILY_CHALLENGE_MAX_XP;

  const scores: { key: ScoreKey; label: string }[] = [
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
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-kin/40 bg-kin/10 p-5 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <RainbowAvatar equippedAccessory={equippedAccessory} />
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-sumi">
              {t(
                "daily_challenge.day_complete_title",
                "Today's challenges complete!",
              )}
            </h2>
            <p className="text-sm text-sumi-soft">
              {t(
                "daily_challenge.day_complete_next",
                "New ones unlock at midnight UTC.",
              )}
            </p>
          </div>
        </div>
        <p className="flex shrink-0 items-baseline gap-1.5 self-start sm:self-auto">
          <span className="rounded-full bg-kin px-3 py-0.5 text-lg font-extrabold tabular-nums text-ink-on-light shadow-[0_4px_14px_-2px_rgb(255_184_0/0.6)] ring-2 ring-kin/30">
            {t("daily_challenge.xp_gain", "+{{xp}} XP", { xp: totalXp })}
          </span>
          <span className="text-sm tabular-nums text-sumi-soft">
            / {maxXp}
          </span>
        </p>
        <Button
          variant="secondary"
          href={`/dashboard/courses/${courseSlug}`}
          className="shrink-0 sm:min-w-40"
        >
          {t("daily_challenge.finish", "Finish")}
        </Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
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

        <section className="flex flex-col gap-3 rounded-3xl border border-card-border bg-washi p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-sumi">
            {t("daily_challenge.todays_average", "Today's average")}
          </h3>
          <ul className="flex flex-col gap-2.5">
            {scores.map(({ key, label }) => {
              const value = average(results, key);
              return (
                <li
                  key={key}
                  className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm"
                >
                  <span className="truncate text-sumi-soft">{label}</span>
                  {value === null ? (
                    <span className="h-2 rounded-sm bg-neutral-soft" />
                  ) : (
                    <ScoreBar score={value} />
                  )}
                  <strong
                    className={cn(
                      "text-right tabular-nums",
                      value === null
                        ? "text-sumi-soft"
                        : scoreTone(Math.round(value)).text,
                    )}
                  >
                    {value ?? "—"}
                  </strong>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-sumi">
          {t("daily_challenge.your_sentences", "Your sentences today")}
        </h3>
        <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result, index) => {
            const showBetter =
              result.message !== null &&
              result.betterVersion !== null &&
              result.betterVersion.trim().toLowerCase() !==
                result.message.trim().toLowerCase();

            return (
              <li
                key={result.id}
                className="flex flex-col gap-4 rounded-3xl border border-card-border bg-washi p-5 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sumi text-xs font-bold text-washi">
                    {index + 1}
                  </span>
                  <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {result.targets.map(({ term, translation }) => (
                      <li
                        key={term}
                        className="flex min-w-0 flex-col rounded-xl bg-matcha-soft/60 px-2.5 py-1"
                      >
                        <span className="text-xs font-semibold text-matcha-dark">
                          {term}
                        </span>
                        {translation && (
                          <span className="text-[11px] leading-snug text-sumi-soft">
                            {translation}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                      result.xpEarned > 0
                        ? "bg-kin text-ink-on-light"
                        : "bg-washi-soft text-sumi-soft",
                    )}
                  >
                    {t("daily_challenge.xp_gain", "+{{xp}} XP", {
                      xp: result.xpEarned,
                    })}
                  </span>
                </div>

                {result.message && (
                  <div className="flex flex-col">
                    <p className="rounded-2xl bg-washi-soft px-4 py-3 text-sm text-sumi">
                      {result.message}
                    </p>
                    {showBetter && (
                      <>
                        <span className="relative z-10 mx-auto -my-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-washi text-sumi-soft ring-1 ring-card-border">
                          <ArrowDownIcon className="h-4 w-4" />
                        </span>
                        <div className="rounded-2xl bg-ai-soft/70 px-4 py-3">
                          <p className="text-xs font-semibold text-ai">
                            {t("daily_challenge.try_this", "Try")}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-ai">
                            {result.betterVersion}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {result.grammarScore !== null && (
                  <ul className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-card-border pt-4">
                    {scores.map(({ key, label }) => {
                      const score = result[key];
                      if (score === null) return null;
                      return (
                        <li key={key} className="flex flex-col gap-1">
                          <span className="flex items-baseline justify-between gap-2 text-xs text-sumi-soft">
                            <span className="truncate">{label}</span>
                            <strong
                              className={cn(
                                "tabular-nums",
                                scoreTone(score).text,
                              )}
                            >
                              {score}
                            </strong>
                          </span>
                          <ScoreBar score={score} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
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
    <section className="flex flex-col gap-4 rounded-3xl border border-card-border bg-washi p-5 shadow-sm">
      <div className="flex gap-3">
        <Image
          src="/images/charles.webp"
          alt=""
          width={80}
          height={80}
          className="h-10 w-10 shrink-0 rounded-full border border-card-border bg-washi object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-sumi">
            {t("daily_challenge.charles_notes", "Charles's notes on today")}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-sumi">
            <BilingualText en={review.feedback} ja={review.feedbackJa} />
          </p>
        </div>
      </div>
      <div className="flex gap-3 rounded-2xl bg-kin/10 p-4">
        <BulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-kin" />
        <div className="min-w-0 text-sm text-sumi">
          <p className="font-semibold">
            {t("daily_challenge.next_time", "Next time, try")}
          </p>
          <p className="mt-0.5">
            <BilingualText en={review.focus} ja={review.focusJa} />
          </p>
        </div>
      </div>
    </section>
  );
}

function ReviewSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-3xl border border-card-border bg-washi p-5 shadow-sm"
      aria-busy
    >
      <p className="text-sm text-sumi-soft">{label}</p>
      <div className="h-3 w-full animate-pulse rounded-full bg-neutral-soft" />
      <div className="h-3 w-4/5 animate-pulse rounded-full bg-neutral-soft" />
      <div className="h-14 w-full animate-pulse rounded-2xl bg-neutral-soft/70" />
    </div>
  );
}

type IconProps = { className?: string };

function ArrowDownIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path
        d="M10 4v12m0 0-4.5-4.5M10 16l4.5-4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BulbIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M10 2a6 6 0 0 0-3.6 10.8c.4.3.6.7.6 1.2v.5h6V14c0-.5.2-.9.6-1.2A6 6 0 0 0 10 2Z" />
      <rect x="7.5" y="15.5" width="5" height="2.5" rx="1" />
    </svg>
  );
}
