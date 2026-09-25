import "server-only";
import OpenAI from "openai";
import { cacheLife } from "next/cache";
import type { DailyChallengeResult } from "@/lib/daily-challenge";

const REVIEW_TIMEOUT_MS = 12000;

// Charles Duck's look back over the day's attempts on the end-of-day
// summary: a short paragraph on how the learner did overall, plus the one
// thing most worth practising next.
export type DailyChallengeReview = {
  feedback: string;
  focus: string;
};

function describeAttempt(result: DailyChallengeResult, index: number): string {
  const scores =
    result.grammarScore === null
      ? "not recorded"
      : `grammar ${result.grammarScore}/10, natural phrasing ${result.naturalnessScore}/10, relevance ${result.relevanceScore}/10, complexity ${result.complexityScore}/10`;

  return [
    `Challenge ${index + 1} — target: ${result.targetTerms.map((term) => `"${term}"`).join(" + ") || "unknown"}`,
    result.message && `Their message: "${result.message}"`,
    `Scores: ${scores}`,
    result.overall && `Notes: ${result.overall}`,
    result.tips.length > 0 && `Tips given: ${result.tips.join(" / ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Cached on the results themselves, so revisiting the summary doesn't pay
// for a new review. Throws on failure so a failed call is never cached.
async function generateReview(
  results: DailyChallengeResult[],
): Promise<DailyChallengeReview> {
  "use cache";
  cacheLife("days");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create(
    {
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Charles Duck, a kind English-speaking friend who has just finished today's chat challenges with a Japanese beginner learning English. In each challenge they had to use a target word or grammar pattern naturally in a chat with you. Here is how each one went:

${results.map(describeAttempt).join("\n\n")}

Look across all of them together, not one at a time, and write:
- "feedback": 2-3 short sentences on how they did today overall — start with something specific they did well, then the main pattern you noticed across their messages.
- "focus": ONE short, concrete thing to practise next time, based on what actually came up today.

Write in very simple, beginner-friendly English — short words, short sentences, no grammar jargon. Be warm and encouraging but honest; don't invent problems that didn't happen.

Return only a JSON object: { "feedback": "...", "focus": "..." }`,
        },
      ],
    },
    { signal: AbortSignal.timeout(REVIEW_TIMEOUT_MS), maxRetries: 0 },
  );

  const parsed: unknown = JSON.parse(
    response.choices[0]?.message.content ?? "",
  );
  const review = parsed as Partial<DailyChallengeReview> | null;
  if (
    typeof review?.feedback !== "string" ||
    typeof review.focus !== "string"
  ) {
    throw new Error("Invalid daily challenge review from model");
  }

  return { feedback: review.feedback.trim(), focus: review.focus.trim() };
}

// Null when there's nothing to review, OpenAI isn't configured or the call
// fails — the summary still shows each attempt's own notes without it.
export async function getDailyChallengeReview(
  results: DailyChallengeResult[],
): Promise<DailyChallengeReview | null> {
  if (
    !process.env.OPENAI_API_KEY ||
    results.every((result) => result.message === null)
  ) {
    return null;
  }

  try {
    return await generateReview(results);
  } catch (error) {
    console.error("Daily challenge review generation failed:", error);
    return null;
  }
}
