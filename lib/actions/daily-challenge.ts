"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { requireUser, MAX_DAILY_CHALLENGE_ATTEMPTS, bumpStreak } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { startOfUTCDay, dailyChallengeXp } from "@/lib/srs";
import {
  pickChallengeTarget,
  type ChallengeItem,
  type ChallengeTarget,
} from "@/lib/daily-challenge";

// A daily-challenge attempt is a chat with Charles Duck in which the learner
// has to work a target word and/or grammar pattern (see pickChallengeTarget)
// into the conversation naturally. The attempt ends on the first message
// that uses the target; that message's grammar and naturalness scores
// decide the XP (see dailyChallengeXp in lib/srs.ts). The target is always
// re-derived here rather than taken from the client, and the scores come
// straight from the model, so the client can't award itself XP.

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

// End-of-attempt review, only written for the message that uses the target.
export type ChallengeSummary = {
  overall: string;
  tips: string[];
  betterVersion: string;
};

export type ChatReply = {
  english: string;
  japanese: string;
  grammarScore: number;
  naturalnessScore: number;
  feedback: string;
  usedTarget: boolean;
  summary: ChallengeSummary | null;
};

export type ChallengeCompletion = {
  xpEarned: number;
  attemptsToday: number;
};

export type SendDailyChallengeMessageResult =
  | { ok: true; reply: ChatReply; completion: ChallengeCompletion | null }
  | {
      ok: false;
      reason: "not_enrolled" | "limit_reached" | "no_content" | "error";
      error?: string;
    };

const MAX_HISTORY_TURNS = 16;
const MAX_MESSAGE_LENGTH = 500;

function parseSummary(value: unknown): ChallengeSummary | null {
  if (!value || typeof value !== "object") return null;

  const summary = value as Record<string, unknown>;
  if (
    typeof summary.overall !== "string" ||
    typeof summary.betterVersion !== "string" ||
    !Array.isArray(summary.tips)
  ) {
    return null;
  }

  return {
    overall: summary.overall,
    betterVersion: summary.betterVersion,
    tips: summary.tips.filter((tip): tip is string => typeof tip === "string").slice(0, 3),
  };
}

