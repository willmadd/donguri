"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  MAX_STAGE,
  nextReviewAtForStage,
  nextStageAfterAnswer,
  streakBonusXp,
  toUTCDateString,
} from "@/lib/srs";
import { ACCESSORIES, levelForXp, parseDonguriConfig, type AccessoryId } from "@/lib/levels";
import type { QuizDirection } from "@/lib/definitions";
import { isLatinTypeable } from "@/lib/language";

// Case-insensitive, whitespace-trimmed match against one candidate answer —
// or, when the stored value is a comma-separated list (e.g. a translation
// with more than one accepted reading, "こんにちは, もしもし"), against any
// one of its segments. Shared by every typed-answer check.
function matchesTypedAnswer(typed: string, stored: string): boolean {
  const guess = typed.trim().toLowerCase();
  return stored
    .split(",")
    .map((segment) => segment.trim().toLowerCase())
    .some((segment) => segment === guess);
}

// +1 XP per correct quiz answer (both multiple-choice and fill-in-the-form
// questions) — see `completeQuiz` below for the +5 perfect-quiz bonus on top
// of this. Returns the profile's new total so the caller can hand it
// straight to the client for the XP counter animation, without a second
// round trip.
async function awardXp(userId: string, amount: number): Promise<number> {
  if (amount === 0) {
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: userId },
      select: { xp: true },
    });
    return profile.xp;
  }

  const profile = await prisma.profile.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
    select: { xp: true },
  });

  return profile.xp;
}

// Shared by `submitAnswer`/`submitFormAnswer`/`submitTypedAnswer`: records
// one answer's result — counts, `lastSeenAt`, XP — always. Stage transition
// (see the STAGES table in lib/srs.ts) only happens when `advancesStage` is
// true, i.e. only for an answer given in the *scheduled review queue*. The
// post-learn quiz deliberately does NOT advance stage: a word's first
// real review has to wait for its stage-1 `nextReviewAt` (set 4 hours out
// the moment it's learned, in `getLearnQueue`) to actually pass — answering
// it twice correctly thirty seconds after learning it isn't evidence of
// retention over time, so it must not fast-forward the schedule. Without
// this split, a perfect post-learn quiz (2 correct answers) would silently
// jump a fresh word from stage 1 to stage 3, skipping its 4-hour and 1-day
// check-ins entirely — which is exactly the bug this parameter fixes.
// No `revalidatePath` here — this is invoked from the test/review routes
// themselves, and any revalidatePath call, no matter which path it targets,
// makes Next.js re-render *this* route in the same response (see
// node_modules/next/dist/docs/01-app/02-guides/server-actions.md). Since
// `getTestQueue`/`getReviewQueue` reshuffle the session randomly on every
// render, that would swap the current question out from under the user
// mid-session. The dashboard/decks pages read the session via cookies() and
// are already fully dynamic (staleTimes.dynamic defaults to 0), so they pick
// up the updated progress on their own next visit without on-demand
// revalidation.
async function recordAnswer(
  userId: string,
  wordId: string,
  correct: boolean,
  advancesStage: boolean,
): Promise<{ xp: number }> {
  const progress = await prisma.userWordProgress.findUniqueOrThrow({
    where: { userId_wordId: { userId, wordId } },
    select: { stage: true, correctCount: true, incorrectCount: true },
  });

  const stage = advancesStage ? nextStageAfterAnswer(progress.stage, correct) : progress.stage;
  const mastered = advancesStage && stage >= MAX_STAGE && correct;

  await prisma.userWordProgress.update({
    where: { userId_wordId: { userId, wordId } },
    data: {
      ...(advancesStage
        ? {
            stage,
            nextReviewAt: mastered ? null : nextReviewAtForStage(stage),
            status: mastered ? "known" : "learning",
          }
        : {}),
      correctCount: correct ? progress.correctCount + 1 : progress.correctCount,
      incorrectCount: correct ? progress.incorrectCount : progress.incorrectCount + 1,
      lastSeenAt: new Date(),
    },
  });

  const xp = await awardXp(userId, correct ? 1 : 0);

  return { xp };
}

// Always the post-learn quiz — multiple choice never appears in the review
// queue (see `getReviewQueue`), so this never advances stage.
export async function submitAnswer(
  wordId: string,
  direction: QuizDirection,
  selectedAnswer: string,
): Promise<{ correct: boolean; correctAnswer: string; xp: number }> {
  const user = await requireUser();

  const word = await prisma.word.findUniqueOrThrow({
    where: { id: wordId },
    select: { term: true, translation: true },
  });

  const correctAnswer = direction === "term-to-translation" ? word.translation : word.term;
  const correct = selectedAnswer === correctAnswer;

  const { xp } = await recordAnswer(user.id, wordId, correct, false);

  return { correct, correctAnswer, xp };
}

