"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import {
  requireUser,
  requireProfile,
  MAX_DAILY_CHALLENGE_ATTEMPTS,
  bumpStreak,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { startOfUTCDay, dailyChallengeXp } from "@/lib/srs";
import {
  JAPANESE_FEEDBACK_RULE,
  pickChallengeTarget,
  type ChallengeItem,
  type ChallengeTarget,
} from "@/lib/daily-challenge";

// A daily-challenge attempt is a chat with Charles Duck in which the learner
// has to work a target word and/or grammar pattern (see pickChallengeTarget)
// into the conversation naturally. The attempt ends on the first message
// that uses the target; that message's scores decide the XP (see dailyChallengeXp in lib/srs.ts). The target is always
// re-derived here rather than taken from the client, and the scores come
// straight from the model, so the client can't award itself XP.

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

// End-of-attempt review, only written for the message that uses the target.
// The ...Ja fields are the Japanese versions (see JAPANESE_FEEDBACK_RULE);
// betterVersion is English-only, since it's the English to learn from.
export type ChallengeSummary = {
  overall: string;
  overallJa: string | null;
  tips: string[];
  // Same order as `tips`; empty when the model didn't return a matching set.
  tipsJa: string[];
  betterVersion: string;
};

export type ChatReply = {
  english: string;
  japanese: string;
  grammarScore: number;
  naturalnessScore: number;
  relevanceScore: number;
  complexityScore: number;
  feedback: string;
  // Japanese version of `feedback`; null if the model left it out.
  feedbackJa: string | null;
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
const SCORE_FIELDS = [
  "grammarScore",
  "naturalnessScore",
  "relevanceScore",
  "complexityScore",
] as const;
// Relevance ceiling for a message that doesn't respond to what Charles just
// said (e.g. dodging his question with one of its own). Kept below
// DAILY_CHALLENGE_PASS_SCORE so a dodge can never earn XP, however fluent
// it sounds — the model tends to score the sentence on its own otherwise.
const NON_RESPONSE_RELEVANCE_CAP = 4;

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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

  const tips = summary.tips.filter((tip): tip is string => typeof tip === "string").slice(0, 3);
  const tipsJa = Array.isArray(summary.tipsJa)
    ? summary.tipsJa.filter((tip): tip is string => typeof tip === "string").slice(0, 3)
    : [];

  return {
    overall: summary.overall,
    overallJa: optionalString(summary.overallJa),
    betterVersion: summary.betterVersion,
    tips,
    // Paired with `tips` by position, so a mismatched list is dropped
    // rather than showing the wrong translation next to a tip.
    tipsJa: tipsJa.length === tips.length ? tipsJa : [],
  };
}

