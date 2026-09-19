"use client";

import { useState } from "react";
import Link from "next/link";
import { submitFormAnswer, submitTypedAnswer, completeQuiz } from "@/lib/actions/vocab";
import type { QuizQuestion } from "@/lib/definitions";
import { SpeakButton, ProgressDots } from "@/components/vocab/session-ui";
import { WordImage } from "@/components/ui/word-image";
import { XpCounter } from "@/components/xp/xp-counter";
import { LevelUpModal } from "@/components/donguri/level-up-modal";
import { parseDonguriConfig, formatXp, type AccessoryId } from "@/lib/levels";

type ReviewSessionProps = {
  quiz: QuizQuestion[];
  courseSlug: string;
  deckId: string;
  initialXp: number;
  initialDonguriConfig: unknown;
};

type Feedback = { correct: boolean; correctAnswer: string; selected: string };

type LevelUpInfo = {
  newLevel: number;
  newlyUnlockedAccessories: AccessoryId[];
  unlockedAccessories: AccessoryId[];
};

// One review queue per deck (see `getReviewQueue` in lib/dal.ts), mixing due
// words from that deck's vocab lesson and its grammar sibling if it has one
// — not shared across other decks. Every question here is typed — never
// multiple choice, unlike `TestSession` — so this only ever needs to render
// `type-form` (a cloze sentence) or `type-answer` (the plain term/
// translation prompt), both answered the same way: one text input.
export const ReviewSession = ({
  quiz,
  courseSlug,
  deckId,
  initialXp,
  initialDonguriConfig,
}: ReviewSessionProps) => {
  const [quizIndex, setQuizIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [score, setScore] = useState({ correct: 0, incorrect: 0 });
  const [finished, setFinished] = useState(false);
  const [xp, setXp] = useState(initialXp);
  const [bonusAwarded, setBonusAwarded] = useState(false);
  const [streakBonus, setStreakBonus] = useState(0);
  const [equippedAccessory, setEquippedAccessory] = useState<AccessoryId | null>(
    (parseDonguriConfig(initialDonguriConfig).equippedAccessory as AccessoryId | undefined) ?? null,
  );
  const [levelUpInfo, setLevelUpInfo] = useState<LevelUpInfo | null>(null);

  const question = quiz[quizIndex];

  // `getReviewQueue` (lib/dal.ts) only ever builds `type-form`/`type-answer`
  // questions via `buildTypedQuestion` — narrowing here (rather than a
  // broader QuizQuestion prop type) is what lets the JSX below access
  // `clozeSentence`/`prompt`/etc. without a cast.
  if (question.kind !== "type-form" && question.kind !== "type-answer") {
    throw new Error(`ReviewSession received an unexpected question kind: ${question.kind}`);
  }

  const recordResult = (correct: boolean) => {
    setScore((current) => ({
      correct: current.correct + (correct ? 1 : 0),
      incorrect: current.incorrect + (correct ? 0 : 1),
    }));
  };

  const handleSubmit = async () => {
    if (feedback || pending || typedAnswer.trim() === "") return;

    setPending(true);

    try {
      const result =
        question.kind === "type-form"
          ? await submitFormAnswer(question.wordId, question.formId, typedAnswer, true)
          : await submitTypedAnswer(question.wordId, question.direction, typedAnswer, true);

      setFeedback({ selected: typedAnswer, correct: result.correct, correctAnswer: result.correctAnswer });
      recordResult(result.correct);
      setXp(result.xp);
    } finally {
      setPending(false);
    }
  };

  const advance = () => {
    setFeedback(null);
    setTypedAnswer("");

    if (quizIndex + 1 < quiz.length) {
      setQuizIndex((current) => current + 1);
    } else {
      setFinished(true);
      completeQuiz(courseSlug, initialXp, quiz.length, score.correct).then((result) => {
        setXp(result.xp);
        setBonusAwarded(result.bonusAwarded);
        setStreakBonus(result.streakBonus);
        if (result.newLevel > result.previousLevel) {
          setLevelUpInfo({
            newLevel: result.newLevel,
            newlyUnlockedAccessories: result.newlyUnlockedAccessories,
            unlockedAccessories: result.unlockedAccessories,
          });
        }
      });
    }
  };

  if (finished) {
    const totalAnswers = score.correct + score.incorrect;
    const perfectScore = totalAnswers > 0 && score.incorrect === 0;

    return (
      <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl border border-sumi/10 bg-washi-soft px-6 py-14 text-center shadow-sm sm:px-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-matcha-soft text-3xl text-matcha-dark">
          {perfectScore ? "★" : "✓"}
        </span>

        <h1 className="mt-5 text-2xl font-semibold text-sumi">
          {perfectScore ? "Perfect review!" : "Review complete!"}
        </h1>

        <p className="mt-2 max-w-sm text-sumi-soft">
          These words will come back around on their own schedule.
        </p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <XpCounter value={xp} />
          {bonusAwarded && (
            <span className="text-sm font-medium text-matcha-dark">+5 bonus for a perfect review!</span>
          )}
          {streakBonus > 0 && (
            <span className="text-sm font-medium text-matcha-dark">
              +{formatXp(streakBonus)} streak bonus!
            </span>
          )}
        </div>

        <div className="mt-7 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-matcha-soft px-4 py-5">
            <p className="text-2xl font-semibold text-matcha-dark">{score.correct}</p>
            <p className="mt-1 text-sm text-matcha-dark/80">Correct</p>
          </div>

          <div className="rounded-2xl bg-ai-soft px-4 py-5">
            <p className="text-2xl font-semibold text-ai-dark">{score.incorrect}</p>
            <p className="mt-1 text-sm text-ai-dark/80">To practise again</p>
          </div>
        </div>

        <Link
          href={`/dashboard/courses/${courseSlug}/decks/${deckId}`}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md"
        >
          Back to deck
        </Link>

        {levelUpInfo && (
          <LevelUpModal
            newLevel={levelUpInfo.newLevel}
            newlyUnlockedAccessories={levelUpInfo.newlyUnlockedAccessories}
            unlockedAccessories={levelUpInfo.unlockedAccessories}
            equippedAccessory={equippedAccessory}
            onDone={(id) => {
              setEquippedAccessory(id);
              setLevelUpInfo(null);
            }}
          />
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center">
      <div className="mb-4 flex w-full justify-center">
        <XpCounter value={xp} />
      </div>

      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <span className="rounded-full bg-matcha-soft px-4 py-1.5 text-sm font-medium text-matcha-dark">
          Review
        </span>

        <p className="text-sm text-sumi-soft">
          Word {quizIndex + 1} of {quiz.length}
        </p>

        <ProgressDots current={quizIndex + 1} total={quiz.length} />
      </div>

      {question.kind === "type-form" ? (
        <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-7 text-center shadow-sm sm:p-9">
          <p className="text-xs font-medium uppercase tracking-wide text-sumi-soft">
            Fill in the blank
          </p>
          <p className="mt-3 text-2xl font-semibold text-sumi">{question.clozeSentence}</p>
          <p className="mt-2 text-sumi-soft">{question.clozeSentenceJa}</p>
        </div>
      ) : (
        <div className="w-full rounded-3xl border border-sumi/10 bg-washi-soft p-7 text-center shadow-sm sm:p-9">
          {question.direction === "translation-to-term" ? null : (
            <WordImage
              src={question.image}
              alt={question.prompt}
              className="mx-auto mb-6 max-h-64 w-full object-contain sm:max-h-72"
            />
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-sumi-soft">
            {question.direction === "translation-to-term" ? "What does this mean?" : "Type the word"}
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <p className="text-3xl font-semibold text-sumi capitalize">{question.prompt}</p>

            {question.direction === "term-to-translation" && (
              <SpeakButton text={question.prompt} language={question.targetLanguage} />
            )}
          </div>
          {question.promptRomanization && (
            <p className="mt-2 text-sm text-sumi-soft">{question.promptRomanization}</p>
          )}
        </div>
      )}

      <form
        className="mt-5 flex w-full flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <input
          type="text"
          value={typedAnswer}
          onChange={(event) => setTypedAnswer(event.target.value)}
          disabled={pending || Boolean(feedback)}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Type your answer"
          className="h-14 w-full rounded-2xl border border-sumi/15 bg-washi px-5 text-lg text-sumi outline-none transition focus:border-ai/50 disabled:opacity-60"
        />

        {!feedback && (
          <button
            type="submit"
            disabled={pending || typedAnswer.trim() === ""}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md disabled:translate-y-0 disabled:opacity-60"
          >
            Check
          </button>
        )}
      </form>

      {feedback && (
        <div
          aria-live="polite"
          className={`mt-5 w-full rounded-2xl px-5 py-4 text-center ${
            feedback.correct ? "bg-matcha-soft text-matcha-dark" : "bg-shu/5 text-shu-dark"
          }`}
        >
          <p className="font-semibold">
            {feedback.correct ? "Great job! You got it." : "Almost! You’ll get it next time."}
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
          onClick={advance}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-ai px-7 font-medium text-washi shadow-sm transition hover:-translate-y-0.5 hover:bg-ai-dark hover:shadow-md"
        >
          {quizIndex + 1 < quiz.length ? "Next word" : "See my results"}
        </button>
      )}
    </section>
  );
};