// The typed counterpart to `submitAnswer`, for `TypeAnswerQuestion` — same
// term/translation fact, checked with `matchesTypedAnswer`'s trimmed,
// case-insensitive, comma-list-tolerant comparison instead of an exact
// option match (some translations carry more than one accepted reading,
// e.g. "こんにちは, もしもし"). The word's own alternate answers (see
// WordAlternateAnswer — extra accepted spellings like "3" or "三" for
// "Three") are unioned into the same comma-list check, regardless of which
// side (term or translation) is being typed. The correct-answer shown back
// to the learner is just the first reading, not the full stored list or any
// alternates. Shared by the quiz's typed half (`advancesStage: false`) and
// the review queue's fallback typed question for words with no cloze
// content (`advancesStage: true`).
export async function submitTypedAnswer(
  wordId: string,
  direction: QuizDirection,
  typedAnswer: string,
  advancesStage: boolean,
): Promise<{ correct: boolean; correctAnswer: string; xp: number }> {
  const user = await requireUser();

  const word = await prisma.word.findUniqueOrThrow({
    where: { id: wordId },
    select: {
      term: true,
      translation: true,
      romanization: true,
      path: true,
      alternateAnswers: { select: { value: true } },
    },
  });

  // Mirrors the direction/answer logic in buildTypedQuestion (lib/dal.ts):
  // a non-Latin-typeable vocab term is checked against its romanization
  // instead, since that's the only typeable form of the correct answer.
  const useRomanizedAnswer =
    direction === "translation-to-term" &&
    !isLatinTypeable(word.term) &&
    word.path === "vocab" &&
    Boolean(word.romanization);

  const storedAnswer =
    direction === "term-to-translation"
      ? word.translation
      : useRomanizedAnswer
        ? word.romanization!
        : word.term;
  const acceptedAnswers = [storedAnswer, ...word.alternateAnswers.map((alt) => alt.value)].join(",");
  const correct = matchesTypedAnswer(typedAnswer, acceptedAnswers);
  const correctAnswer = storedAnswer.split(",")[0].trim();

  const { xp } = await recordAnswer(user.id, wordId, correct, advancesStage);

  return { correct, correctAnswer, xp };
}

// Checks a typed answer against a word form's value — trimmed and
// case-insensitive, so "Went"/"went "/"WENT" all count. A null `formId`
// means the blank was the word's own term (see findTermClozeMatches in
// lib/cloze.ts), checked against the term plus its alternate answers. Shared by the
// quiz's cloze-preferred typed half (`advancesStage: false`) and the review
// queue's cloze question (`advancesStage: true`) — see `submitTypedAnswer`.
export async function submitFormAnswer(
  wordId: string,
  formId: string | null,
  typedAnswer: string,
  advancesStage: boolean,
): Promise<{ correct: boolean; correctAnswer: string; xp: number }> {
  const user = await requireUser();

  if (formId === null) {
    const word = await prisma.word.findUniqueOrThrow({
      where: { id: wordId },
      select: { term: true, alternateAnswers: { select: { value: true } } },
    });
    const acceptedAnswers = [word.term, ...word.alternateAnswers.map((alt) => alt.value)].join(",");
    const correct = matchesTypedAnswer(typedAnswer, acceptedAnswers);
    const { xp } = await recordAnswer(user.id, wordId, correct, advancesStage);
    return { correct, correctAnswer: word.term, xp };
  }

  const form = await prisma.wordForm.findUniqueOrThrow({
    where: { id: formId },
    select: { value: true, wordId: true },
  });

  if (form.wordId !== wordId) {
    throw new Error("Form does not belong to the given word.");
  }

  const correct = typedAnswer.trim().toLowerCase() === form.value.trim().toLowerCase();

  const { xp } = await recordAnswer(user.id, wordId, correct, advancesStage);

  return { correct, correctAnswer: form.value, xp };
}

