"use client";

import Image from "next/image";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  sendDailyChallengeMessage,
  type ChallengeCompletion,
  type ChatReply,
  type ChatTurn,
} from "@/lib/actions/daily-challenge";
import type {
  ChallengeItem,
  ChallengeOpener,
  ChallengeTarget,
} from "@/lib/daily-challenge";
import {
  DAILY_CHALLENGE_FLAWLESS_XP,
  DAILY_CHALLENGE_PASS_SCORE,
  DAILY_CHALLENGE_PASS_XP,
  DAILY_CHALLENGE_PERFECT_XP,
} from "@/lib/srs";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { scoreTone } from "@/components/vocab/challenge-score";
import { BilingualText } from "@/components/vocab/bilingual-text";

type Message = {
  id: number;
  role: "ai" | "user";
  text: string;
  sentAt: number;
  // Japanese translation of Charles's messages, behind the Translate button.
  japanese?: string;
  reply?: ChatReply;
};

type FeedbackItem = {
  id: number;
  userMessageId: number;
  userText: string;
  reply: ChatReply;
};

type Challenge = {
  target: ChallengeTarget | null;
  attemptsToday: number;
  maxAttemptsPerDay: number;
};

type Attempt = {
  challenge: Challenge;
  openerPromise: Promise<ChallengeOpener> | null;
};

// Holds the attempt being played on screen until the learner moves on.
// Finishing an attempt revalidates the page, and that fresh render (with
// attemptsToday bumped, or no target once the day's attempts are used up)
// lands in the same response as the result — rendering it straight away
// would remount the chat and throw the result card away. So the attempt is
// pinned from the first message sent, and only "Next challenge" (or the
// server refusing the attempt) lets the latest render through.
export function DailyChallenge({
  courseSlug,
  challenge,
  openerPromise,
  heading,
  emptyState,
}: Attempt & {
  courseSlug: string;
  heading: ReactNode;
  emptyState: ReactNode;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState<Attempt | null>(null);
  const [isAdvancing, startAdvance] = useTransition();
  const live: Attempt = { challenge, openerPromise };
  const { challenge: shown, openerPromise: shownOpener } = pinned ?? live;

  function handleAdvance() {
    startAdvance(() => {
      setPinned(null);
      router.refresh();
    });
  }

  if (!shown.target || !shownOpener) {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        {emptyState}
      </div>
    );
  }

  return (
    <DailyChallengeChat
      key={shown.attemptsToday}
      courseSlug={courseSlug}
      heading={heading}
      target={shown.target}
      openerPromise={shownOpener}
      attemptsToday={shown.attemptsToday}
      maxAttemptsPerDay={shown.maxAttemptsPerDay}
      isAdvancing={isAdvancing}
      onStart={() => setPinned((current) => current ?? live)}
      onAdvance={handleAdvance}
    />
  );
}

type Props = {
  courseSlug: string;
  heading: ReactNode;
  target: ChallengeTarget;
  // Charles's generated first message, streamed from the page.
  openerPromise: Promise<ChallengeOpener>;
  attemptsToday: number;
  maxAttemptsPerDay: number;
  isAdvancing: boolean;
  onStart: () => void;
  onAdvance: () => void;
};