function isChatReply(
  value: unknown,
): value is Omit<ChatReply, "summary"> & { summary?: unknown } {
  if (!value || typeof value !== "object") return false;

  const reply = value as Record<string, unknown>;

  return (
    typeof reply.english === "string" &&
    typeof reply.japanese === "string" &&
    typeof reply.feedback === "string" &&
    typeof reply.usedTarget === "boolean" &&
    typeof reply.grammarScore === "number" &&
    typeof reply.naturalnessScore === "number" &&
    reply.grammarScore >= 0 &&
    reply.grammarScore <= 10 &&
    reply.naturalnessScore >= 0 &&
    reply.naturalnessScore <= 10
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Guards against the model claiming a vocab word was used when it wasn't —
// the term itself or any of its forms must actually appear. Grammar
// patterns can't be matched like this, so those are left to the model.
function containsVocab(sentence: string, item: ChallengeItem): boolean {
  return [item.term, ...item.forms].some((form) =>
    new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(form.trim())}(?![\\p{L}\\p{N}])`,
      "iu",
    ).test(sentence),
  );
}

function describeItem(item: ChallengeItem): string {
  const forms =
    item.forms.length > 0 ? ` — any form counts: ${item.forms.join(", ")}` : "";
  const explanation = item.explanation ? `; ${item.explanation}` : "";
  return `"${item.term}" (${item.translation}${explanation})${forms}`;
}

function describeTarget(target: ChallengeTarget): string {
  if (target.vocab && target.grammar) {
    return `the word ${describeItem(target.vocab)} together with the grammar pattern ${describeItem(target.grammar)}, both in the same message`;
  }
  if (target.grammar) return `the grammar pattern ${describeItem(target.grammar)}`;
  return `the word ${describeItem(target.vocab!)}`;
}

function buildSystemPrompt(target: ChallengeTarget): string {
  const goal = describeTarget(target);

  return `You are Charles Duck, the user's kind English-speaking friend. You two are just texting casually — this is NOT a classroom and you are not a teacher. You want the user to practice using ${goal} themselves, but you never announce that or make it feel like a lesson.

How to chat:
- Read the whole conversation so far and keep the thread going naturally, the way a real friend remembers what was just said.
- Talk about simple, everyday topics a friend would bring up, and mix them up — food, drinks, the weekend, school or work, a trip, a hobby, a game, a movie or show, pets, family, sports, and so on.
- Use very simple, short sentences, like you are talking to a total beginner. Only common, everyday words — no idioms, no rare or advanced vocabulary, no hard grammar. 1-3 short sentences per reply.
- Never use the target word or grammar pattern yourself, in English or Japanese. Leave it for the user. Instead, ask simple questions whose most natural answer would use it.
- If the conversation drifts somewhere that doesn't invite the target, bring it back within a turn or two by switching to a new simple topic, without lecturing the user about it.
- If the user's latest message is only one or two words, or is vague and doesn't really answer what you just asked, warmly ask them to say a little more.
- If the user tries to end the chat early, kindly keep it going with a new simple, friendly question.
- Never break character or mention that this is a language exercise, scoring, or practice.

Return only a JSON object with exactly these fields:
{
	"english": "Charles Duck's simple, casual chat reply in English",
	"japanese": "A natural Japanese translation of the same reply",
	"grammarScore": 0,
	"naturalnessScore": 0,
	"usedTarget": false,
	"summary": null,
	"feedback": "One short, encouraging sentence with a concrete tip on how the user's latest message could be more natural, correct, or relevant to the conversation, or a short specific compliment if it's already excellent. Write it in very simple, beginner-friendly English — short words, short sentences, no grammar jargon."
}
usedTarget is true only if the user's latest message genuinely uses ${goal} in a real sentence that is part of the conversation — not just listing, quoting, or asking about it. Judge the latest message only, not earlier ones.
grammarScore is an integer from 0 to 10 for the grammatical correctness of the user's latest message, judged on its own. When usedTarget is true, also judge whether the target is used correctly.
naturalnessScore is an integer from 0 to 10 for how natural the user's latest message sounds AND how relevant it is as a reply to what you just said. A message that forces the target in awkwardly, or ignores your question just to use it, should score low even if the grammar is fine.
When usedTarget is true, the chat is over, so "english" should be a short, warm reply that wraps up the chat, and "summary" must be an object reviewing the user's whole performance:
{
	"overall": "2-3 short sentences on how the user did across the whole chat — how well they used the target, and how natural and relevant their replies were",
	"tips": ["Up to 3 short, concrete tips on what they could have done better, each about something they actually wrote. Use an empty list if there is truly nothing to improve."],
	"betterVersion": "A more natural way to say the message where they used the target, still using it. If that message was already perfect, repeat it unchanged."
}
When usedTarget is false, "summary" must be null. Write the summary in the same very simple, beginner-friendly English as the feedback, with no grammar jargon.
Be honest and strict: 10 means flawless and exactly what a native speaker would text in this situation. Give 10 only when there is truly nothing to improve.
Do not score based on spelling alone, and do not invent a correction when the sentence is already natural.`;
}

export async function sendDailyChallengeMessage(
  courseSlug: string,
  history: ChatTurn[],
  message: string,
): Promise<SendDailyChallengeMessageResult> {
  const user = await requireUser();
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return { ok: false, reason: "error", error: "Please write a message first." };
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      reason: "error",
      error: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.`,
    };
  }

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

  const target = await pickChallengeTarget(
    user.id,
    enrollment.courseId,
    today,
    attemptsToday,
  );

  if (!target) {
    return { ok: false, reason: "no_content" };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      reason: "error",
      error: "OpenAI is not configured. Add OPENAI_API_KEY to your environment.",
    };
  }

  let reply: ChatReply;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(target) },
        ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
          role: turn.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(turn.content).slice(0, MAX_MESSAGE_LENGTH * 2),
        })),
        { role: "user", content: trimmedMessage },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      return { ok: false, reason: "error", error: "Charles Duck did not send a reply." };
    }

    const parsed: unknown = JSON.parse(content);
    if (!isChatReply(parsed)) {
      return { ok: false, reason: "error", error: "Charles Duck sent an invalid reply." };
    }

    const usedTarget =
      parsed.usedTarget &&
      (!target.vocab || containsVocab(trimmedMessage, target.vocab));

    reply = {
      ...parsed,
      grammarScore: Math.round(parsed.grammarScore),
      naturalnessScore: Math.round(parsed.naturalnessScore),
      usedTarget,
      summary: usedTarget ? parseSummary(parsed.summary) : null,
    };
  } catch (error) {
    console.error("OpenAI daily challenge request failed:", error);
    return {
      ok: false,
      reason: "error",
      error: "Charles Duck could not reply right now. Please try again.",
    };
  }

  if (!reply.usedTarget) {
    return { ok: true, reply, completion: null };
  }

  const xpEarned = dailyChallengeXp(reply.grammarScore, reply.naturalnessScore);

  await prisma.dailyChallengeAttempt.create({
    data: { userId: user.id, courseId: enrollment.courseId, challengeDate: today },
  });

  await bumpStreak(user.id, enrollment.courseId, today);

  if (xpEarned > 0) {
    await prisma.$transaction([
      prisma.profile.update({
        where: { id: user.id },
        data: { xp: { increment: xpEarned } },
      }),
      prisma.xpEvent.create({
        data: { userId: user.id, amount: xpEarned },
      }),
    ]);
  }

  revalidatePath(`/dashboard/courses/${courseSlug}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/daily-challenge`);
  // "layout" scope too: the header's XP/level badge lives in the shared
  // dashboard layout, not just the pages under this exact path.
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    reply,
    completion: { xpEarned, attemptsToday: attemptsToday + 1 },
  };
}
