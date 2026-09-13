"use client";

import { useState } from "react";
import Link from "next/link";
import { skipWord } from "@/lib/actions/vocab";
import type { RevealWord } from "@/lib/definitions";
import { SpeakButton, ProgressDots } from "@/components/vocab/session-ui";
import { WordImage } from "@/components/ui/word-image";

type LearnSessionProps = {
  words: RevealWord[];
  courseSlug: string;
  deckId: string;
};

export const LearnSession = ({ words, courseSlug, deckId }: LearnSessionProps) => {
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

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
      advance();
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl border border-sumi/10 bg-washi-soft px-6 py-14 text-center shadow-sm sm:px-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-matcha-soft text-3xl text-matcha-dark">
          ✓
        </span>

        <h1 className="mt-5 text-2xl font-semibold text-sumi">Nicely done!</h1>

        <p className="mt-2 max-w-sm text-sumi-soft">
          These new words are ready for you in Test yourself.
        </p>

        <div className="mt-7 flex w-full flex-col gap-3">
          <Link
            href={`/dashboard/courses/${courseSlug}/decks/${deckId}/learn`}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md"
          >
            Learn more words
          </Link>
          <Link
            href={`/dashboard/courses/${courseSlug}/decks/${deckId}/test`}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
          >
            Test yourself
          </Link>
          <Link
            href={`/dashboard/courses/${courseSlug}/decks/${deckId}`}
            className="inline-flex h-11 w-full items-center justify-center px-6 text-sm font-medium text-sumi-soft transition hover:text-sumi"
          >
            Back to deck
          </Link>
        </div>
      </section>
    );
  }

  const word = words[index];

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-ai-soft px-4 py-1.5 text-sm font-medium text-ai-dark">
          A new word to learn
        </span>

        <p className="text-sm text-sumi-soft">
          Word {index + 1} of {words.length}
        </p>

        <ProgressDots current={index + 1} total={words.length} />
      </div>

      <div className="grid items-start gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
        <div className="flex min-h-72 items-center justify-center rounded-3xl bg-washi-soft p-6 sm:min-h-96 sm:p-8">
          <WordImage
            src={word.image}
            alt={word.term}
            className="max-h-[440px] w-full object-contain"
          />
        </div>

        <div className="flex flex-col items-center gap-6 md:items-start">
          <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-7 text-center shadow-sm sm:p-9">
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-semibold tracking-tight text-sumi">
                {word.term}
              </p>

              <SpeakButton text={word.term} language={word.targetLanguage} />
            </div>

            {word.romanization && (
              <p className="mt-2 text-lg text-sumi-soft">{word.romanization}</p>
            )}

            <div className="mx-auto my-5 h-px w-12 bg-sumi/10" />

            <p className="text-2xl font-medium text-ai-dark">{word.translation}</p>

            {(word.explanation || word.explanationJa) && (
              <div className="mt-5 space-y-1">
                {word.explanation && (
                  <p className="text-sumi-soft">{word.explanation}</p>
                )}
                {word.explanationJa && (
                  <p className="text-sumi-soft">{word.explanationJa}</p>
                )}
              </div>
            )}

            {word.exampleSentence && (
              <div className="mt-6 rounded-2xl bg-washi px-5 py-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sumi-soft">
                  Example
                </p>

                <p className="leading-relaxed text-sumi">{word.exampleSentence}</p>
              </div>
            )}
          </div>

          {word.forms.length > 0 && (
            <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sumi-soft">
                Forms
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
            <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-sumi-soft">
                Example sentences
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
            <button
              type="button"
              disabled={pending}
              onClick={advance}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md disabled:translate-y-0 disabled:opacity-60"
            >
              {index + 1 < words.length ? "Got it — next word" : "Got it — done for now"}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => handleSkip(word.id)}
              className="inline-flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-medium text-sumi-soft transition hover:bg-sumi/5 hover:text-sumi disabled:opacity-60"
            >
              I already know this — skip it
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