// One daily-challenge attempt: a chat with Charles Duck that ends as soon as
// the learner uses the target naturally (judged server-side by
// sendDailyChallengeMessage). Keyed by `attemptsToday` in DailyChallenge, so
// moving on to the next attempt starts a fresh chat.
function DailyChallengeChat({
  courseSlug,
  heading,
  target,
  openerPromise,
  attemptsToday,
  maxAttemptsPerDay,
  isAdvancing,
  onStart,
  onAdvance,
}: Props) {
  const t = useTranslations();
  const locale = useLocale();
  // Starts empty: Charles's opener streams in from openerPromise, with
  // his typing indicator showing until it lands.
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<ChallengeCompletion | null>(
    null,
  );
  // Null follows the latest reply; set when the learner picks an older one.
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<number | null>(
    null,
  );
  const [translatedIds, setTranslatedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [isReplying, startReply] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLElement>(null);

  const isComplete = completion !== null;
  const isOpening = messages.length === 0;
  const isCharlesTyping = isReplying || isOpening;

  useEffect(() => {
    let active = true;
    openerPromise.then((opener) => {
      if (!active) return;
      // A revalidation can hand over a new promise mid-chat; only the
      // first opener ever counts.
      setMessages((current) =>
        current.length > 0
          ? current
          : [
              {
                id: 1,
                role: "ai",
                text: opener.english,
                japanese: opener.japanese,
                sentAt: Date.now(),
              },
            ],
      );
    });
    return () => {
      active = false;
    };
  }, [openerPromise]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isCharlesTyping]);

  // Hand focus back to the input once Charles has answered, so the learner
  // can keep typing without reaching for the mouse. preventScroll: focusing
  // would otherwise scroll the window to the input, pushing the page title
  // and breadcrumbs out of view.
  useEffect(() => {
    if (!isReplying && !isComplete && messages.length > 1) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isReplying, isComplete, messages.length]);

  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || isCharlesTyping || isComplete) return;

    const history: ChatTurn[] = messages.map((current) => ({
      role: current.role === "ai" ? "assistant" : "user",
      content: current.text,
    }));

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: Date.now(), role: "user", text: message, sentAt: Date.now() },
    ]);
    setDraft("");
    setError(null);
    setSelectedFeedbackId(null);
    onStart();

    startReply(async () => {
      const result = await sendDailyChallengeMessage(
        courseSlug,
        history,
        message,
      );

      if (!result.ok) {
        if (
          result.reason === "limit_reached" ||
          result.reason === "not_enrolled"
        ) {
          onAdvance();
          return;
        }
        setError(
          result.error ??
            t(
              "daily_challenge.error",
              "Something went wrong. Please try again.",
            ),
        );
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          role: "ai",
          text: result.reply.english,
          japanese: result.reply.japanese,
          sentAt: Date.now(),
          reply: result.reply,
        },
      ]);

      if (result.completion) {
        setCompletion(result.completion);
      }
    });
  }

  function toggleTranslation(id: number) {
    setTranslatedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showFeedback(id: number) {
    setSelectedFeedbackId(id);
    // Stacked layout: the panel sits below the chat, so bring it into view.
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  const feedbackItems = messages.reduce<FeedbackItem[]>(
    (items, message, index) => {
      if (message.role === "ai" && message.reply) {
        const previous = messages[index - 1];
        if (previous?.role === "user") {
          items.push({
            id: message.id,
            userMessageId: previous.id,
            userText: previous.text,
            reply: message.reply,
          });
        }
      }
      return items;
    },
    [],
  );
  const feedbackByUserMessage = new Map(
    feedbackItems.map((item) => [item.userMessageId, item]),
  );

  const selectedIndex =
    selectedFeedbackId === null
      ? feedbackItems.length - 1
      : feedbackItems.findIndex((item) => item.id === selectedFeedbackId);
  const selectedItem = feedbackItems[selectedIndex];

  const finalItem = isComplete ? feedbackItems.at(-1) : undefined;
  const summary = finalItem?.reply.summary ?? null;
  const showBetterVersion =
    summary !== null &&
    summary.betterVersion.trim().toLowerCase() !==
      finalItem?.userText.trim().toLowerCase();
  const attemptsUsed = completion?.attemptsToday ?? attemptsToday;
  const hasMoreAttempts = attemptsUsed < maxAttemptsPerDay;
  const currentAttempt = Math.min(
    attemptsUsed + (isComplete ? 0 : 1),
    maxAttemptsPerDay,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {heading}
          <div className="flex shrink-0 items-center gap-3 self-start rounded-full border border-card-border bg-washi-soft/60 px-4 py-1.5 text-sm text-sumi-soft sm:self-auto">
            <span>
              {t(
                "daily_challenge.attempt_progress",
                "Attempt {{current}} of {{max}}",
                {
                  current: currentAttempt,
                  max: maxAttemptsPerDay,
                },
              )}
            </span>
            <span className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: maxAttemptsPerDay }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors",
                    i < attemptsUsed
                      ? "bg-matcha"
                      : i === attemptsUsed && !isComplete
                        ? "bg-matcha/30 ring-2 ring-matcha/60"
                        : "bg-neutral-soft",
                  )}
                />
              ))}
            </span>
          </div>
        </div>

        <section className="flex h-144 flex-col overflow-hidden rounded-3xl border border-card-border bg-washi shadow-sm lg:h-168">
          <header className="flex items-center gap-3 border-b border-card-border px-5 py-4">
            <Image
              src="/images/charles.webp"
              alt=""
              width={96}
              height={96}
              className="h-12 w-12 rounded-full border border-card-border bg-washi-soft object-cover"
            />
            <div className="flex flex-col">
              <p className="font-semibold text-sumi">Charles Duck</p>
              <p className="flex items-center gap-1.5 text-xs text-sumi-soft">
                <span className="h-2 w-2 rounded-full bg-matcha" aria-hidden />
                {isCharlesTyping
                  ? t("daily_challenge.typing", "Typing…")
                  : t("daily_challenge.online", "Online now")}
              </p>
            </div>
          </header>

          <TargetBanner target={target} isComplete={isComplete} />

          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5"
            aria-live="polite"
          >
            {messages.map((message) => {
              const isUser = message.role === "user";
              const feedback = isUser
                ? feedbackByUserMessage.get(message.id)
                : undefined;
              const showTranslation = translatedIds.has(message.id);

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-2.5",
                    isUser && "flex-row-reverse",
                  )}
                >
                  <Avatar role={message.role} />
                  <div
                    className={cn(
                      "flex max-w-[78%] flex-col gap-1",
                      isUser ? "items-end" : "items-start",
                    )}
                  >
                    <p
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-[0.95rem] leading-snug",
                        isUser
                          ? "rounded-br-md bg-ai text-washi"
                          : "rounded-bl-md bg-washi-soft text-sumi",
                      )}
                    >
                      {message.text}
                      {showTranslation && message.japanese && (
                        <span className="mt-1.5 block border-t border-card-border pt-1.5 text-sm text-sumi-soft">
                          {message.japanese}
                        </span>
                      )}
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-2 px-1 text-xs text-sumi-soft",
                        isUser && "flex-row-reverse",
                      )}
                    >
                      <time dateTime={new Date(message.sentAt).toISOString()}>
                        {timeFormat.format(message.sentAt)}
                      </time>
                      {message.japanese && (
                        <button
                          type="button"
                          onClick={() => toggleTranslation(message.id)}
                          className="rounded-full px-1.5 py-0.5 transition hover:bg-washi-soft hover:text-sumi"
                        >
                          {showTranslation
                            ? t(
                                "daily_challenge.hide_translation",
                                "Hide translation",
                              )
                            : t(
                                "daily_challenge.show_translation",
                                "Translate",
                              )}
                        </button>
                      )}
                    </div>
                    {feedback && (
                      <button
                        type="button"
                        onClick={() => showFeedback(feedback.id)}
                        aria-pressed={feedback.id === selectedItem?.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
                          feedback.id === selectedItem?.id
                            ? "border-kin/60 bg-kin/15 text-sumi"
                            : "border-card-border bg-washi text-sumi-soft hover:bg-washi-soft hover:text-sumi",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            scoreTone(
                              Math.min(
                                feedback.reply.grammarScore,
                                feedback.reply.naturalnessScore,
                                feedback.reply.relevanceScore,
                              ),
                            ).dot,
                          )}
                          aria-hidden
                        />
                        {t("daily_challenge.see_feedback", "See feedback")}
                        <ChevronIcon className="h-3 w-3 -rotate-90" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isCharlesTyping && (
              <div className="flex items-end gap-2.5">
                <Avatar role="ai" />
                <p
                  className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-washi-soft px-4 py-3.5"
                  aria-label={t("daily_challenge.typing", "Typing…")}
                >
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 animate-bounce rounded-full bg-sumi-soft/60"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </p>
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mx-4 mb-2 rounded-xl bg-shu/10 px-3 py-2 text-sm text-shu"
            >
              {error}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-card-border px-4 py-3 sm:px-5"
          >
            <label htmlFor="message" className="sr-only">
              {t("chat.your_message", "Your message")}
            </label>
            <input
              ref={inputRef}
              id="message"
              name="message"
              value={draft}
              maxLength={500}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                isComplete
                  ? t("chat.session_complete_short", "Session complete!")
                  : t("chat.type_a_message", "Type a message")
              }
              disabled={isReplying || isComplete}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-card-border bg-washi px-4 text-sumi outline-none transition placeholder:text-sumi-soft/70 focus:border-ai focus:ring-2 focus:ring-ai/20 disabled:bg-washi-soft/50"
            />
            <Button
              type="submit"
              disabled={isCharlesTyping || isComplete || !draft.trim()}
              className="h-12 rounded-2xl px-6 disabled:opacity-40"
            >
              {t("chat.send", "Send")}
            </Button>
          </form>
        </section>
      </div>

      <aside ref={feedbackRef} className="flex scroll-mt-6 flex-col gap-6">
        {completion && finalItem && (
          <CompletionCard
            completion={completion}
            finalItem={finalItem}
            showBetterVersion={showBetterVersion}
            hasMoreAttempts={hasMoreAttempts}
            isAdvancing={isAdvancing}
            onNext={onAdvance}
          />
        )}

        <section className="flex flex-col gap-4 rounded-3xl border border-card-border bg-washi p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-washi-soft text-sumi-soft">
              <ChartIcon className="h-5 w-5" />
            </span>
            <h2 className="flex-1 text-lg font-semibold text-sumi">
              {selectedIndex === feedbackItems.length - 1
                ? t(
                    "daily_challenge.feedback_latest",
                    "Feedback on your last reply",
                  )
                : t(
                    "daily_challenge.feedback_selected",
                    "Feedback on this reply",
                  )}
            </h2>
            {feedbackItems.length > 1 && (
              <div className="flex items-center gap-1 text-xs text-sumi-soft">
                <PagerButton
                  label={t("daily_challenge.previous_reply", "Previous reply")}
                  disabled={selectedIndex <= 0}
                  onClick={() =>
                    setSelectedFeedbackId(feedbackItems[selectedIndex - 1].id)
                  }
                  className="rotate-90"
                />
                <span className="tabular-nums">
                  {selectedIndex + 1}/{feedbackItems.length}
                </span>
                <PagerButton
                  label={t("daily_challenge.next_reply", "Next reply")}
                  disabled={selectedIndex >= feedbackItems.length - 1}
                  onClick={() =>
                    setSelectedFeedbackId(feedbackItems[selectedIndex + 1].id)
                  }
                  className="-rotate-90"
                />
              </div>
            )}
          </div>

          {selectedItem ? (
            <>
              <p className="rounded-2xl bg-ai-soft px-4 py-3 font-medium text-sumi">
                {selectedItem.userText}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ScoreTile
                  label={t("daily_challenge.summary_grammar", "Grammar")}
                  hint={t("daily_challenge.hint_grammar", "Is it correct?")}
                  score={selectedItem.reply.grammarScore}
                />
                <ScoreTile
                  label={t(
                    "daily_challenge.summary_naturalness",
                    "Natural phrasing",
                  )}
                  hint={t(
                    "daily_challenge.hint_naturalness",
                    "Would a native speaker say it?",
                  )}
                  score={selectedItem.reply.naturalnessScore}
                />
                <ScoreTile
                  label={t("daily_challenge.summary_relevance", "Relevance")}
                  hint={t(
                    "daily_challenge.hint_relevance",
                    "Does it answer Charles?",
                  )}
                  score={selectedItem.reply.relevanceScore}
                />
                <ScoreTile
                  label={t("daily_challenge.summary_complexity", "Complexity")}
                  hint={t(
                    "daily_challenge.hint_complexity",
                    "Does it add detail or join ideas?",
                  )}
                  score={selectedItem.reply.complexityScore}
                />
              </div>
              <div className="flex gap-3 rounded-2xl bg-kin/10 p-4">
                <BulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-kin" />
                <div>
                  <p className="text-sm font-semibold text-sumi">
                    {t("daily_challenge.tip", "Tip")}
                  </p>
                  <p className="mt-0.5 text-sm text-sumi">
                    <BilingualText
                      en={selectedItem.reply.feedback}
                      ja={selectedItem.reply.feedbackJa}
                    />
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-card-border px-6 py-10 text-center">
              <ChartIcon className="h-8 w-8 text-neutral-soft" />
              <p className="text-sm text-sumi-soft">
                {t(
                  "daily_challenge.feedback_empty",
                  "Reply to Charles and you'll get a grammar and natural-phrasing score for every message here.",
                )}
              </p>
            </div>
          )}
        </section>

        <details className="group rounded-3xl border border-card-border bg-washi shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-medium text-sumi [&::-webkit-details-marker]:hidden">
            {t("daily_challenge.how_xp_works", "How XP works")}
            <ChevronIcon className="h-4 w-4 text-sumi-soft transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-card-border px-5 pb-5 pt-4 text-sm text-sumi">
            <ul className="flex flex-col gap-2.5">
              <XpRule
                xp={DAILY_CHALLENGE_FLAWLESS_XP}
                tone="flawless"
                text={t(
                  "daily_challenge.xp_rule_flawless",
                  "10/10 on all four scores",
                )}
              />
              <XpRule
                xp={DAILY_CHALLENGE_PERFECT_XP}
                tone="perfect"
                text={t(
                  "daily_challenge.xp_rule_perfect_all",
                  "10/10 for grammar, natural phrasing and relevance",
                )}
              />
              <XpRule
                xp={DAILY_CHALLENGE_PASS_XP}
                tone="pass"
                text={t(
                  "daily_challenge.xp_rule_pass_all",
                  "{{pass}}+ for all three",
                  {
                    pass: DAILY_CHALLENGE_PASS_SCORE,
                  },
                )}
              />
              <XpRule
                xp={0}
                tone="none"
                text={t("daily_challenge.xp_rule_none", "Anything lower")}
              />
            </ul>
            <p className="mt-3 border-t border-card-border pt-3 text-xs text-sumi-soft">
              {t(
                "daily_challenge.xp_rule_note",
                "Only the message that uses the target is scored. You get {{max}} attempts a day.",
                { max: maxAttemptsPerDay },
              )}
            </p>
          </div>
        </details>
      </aside>
    </div>
  );
}

