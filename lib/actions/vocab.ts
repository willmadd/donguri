"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { nextBoxAfterAnswer, MAX_BOX, streakBonusXp, toUTCDateString } from "@/lib/srs";
import { ACCESSORIES, levelForXp, parseDonguriConfig, type AccessoryId } from "@/lib/levels";
import type { QuizDirection } from "@/lib/definitions";

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

// Shared by `submitAnswer` and `submitFormAnswer`: applies one answer's
// result to a word's `UserWordProgress` (box transition, mastery status,
// counts, `lastSeenAt`) and awards XP for a correct answer. No
// `revalidatePath` here — this is invoked from the test route itself, and
// any revalidatePath call, no matter which path it targets, makes Next.js
// re-render *this* route in the same response (see
// node_modules/next/dist/docs/01-app/02-guides/server-actions.md). Since
// `getTestQueue` reshuffles the quiz randomly on every render, that would
// swap the current question out from under the user mid-session. The
// dashboard/decks pages read the session via cookies() and are already fully
// dynamic (staleTimes.dynamic defaults to 0), so they pick up the updated
// progress on their own next visit without on-demand revalidation.
async function recordAnswer(userId: string, wordId: string, correct: boolean): Promise<{ xp: number }> {
  const progress = await prisma.userWordProgress.findUniqueOrThrow({
    where: { userId_wordId: { userId, wordId } },
    select: { box: true, correctCount: true, incorrectCount: true },
  });

  const box = nextBoxAfterAnswer(progress.box, correct);

  await prisma.userWordProgress.update({
    where: { userId_wordId: { userId, wordId } },
    data: {
      box,
      status: box >= MAX_BOX && correct ? "known" : "learning",
      correctCount: correct ? progress.correctCount + 1 : progress.correctCount,
      incorrectCount: correct ? progress.incorrectCount : progress.incorrectCount + 1,
      lastSeenAt: new Date(),
    },
  });

  const xp = await awardXp(userId, correct ? 1 : 0);

  return { xp };
}

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

  const { xp } = await recordAnswer(user.id, wordId, correct);

  return { correct, correctAnswer, xp };
}

// Checks a typed answer against a word form's value — trimmed and
// case-insensitive, so "Went"/"went "/"WENT" all count.
export async function submitFormAnswer(
  wordId: string,
  formId: string,
  typedAnswer: string,
): Promise<{ correct: boolean; correctAnswer: string; xp: number }> {
  const user = await requireUser();

  const form = await prisma.wordForm.findUniqueOrThrow({
    where: { id: formId },
    select: { value: true, wordId: true },
  });

  if (form.wordId !== wordId) {
    throw new Error("Form does not belong to the given word.");
  }

  const correct = typedAnswer.trim().toLowerCase() === form.value.trim().toLowerCase();

  const { xp } = await recordAnswer(user.id, wordId, correct);

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

  const { xp } = await recordAnswer(user.id, wordId, correct);

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

  // Unlike submitAnswer/submitFormAnswer above, it's safe to revalidate here:
  // the quiz has already finished (the client has moved to its local
  // "finished" summary state, which doesn't render the `quiz` prop), so a
  // fresh getTestQueue result reaching the still-mounted page underneath it
  // is invisible. This is what keeps the header's XP badge (read from the
  // shared dashboard layout) correct once the learner navigates away.
  revalidatePath("/dashboard", "layout");

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

export async function skipWord(wordId: string): Promise<void> {
  const user = await requireUser();

  await prisma.userWordProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId } },
    create: {
      userId: user.id,
      wordId,
      status: "known",
      skipped: true,
      box: MAX_BOX,
    },
    update: {
      status: "known",
      skipped: true,
      box: MAX_BOX,
    },
  });

  // Same reasoning as `submitAnswer` above — no revalidatePath here.
}

export async function skipLesson(lessonId: string): Promise<void> {
  const user = await requireUser();

  const words = await prisma.word.findMany({
    where: { lessonId },
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
      box: MAX_BOX,
    })),
    skipDuplicates: true,
  });

  await prisma.userWordProgress.updateMany({
    where: {
      userId: user.id,
      wordId: { in: words.map((word) => word.id) },
      status: { not: "known" },
    },
    data: { status: "known", skipped: true, box: MAX_BOX },
  });

  // "page" scope (the default) only revalidates this exact path, not the
  // whole dashboard subtree — safe even if a practice session happens to be
  // open in another tab.
  revalidatePath("/dashboard");
}

export async function resetCourseProgress(courseId: string): Promise<void> {
  const user = await requireUser();

  await prisma.userWordProgress.deleteMany({
    where: { userId: user.id, word: { lesson: { courseId } } },
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
