"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { skipWord, startLearnSession } from "@/lib/actions/vocab";
import type { RevealWord } from "@/lib/definitions";
import { SpeakButton, ProgressDots } from "@/components/vocab/session-ui";
import { WordImage } from "@/components/ui/word-image";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { useTranslations } from "@/components/i18n/locale-provider";

type LearnSessionProps = {
  // Pooled from every active deck, vocab and grammar together (see
  // `getLearnQueueForCourse` in lib/dal.ts) — each word carries its own
  // `path`, since a batch can mix the two. For grammar, `path` drops the
  // image panel (grammar points don't have one) and adjusts copy —
  // otherwise identical: a grammar point is just a `Word` row whose
  // term/translation/explanation/examples happen to hold a structure, its
  // Japanese meaning, its English meaning, and a few instantiated example
  // sentences instead of a vocabulary word's usual content (see the note on
  // `LanguageDeck.path` in lib/dal.ts). Batched in threes just like vocab
  // (see SET_SIZE in lib/srs.ts) — one languageDeck just happens to be one
  // structure instead of one word.
  words: RevealWord[];
  courseSlug: string;
};

export const LearnSession = ({ words, courseSlug }: LearnSessionProps) => {
  const t = useTranslations();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [refreshing, startRefresh] = useTransition();
  const [started, setStarted] = useState(false);

  // The learn page only *picks* this batch (it's read-only so it can be
  // prefetched) — mounting is what commits it: progress rows, first review
  // due, streak. The quiz reads those rows, so "Start quiz" waits on this.
  useEffect(() => {
    let cancelled = false;

    startLearnSession(
      courseSlug,
      words.map((word) => word.id),
    )
      .catch((error) => console.error("Failed to start learn session:", error))
      .finally(() => {
        if (!cancelled) {
          setStarted(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseSlug, words]);

  const advance = () => {
    if (index + 1 < words.length) {
      setIndex((current) => current + 1);
    } else {
      setDone(true);
    }
  };

  const handleSkip = async (wordId: string) => {
    setPending(true);

    try {
      await skipWord(wordId);
      setSkippedIds((current) => [...current, wordId]);
      advance();
    } finally {
      setPending(false);
    }
  };

  // The "learn more" href is this same /learn URL — a plain <Link> to a
  // route you're already on is a no-op in Next.js (it never re-fetches),
  // so clicking it would silently do nothing. `router.refresh()` forces a
  // fresh request instead, re-running getLearnQueue server-side for the
  // next batch; the parent page passes the result back down as a new
  // `words` array, keyed so this component remounts with fresh state (see
  // the `key` on <LearnSession> in learn/page.tsx).
  const handleLearnMore = () => {
    startRefresh(() => {
      router.refresh();
    });
  };

  if (done) {
    // The quiz covers exactly this batch — minus anything skipped, which
    // goes straight to Mastered — not every learnt-but-unquizzed word (see
    // `wordIds` on `getTestQueueForCourse` in lib/dal.ts).
    const learntIds = words.map((w) => w.id).filter((id) => !skippedIds.includes(id));
    const quizHref = `/dashboard/courses/${courseSlug}/test?words=${learntIds.join(",")}`;

    return (
      <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl border border-card-border bg-washi-soft px-6 py-14 text-center shadow-sm sm:px-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-matcha-soft text-3xl text-matcha-dark">
          ✓
        </span>

        <PageTitle className="mt-5">{t("learn_session.nicely_done", "Nicely done!")}</PageTitle>

        <PageSubtitle className="mt-2 max-w-sm">
          {learntIds.length > 0
            ? t("learn_session.ready_for_quiz", "Now let's see how well they stuck.")
            : t("learn_session.all_skipped", "You skipped them all — nothing to quiz this time.")}
        </PageSubtitle>

        <div className="mt-7 flex w-full flex-col gap-3">
          {learntIds.length > 0 ? (
            started ? (
              <Button
                href={quizHref}
                size="lg"
                fullWidth
                className="shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              >
                {t("learn_session.start_quiz", "Start quiz")}
              </Button>
            ) : (
              <Button disabled size="lg" fullWidth>
                {t("common.loading", "Loading…")}
              </Button>
            )
          ) : (
            <Button
              disabled={refreshing}
              onClick={handleLearnMore}
              size="lg"
              fullWidth
              className="shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0"
            >
              {refreshing
                ? t("common.loading", "Loading…")
                : t("learn_session.learn_more", "Learn more")}
            </Button>
          )}
        </div>
      </section>
    );
  }

  const word = words[index];
  const isGrammar = word.path === "grammar";

  const wordCard = (
    <div className="flex flex-col items-center gap-6 md:items-start">
      <div className="w-full rounded-3xl border border-card-border bg-washi-soft p-7 text-center shadow-sm sm:p-9">
        <div className="flex items-center justify-center gap-3">
          <p
            className={`font-semibold tracking-tight text-sumi ${isGrammar ? "text-2xl sm:text-3xl" : "text-4xl"}`}
          >
            {word.term}
          </p>

          {!isGrammar && <SpeakButton text={word.term} language={word.targetLanguage} />}
        </div>

        {word.romanization && <p className="mt-2 text-lg text-sumi-soft">{word.romanization}</p>}

        <div className="mx-auto my-5 h-px w-12 bg-sumi/10" />

        <p className="text-2xl font-medium text-ai-dark">{word.translation}</p>

        {(word.explanation || word.explanationJa) && (
          <div className="mt-5 space-y-1">
            {word.explanation && <p className="text-sumi-soft">{word.explanation}</p>}
            {word.explanationJa && <p className="text-sumi-soft">{word.explanationJa}</p>}
          </div>
        )}

        {!isGrammar && word.exampleSentence && (
          <div className="mt-6 rounded-2xl bg-washi px-5 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sumi-soft">
              {t("learn_session.example", "Example")}
            </p>

            <p className="leading-relaxed text-sumi">{word.exampleSentence}</p>
          </div>
        )}
      </div>

      {!isGrammar && word.forms.length > 0 && (
        <div className="w-full rounded-3xl border border-card-border bg-washi-soft p-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sumi-soft">
            {t("learn_session.forms", "Forms")}
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {word.forms.map((form) => (
              <div key={form.id} className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-sumi-soft">
                  {form.labelEn}
                  <span className="opacity-70"> / {form.labelJa}</span>
                </dt>
                <dd className="font-medium text-sumi">{form.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {word.examples.length > 0 && (
        <div className="w-full rounded-3xl border border-card-border bg-washi-soft p-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sumi-soft">
            {t("learn_session.example_sentences", "Example sentences")}
          </p>
          <ul className="flex flex-col gap-3">
            {word.examples.map((example) => (
              <li key={example.id} className="text-sm">
                <p className="text-sumi">{example.en}</p>
                <p className="text-sumi-soft">{example.ja}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        <Button
          disabled={pending}
          onClick={advance}
          size="lg"
          fullWidth
          className="shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0"
        >
          {index + 1 < words.length
            ? isGrammar
              ? t("learn_session.got_it_next_point", "Got it — next point")
              : t("learn_session.got_it_next_word", "Got it — next word")
            : t("learn_session.got_it_done", "Got it — done for now")}
        </Button>

        <button
          type="button"
          disabled={pending}
          onClick={() => handleSkip(word.id)}
          className="inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium text-sumi-soft transition hover:bg-sumi/5 hover:text-sumi disabled:opacity-60"
        >
          {t("learn_session.skip", "I already know this — skip it")}
        </button>
      </div>
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-ai-soft px-4 py-1.5 text-sm font-medium text-ai-dark">
          {isGrammar
            ? t("learn_session.new_grammar_point", "A new grammar point")
            : t("learn_session.new_word", "A new word to learn")}
        </span>

        <p className="text-sm text-sumi-soft">
          {isGrammar
            ? t("learn_session.point_progress", "Point {{current}} of {{total}}", {
                current: index + 1,
                total: words.length,
              })
            : t("learn_session.word_progress", "Word {{current}} of {{total}}", {
                current: index + 1,
                total: words.length,
              })}
        </p>
        <ProgressDots current={index + 1} total={words.length} />
      </div>

      {isGrammar ? (
        <div className="mx-auto max-w-2xl">{wordCard}</div>
      ) : (
        <div className="grid items-start gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
          <div className="flex min-h-72 items-center justify-center rounded-3xl bg-washi-soft p-6 sm:min-h-96 sm:p-8">
            <WordImage
              src={word.image}
              alt={word.term}
              className="max-h-[440px] w-full object-contain"
            />
          </div>
          {wordCard}
        </div>
      )}
    </section>
  );
};
