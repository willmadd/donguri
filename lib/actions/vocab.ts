"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { nextBoxAfterAnswer, MAX_BOX } from "@/lib/srs";
import type { QuizDirection } from "@/lib/definitions";

export async function submitAnswer(
  wordId: string,
  direction: QuizDirection,
  selectedAnswer: string,
): Promise<{ correct: boolean; correctAnswer: string }> {
  const user = await requireUser();

  const word = await prisma.word.findUniqueOrThrow({
    where: { id: wordId },
    select: { term: true, translation: true },
  });

  const correctAnswer = direction === "term-to-translation" ? word.translation : word.term;
  const correct = selectedAnswer === correctAnswer;

  const progress = await prisma.userWordProgress.findUniqueOrThrow({
    where: { userId_wordId: { userId: user.id, wordId } },
    select: { box: true, correctCount: true, incorrectCount: true },
  });

  const box = nextBoxAfterAnswer(progress.box, correct);
  const now = new Date();

  await prisma.userWordProgress.update({
    where: { userId_wordId: { userId: user.id, wordId } },
    data: {
      box,
      status: box >= MAX_BOX && correct ? "known" : "learning",
      correctCount: correct ? progress.correctCount + 1 : progress.correctCount,
      incorrectCount: correct ? progress.incorrectCount : progress.incorrectCount + 1,
      lastSeenAt: now,
    },
  });

  // No revalidatePath here: this action is invoked from the practice route
  // itself, and any revalidatePath call — no matter which path it targets —
  // makes Next.js re-render *this* route in the same response (see
  // node_modules/next/dist/docs/01-app/02-guides/server-actions.md). Since
  // `getPracticeQueue` reshuffles the quiz randomly on every render, that
  // swapped the current question out from under the user mid-session. The
  // dashboard/vocab pages read the session via cookies() and are already
  // fully dynamic (staleTimes.dynamic defaults to 0), so they pick up the
  // updated progress on their own next visit without on-demand revalidation.

  return { correct, correctAnswer };
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
