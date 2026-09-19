const SET_SIZE = 3;
// Every freshly learned word is quizzed exactly this many times (one
// multiple-choice, one typed) before it graduates into the scheduled review
// queue below.
const QUESTIONS_PER_LEARNT_WORD = 2;

export { SET_SIZE, QUESTIONS_PER_LEARNT_WORD };

// The 7-stage scheduled review model. A word starts at stage 1 the moment
// it's learned (see `getLearnQueue`); every correct review answer — whether
// from the initial post-learn quiz or a later review-queue session —
// advances it one stage and pushes `nextReviewAt` out to `intervalHours`
// from now. A wrong answer regresses it to `wrongGoesTo`, not always back to
// stage 1 (e.g. a slip at Intermediate 1 only drops to Beginner 2, not to
// square one). Stage 7 ("Mastered") has no interval — it's terminal, same
// meaning as the old `status: "known"`.
export const STAGES = [
  { stage: 1, nameEn: "Beginner 1", nameJa: "初心者 1", intervalHours: 4, wrongGoesTo: 1 },
  { stage: 2, nameEn: "Beginner 2", nameJa: "初心者 2", intervalHours: 24, wrongGoesTo: 1 },
  { stage: 3, nameEn: "Beginner 3", nameJa: "初心者 3", intervalHours: 24 * 3, wrongGoesTo: 1 },
  { stage: 4, nameEn: "Intermediate 1", nameJa: "中級者 1", intervalHours: 24 * 7, wrongGoesTo: 2 },
  { stage: 5, nameEn: "Intermediate 2", nameJa: "中級者 2", intervalHours: 24 * 14, wrongGoesTo: 2 },
  { stage: 6, nameEn: "Expert 1", nameJa: "上級者 1", intervalHours: 24 * 30, wrongGoesTo: 4 },
  { stage: 7, nameEn: "Mastered", nameJa: "マスター", intervalHours: null, wrongGoesTo: null },
] as const;

export const MAX_STAGE = 7;

export function stageInfo(stage: number) {
  return STAGES[Math.min(Math.max(stage, 1), MAX_STAGE) - 1];
}

export function nextStageAfterAnswer(stage: number, correct: boolean): number {
  if (correct) return Math.min(stage + 1, MAX_STAGE);
  return stageInfo(stage).wrongGoesTo ?? stage;
}

// null means "no further review" (stage 7, mastered).
export function nextReviewAtForStage(stage: number, from: Date = new Date()): Date | null {
  const hours = stageInfo(stage).intervalHours;
  if (hours == null) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function startOfUTCDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function toUTCDateString(date: Date): string {
  return startOfUTCDay(date).toISOString().slice(0, 10);
}

// Extra XP for sustaining a streak: nothing on day 1, then +0.5 more per
// consecutive day after that (day 2 = 0.5, day 3 = 1, day 4 = 1.5, ...).
// Awarded once per UTC day per course (see `lastStreakBonusDate` in
// `completeQuiz`), not per quiz, so finishing several quizzes in a day
// doesn't stack it.
export function streakBonusXp(currentStreak: number): number {
  return currentStreak >= 2 ? (currentStreak - 1) * 0.5 : 0;
}

type StreakFields = {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date | null;
};

// Pure calculation of the new streak state for "the user did something today".
// Same day as last activity: no-op. Exactly one day after: streak continues.
// Any bigger gap (or first-ever activity): streak resets to 1.
export function applyDailyActivity(
  profile: StreakFields,
  today: Date = new Date(),
): StreakFields {
  const todayStr = toUTCDateString(today);

  if (profile.lastActivityDate && toUTCDateString(profile.lastActivityDate) === todayStr) {
    return profile;
  }

  const yesterdayStr = toUTCDateString(addDays(today, -1));
  const continuesStreak =
    profile.lastActivityDate && toUTCDateString(profile.lastActivityDate) === yesterdayStr;

  const currentStreak = continuesStreak ? profile.currentStreak + 1 : 1;

  return {
    currentStreak,
    longestStreak: Math.max(profile.longestStreak, currentStreak),
    lastActivityDate: startOfUTCDay(today),
  };
}
