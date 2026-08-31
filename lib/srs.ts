// Weighted spaced repetition: `box` (1-5) is a mastery level, not a
// schedule. Every not-yet-mastered word is always eligible for review, but
// `weightForBox` weights lower boxes (new words, or words just answered
// wrong) to appear far more often than higher boxes (answered correctly
// again and again) — a sliding scale, not a hard due-date gate. A wrong
// answer always drops a word back to box 1; box 5 retires it as "known".
const MAX_BOX = 5;
const SET_SIZE = 3;
const REVIEW_BATCH_SIZE = 5;

export { MAX_BOX, SET_SIZE, REVIEW_BATCH_SIZE };

export function nextBoxAfterAnswer(box: number, correct: boolean): number {
  return correct ? Math.min(box + 1, MAX_BOX) : 1;
}

// Monotonically decreasing: box 1 → 4, box 2 → 3, box 3 → 2, box 4 → 1.
// Box 5 is "known" and excluded from the active pool before this is called.
export function weightForBox(box: number): number {
  return Math.max(1, MAX_BOX - box);
}

// Weighted sampling without replacement (Efraimidis-Spirakis): each item
// gets a key = random()^(1/weight), and the top-k keys are taken. Higher
// weight pushes the key closer to 1, so it's more likely to rank in the
// top-k, but never guaranteed — a true sliding scale rather than a cutoff.
export function weightedSample<T>(items: { item: T; weight: number }[], k: number): T[] {
  return items
    .map(({ item, weight }) => ({ item, key: Math.random() ** (1 / weight) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((entry) => entry.item);
}

export function startOfUTCDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toUTCDateString(date: Date): string {
  return startOfUTCDay(date).toISOString().slice(0, 10);
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
