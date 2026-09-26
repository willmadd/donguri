import "server-only";
import OpenAI from "openai";
import { cacheLife } from "next/cache";
import type { ChallengeItem, ChallengeOpener, ChallengeTarget } from "@/lib/daily-challenge";

const MAX_OPENER_LENGTH = 200;
const OPENER_TIMEOUT_MS = 8000;

function describeItem(kind: string, item: ChallengeItem): string {
  const explanation = item.explanation ? ` — ${item.explanation}` : "";
  return `${kind}: "${item.term}" (${item.translation}${explanation})`;
}

// Just the first word of the profile's full name; null when there isn't
// one, so Charles never greets anyone by an email handle.
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

// Works the learner's name into a fixed opener's greeting: "Hi! How was
// your day?" → "Hi Will! How was your day?", "やあ！…" → "やあ、Will！…".
// Left as it is when it doesn't open with a greeting.
function personalise(opener: ChallengeOpener, firstName: string | null): ChallengeOpener {
  if (!firstName) return opener;
  return {
    english: opener.english.replace(/^(Hi|Hey|Hello)([!,])/, `$1 ${firstName}$2`),
    japanese: opener.japanese.replace(/^([^！!、。]{1,6})([！!])/, `$1、${firstName}$2`),
  };
}

function buildOpenerPrompt(target: ChallengeTarget, firstName: string | null): string {
  const targets = [
    target.vocab && describeItem("Word", target.vocab),
    target.grammar && describeItem("Grammar pattern", target.grammar),
  ]
    .filter(Boolean)
    .join("\n");

  return `You write the very first text message that Charles Duck, a friendly English-speaking duck, sends to start a casual chat with a Japanese beginner who is learning English.

Later in the chat, the learner will try to use this naturally:
${targets}

How to write the opener:
- A casual greeting plus ONE simple question. At most 2 short sentences and about 15 words.
${firstName ? `- Greet them by their first name, "${firstName}", in the greeting (e.g. "Hi ${firstName}!"). Use it once only, and keep it exactly as written in the Japanese too.\n` : ""}- Only very common, everyday words a total beginner knows. No idioms, no slang, no phrasal verbs like "been up to", no hard grammar.
- It must sound natural — exactly how a friend would really text.
- Pick an everyday topic that is loosely related to the target, so the chat can drift towards it later. Only loosely: never use the target word or pattern yourself, and don't ask a question whose obvious answer is just the target.
- If the target doesn't point to a clear everyday topic (for example a small word like "the" or "some", or an abstract grammar pattern), don't force it. Instead use the topic of this general opener, reworded in your own way: "${target.fallbackOpener.english}"

Return only a JSON object:
{
	"english": "Charles Duck's opening message",
	"japanese": "A natural, casual Japanese translation of the same message"
}`;
}

// Cached per target (the fallback opener in it is seeded per user, day and
// attempt — see pickChallengeTarget), so reloading the page doesn't pay for
// a fresh generation or show a different opener. Throws on any failure
// rather than returning the fallback, so a failed call is never cached.
async function generateOpener(
  target: ChallengeTarget,
  firstName: string | null,
): Promise<ChallengeOpener> {
  "use cache";
  cacheLife("days");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create(
    {
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: buildOpenerPrompt(target, firstName) }],
    },
    { signal: AbortSignal.timeout(OPENER_TIMEOUT_MS), maxRetries: 0 },
  );

  const parsed: unknown = JSON.parse(response.choices[0]?.message.content ?? "");
  const opener = parsed as Partial<ChallengeOpener> | null;
  if (
    typeof opener?.english !== "string" ||
    typeof opener.japanese !== "string" ||
    !opener.english.trim() ||
    opener.english.length > MAX_OPENER_LENGTH
  ) {
    throw new Error("Invalid opener from model");
  }

  return { english: opener.english.trim(), japanese: opener.japanese.trim() };
}

// Charles Duck's first message for an attempt, greeting the learner by
// first name when there is one: generated to loosely suit
// the target, falling back to the fixed opener pickChallengeTarget chose
// when OpenAI isn't configured or the call fails. Never rejects — the page
// streams this promise to the chat, which waits on it.
export async function getChallengeOpener(
  target: ChallengeTarget,
  firstName: string | null,
): Promise<ChallengeOpener> {
  if (!process.env.OPENAI_API_KEY) return personalise(target.fallbackOpener, firstName);

  try {
    return await generateOpener(target, firstName);
  } catch (error) {
    console.error("Daily challenge opener generation failed:", error);
    return personalise(target.fallbackOpener, firstName);
  }
}