function TargetBanner({
  target,
  isComplete,
}: {
  target: ChallengeTarget;
  isComplete: boolean;
}) {
  const t = useTranslations();
  const items = [target.vocab, target.grammar].filter(
    (item): item is ChallengeItem => item !== null,
  );

  return (
    <div
      className={cn(
        "mx-4 mt-4 flex items-start gap-3 rounded-2xl p-4 transition-colors sm:mx-5",
        isComplete ? "bg-matcha/15" : "bg-matcha-soft/70",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-washi/70 text-matcha-dark">
        {isComplete ? (
          <CheckIcon className="h-5 w-5" />
        ) : (
          <TargetIcon className="h-6 w-6" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-matcha-dark">
          {isComplete
            ? t(
                "daily_challenge.target_done",
                "Target used — challenge complete",
              )
            : items.length > 1
              ? t("daily_challenge.target_both", "Use both in one reply")
              : t("daily_challenge.target_one", "Use this in a reply")}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          {items.map((item, index) => (
            <div key={item.term} className="flex items-center gap-3">
              {index > 0 && <span className="text-matcha-dark/60">+</span>}
              <div title={item.explanation ?? undefined}>
                <p className="font-semibold text-sumi">“{item.term}”</p>
                <p className="text-sm text-sumi-soft">{item.translation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompletionCard({
  completion,
  finalItem,
  showBetterVersion,
  hasMoreAttempts,
  isAdvancing,
  onNext,
}: {
  completion: ChallengeCompletion;
  finalItem: FeedbackItem;
  showBetterVersion: boolean;
  hasMoreAttempts: boolean;
  isAdvancing: boolean;
  onNext: () => void;
}) {
  const t = useTranslations();
  const summary = finalItem.reply.summary;
  const isFlawless = completion.xpEarned === DAILY_CHALLENGE_FLAWLESS_XP;
  const isPerfect = completion.xpEarned === DAILY_CHALLENGE_PERFECT_XP;

  return (
    <section className="flex flex-col gap-4 overflow-hidden rounded-3xl border border-card-border bg-washi shadow-sm">
      <div
        className={cn(
          "flex flex-col items-center gap-1 px-5 pb-4 pt-6 text-center",
          isFlawless || isPerfect
            ? "bg-kin/15"
            : completion.xpEarned > 0
              ? "bg-matcha-soft/60"
              : "bg-washi-soft",
        )}
      >
        <span className="text-3xl" aria-hidden>
          {isFlawless
            ? "🌟"
            : isPerfect
              ? "🏆"
              : completion.xpEarned > 0
                ? "🎉"
                : "🌱"}
        </span>
        <p className="text-xl font-semibold text-sumi">
          {isFlawless
            ? t("daily_challenge.result_flawless", "Flawless! +{{xp}} XP", {
                xp: completion.xpEarned,
              })
            : isPerfect
              ? t("daily_challenge.result_perfect", "Perfect! +{{xp}} XP", {
                  xp: completion.xpEarned,
                })
              : completion.xpEarned > 0
                ? t("daily_challenge.result_pass", "Nice work! +{{xp}} XP", {
                    xp: completion.xpEarned,
                  })
                : t(
                    "daily_challenge.result_none",
                    "Challenge done — no XP this time",
                  )}
        </p>
      </div>

      {summary && (
        <div className="flex flex-col gap-4 px-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
              {t("daily_challenge.summary_how_you_did", "How you did")}
            </h3>
            <p className="mt-1 text-sm text-sumi">
              <BilingualText en={summary.overall} ja={summary.overallJa} />
            </p>
          </section>

          {showBetterVersion && (
            <section className="rounded-2xl bg-washi-soft p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
                {t(
                  "daily_challenge.summary_better_version",
                  "A more natural way to say it",
                )}
              </h3>
              <p className="mt-2 text-sm text-sumi-soft line-through decoration-sumi-soft/50">
                {finalItem.userText}
              </p>
              <p className="mt-1 font-medium text-ai">
                {summary.betterVersion}
              </p>
            </section>
          )}

          {summary.tips.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-sumi-soft">
                {t("daily_challenge.summary_tips", "What to work on")}
              </h3>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-sumi">
                {summary.tips.map((tip, index) => (
                  <li key={tip} className="flex gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-matcha"
                      aria-hidden
                    />
                    <BilingualText en={tip} ja={summary.tipsJa[index]} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="flex justify-center px-5 pb-5">
        {hasMoreAttempts ? (
          <Button
            variant="secondary"
            disabled={isAdvancing}
            onClick={onNext}
            fullWidth
          >
            {t("daily_challenge.next", "Next challenge")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={isAdvancing}
            onClick={onNext}
            fullWidth
          >
            {t("daily_challenge.see_summary", "See today's summary")}
          </Button>
        )}
      </div>
    </section>
  );
}

function Avatar({ role }: { role: Message["role"] }) {
  return (
    <Image
      src={role === "user" ? "/images/mascot.png" : "/images/charles.webp"}
      alt=""
      width={64}
      height={64}
      className="h-9 w-9 shrink-0 rounded-full border border-card-border bg-washi-soft object-cover"
    />
  );
}

function ScoreTile({
  label,
  hint,
  score,
}: {
  label: string;
  hint: string;
  score: number;
}) {
  return (
    <div
      className="rounded-2xl border border-card-border px-4 py-3"
      title={hint}
    >
      <p className="text-sm text-sumi-soft">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          scoreTone(score).text,
        )}
      >
        {score}
        <span className="text-base font-semibold opacity-70">/10</span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-washi-soft"
        aria-hidden
      >
        <div
          className={cn("h-full rounded-full", scoreTone(score).dot)}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-snug text-sumi-soft">{hint}</p>
    </div>
  );
}

function XpRule({
  xp,
  tone,
  text,
}: {
  xp: number;
  tone: "flawless" | "perfect" | "pass" | "none";
  text: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "w-14 shrink-0 rounded-full py-0.5 text-center text-xs font-semibold",
          tone === "flawless" && "bg-kin text-ink-on-light",
          tone === "perfect" && "bg-kin/20 text-sumi",
          tone === "pass" && "bg-matcha-soft text-matcha-dark",
          tone === "none" && "bg-washi-soft text-sumi-soft",
        )}
      >
        +{xp} XP
      </span>
      <span>{text}</span>
    </li>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  className,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-washi-soft hover:text-sumi disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <ChevronIcon className={cn("h-4 w-4", className)} />
    </button>
  );
}

type IconProps = { className?: string };

function ChevronIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <rect x="3" y="10" width="3" height="7" rx="1" />
      <rect x="8.5" y="5" width="3" height="12" rx="1" />
      <rect x="14" y="8" width="3" height="9" rx="1" />
    </svg>
  );
}

function TargetIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={className}
      aria-hidden
    >
      <path
        d="m4.5 10.5 3.5 3.5 7.5-8"
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
