"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { nextBoxAfterAnswer, MAX_BOX } from "@/lib/srs";
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

// Called once when a test session's summary screen is reached. Awards a +5
// bonus only when every question in that session was answered correctly —
// the per-question +1 XP was already awarded (and server-verified) by
// `submitAnswer`/`submitFormAnswer` as each question was answered, so this
// only ever adds the bonus on top, never re-awards the base points.
export async function completeQuiz(
  totalQuestions: number,
  correctCount: number,
): Promise<{ xp: number; bonusAwarded: boolean }> {
  const user = await requireUser();

  const perfect = totalQuestions > 0 && correctCount === totalQuestions;
  const xp = await awardXp(user.id, perfect ? 5 : 0);

  // Unlike submitAnswer/submitFormAnswer above, it's safe to revalidate here:
  // the quiz has already finished (the client has moved to its local
  // "finished" summary state, which doesn't render the `quiz` prop), so a
  // fresh getTestQueue result reaching the still-mounted page underneath it
  // is invisible. This is what keeps the header's XP badge (read from the
  // shared dashboard layout) correct once the learner navigates away.
  revalidatePath("/dashboard", "layout");

  return { xp, bonusAwarded: perfect };
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
    data: { currentStreak: 0, longestStreak: 0, lastActivityDate: null },
  });

  // "page" scope only — see the note on `skipLesson` above.
  revalidatePath("/dashboard");
}
