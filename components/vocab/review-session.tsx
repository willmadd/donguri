"use client";

import { useState } from "react";
import {
  submitFormAnswer,
  submitTypedAnswer,
  completeQuiz,
  refreshDashboardHeader,
} from "@/lib/actions/vocab";
import type { QuizQuestion } from "@/lib/definitions";
import { SpeakButton, ProgressDots } from "@/components/vocab/session-ui";
import { WordImage } from "@/components/ui/word-image";
import { XpCounter } from "@/components/xp/xp-counter";
import { LevelUpModal } from "@/components/donguri/level-up-modal";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { useTranslations } from "@/components/i18n/locale-provider";
import { parseDonguriConfig, formatXp, type AccessoryId } from "@/lib/levels";

type ReviewSessionProps = {
  quiz: QuizQuestion[];
  courseSlug: string;
  initialXp: number;
  initialDonguriConfig: unknown;
};

type Feedback = { correct: boolean; correctAnswer: string; selected: string };

type LevelUpInfo = {
  newLevel: number;
  newlyUnlockedAccessories: AccessoryId[];
  unlockedAccessories: AccessoryId[];
};

// One review queue per course (see `getReviewQueue` in lib/dal.ts), mixing
// due words from every deck's vocab and grammar together — not scoped to a
// single deck. Every question here is typed — never multiple choice, unlike
// `TestSession` — so this only ever needs to render `type-form` (a cloze
// sentence) or `type-answer` (the plain term/translation prompt), both
// answered the same way: one text input.
export const ReviewSession = ({
  quiz,
  courseSlug,
  initialXp,
  initialDonguriConfig,
}: ReviewSessionProps) => {
  const t = useTranslations();
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
        } else {
          // No level-up modal to protect — safe to refresh the header now.
          // When there IS a level-up, this is deferred to the modal's
          // `onDone` instead (see below), so the dashboard-wide revalidation
          // it triggers can't unmount this still-visible modal out from
          // under the learner (that was the bug: revalidating immediately
          // here reached this page too, whose `quiz` prop was now empty).
          refreshDashboardHeader();
        }
      });
    }
  };

  if (finished) {
    const totalAnswers = score.correct + score.incorrect;
    const perfectScore = totalAnswers > 0 && score.incorrect === 0;

    return (
      <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-3xl border border-card-border bg-washi-soft px-6 py-14 text-center shadow-sm sm:px-10">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-matcha-soft text-3xl text-matcha-dark">
          {perfectScore ? "★" : "✓"}
        </span>

        <PageTitle className="mt-5">
          {perfectScore
            ? t("review_session.perfect_review", "Perfect review!")
            : t("review_session.review_complete", "Review complete!")}
        </PageTitle>

        <PageSubtitle className="mt-2 max-w-sm">
          {t(
            "review_session.results_subtitle",
            "These words will come back around on their own schedule.",
          )}
        </PageSubtitle>

        <div className="mt-6 flex flex-col items-center gap-2">
          <XpCounter value={xp} />
          {bonusAwarded && (
            <span className="text-sm font-medium text-matcha-dark">
              {t("review_session.perfect_bonus", "+5 bonus for a perfect review!")}
            </span>
          )}
          {streakBonus > 0 && (
            <span className="text-sm font-medium text-matcha-dark">
              {t("test_session.streak_bonus", "+{{amount}} streak bonus!", {
                amount: formatXp(streakBonus),
              })}
            </span>
          )}
        </div>

        <div className="mt-7 grid w-full grid-cols-2 gap-3">
          <div className="rounded-2xl bg-matcha-soft px-4 py-5">
            <p className="text-2xl font-semibold text-matcha-dark">{score.correct}</p>
            <p className="mt-1 text-sm text-matcha-dark/80">
              {t("test_session.correct", "Correct")}
            </p>
          </div>

          <div className="rounded-2xl bg-ai-soft px-4 py-5">
            <p className="text-2xl font-semibold text-ai-dark">{score.incorrect}</p>
            <p className="mt-1 text-sm text-ai-dark/80">
              {t("test_session.to_practise_again", "To practise again")}
            </p>
          </div>
        </div>

        <Button
          href={`/dashboard/courses/${courseSlug}`}
          size="lg"
          fullWidth
          className="mt-8 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
        >
          {t("test_session.back_to_course", "Back to course")}
        </Button>

        {levelUpInfo && (
          <LevelUpModal
            newLevel={levelUpInfo.newLevel}
            newlyUnlockedAccessories={levelUpInfo.newlyUnlockedAccessories}
            unlockedAccessories={levelUpInfo.unlockedAccessories}
            equippedAccessory={equippedAccessory}
            onDone={(id) => {
              setEquippedAccessory(id);
              setLevelUpInfo(null);
              refreshDashboardHeader();
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
          {t("review_session.review", "Review")}
        </span>

        <p className="text-sm text-sumi-soft">
          {t("review_session.word_progress", "Word {{current}} of {{total}}", {
            current: quizIndex + 1,
            total: quiz.length,
          })}
        </p>

        <ProgressDots current={quizIndex + 1} total={quiz.length} />
      </div>

      {question.kind === "type-form" ? (
        <div className="w-full rounded-3xl border border-card-border bg-washi-soft p-7 text-center shadow-sm sm:p-9">
          <p className="text-xs font-medium uppercase tracking-wide text-sumi-soft">
            {t("test_session.fill_in_the_blank", "Fill in the blank")}
          </p>
          <p className="mt-3 text-lg text-sumi-soft">{question.clozeSentenceJa}</p>
          <p className="mt-2 text-2xl font-semibold text-sumi">{question.clozeSentence}</p>
        </div>
      ) : (
        <div className="w-full rounded-3xl border border-card-border bg-washi-soft p-7 text-center shadow-sm sm:p-9">
          {question.direction === "translation-to-term" ? null : (
            <WordImage
              src={question.image}
              alt={question.prompt}
              className="mx-auto mb-6 max-h-64 w-full object-contain sm:max-h-72"
            />
          )}
          <p className="text-xs font-medium uppercase tracking-wide text-sumi-soft">
            {question.answerRomanized
              ? t("test_session.type_the_romanized_word", "Type the romanized word")
              : question.direction === "translation-to-term"
                ? t("test_session.what_does_this_mean", "What does this mean?")
                : t("test_session.type_the_word", "Type the word")}
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
          placeholder={
            question.kind === "type-answer" && question.answerRomanized
              ? t("test_session.type_romanized_placeholder", "Type the romanization")
              : t("test_session.type_answer_placeholder", "Type your answer")
          }
          className="h-14 w-full rounded-2xl border border-sumi/15 bg-washi px-5 text-lg text-sumi outline-none transition focus:border-ai/50 disabled:opacity-60"
        />

        {!feedback && (
          <Button
            type="submit"
            disabled={pending || typedAnswer.trim() === ""}
            size="lg"
            fullWidth
            className="shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0"
          >
            {t("test_session.check", "Check")}
          </Button>
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
            {feedback.correct
              ? t("test_session.great_job", "Great job! You got it.")
              : t("test_session.almost", "Almost! You'll get it next time.")}
          </p>

          {!feedback.correct && (
            <p className="mt-1 text-sm">
              {t("test_session.correct_answer_is", "The correct answer is")}{" "}
              <strong>{feedback.correctAnswer}</strong>.
            </p>
          )}
        </div>
      )}

      {feedback && (
        <Button
          onClick={advance}
          size="lg"
          fullWidth
          className="mt-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
        >
          {quizIndex + 1 < quiz.length
            ? t("review_session.next_word", "Next word")
            : t("test_session.see_my_results", "See my results")}
        </Button>
      )}
    </section>
  );
};