// Checks a selected option against a hand-authored question's correct index.
export async function submitCustomAnswer(
  wordId: string,
  questionId: string,
  selectedOption: string,
): Promise<{ correct: boolean; correctAnswer: string; xp: number }> {
  const user = await requireUser();

  const question = await prisma.wordQuizQuestion.findUniqueOrThrow({
    where: { id: questionId },
    select: { options: true, correctIndex: true, wordId: true },
  });

  if (question.wordId !== wordId) {
    throw new Error("Question does not belong to the given word.");
  }

  const correctAnswer = question.options[question.correctIndex];
  // Trimmed and case-insensitive: this same check backs both the
  // multiple-choice presentation (an exact click, so this is a no-op) and
  // the free-typed one, where "Correct"/"correct "/"CORRECT" should all count.
  const correct = selectedOption.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

  const { xp } = await recordAnswer(user.id, wordId, correct, false);

  return { correct, correctAnswer, xp };
}

// Called once when a test session's summary screen is reached. Awards a +5
// bonus only when every question in that session was answered correctly —
// the per-question +1 XP was already awarded (and server-verified) by
// `submitAnswer`/`submitFormAnswer` as each question was answered, so this
// only ever adds the bonus on top, never re-awards the base points. Also
// awards the streak bonus (see `streakBonusXp`) — once per UTC day per
// course, tracked via `lastStreakBonusDate` on the enrollment, so finishing
// several quizzes the same day only pays it out once.
// `initialXp` is the XP the learner had when the test session *started*
// (passed back from the client, which got it from the page that fetched the
// session) — comparing its level against the level after this quiz's XP
// (including both bonuses below) is how a level-up crossed during the
// session is detected, regardless of which bonus tipped it over.
export async function completeQuiz(
  courseSlug: string,
  initialXp: number,
  totalQuestions: number,
  correctCount: number,
): Promise<{
  xp: number;
  bonusAwarded: boolean;
  streakBonus: number;
  previousLevel: number;
  newLevel: number;
  newlyUnlockedAccessories: AccessoryId[];
  unlockedAccessories: AccessoryId[];
}> {
  const user = await requireUser();

  const perfect = totalQuestions > 0 && correctCount === totalQuestions;

  const course = await prisma.course.findUniqueOrThrow({
    where: { slug: courseSlug },
    select: { id: true },
  });
  const enrollment = await prisma.courseEnrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    select: { currentStreak: true, lastStreakBonusDate: true },
  });

  const today = new Date();
  const alreadyAwardedToday =
    enrollment.lastStreakBonusDate !== null &&
    toUTCDateString(enrollment.lastStreakBonusDate) === toUTCDateString(today);
  const streakBonus = alreadyAwardedToday ? 0 : streakBonusXp(enrollment.currentStreak);

  if (streakBonus > 0) {
    await prisma.courseEnrollment.update({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      data: { lastStreakBonusDate: today },
    });
  }

  const xp = await awardXp(user.id, (perfect ? 5 : 0) + streakBonus);

  const previousLevel = levelForXp(initialXp);
  const newLevel = levelForXp(xp);

  let newlyUnlockedAccessories: AccessoryId[] = [];
  let unlockedAccessories: AccessoryId[] = [];

  if (newLevel > previousLevel) {
    const profile = await prisma.profile.findUniqueOrThrow({
      where: { id: user.id },
      select: { donguriConfig: true },
    });

    const config = parseDonguriConfig(profile.donguriConfig);
    const alreadyUnlocked = new Set(config.unlockedAccessories ?? []);

    // Every accessory whose own threshold has been reached is unlocked at
    // once — not one-at-a-time in list order, so a level that has several
    // accessories sharing its threshold (e.g. level 2's set) all become
    // available together for free choice, without pulling in a later
    // level's costumes early.
    const earnedIds = ACCESSORIES.filter((accessory) => accessory.threshold <= xp).map(
      (accessory) => accessory.id,
    );
    newlyUnlockedAccessories = earnedIds.filter((id) => !alreadyUnlocked.has(id));
    unlockedAccessories = earnedIds;

    // Every level-up reopens the outfit choice — `equipAccessory` locks it
    // again the moment the learner actually picks something (in the
    // level-up modal or later from their profile), so this only needs to
    // flip it back open here, unconditionally, every time a level is
    // crossed — including later ones where nothing new unlocks.
    await prisma.profile.update({
      where: { id: user.id },
      data: { donguriConfig: { ...config, unlockedAccessories: earnedIds, canChooseOutfit: true } },
    });
  }

  // Deliberately NOT revalidating here (see `refreshDashboardHeader` below)
  // — a level-up modal may still be showing, and revalidating now was
  // exactly the bug: `revalidatePath(..., "layout")` invalidates the
  // *whole* dashboard layout, including the test/review page still mounted
  // underneath, so Next re-renders it with a fresh (now-empty) `quiz`
  // array a second or two later, which swaps that page over to its
  // "nothing left" empty state — unmounting TestSession/ReviewSession, and
  // the level-up modal along with it, out from under the learner mid-choice.
  return {
    xp,
    bonusAwarded: perfect,
    streakBonus,
    previousLevel,
    newLevel,
    newlyUnlockedAccessories,
    unlockedAccessories,
  };
}

