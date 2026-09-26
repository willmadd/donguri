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

// Charles Duck's first message of an attempt. Always English (it's what
// the learner is practising against, so it never goes through the UI's
// i18n), with a Japanese translation behind the chat's Translate button.
// Normally generated to suit the target (see getChallengeOpener in
// lib/daily-challenge-opener.ts); the fixed ones below are the fallback.
export type ChallengeOpener = {
  english: string;
  japanese: string;
};

export type ChallengeTarget = {
  vocab: ChallengeItem | null;
  grammar: ChallengeItem | null;
  fallbackOpener: ChallengeOpener;
};

// How every piece of learner-facing feedback gets its Japanese twin (the
// chat's per-reply tip, the end-of-attempt summary, the end-of-day review):
// learners read feedback in their native Japanese, but anything from the
// English conversation itself stays in English so they can see exactly
// what it refers to.
export const JAPANESE_FEEDBACK_RULE = `Every "...Ja" field is the same content written in natural, simple Japanese for a beginner (polite です/ます style, no difficult kanji or grammar jargon) — not a word-for-word translation. Inside the Japanese, keep anything that comes from the English conversation in English, in quotes: words or sentences the user wrote, the target word or pattern, words or sentences you said, and any English wording you suggest. For example: 「"I ate some food."」は正しい文ですが、"what" を使って質問に答えるともっと自然です。`;

// One finished attempt, as the end-of-day summary shows it. Scores and the
// message are null for attempts saved before they were recorded.
export type DailyChallengeResult = {
  id: string;
  xpEarned: number;
  targetTerms: string[];
  // targetTerms with each one's Japanese from the course, looked up when
  // read; null if the word has since been renamed or removed.
  targets: { term: string; translation: string | null }[];
  message: string | null;
  grammarScore: number | null;
  naturalnessScore: number | null;
  relevanceScore: number | null;
  complexityScore: number | null;
  overall: string | null;
  overallJa: string | null;
  tips: string[];
  tipsJa: string[];
  betterVersion: string | null;
};

// Short, everyday openers a total beginner can read: common words, one
// clear question each, spread across topics so consecutive attempts don't
// feel the same. Used as-is when generation fails, and as the topic
// suggestion when the target doesn't point to an everyday topic of its own.
const OPENERS: ChallengeOpener[] = [
  { english: "Hi! How was your day?", japanese: "やあ！今日はどうだった？" },
  {
    english: "Hey! Did you eat anything good today?",
    japanese: "ねえ！今日は何かおいしいもの食べた？",
  },
  {
    english: "Hi! What did you do last weekend?",
    japanese: "やあ！先週末は何をしたの？",
  },
  {
    english: "Hey! Do you have any plans for this weekend?",
    japanese: "ねえ！今週末は何か予定ある？",
  },
  {
    english: "Good morning! What did you have for breakfast?",
    japanese: "おはよう！朝ごはんは何を食べた？",
  },
  {
    english: "Hi! What are you doing right now?",
    japanese: "やあ！今何してるの？",
  },
  {
    english: "Hey! Did you sleep well last night?",
    japanese: "ねえ！昨日の夜はよく眠れた？",
  },
  {
    english: "Hi! Do you have any pets?",
    japanese: "やあ！ペットは飼ってる？",
  },
  {
    english: "Hey! What's your favorite food?",
    japanese: "ねえ！好きな食べ物は何？",
  },
  {
    english: "Hi! Where do you want to go on your next trip?",
    japanese: "やあ！次の旅行はどこに行きたい？",
  },
  {
    english: "Hey! Which do you like more, coffee or tea?",
    japanese: "ねえ！コーヒーと紅茶、どっちが好き？",
  },
  {
    english: "Hi! What do you usually do after work or school?",
    japanese: "やあ！仕事や学校のあとは、いつも何してる？",
  },
  {
    english: "Hey! I just had pizza for lunch. What did you have?",
    japanese: "ねえ！お昼にピザを食べたんだ。君は何を食べた？",
  },
  {
    english: "Hi! Do you play any sports?",
    japanese: "やあ！何かスポーツはしてる？",
  },
  {
    english: "Hey! What kind of music do you like?",
    japanese: "ねえ！どんな音楽が好き？",
  },
  {
    english: "Hi! How is your week going?",
    japanese: "やあ！今週はどんな感じ？",
  },
  {
    english: "Hey! Did you go anywhere fun recently?",
    japanese: "ねえ！最近どこか楽しいところに行った？",
  },
  {
    english: "Hi! What made you happy today?",
    japanese: "やあ！今日は何かうれしいことあった？",
  },
  {
    english: "Hey! Have you watched any good movies or shows lately?",
    japanese: "ねえ！最近何かいい映画やドラマを観た？",
  },
  {
    english: "Hi! What's the weather like where you are?",
    japanese: "やあ！そっちの天気はどう？",
  },
  {
    english: "Hey! Do you like cooking?",
    japanese: "ねえ！料理するのは好き？",
  },
  {
    english: "Hi! What's your favorite way to relax?",
    japanese: "やあ！一番好きなリラックス方法は何？",
  },
];

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

  const seed = `${userId}:${courseId}:${challengeDate.toISOString().slice(0, 10)}:${attemptIndex}`;
  const random = mulberry32(hashSeed(seed));
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

  // Its own stream, so adding or reordering openers never changes which
  // word or grammar point an attempt picks.
  const openerRandom = mulberry32(hashSeed(`${seed}:opener`));

  return {
    vocab: mode === "grammar" ? null : toItem(pick(vocab)),
    grammar: mode === "vocab" ? null : toItem(pick(grammar)),
    fallbackOpener: OPENERS[Math.floor(openerRandom() * OPENERS.length)],
  };
}
