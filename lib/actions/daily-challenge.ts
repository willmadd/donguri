"use server";

import { revalidatePath } from "next/cache";
import { requireUser, MAX_DAILY_CHALLENGE_ATTEMPTS, bumpStreak } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { startOfUTCDay, DAILY_CHALLENGE_XP } from "@/lib/srs";

// There's no real challenge content yet (see the note on
// DailyChallengeAttempt in prisma/schema.prisma) — this just records the
// attempt and pays out a small flat bonus (DAILY_CHALLENGE_XP, in
// lib/srs.ts) so the button is worth pressing until real content replaces
// it.

export type CompleteDailyChallengeResult =
  | { ok: true; attemptsToday: number; xp: number }
  | { ok: false; reason: "not_enrolled" | "limit_reached" };

export async function completeDailyChallenge(
  courseSlug: string,
): Promise<CompleteDailyChallengeResult> {
  const user = await requireUser();

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { userId: user.id, course: { slug: courseSlug, active: true } },
    select: { courseId: true },
  });

  if (!enrollment) {
    return { ok: false, reason: "not_enrolled" };
  }

  const today = startOfUTCDay(new Date());
  const attemptsToday = await prisma.dailyChallengeAttempt.count({
    where: {
      userId: user.id,
      courseId: enrollment.courseId,
      challengeDate: today,
    },
  });

  if (attemptsToday >= MAX_DAILY_CHALLENGE_ATTEMPTS) {
    return { ok: false, reason: "limit_reached" };
  }

  await prisma.dailyChallengeAttempt.create({
    data: { userId: user.id, courseId: enrollment.courseId, challengeDate: today },
  });

  await bumpStreak(user.id, enrollment.courseId, today);

  const profile = await prisma.profile.update({
    where: { id: user.id },
    data: { xp: { increment: DAILY_CHALLENGE_XP } },
    select: { xp: true },
  });

  revalidatePath(`/dashboard/courses/${courseSlug}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/daily-challenge`);
  // "layout" scope too: the header's XP/level badge lives in the shared
  // dashboard layout, not just the pages under this exact path.
  revalidatePath("/dashboard", "layout");

  return { ok: true, attemptsToday: attemptsToday + 1, xp: profile.xp };
}
