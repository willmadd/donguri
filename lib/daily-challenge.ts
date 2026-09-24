import { prisma } from "@/lib/prisma";

// What a daily-challenge attempt asks the learner to use in their chat with
// Charles Duck: a vocab word, a grammar point, or one of each in the same
// message.
export type ChallengeItem = {
  term: string;
  translation: string;
  explanation: string | null;
  // Inflected forms (went/gone for "go") — any of them counts as using a
  // vocab word.
  forms: string[];
};

export type ChallengeTarget = {
  vocab: ChallengeItem | null;
  grammar: ChallengeItem | null;
};

// cyrb53-style string hash → mulberry32 PRNG. Deterministic so the page and
// the chat action (which never trusts a client-supplied target) agree on the
// same target, and reloading the page can't reroll an easier one.
function hashSeed(value: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const challengeWordSelect = {
  id: true,
  path: true,
  term: true,
  translation: true,
  explanation: true,
  forms: { select: { value: true }, orderBy: { position: "asc" } },
} as const;

// Picks the target for the user's `attemptIndex`-th attempt (0-based) of
// `challengeDate` in this course. Draws from words the user has already
// started learning; falls back to the whole course when they haven't
// learned anything yet. Null only when the course has no content at all.
export async function pickChallengeTarget(
  userId: string,
  courseId: string,
  challengeDate: Date,
  attemptIndex: number,
): Promise<ChallengeTarget | null> {
  const activeWord = {
    active: true,
    languageDeck: { courseId, active: true },
  };

  let words = await prisma.word.findMany({
    where: { ...activeWord, progress: { some: { userId } } },
    select: challengeWordSelect,
    orderBy: { id: "asc" },
  });

  if (words.length === 0) {
    words = await prisma.word.findMany({
      where: activeWord,
      select: challengeWordSelect,
      orderBy: { id: "asc" },
    });
  }

  const vocab = words.filter((word) => word.path !== "grammar");
  const grammar = words.filter((word) => word.path === "grammar");

  if (vocab.length === 0 && grammar.length === 0) return null;

  const random = mulberry32(
    hashSeed(
      `${userId}:${courseId}:${challengeDate.toISOString().slice(0, 10)}:${attemptIndex}`,
    ),
  );
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  const modes: ("vocab" | "grammar" | "both")[] = [];
  if (vocab.length > 0) modes.push("vocab");
  if (grammar.length > 0) modes.push("grammar");
  if (vocab.length > 0 && grammar.length > 0) modes.push("both");
  const mode = pick(modes);

  const toItem = (word: (typeof words)[number]): ChallengeItem => ({
    term: word.term,
    translation: word.translation,
    explanation: word.explanation,
    forms: word.forms.map((form) => form.value),
  });

  return {
    vocab: mode === "grammar" ? null : toItem(pick(vocab)),
    grammar: mode === "vocab" ? null : toItem(pick(grammar)),
  };
}
