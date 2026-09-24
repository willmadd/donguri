"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendDailyChallengeMessage,
  type ChallengeCompletion,
  type ChatReply,
  type ChatTurn,
} from "@/lib/actions/daily-challenge";
import type { ChallengeItem, ChallengeTarget } from "@/lib/daily-challenge";
import {
  DAILY_CHALLENGE_PASS_SCORE,
  DAILY_CHALLENGE_PASS_XP,
  DAILY_CHALLENGE_PERFECT_XP,
} from "@/lib/srs";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

type Message = {
  id: number;
  role: "ai" | "user";
  text: string;
  reply?: ChatReply;
};

type Props = {
  courseSlug: string;
  target: ChallengeTarget;
  attemptsToday: number;
  maxAttemptsPerDay: number;
};

// One daily-challenge attempt: a chat with Charles Duck that ends as soon as
// the learner uses the target naturally (judged server-side by
// sendDailyChallengeMessage). Keyed by `attemptsToday` on the page, so
// moving on to the next attempt starts a fresh chat.
export function DailyChallengeChat({
  courseSlug,
  target,
  attemptsToday,
  maxAttemptsPerDay,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 1, role: "ai", text: t("chat.greeting", "Hey! What have you been up to lately?") },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<ChallengeCompletion | null>(null);
  const [isReplying, startReply] = useTransition();
  const [isAdvancing, startAdvance] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isComplete = completion !== null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isReplying, completion]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || isReplying || isComplete) return;

    const history: ChatTurn[] = messages.map((current) => ({
      role: current.role === "ai" ? "assistant" : "user",
      content: current.text,
    }));

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: Date.now(), role: "user", text: message },
    ]);
    setDraft("");
    setError(null);

    startReply(async () => {
      const result = await sendDailyChallengeMessage(courseSlug, history, message);

      if (!result.ok) {
        if (result.reason === "limit_reached" || result.reason === "not_enrolled") {
          router.refresh();
          return;
        }
        setError(
          result.error ??
            t("daily_challenge.error", "Something went wrong. Please try again."),
        );
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          role: "ai",
          text: result.reply.english,
          reply: result.reply,
        },
      ]);

      if (result.completion) {
        setCompletion(result.completion);
      }
    });
  }

  function handleNext() {
    startAdvance(() => router.refresh());
  }

  const feedbackItems = messages.reduce<
    { id: number; userText: string; reply: ChatReply }[]
  >((items, message, index) => {
    if (message.role === "ai" && message.reply) {
      const previous = messages[index - 1];
      if (previous?.role === "user") {
        items.push({
          id: message.id,
          userText: previous.text,
          reply: message.reply,
        });
      }
    }
    return items;
  }, []);

  const finalItem = isComplete ? feedbackItems.at(-1) : undefined;
  const summary = finalItem?.reply.summary ?? null;
  const showBetterVersion =
    summary !== null &&
    summary.betterVersion.trim().toLowerCase() !==
      finalItem?.userText.trim().toLowerCase();
  const attemptsUsed = completion?.attemptsToday ?? attemptsToday;
  const hasMoreAttempts = attemptsUsed < maxAttemptsPerDay;

  return (
    <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2" aria-hidden>
            {Array.from({ length: maxAttemptsPerDay }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full transition-colors ${
                  i < attemptsUsed ? "bg-matcha" : "bg-neutral-soft"
                }`}
              />
            ))}
          </div>
          <p className="max-w-sm text-sm text-sumi-soft">
            {t(
              "daily_challenge.instructions",
              "Chat with Charles Duck and use this naturally in one of your messages:",
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {target.vocab && (
              <TargetCard
                label={t("daily_challenge.target_word", "Word")}
                item={target.vocab}
              />
            )}
            {target.grammar && (
              <TargetCard
                label={t("daily_challenge.target_grammar", "Grammar")}
                item={target.grammar}
              />
            )}
          </div>
          <p className="max-w-sm text-xs text-sumi-soft">
            {t(
              "daily_challenge.xp_rules",
              "10/10 for both grammar and natural phrasing earns {{perfect}} XP. {{pass}}+ on both earns {{passXp}} XP.",
              {
                perfect: DAILY_CHALLENGE_PERFECT_XP,
                pass: DAILY_CHALLENGE_PASS_SCORE,
                passXp: DAILY_CHALLENGE_PASS_XP,
              },
            )}
          </p>
        </div>

        <div className="w-[320px] rounded-[2.5rem] bg-sumi p-2 shadow-xl">
          <div className="flex h-150 flex-col overflow-hidden rounded-4xl bg-washi">
            <div className="flex items-center justify-center bg-washi-soft py-2">
              <div className="h-5 w-24 rounded-full bg-sumi" />
            </div>

            <div className="flex items-center justify-center gap-2 border-b border-washi-soft bg-washi px-4 py-2">
              <Image
                src="/images/charles.webp"
                alt="Charles Duck"
                width={64}
                height={64}
                className="h-6 w-6 rounded-full object-cover"
              />
              <p className="text-sm font-semibold text-sumi">Charles Duck</p>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <Image
                    src={
                      message.role === "user"
                        ? "/images/mascot.png"
                        : "/images/charles.webp"
                    }
                    alt={message.role === "user" ? "You" : "Charles Duck"}
                    width={64}
                    height={64}
                    className="h-7 w-7 shrink-0 rounded-full border border-washi-soft object-cover"
                  />
                  <p
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "rounded-br-sm bg-ai text-washi"
                        : "rounded-bl-sm bg-washi-soft text-sumi"
                    }`}
                  >
                    {message.text}
                  </p>
                </div>
              ))}
              {isReplying && (
                <div className="flex items-end gap-2">
                  <Image
                    src="/images/charles.webp"
                    alt="Charles Duck"
                    width={64}
                    height={64}
                    className="h-7 w-7 shrink-0 rounded-full border border-washi-soft object-cover"
                  />
                  <p className="max-w-[75%] rounded-2xl rounded-bl-sm bg-washi-soft px-3 py-2 text-sm text-sumi-soft">
                    …
                  </p>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-washi-soft bg-washi px-3 py-2"
            >
              <label htmlFor="message" className="sr-only">
                {t("chat.your_message", "Your message")}
              </label>
              <input
                id="message"
                name="message"
                value={draft}
                maxLength={500}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  isComplete
                    ? t("chat.session_complete_short", "Session complete!")
                    : t("chat.type_a_message", "Type a message")
                }
                disabled={isReplying || isComplete}
                className="flex-1 rounded-full border border-washi-soft bg-washi px-3 py-1.5 text-sm text-sumi outline-none focus:border-ai"
              />
              <Button
                type="submit"
                disabled={isReplying || isComplete || !draft.trim()}
                size="sm"
                className="h-auto px-3 py-1.5 disabled:opacity-40"
              >
                {t("chat.send", "Send")}
              </Button>
            </form>

            <div className="flex justify-center bg-washi pb-2 pt-1">
              <div className="h-1 w-28 rounded-full bg-sumi/60" />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-shu">
            {error}
          </p>
        )}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        {completion && finalItem && (
          <div className="flex flex-col gap-4 rounded-2xl border border-card-border bg-washi-soft p-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-lg font-semibold text-sumi">
                {completion.xpEarned === DAILY_CHALLENGE_PERFECT_XP
                  ? t("daily_challenge.result_perfect", "Perfect! +{{xp}} XP", {
                      xp: completion.xpEarned,
                    })
                  : completion.xpEarned > 0
                    ? t("daily_challenge.result_pass", "Nice work! +{{xp}} XP", {
                        xp: completion.xpEarned,
                      })
                    : t("daily_challenge.result_none", "Challenge done — no XP this time")}
              </p>
              <div className="flex gap-2 text-sm">
                <ScorePill
                  label={t("daily_challenge.summary_grammar", "Grammar")}
                  score={finalItem.reply.grammarScore}
                />
                <ScorePill
                  label={t("daily_challenge.summary_naturalness", "Natural phrasing")}
                  score={finalItem.reply.naturalnessScore}
                />
              </div>
            </div>

            {summary && (
              <>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
                    {t("daily_challenge.summary_how_you_did", "How you did")}
                  </h3>
                  <p className="mt-1 text-sm text-sumi">{summary.overall}</p>
                </section>

                {showBetterVersion && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
                      {t("daily_challenge.summary_better_version", "A more natural way to say it")}
                    </h3>
                    <p className="mt-1 text-sm text-sumi-soft line-through decoration-sumi-soft/50">
                      {finalItem.userText}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ai">{summary.betterVersion}</p>
                  </section>
                )}

                {summary.tips.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
                      {t("daily_challenge.summary_tips", "What to work on")}
                    </h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sumi">
                      {summary.tips.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            <div className="flex justify-center">
              {hasMoreAttempts ? (
                <Button
                  variant="secondary"
                  disabled={isAdvancing}
                  onClick={handleNext}
                >
                  {t("daily_challenge.next", "Next challenge")}
                </Button>
              ) : (
                <Button variant="secondary" href={`/dashboard/courses/${courseSlug}`}>
                  {t("daily_challenge.back_to_course", "Back to course")}
                </Button>
              )}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-lg text-sumi">{t("chat.feedback", "Feedback")}</h2>
          {feedbackItems.length === 0 ? (
            <p className="text-sm text-sumi-soft">
              {t("chat.feedback_empty", "Send a message to see feedback here.")}
            </p>
          ) : (
            <ul className="space-y-3">
              {feedbackItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-washi-soft bg-washi-soft/60 p-3"
                >
                  <p className="text-sm text-sumi-soft">
                    {t("chat.you_said", "You said:")}{" "}
                    <span className="text-sumi">{item.userText}</span>
                  </p>
                  <p className="mt-1 text-sm text-sumi">{item.reply.japanese}</p>
                  <div className="mt-2 flex gap-3 text-xs text-sumi-soft">
                    <span>
                      {t("chat.grammar_score", "Grammar: {{score}}/10", {
                        score: item.reply.grammarScore,
                      })}
                    </span>
                    <span>
                      {t("chat.naturalness_score", "Natural phrasing: {{score}}/10", {
                        score: item.reply.naturalnessScore,
                      })}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-sumi-soft">
                    {item.reply.feedback}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetCard({ label, item }: { label: string; item: ChallengeItem }) {
  return (
    <div className="flex max-w-[16rem] flex-col items-center rounded-xl border border-card-border bg-washi px-4 py-2">
      <span className="text-xs uppercase tracking-wide text-sumi-soft">{label}</span>
      <strong className="text-base text-sumi">{item.term}</strong>
      <span className="text-xs text-sumi-soft">{item.translation}</span>
    </div>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const tone =
    score === 10
      ? "border-matcha bg-matcha/10 text-matcha-dark"
      : score >= DAILY_CHALLENGE_PASS_SCORE
        ? "border-ai bg-ai/10 text-ai"
        : "border-shu/40 bg-shu/10 text-shu";

  return (
    <span className={`rounded-full border px-3 py-1 ${tone}`}>
      {label} <strong>{score}</strong>/10
    </span>
  );
}
