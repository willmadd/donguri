"use client";

import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
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
  DAILY_CHALLENGE_BASE_XP,
  DAILY_CHALLENGE_MAX_TOTAL,
  DAILY_CHALLENGE_PERFECT_BONUS_XP,
  DAILY_CHALLENGE_XP_THRESHOLD,
  dailyChallengeTotal,
  dailyChallengeXp,
} from "@/lib/srs";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { scoreTone } from "@/components/vocab/challenge-score";
import { BilingualText } from "@/components/vocab/bilingual-text";
import { RainbowAvatar } from "@/components/donguri/rainbow-avatar";
import { ScoreBar } from "@/components/vocab/score-bar";
import type { AccessoryId } from "@/lib/levels";

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
  equippedAccessory,
  heading,
  emptyState,
}: Attempt & {
  courseSlug: string;
  equippedAccessory: AccessoryId | null;
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
      equippedAccessory={equippedAccessory}
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
  equippedAccessory: AccessoryId | null;
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
  equippedAccessory,
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
  const completionRef = useRef<HTMLDivElement>(null);

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

  // The result card appears above the chat, which may be scrolled out of
  // view by then — bring it up.
  useEffect(() => {
    if (completion) {
      completionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [completion]);

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
  const attemptsUsed = completion?.attemptsToday ?? attemptsToday;
  const hasMoreAttempts = attemptsUsed < maxAttemptsPerDay;
  const currentAttempt = Math.min(
    attemptsUsed + (isComplete ? 0 : 1),
    maxAttemptsPerDay,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
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

      {completion && finalItem && (
        <motion.div
          ref={completionRef}
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="scroll-mt-6 lg:col-span-2"
        >
          <CompletionBanner
            completion={completion}
            finalItem={finalItem}
            equippedAccessory={equippedAccessory}
            hasMoreAttempts={hasMoreAttempts}
            isAdvancing={isAdvancing}
            onNext={onAdvance}
          />
        </motion.div>
      )}

      <section className="flex h-144 flex-col overflow-hidden rounded-3xl border border-card-border bg-washi shadow-sm lg:h-168">
            <header className="relative z-10 flex items-center gap-3 border-b border-card-border/70 bg-washi/90 px-4 py-3 backdrop-blur">
              <span className="relative shrink-0">
                <Image
                  src="/images/charles.webp"
                  alt=""
                  width={96}
                  height={96}
                  className="h-11 w-11 rounded-full bg-washi-soft object-cover ring-2 ring-washi"
                />
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-matcha ring-2 ring-washi"
                  aria-hidden
                />
              </span>
              <div className="flex min-w-0 flex-col">
                <p className="font-semibold leading-tight text-sumi">
                  Charles Duck
                </p>
                <p
                  className={cn(
                    "text-xs transition-colors",
                    isCharlesTyping ? "text-ai" : "text-sumi-soft",
                  )}
                >
                  {isCharlesTyping
                    ? t("daily_challenge.typing", "Typing…")
                    : t("daily_challenge.online", "Online now")}
                </p>
              </div>
            </header>

            <TargetBanner target={target} isComplete={isComplete} />

            <MotionConfig reducedMotion="user">
              <div
                ref={scrollRef}
                className="flex flex-1 flex-col gap-3 overflow-y-auto bg-washi-soft/40 px-3 py-4 sm:px-4"
                style={{
                  backgroundImage:
                    "radial-gradient(var(--card-border) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
                aria-live="polite"
              >
                <span className="mx-auto mb-1 rounded-full bg-washi/90 px-3 py-1 text-[11px] font-medium text-sumi-soft shadow-sm">
                  {t("daily_challenge.today", "Today")}
                </span>

                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const feedback = isUser
                    ? feedbackByUserMessage.get(message.id)
                    : undefined;
                  const showTranslation = translatedIds.has(message.id);

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      style={{
                        transformOrigin: isUser
                          ? "bottom right"
                          : "bottom left",
                      }}
                      className={cn(
                        "flex items-end gap-2",
                        isUser && "justify-end",
                      )}
                    >
                      {!isUser && <Avatar />}
                      <div
                        className={cn(
                          "flex max-w-[80%] flex-col gap-1",
                          isUser ? "items-end" : "items-start",
                        )}
                      >
                        <p
                          className={cn(
                            "rounded-[1.25rem] px-4 py-2.5 text-[0.95rem] leading-snug shadow-sm",
                            isUser
                              ? "rounded-br-md bg-linear-to-br from-ai to-ai-dark text-washi shadow-ai/25"
                              : "rounded-bl-md bg-washi text-sumi ring-1 ring-card-border/60",
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
                            "flex items-center gap-2 px-1.5 text-[11px] text-sumi-soft",
                            isUser && "flex-row-reverse",
                          )}
                        >
                          <time
                            dateTime={new Date(message.sentAt).toISOString()}
                          >
                            {timeFormat.format(message.sentAt)}
                          </time>
                          {message.japanese && (
                            <button
                              type="button"
                              onClick={() => toggleTranslation(message.id)}
                              className="rounded-full px-1.5 py-0.5 font-medium transition hover:bg-washi hover:text-sumi"
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
                              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-sm ring-1 transition",
                              feedback.id === selectedItem?.id
                                ? "bg-kin/15 text-sumi ring-kin/60"
                                : "bg-washi text-sumi-soft ring-card-border hover:text-sumi",
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
                    </motion.div>
                  );
                })}

                <AnimatePresence>
                  {isCharlesTyping && (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-end gap-2"
                    >
                      <Avatar />
                      <p
                        className="flex items-center gap-1 rounded-[1.25rem] rounded-bl-md bg-washi px-4 py-3.5 shadow-sm ring-1 ring-card-border/60"
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </MotionConfig>

            {error && (
              <p
                role="alert"
                className="border-t border-shu/20 bg-shu/10 px-4 py-2 text-sm text-shu"
              >
                {error}
              </p>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-card-border/70 bg-washi/90 px-3 py-3 backdrop-blur"
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
                className="h-11 min-w-0 flex-1 rounded-full border border-card-border bg-washi-soft/60 px-4 text-sumi outline-none transition placeholder:text-sumi-soft/70 focus:border-ai/50 focus:bg-washi focus:ring-4 focus:ring-ai/10 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isCharlesTyping || isComplete || !draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ai text-washi shadow-sm transition hover:bg-ai-dark active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-sumi-soft disabled:shadow-none"
              >
                <SendIcon className="h-5 w-5" />
                <span className="sr-only">{t("chat.send", "Send")}</span>
              </button>
            </form>
      </section>

      <aside ref={feedbackRef} className="flex scroll-mt-6 flex-col gap-6">
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
            <FeedbackDetail item={selectedItem} />
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
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <InfoIcon className="h-5 w-5 shrink-0 text-sumi-soft" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-sumi">
                {t("daily_challenge.how_scores_work", "How scores and XP work")}
              </span>
              {selectedItem && (
                <span className="text-xs tabular-nums text-sumi-soft">
                  {t("daily_challenge.xp_total_label", "Total {{total}}/{{max}}", {
                    total: dailyChallengeTotal(selectedItem.reply),
                    max: DAILY_CHALLENGE_MAX_TOTAL,
                  })}
                </span>
              )}
            </span>
            <ChevronIcon className="h-4 w-4 shrink-0 text-sumi-soft transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-4 border-t border-card-border px-5 pb-5 pt-4 text-sm text-sumi">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              {scoreLabels(t).map(({ label, hint }) => (
                <div key={label} className="contents">
                  <dt className="font-medium text-sumi">{label}</dt>
                  <dd className="text-sumi-soft">{hint}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-card-border pt-4">
              <p className="text-sm text-sumi-soft">
                {t(
                  "daily_challenge.xp_rule_intro",
                  "Your four scores are added up to a total out of {{max}}. Finishing always earns {{base}} XP, every point above {{threshold}} adds 1 more, and a perfect {{max}}/{{max}} adds a +{{bonus}} bonus.",
                  {
                    max: DAILY_CHALLENGE_MAX_TOTAL,
                    base: DAILY_CHALLENGE_BASE_XP,
                    threshold: DAILY_CHALLENGE_XP_THRESHOLD,
                    bonus: DAILY_CHALLENGE_PERFECT_BONUS_XP,
                  },
                )}
              </p>
              <XpTable />
            </div>
            <p className="border-t border-card-border pt-3 text-xs text-sumi-soft">
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

  // Pinned under the header, like a pinned message in a chat app.
  return (
    <div
      className={cn(
        "relative z-10 flex items-start gap-3 border-b px-4 py-3 transition-colors",
        isComplete
          ? "border-matcha/30 bg-matcha/15"
          : "border-matcha/20 bg-matcha-soft/60",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-washi/80 text-matcha-dark shadow-sm">
        {isComplete ? (
          <CheckIcon className="h-5 w-5" />
        ) : (
          <TargetIcon className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-matcha-dark">
          {isComplete
            ? t(
                "daily_challenge.target_done",
                "Target used — challenge complete",
              )
            : items.length > 1
              ? t("daily_challenge.target_both", "Use both in one reply")
              : t("daily_challenge.target_one", "Use this in a reply")}
        </p>
        {/* One card per target, the term over its meaning, so a long
            grammar pattern and its explanation wrap inside their own card
            rather than across the whole strip. */}
        <ul className="mt-1.5 flex flex-wrap items-stretch gap-1.5">
          {items.map((item, index) => (
            <li key={item.term} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && (
                <span
                  className="text-sm font-semibold text-matcha-dark/60"
                  aria-hidden
                >
                  +
                </span>
              )}
              <span
                title={item.explanation ?? undefined}
                className="flex min-w-0 flex-col rounded-xl bg-washi/80 px-3 py-1.5 shadow-sm ring-1 ring-matcha/15"
              >
                <strong className="text-sm font-semibold leading-snug text-sumi">
                  {item.term}
                </strong>
                <span className="text-xs leading-snug text-sumi-soft">
                  {item.translation}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Why the attempt earned what it did, readable at a glance: each score as
// a 10-segment bar with the lost points marked, adding up to the total, then
// that total's place on the XP ladder (every total from the threshold up to
// a perfect score, worked out with dailyChallengeXp so it can't drift from
// the real rule). xpEarned is the server's real award.
function XpBreakdown({
  reply,
  xpEarned,
}: {
  reply: ChatReply;
  xpEarned: number;
}) {
  const t = useTranslations();
  const total = dailyChallengeTotal(reply);
  const ladder = Array.from(
    { length: DAILY_CHALLENGE_MAX_TOTAL - DAILY_CHALLENGE_XP_THRESHOLD + 1 },
    (_, i) => DAILY_CHALLENGE_XP_THRESHOLD + i,
  );
  const rung = Math.max(total, DAILY_CHALLENGE_XP_THRESHOLD);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <ul className="grid flex-1 grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
          {scoreLabels(t).map(({ label, field }) => {
            const score = reply[field];
            return (
              <li key={field} className="flex flex-col gap-1.5">
                <p className="flex items-baseline justify-between gap-2 text-xs text-sumi-soft">
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 tabular-nums">
                    <strong className={cn("text-sm", scoreTone(score).text)}>
                      {score}
                    </strong>
                    {score < 10 && (
                      <span className="ml-1 font-semibold text-shu">
                        −{10 - score}
                      </span>
                    )}
                  </span>
                </p>
                <ScoreBar score={score} />
              </li>
            );
          })}
        </ul>
        <p className="shrink-0 self-start rounded-full bg-sumi px-3 py-1 text-sm font-semibold tabular-nums text-washi sm:self-auto">
          = {total}/{DAILY_CHALLENGE_MAX_TOTAL}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-sumi-soft">
          {t("daily_challenge.xp_ladder", "Total → XP")}
        </p>
        <ol
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${ladder.length}, minmax(0, 1fr))`,
          }}
        >
          {ladder.map((step) => {
            const xp =
              step === rung
                ? xpEarned
                : dailyChallengeXp({
                    grammarScore: step,
                    naturalnessScore: 0,
                    relevanceScore: 0,
                    complexityScore: 0,
                  });
            const isYou = step === rung;
            return (
              <li
                key={step}
                aria-current={isYou ? "step" : undefined}
                className={cn(
                  "flex flex-col items-center rounded-xl py-1.5 text-center tabular-nums transition",
                  isYou
                    ? "bg-matcha text-washi shadow-sm ring-2 ring-matcha/30"
                    : step < rung
                      ? "bg-matcha-soft/70 text-matcha-dark"
                      : "bg-washi/60 text-sumi-soft",
                )}
              >
                <span className="text-[11px] opacity-80">
                  {step === DAILY_CHALLENGE_XP_THRESHOLD
                    ? `≤${step}`
                    : step === DAILY_CHALLENGE_MAX_TOTAL
                      ? `${step}★`
                      : step}
                </span>
                <span className="text-sm font-bold">+{xp}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// Shown across the top once the target's been used: the XP earned, a
// one-line verdict and the way on. The full breakdown of how the score
// became XP folds out below; the written feedback lives in the side panel.
function CompletionBanner({
  completion,
  finalItem,
  equippedAccessory,
  hasMoreAttempts,
  isAdvancing,
  onNext,
}: {
  completion: ChallengeCompletion;
  finalItem: FeedbackItem;
  equippedAccessory: AccessoryId | null;
  hasMoreAttempts: boolean;
  isAdvancing: boolean;
  onNext: () => void;
}) {
  const t = useTranslations();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const total = dailyChallengeTotal(finalItem.reply);
  const isPerfect = total === DAILY_CHALLENGE_MAX_TOTAL;
  const isGreat = total >= DAILY_CHALLENGE_MAX_TOTAL - 2;
  const isAboveThreshold = total > DAILY_CHALLENGE_XP_THRESHOLD;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border shadow-sm",
        isPerfect
          ? "border-kin/50 bg-kin/10"
          : "border-matcha/40 bg-matcha-soft/40",
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <RainbowAvatar equippedAccessory={equippedAccessory} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-bold text-sumi">
              {t("daily_challenge.result_title", "Challenge complete")}
              <motion.span
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: [0, 1.25, 1], rotate: [-12, 4, 0] }}
                transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
                className="relative inline-flex overflow-hidden rounded-full bg-kin px-3 py-0.5 text-lg font-extrabold tabular-nums text-ink-on-light shadow-[0_4px_14px_-2px_rgb(255_184_0/0.6)] ring-2 ring-kin/30"
              >
                {t("daily_challenge.xp_gain", "+{{xp}} XP", {
                  xp: completion.xpEarned,
                })}
                {/* One sweep of shine across the badge after it lands. */}
                <motion.span
                  initial={{ x: "-120%" }}
                  animate={{ x: "220%" }}
                  transition={{ delay: 1, duration: 0.9, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-white/60"
                  aria-hidden
                />
              </motion.span>
            </p>
            <p className="text-sm text-sumi-soft">
              {isPerfect
                ? t("daily_challenge.result_line_perfect", "A perfect score!")
                : isGreat
                  ? t("daily_challenge.result_line_great", "Excellent answer!")
                  : isAboveThreshold
                    ? t("daily_challenge.result_line_pass", "Nice work!")
                    : t(
                        "daily_challenge.result_line_done",
                        "Good effort — the tips will help you score higher.",
                      )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowBreakdown((open) => !open)}
          aria-expanded={showBreakdown}
          className="flex shrink-0 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm text-sumi-soft transition hover:bg-washi/70 hover:text-sumi sm:self-auto"
        >
          <strong className="tabular-nums text-sumi">
            {total}/{DAILY_CHALLENGE_MAX_TOTAL}
          </strong>
          <span aria-hidden>·</span>
          {t("daily_challenge.see_xp_breakdown", "See XP breakdown")}
          <ChevronIcon
            className={cn(
              "h-4 w-4 transition-transform",
              showBreakdown && "rotate-180",
            )}
          />
        </button>

        <Button
          variant="secondary"
          disabled={isAdvancing}
          onClick={onNext}
          className="shrink-0 sm:min-w-48"
        >
          {hasMoreAttempts
            ? t("daily_challenge.next", "Next challenge")
            : t("daily_challenge.see_summary", "See today's summary")}
          <ChevronIcon className="h-4 w-4 -rotate-90" />
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showBreakdown && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-card-border/70 px-5 py-4 sm:px-6">
              <XpBreakdown
                reply={finalItem.reply}
                xpEarned={completion.xpEarned}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// One reply's feedback, read top to bottom: what the learner wrote, a
// better version (final reply only), the tips, the overall verdict (final
// reply only), then the four scores.
function FeedbackDetail({ item }: { item: FeedbackItem }) {
  const t = useTranslations();
  const { reply, userText } = item;
  const summary = reply.summary;
  const betterVersion =
    summary &&
    summary.betterVersion.trim().toLowerCase() !==
      userText.trim().toLowerCase()
      ? summary.betterVersion
      : null;

  // The per-reply tip first, then the end-of-attempt ones, minus any the
  // model repeated.
  const tips = [{ en: reply.feedback, ja: reply.feedbackJa }];
  summary?.tips.forEach((tip, index) => {
    if (!tips.some(({ en }) => en.trim() === tip.trim())) {
      tips.push({ en: tip, ja: summary.tipsJa[index] ?? null });
    }
  });

  return (
    <>
      <div className="flex flex-col">
        <div className="rounded-2xl bg-washi-soft px-4 py-3">
          <p className="text-xs text-sumi-soft">
            {t("daily_challenge.you_wrote", "You wrote")}
          </p>
          <p className="mt-0.5 text-sumi">{userText}</p>
        </div>
        {betterVersion && (
          <>
            <span className="relative z-10 mx-auto -my-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-washi text-sumi-soft ring-1 ring-card-border">
              <ArrowDownIcon className="h-4 w-4" />
            </span>
            <div className="rounded-2xl bg-ai-soft/70 px-4 py-3">
              <p className="text-xs font-semibold text-ai">
                {t("daily_challenge.try_this", "Try")}
              </p>
              <p className="mt-0.5 font-semibold text-ai">{betterVersion}</p>
            </div>
          </>
        )}
      </div>

      <ul className="flex flex-col gap-3 rounded-2xl bg-kin/10 p-4">
        {tips.map((tip) => (
          <li key={tip.en} className="flex gap-3 text-sm text-sumi">
            <BulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-kin" />
            <BilingualText en={tip.en} ja={tip.ja} />
          </li>
        ))}
      </ul>

      {summary && (
        <div className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-matcha text-washi">
            <CheckIcon className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium text-sumi">
            <BilingualText en={summary.overall} ja={summary.overallJa} />
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-card-border pt-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        {scoreLabels(t).map(({ label, hint, field }) => (
          <ScoreTile
            key={field}
            label={label}
            hint={hint}
            score={reply[field]}
          />
        ))}
      </div>
    </>
  );
}

// The four scores in display order, with what each one asks.
function scoreLabels(t: ReturnType<typeof useTranslations>) {
  return [
    {
      field: "grammarScore",
      label: t("daily_challenge.summary_grammar", "Grammar"),
      hint: t("daily_challenge.hint_grammar", "Is it correct?"),
    },
    {
      field: "naturalnessScore",
      label: t("daily_challenge.summary_naturalness", "Natural phrasing"),
      hint: t(
        "daily_challenge.hint_naturalness",
        "Would a native speaker say it?",
      ),
    },
    {
      field: "relevanceScore",
      label: t("daily_challenge.summary_relevance", "Relevance"),
      hint: t("daily_challenge.hint_relevance", "Does it answer Charles?"),
    },
    {
      field: "complexityScore",
      label: t("daily_challenge.summary_complexity", "Complexity"),
      hint: t(
        "daily_challenge.hint_complexity",
        "Does it add detail or join ideas?",
      ),
    },
  ] as const;
}

function Avatar() {
  return (
    <Image
      src="/images/charles.webp"
      alt=""
      width={64}
      height={64}
      className="h-8 w-8 shrink-0 rounded-full bg-washi-soft object-cover shadow-sm ring-2 ring-washi"
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
      className="rounded-2xl border border-card-border px-3 py-2.5"
      title={hint}
    >
      <p className="truncate text-xs text-sumi-soft">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xl font-bold tabular-nums",
          scoreTone(score).text,
        )}
      >
        {score}
        <span className="text-sm font-semibold opacity-70">/10</span>
      </p>
    </div>
  );
}

// One row per total from a perfect score down to the threshold, then a
// catch-all row, all computed with dailyChallengeXp so it can't drift from
// the real rule.
function XpTable() {
  const t = useTranslations();
  const totals = Array.from(
    { length: DAILY_CHALLENGE_MAX_TOTAL - DAILY_CHALLENGE_XP_THRESHOLD + 1 },
    (_, i) => DAILY_CHALLENGE_MAX_TOTAL - i,
  );

  return (
    <table className="mt-3 w-full text-sm">
      <thead className="text-xs text-sumi-soft">
        <tr>
          <th className="pb-1.5 text-left font-medium">
            {t("daily_challenge.xp_table_total", "Total")}
          </th>
          <th className="pb-1.5 text-right font-medium">XP</th>
        </tr>
      </thead>
      <tbody>
        {totals.map((total) => {
          const isThreshold = total === DAILY_CHALLENGE_XP_THRESHOLD;
          const xp = dailyChallengeXp({
            grammarScore: total,
            naturalnessScore: 0,
            relevanceScore: 0,
            complexityScore: 0,
          });
          return (
            <tr key={total} className="border-t border-card-border/60">
              <td className="py-1.5 tabular-nums text-sumi">
                {isThreshold
                  ? t("daily_challenge.xp_table_or_less", "{{total}} or less", {
                      total,
                    })
                  : `${total}/${DAILY_CHALLENGE_MAX_TOTAL}`}
              </td>
              <td className="py-1.5 text-right">
                <span
                  className={cn(
                    "inline-block min-w-14 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums",
                    total === DAILY_CHALLENGE_MAX_TOTAL
                      ? "bg-kin text-ink-on-light"
                      : isThreshold
                        ? "bg-washi-soft text-sumi-soft"
                        : "bg-matcha-soft text-matcha-dark",
                  )}
                >
                  +{xp} XP
                </span>
                {total === DAILY_CHALLENGE_MAX_TOTAL && (
                  <span className="ml-1.5 text-xs text-sumi-soft">
                    {t(
                      "daily_challenge.xp_table_bonus",
                      "incl. +{{bonus}} bonus",
                      {
                        bonus: DAILY_CHALLENGE_PERFECT_BONUS_XP,
                      },
                    )}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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

function SendIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M3.1 2.3a.75.75 0 0 0-1 .92l1.9 5.9a1 1 0 0 0 .92.69H11a.75.75 0 0 1 0 1.5H4.92a1 1 0 0 0-.92.69l-1.9 5.9a.75.75 0 0 0 1 .92l15-7.1a.75.75 0 0 0 0-1.36l-15-7.1Z" />
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

function InfoIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM9 9.5a1 1 0 0 1 2 0v4.5a1 1 0 1 1-2 0V9.5Z" />
    </svg>
  );
}