// The revalidation `completeQuiz` above deliberately skips — call this once
// the finished screen is truly done being looked at (immediately, if there
// was no level-up; from the level-up modal's `onDone`, if there was one).
// Keeps the header's XP badge (read from the shared dashboard layout)
// correct once the learner navigates away, without risking unmounting a
// still-visible modal the way calling it from inside `completeQuiz` did.
export async function refreshDashboardHeader(): Promise<void> {
  revalidatePath("/dashboard", "layout");
}

export async function skipWord(wordId: string): Promise<void> {
  const user = await requireUser();

  await prisma.userWordProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId } },
    create: {
      userId: user.id,
      wordId,
      status: "known",
      skipped: true,
      stage: MAX_STAGE,
      nextReviewAt: null,
    },
    update: {
      status: "known",
      skipped: true,
      stage: MAX_STAGE,
      nextReviewAt: null,
    },
  });

  // Same reasoning as `submitAnswer` above — no revalidatePath here.
}

export async function skipLanguageDeck(languageDeckId: string): Promise<void> {
  const user = await requireUser();

  const words = await prisma.word.findMany({
    where: { languageDeckId },
    select: { id: true },
  });

  if (words.length === 0) {
    return;
  }

  await prisma.userWordProgress.createMany({
    data: words.map((word) => ({
      userId: user.id,
      wordId: word.id,
      status: "known",
      skipped: true,
      stage: MAX_STAGE,
      nextReviewAt: null,
    })),
    skipDuplicates: true,
  });

  await prisma.userWordProgress.updateMany({
    where: {
      userId: user.id,
      wordId: { in: words.map((word) => word.id) },
      status: { not: "known" },
    },
    data: { status: "known", skipped: true, stage: MAX_STAGE, nextReviewAt: null },
  });

  // "page" scope (the default) only revalidates this exact path, not the
  // whole dashboard subtree — safe even if a practice session happens to be
  // open in another tab.
  revalidatePath("/dashboard");
}

// Turns a deck on/off in the user's personal "active decks" selection for a
// course (see getActiveDeckIds in lib/dal.ts) — upserts rather than
// creating/deleting the row, since `active` being a real column (not row
// presence) is what lets getActiveDeckIds tell "explicitly deactivated"
// apart from "never touched" even once every deck is off. A deck can hold
// vocab words, grammar points, or a mix (see the note on `Word.path` in
// prisma/schema.prisma) — activation is purely per-deck, not per content
// type.
export async function toggleDeckActivation(
  courseSlug: string,
  deckId: string,
  active: boolean,
): Promise<void> {
  const user = await requireUser();

  await prisma.userDeckActivation.upsert({
    where: { userId_languageDeckId: { userId: user.id, languageDeckId: deckId } },
    create: { userId: user.id, languageDeckId: deckId, active },
    update: { active },
  });

  revalidatePath(`/dashboard/courses/${courseSlug}`);
}

export async function resetCourseProgress(courseId: string): Promise<void> {
  const user = await requireUser();

  await prisma.userWordProgress.deleteMany({
    where: { userId: user.id, word: { languageDeck: { courseId } } },
  });

  await prisma.courseEnrollment.update({
    where: { userId_courseId: { userId: user.id, courseId } },
    data: {
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      lastStreakBonusDate: null,
    },
  });

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: user.id },
    select: { donguriConfig: true },
  });
  const config = parseDonguriConfig(profile.donguriConfig);

  await prisma.profile.update({
    where: { id: user.id },
    data: {
      xp: 0,
      // Accessories are gated by XP/level, so resetting back to 0 XP also
      // clears which ones are unlocked/equipped — otherwise the header
      // would show "Lv 0" while still wearing a costume that requires
      // Lv 1+. Other hand-edited keys in the JSON blob are left alone.
      donguriConfig: { ...config, unlockedAccessories: [], equippedAccessory: null },
    },
  });

  // "layout" scope too: the header's XP/level badge lives in the shared
  // dashboard layout, not just the vocab pages under this exact path.
  revalidatePath("/dashboard", "layout");
}
