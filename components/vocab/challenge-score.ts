import { DAILY_CHALLENGE_GOOD_SCORE } from "@/lib/srs";

// Colour for a 0-10 daily-challenge score — shared by the chat's feedback
// panel and the end-of-day summary so the two always agree.
export function scoreTone(score: number) {
  if (score === 10) return { text: "text-matcha-dark", dot: "bg-matcha" };
  if (score >= DAILY_CHALLENGE_GOOD_SCORE) return { text: "text-ai", dot: "bg-ai" };
  return { text: "text-shu", dot: "bg-shu" };
}
