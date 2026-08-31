"use client";

import { useState } from "react";
import Link from "next/link";
import { submitAnswer, skipWord } from "@/lib/actions/vocab";
import type { QuizOption, QuizQuestion, RevealWord } from "@/lib/definitions";
import { useSpeech } from "@/lib/speech";

type PracticeSessionProps = {
  reveals: RevealWord[];
  quiz: QuizQuestion[];
  courseSlug: string;
};

type Phase = "reveal" | "quiz" | "summary";

// Study-card images are looked up by naming convention (see `lib/images.ts`)
// and no real assets exist yet — hide gracefully instead of showing a
// broken-image icon if the file 404s.
function WordImage({ src, alt }: { src: string; alt: string }) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- placeholder path may 404; next/image can't degrade gracefully like this.
    <img
      src={src}
      alt={alt}
      onError={() => setHidden(true)}
      className="mx-auto mb-4 h-24 w-24 rounded-xl object-cover"
    />
  );
}

function SpeakButton({ text, language }: { text: string; language: string }) {
  const { speak, speaking } = useSpeech();

  return (
    <button
      type="button"
      onClick={() => speak(text, language)}
      aria-label="Read aloud"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ai transition hover:bg-ai-soft disabled:opacity-60"
      disabled={speaking}
    >
      {speaking ? "…" : "🔊"}
    </button>
  );
}

export function PracticeSession({ reveals, quiz, courseSlug }: PracticeSessionProps) {
  const [phase, setPhase] = useState<Phase>(
    reveals.length > 0 ? "reveal" : quiz.length > 0 ? "quiz" : "summary",
  );
  const [revealIndex, setRevealIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    selected: string;
    correct: boolean;
    correctAnswer: string;
  } | null>(null);
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });

  function advanceFromReveal() {
    setFeedback(null);
    if (revealIndex + 1 < reveals.length) {
      setRevealIndex(revealIndex + 1);
    } else if (quiz.length > 0) {
      setPhase("quiz");
    } else {
      setPhase("summary");
    }
  }

  async function handleSkip(wordId: string) {
    setPending(true);
    await skipWord(wordId);
    setPending(false);
    advanceFromReveal();
  }

  async function handleAnswer(question: QuizQuestion, option: QuizOption) {
    if (feedback || pending) return;

    setPending(true);
    const result = await submitAnswer(question.wordId, question.direction, option.text);
    setPending(false);
    setFeedback({
      selected: option.text,
      correct: result.correct,
      correctAnswer: result.correctAnswer,
    });
    setScore((prev) => ({
      correct: prev.correct + (result.correct ? 1 : 0),
      incorrect: prev.incorrect + (result.correct ? 0 : 1),
    }));
  }

  function advanceFromQuiz() {
    setFeedback(null);
    if (quizIndex + 1 < quiz.length) {
      setQuizIndex(quizIndex + 1);
    } else {
      setPhase("summary");
    }
  }

  if (phase === "reveal") {
    const word = reveals[revealIndex];

    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-sm text-sumi-soft">
          New word {revealIndex + 1} of {reveals.length}
        </p>
        <div className="w-full max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8 text-center">
          <WordImage src={word.image} alt={word.term} />
          <p className="text-3xl font-semibold text-sumi">{word.term}</p>
          {word.romanization && (
            <p className="mt-1 text-sm text-sumi-soft">{word.romanization}</p>
          )}
          <p className="mt-2 text-xl text-ai-dark">{word.translation}</p>
          {word.exampleSentence && (
            <p className="mt-4 text-sm text-sumi-soft">{word.exampleSentence}</p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={advanceFromReveal}
            className="inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark disabled:opacity-60"
          >
            Got it
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleSkip(word.id)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi disabled:opacity-60"
          >
            I already know this — skip
          </button>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    const question = quiz[quizIndex];
    // Exactly one side of a question shows the target language (the word
    // being learned) — the other always shows the learner's base language.
    // Read-aloud only ever offers the target-language side, never the base
    // language, so it moves between the prompt and the options depending on
    // which way this question happens to be testing.
    const promptIsTargetLanguage = question.direction === "term-to-translation";

    return (
      <div className="flex flex-col items-center gap-6">
        <p className="text-sm text-sumi-soft">
          Review {quizIndex + 1} of {quiz.length}
        </p>
        <div className="w-full max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8 text-center">
          <p className="text-xs uppercase tracking-wide text-sumi-soft">
            {question.direction === "term-to-translation"
              ? "What does this mean?"
              : "What's the word?"}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="text-3xl font-semibold text-sumi">{question.prompt}</p>
            {promptIsTargetLanguage && (
              <SpeakButton text={question.prompt} language={question.targetLanguage} />
            )}
          </div>
          {question.promptRomanization && (
            <p className="mt-1 text-sm text-sumi-soft">{question.promptRomanization}</p>
          )}
        </div>

        <div className="grid w-full max-w-sm grid-cols-1 gap-3">
          {question.options.map((option) => {
            const isSelected = feedback?.selected === option.text;
            const isCorrectOption = feedback && option.text === feedback.correctAnswer;

            let style = "border-sumi/15 hover:border-ai/40 text-sumi";
            if (feedback && isCorrectOption) {
              style = "border-matcha bg-matcha-soft text-matcha-dark";
            } else if (feedback && isSelected && !feedback.correct) {
              style = "border-shu bg-shu/5 text-shu-dark";
            }

            return (
              <div key={option.text} className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition ${style}`}>
                <button
                  type="button"
                  disabled={pending || Boolean(feedback)}
                  onClick={() => handleAnswer(question, option)}
                  className="flex-1 text-left font-medium disabled:cursor-not-allowed"
                >
                  {option.text}
                  {option.romanization && (
                    <span className="block text-xs font-normal opacity-70">
                      {option.romanization}
                    </span>
                  )}
                </button>
                {!promptIsTargetLanguage && (
                  <SpeakButton text={option.text} language={question.targetLanguage} />
                )}
              </div>
            );
          })}
        </div>

        {feedback && (
          <button
            type="button"
            onClick={advanceFromQuiz}
            className="inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark"
          >
            Continue
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-sumi/10 bg-washi-soft px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-xl font-semibold text-ai-dark">
        ✓
      </span>
      <h1 className="text-xl font-semibold text-sumi">Nice work today</h1>
      {(score.correct > 0 || score.incorrect > 0) && (
        <p className="text-sumi-soft">
          {score.correct} correct · {score.incorrect} to review again
        </p>
      )}
      <Link
        href={`/dashboard/courses/${courseSlug}/vocab`}
        className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
      >
        Back to vocabulary
      </Link>
    </div>
  );
}
