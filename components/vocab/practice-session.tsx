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

type WordImageProps = {
  src: string;
  alt: string;
  className?: string;
};

const WordImage = ({ src, alt, className = "" }: WordImageProps) => {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- images may not exist yet and need to fail gracefully.
    <img
      src={src}
      alt={alt}
      onError={() => setHidden(true)}
      className={className}
    />
  );
};

const SpeakButton = ({
  text,
  language,
}: {
  text: string;
  language: string;
}) => {
  const { speak, speaking } = useSpeech();

  return (
    <button
      type="button"
      onClick={() => speak(text, language)}
      aria-label={`Listen to ${text}`}
      disabled={speaking}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-soft text-lg text-ai transition hover:scale-105 hover:bg-ai/15 disabled:opacity-60"
    >
      {speaking ? "…" : "🔊"}
    </button>
  );
};

const ProgressDots = ({
  current,
  total,
}: {
  current: number;
  total: number;
}) => (
  <div
    className="flex items-center justify-center gap-2"
    role="progressbar"
    aria-valuemin={1}
    aria-valuemax={total}
    aria-valuenow={current}
  >
    {Array.from({ length: total }).map((_, index) => (
      <span
        key={index}
        className={`h-2 rounded-full transition-all ${
          index + 1 === current
            ? "w-7 bg-ai"
            : index + 1 < current
              ? "w-2 bg-ai/40"
              : "w-2 bg-sumi/10"
        }`}
      />
    ))}
  </div>
);

