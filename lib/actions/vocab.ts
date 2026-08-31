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

  // Deliberately no revalidatePath here: this runs on every answer during an
  // active practice session. Revalidating the dashboard layout would push
  // fresh RSC data for the whole subtree — including the practice route
  // that's currently mounted — swapping its `quiz` prop out from under the
  // in-progress session (the question at the current index would suddenly
  // become a different question). The dashboard/course pages are already
  // dynamically rendered per-request, so they show fresh data on their own
  // next visit without this.

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

  // No revalidatePath here either — same reason as `submitAnswer` above:
  // this is called mid-session (from the reveal step), and a "layout"
  // revalidation would corrupt the currently-mounted practice page's props.
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