function isChatReply(
  value: unknown,
): value is Omit<ChatReply, "summary"> & { summary?: unknown; respondedToYou?: boolean } {
  if (!value || typeof value !== "object") return false;

  const reply = value as Record<string, unknown>;

  return (
    typeof reply.english === "string" &&
    typeof reply.japanese === "string" &&
    typeof reply.feedback === "string" &&
    typeof reply.usedTarget === "boolean" &&
    (reply.respondedToYou === undefined || typeof reply.respondedToYou === "boolean") &&
    SCORE_FIELDS.every((field) => {
      const score = reply[field];
      return typeof score === "number" && score >= 0 && score <= 10;
    })
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

Return only a JSON object with exactly these fields, in this order:
{
	"assessment": "Private notes for scoring, never shown to the user, 1-2 short sentences: what did you last say or ask, and does the user's latest message actually respond to it?",
	"respondedToYou": true,
	"english": "Charles Duck's simple, casual chat reply in English",
	"japanese": "A natural Japanese translation of the same reply",
	"grammarScore": 0,
	"naturalnessScore": 0,
	"relevanceScore": 0,
	"complexityScore": 0,
	"usedTarget": false,
	"summary": null,
	"feedback": "One short, encouraging sentence with a concrete tip on how the user's latest message could be more natural, correct, or relevant to the conversation — or, if it's already good, richer (e.g. add a reason or a detail) — or a short specific compliment if it's already excellent. If respondedToYou is false, the tip must be about that (e.g. answer my question first, then ask yours). Write it in very simple, beginner-friendly English — short words, short sentences, no grammar jargon.",
	"feedbackJa": "The same feedback in Japanese"
}
respondedToYou is true only if the user's latest message actually responds to what you last said. If you asked a question, it must answer it — even briefly or loosely ("Just some toast!", "I'm not sure"). It is false if the user ignores your question, changes the subject, or replies with a question of their own without answering yours. Asking a question back AFTER answering is great ("Pizza! What about you?") and counts as true.
usedTarget is true only if the user's latest message genuinely uses ${goal} in a real sentence that is part of the conversation — not just listing, quoting, or asking about it. Judge the latest message only, not earlier ones.
grammarScore is an integer from 0 to 10 for the grammatical correctness of the user's latest message, judged on its own, not on relevance. This is casual texting, so ignore capital letters and missing end punctuation. When usedTarget is true, also judge whether the target is used correctly.
naturalnessScore is an integer from 0 to 10 for how natural the WORDING of the user's latest message is — would a native speaker text it this way? Judge the wording only; whether it fits the conversation is relevanceScore.
- 9-10: exactly how a native speaker would text it. 10 only if there is nothing to change.
- 7-8: clear, but a little stiff, textbook-like, or an unusual word choice.
- 4-6: understandable but awkward — a native speaker would not say it like this, or the target is forced in where it doesn't fit.
- 0-3: hard to understand.
relevanceScore is an integer from 0 to 10 for how well the user's latest message responds to what you just said.
- 9-10: responds directly and fully to what you said. 10 only if it's exactly the kind of reply a friend would hope for.
- 7-8: responds, but loosely or only partly.
- 4-6: vague, or only barely connected to what you said.
- 0-3: does not respond — ignores or dodges your question, answers it with an unrelated question, or changes the subject.
If respondedToYou is false, relevanceScore must be ${NON_RESPONSE_RELEVANCE_CAP} or lower. A sentence can sound perfectly natural and still score low for relevance.
complexityScore is an integer from 0 to 10 for how rich and developed the user's latest message is as a sentence, independent of whether it's correct.
- 9-10: connects ideas smoothly — e.g. a reason, a contrast, a time or a detail joined with words like because, but, when, so, or two related sentences — while still sounding like a text, not an essay.
- 7-8: a full sentence with some extra detail (who, where, when, why, or a describing word).
- 4-6: one short, basic sentence.
- 0-3: a single word or a fragment.
Don't reward length for its own sake: rambling, repetitive or overlong messages should not score higher than a tight sentence that connects two ideas.
When usedTarget is true, the chat is over, so "english" should be a short, warm reply that wraps up the chat, and "summary" must be an object reviewing the user's whole performance:
{
	"overall": "2-3 short sentences on how the user did across the whole chat — how well they used the target, and how natural and relevant their replies were",
	"tips": ["Up to 3 short, concrete tips on what they could have done better, each about something they actually wrote. Use an empty list if there is truly nothing to improve."],
	"betterVersion": "A more natural way to say the message where they used the target, still using it. If that message was already perfect, repeat it unchanged.",
	"overallJa": "The same overall review in Japanese",
	"tipsJa": ["The same tips in Japanese, one for each tip above, in the same order"]
}
When usedTarget is false, "summary" must be null. Write the summary in the same very simple, beginner-friendly English as the feedback, with no grammar jargon.
${JAPANESE_FEEDBACK_RULE}
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

    // The model sometimes flags a dodge in respondedToYou but still scores
    // the sentence on its own merits, so the cap is enforced here too.
    const relevanceScore =
      parsed.respondedToYou === false
        ? Math.min(Math.round(parsed.relevanceScore), NON_RESPONSE_RELEVANCE_CAP)
        : Math.round(parsed.relevanceScore);

    reply = {
      english: parsed.english,
      japanese: parsed.japanese,
      feedback: parsed.feedback,
      feedbackJa: optionalString((parsed as { feedbackJa?: unknown }).feedbackJa),
      grammarScore: Math.round(parsed.grammarScore),
      naturalnessScore: Math.round(parsed.naturalnessScore),
      relevanceScore,
      complexityScore: Math.round(parsed.complexityScore),
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

  const xpEarned = dailyChallengeXp(reply);

  await prisma.dailyChallengeAttempt.create({
    data: {
      userId: user.id,
      courseId: enrollment.courseId,
      challengeDate: today,
      xpEarned,
      targetTerms: [target.vocab?.term, target.grammar?.term].filter(
        (term): term is string => term !== undefined,
      ),
      message: trimmedMessage,
      grammarScore: reply.grammarScore,
      naturalnessScore: reply.naturalnessScore,
      relevanceScore: reply.relevanceScore,
      complexityScore: reply.complexityScore,
      summary: reply.summary ?? undefined,
    },
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

  revalidateChallengePaths(courseSlug);

  return {
    ok: true,
    reply,
    completion: { xpEarned, attemptsToday: attemptsToday + 1 },
  };
}

// "layout" scope too: the header's XP/level badge lives in the shared
// dashboard layout, not just the pages under this exact path.
function revalidateChallengePaths(courseSlug: string) {
  revalidatePath(`/dashboard/courses/${courseSlug}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/daily-challenge`);
  revalidatePath("/dashboard", "layout");
}

// Dev-mode tool (admin only): deletes the caller's attempts for today in
// this course so the daily cap stops getting in the way while testing, and
// takes back the XP they earned — with a negative xp_events row, so weekly
// totals stay in step with `profiles.xp`. Re-guarded here, not just hidden
// in the UI, since server actions are callable directly.
export async function resetDailyChallengeToday(
  courseSlug: string,
): Promise<{ ok: boolean }> {
  const profile = await requireProfile();
  if (profile.role !== "admin") return { ok: false };

  const course = await prisma.course.findFirst({
    where: { slug: courseSlug },
    select: { id: true },
  });
  if (!course) return { ok: false };

  const where = {
    userId: profile.id,
    courseId: course.id,
    challengeDate: startOfUTCDay(new Date()),
  };
  try {
    const { _sum } = await prisma.dailyChallengeAttempt.aggregate({
      where,
      _sum: { xpEarned: true },
    });
    const xpToRemove = Math.min(_sum.xpEarned ?? 0, profile.xp);

    await prisma.$transaction([
      prisma.dailyChallengeAttempt.deleteMany({ where }),
      ...(xpToRemove > 0
        ? [
            prisma.profile.update({
              where: { id: profile.id },
              data: { xp: { decrement: xpToRemove } },
            }),
            prisma.xpEvent.create({
              data: { userId: profile.id, amount: -xpToRemove },
            }),
          ]
        : []),
    ]);
  } catch (error) {
    console.error("Daily challenge reset failed:", error);
    return { ok: false };
  }

  revalidateChallengePaths(courseSlug);
  return { ok: true };
}