export const PracticeSession = ({
  reveals,
  quiz,
  courseSlug,
}: PracticeSessionProps) => {
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

  const [score, setScore] = useState({
    correct: 0,
    incorrect: 0,
  });

  const advanceFromReveal = () => {
    setFeedback(null);

    if (revealIndex + 1 < reveals.length) {
      setRevealIndex((current) => current + 1);
    } else if (quiz.length > 0) {
      setPhase("quiz");
    } else {
      setPhase("summary");
    }
  };

  const handleSkip = async (wordId: string) => {
    setPending(true);

    try {
      await skipWord(wordId);
      advanceFromReveal();
    } finally {
      setPending(false);
    }
  };

  const handleAnswer = async (question: QuizQuestion, option: QuizOption) => {
    if (feedback || pending) return;

    setPending(true);

    try {
      const result = await submitAnswer(
        question.wordId,
        question.direction,
        option.text,
      );

      setFeedback({
        selected: option.text,
        correct: result.correct,
        correctAnswer: result.correctAnswer,
      });

      setScore((current) => ({
        correct: current.correct + (result.correct ? 1 : 0),
        incorrect: current.incorrect + (result.correct ? 0 : 1),
      }));
    } finally {
      setPending(false);
    }
  };

  const advanceFromQuiz = () => {
    setFeedback(null);

    if (quizIndex + 1 < quiz.length) {
      setQuizIndex((current) => current + 1);
    } else {
      setPhase("summary");
    }
  };

  if (phase === "reveal") {
    const word = reveals[revealIndex];

    return (
      <section className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-ai-soft px-4 py-1.5 text-sm font-medium text-ai-dark">
            A new word to learn
          </span>

          <p className="text-sm text-sumi-soft">
            Word {revealIndex + 1} of {reveals.length}
          </p>

          <ProgressDots current={revealIndex + 1} total={reveals.length} />
        </div>

        <div className="grid items-center gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
          <div className="flex min-h-72 items-center justify-center rounded-3xl bg-washi-soft p-6 sm:min-h-96 sm:p-8">
            <WordImage
              src={word.image}
              alt={word.term}
              className="max-h-[440px] w-full object-contain"
            />
          </div>

          <div className="flex flex-col items-center md:items-start">
            <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-7 text-center shadow-sm sm:p-9">
              <div className="flex items-center justify-center gap-3">
                <p className="text-4xl font-semibold tracking-tight text-sumi">
                  {word.term}
                </p>

                <SpeakButton text={word.term} language={word.targetLanguage} />
              </div>

              {word.romanization && (
                <p className="mt-2 text-lg text-sumi-soft">
                  {word.romanization}
                </p>
              )}

              <div className="mx-auto my-5 h-px w-12 bg-sumi/10" />

              <p className="text-2xl font-medium text-ai-dark">
                {word.translation}
              </p>

              {word.exampleSentence && (
                <div className="mt-6 rounded-2xl bg-washi px-5 py-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-sumi-soft">
                    Example
                  </p>

                  <p className="leading-relaxed text-sumi">
                    {word.exampleSentence}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex w-full flex-col gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={advanceFromReveal}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md disabled:translate-y-0 disabled:opacity-60"
              >
                {revealIndex + 1 < reveals.length
                  ? "Got it — next word"
                  : "Got it — time to practice"}
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
  }

  if (phase === "quiz") {
    const question = quiz[quizIndex];

    const promptIsTargetLanguage = question.direction === "term-to-translation";

    const answersUseImages = promptIsTargetLanguage;

    return (
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-ai-soft px-4 py-1.5 text-sm font-medium text-ai-dark">
            Quick review
          </span>

          <p className="text-sm text-sumi-soft">
            Question {quizIndex + 1} of {quiz.length}
          </p>

          <ProgressDots current={quizIndex + 1} total={quiz.length} />
        </div>

        <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-7 text-center shadow-sm sm:p-9">
          {!answersUseImages && (
            <WordImage
              src={question.image}
              alt={question.prompt}
              className="mx-auto mb-6 max-h-64 w-full object-contain sm:max-h-72"
            />
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-sumi-soft">
            {answersUseImages
              ? "What does this mean?"
              : "Can you find the right word?"}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <p className="text-3xl font-semibold text-sumi capitalize">
              {question.prompt}
            </p>

            {promptIsTargetLanguage && (
              <SpeakButton
                text={question.prompt}
                language={question.targetLanguage}
              />
            )}
          </div>
          {question.promptRomanization && (
            <p className="mt-2 text-sm text-sumi-soft">
              {question.promptRomanization}
            </p>
          )}
        </div>

        <div className="mt-5 grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {question.options.map((option) => {
            const isSelected = feedback?.selected === option.text;
            const isCorrectOption =
              feedback && option.text === feedback.correctAnswer;

            let style =
              "border-sumi/10 bg-washi hover:-translate-y-0.5 hover:border-ai/40 hover:bg-ai-soft/30 hover:shadow-sm";

            if (feedback && isCorrectOption) {
              style = "border-matcha bg-matcha-soft text-matcha-dark shadow-sm";
            } else if (feedback && isSelected && !feedback.correct) {
              style = "border-shu bg-shu/5 text-shu-dark";
            } else if (feedback) {
              style = "border-sumi/10 bg-washi opacity-60";
            }

            return (
              <div
                key={option.text}
                className={`flex min-h-20 items-center gap-4 rounded-2xl border p-3 transition ${style}`}
              >
                {promptIsTargetLanguage && option.image && (
                  <WordImage
                    src={option.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl bg-washi-soft object-contain p-1"
                  />
                )}
                {/* {!promptIsTargetLanguage && option.image && (
                  <WordImage
                    src={option.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl bg-washi-soft object-contain p-1"
                  />
                )} */}
                <button
                  type="button"
                  disabled={pending || Boolean(feedback)}
                  onClick={() => handleAnswer(question, option)}
                  aria-label={`Choose ${option.text}`}
                  className="flex min-w-0 flex-1 items-center self-stretch text-left font-medium disabled:cursor-not-allowed"
                >
                  <span className="capitalize">
                    {option.text}

                    {option.romanization && (
                      <span className="mt-0.5 block text-xs font-normal opacity-70 lowercase">
                        {option.romanization}
                      </span>
                    )}
                  </span>
                </button>
                {feedback && isCorrectOption && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-matcha text-sm text-white"
                    aria-label="Correct answer"
                  >
                    ✓
                  </span>
                )}
                {feedback && isSelected && !feedback.correct && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shu text-sm text-white"
                    aria-label="Incorrect answer"
                  >
                    ×
                  </span>
                )}
                {!promptIsTargetLanguage && (
                  <SpeakButton
                    text={option.text}
                    language={question.targetLanguage}
                  />
                )}
              </div>
            );
          })}
        </div>

        {feedback && (
          <div
            aria-live="polite"
            className={`mt-5 w-full rounded-2xl px-5 py-4 text-center ${
              feedback.correct
                ? "bg-matcha-soft text-matcha-dark"
                : "bg-shu/5 text-shu-dark"
            }`}
          >
            <p className="font-semibold">
              {feedback.correct
                ? "Great job! You got it."
                : "Almost! You’ll get it next time."}
            </p>

            {!feedback.correct && (
              <p className="mt-1 text-sm">
                The correct answer is <strong>{feedback.correctAnswer}</strong>.
              </p>
            )}
          </div>
        )}

        {feedback && (
          <button
            type="button"
            onClick={advanceFromQuiz}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md"
          >
            {quizIndex + 1 < quiz.length ? "Next question" : "See my results"}
          </button>
        )}
      </section>
    );
  }

  const totalAnswers = score.correct + score.incorrect;

  const perfectScore = totalAnswers > 0 && score.incorrect === 0;

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl border border-sumi/10 bg-washi-soft px-6 py-14 text-center shadow-sm sm:px-10">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-matcha-soft text-3xl text-matcha-dark">
        {perfectScore ? "★" : "✓"}
      </span>

      <h1 className="mt-5 text-2xl font-semibold text-sumi">
        {perfectScore ? "Perfect score!" : "Lovely work today!"}
      </h1>

      <p className="mt-2 max-w-sm text-sumi-soft">
        {totalAnswers > 0
          ? "Every practice session helps these words stick a little better."
          : "You’ve finished today’s vocabulary practice."}
      </p>

      {totalAnswers > 0 && (
        <div className="mt-7 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-matcha-soft px-4 py-5">
            <p className="text-2xl font-semibold text-matcha-dark">
              {score.correct}
            </p>

            <p className="mt-1 text-sm text-matcha-dark/80">Correct</p>
          </div>

          <div className="rounded-2xl bg-ai-soft px-4 py-5">
            <p className="text-2xl font-semibold text-ai-dark">
              {score.incorrect}
            </p>

            <p className="mt-1 text-sm text-ai-dark/80">To practise again</p>
          </div>
        </div>
      )}

      <Link
        href={`/dashboard/courses/${courseSlug}/vocab`}
        className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md"
      >
        Back to vocabulary
      </Link>
    </section>
  );
};
