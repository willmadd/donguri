"use server";

import OpenAI from "openai";
import { MASTERY_THRESHOLD } from "../_lib/session";

export type ChatReply = {
  english: string;
  japanese: string;
  grammarScore: number;
  naturalnessScore: number;
  feedback: string;
  wordsUsed: string[];
  masteredWords: string[];
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatActionResult =
  | { success: true; reply: ChatReply }
  | { success: false; error: string };

const MAX_HISTORY_TURNS = 16;

type LLMReply = {
  english: string;
  japanese: string;
  grammarScore: number;
  naturalnessScore: number;
  feedback: string;
};

function isLLMReply(value: unknown): value is LLMReply {
  if (!value || typeof value !== "object") return false;

  const reply = value as Record<string, unknown>;

  return (
    typeof reply.english === "string" &&
    typeof reply.japanese === "string" &&
    typeof reply.feedback === "string" &&
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

function detectWordsUsed(sentence: string, targetWords: string[]): string[] {
  return targetWords.filter((word) =>
    new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(sentence),
  );
}

function formatWordList(words: string[]): string {
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function buildSystemPrompt(
  targetWords: string[],
  remainingWords: string[],
): string {
  const allWords = formatWordList(targetWords);
  const focusWords = formatWordList(
    remainingWords.length > 0 ? remainingWords : targetWords,
  );

  return `You are Charles Duck, the user's kind English-speaking friend. You two are just texting casually — this is NOT a classroom and you are not a teacher. You want the user to practice saying ${allWords} themselves, but you never announce that or make it feel like a lesson.

How to chat:
- Read the whole conversation so far and keep the thread going naturally, the way a real friend remembers what was just said.
- Talk about simple, everyday topics a friend would bring up, and mix them up — don't lean on the same topic (like the weather) every time. Pick from things like food, drinks, the weekend, school or work, a trip, a hobby, a game, a movie or show, pets, family, sports, and so on. Don't stay on one topic for more than two or three replies in a row — after that, switch to a different one.
- Use very simple, short sentences, like you are talking to a total beginner. Only common, everyday words — no idioms, no rare or advanced vocabulary, no hard grammar. 1-3 short sentences per reply.
- Never use the words ${allWords} yourself, in English or Japanese. Leave those words for the user. Instead, ask simple questions that invite the user to describe or compare things in their own words (for example: "What did you do last weekend?", "Tell me about your favorite food.", "What's something you don't like doing?").
- Right now, gently steer the conversation toward chances for the user to use: ${focusWords} — pick whichever everyday topic would make that word come up naturally. Once the user has already used a word naturally with strong grammar and natural phrasing, don't ask for it again — shift toward whichever of ${allWords} is still missing.
- If the conversation drifts somewhere that doesn't invite one of those words, bring it back within a turn or two by switching to a new simple topic, without lecturing the user about it.
- If the user's latest message is only one or two words, or is vague and doesn't really answer what you just asked (even if it's a full sentence), warmly ask them to say a little more — invite a reason, a detail, or a follow-up thought that connects back to your question — so the chat keeps flowing. Do this kindly, like a friend who wants to hear more, never like a teacher grading length.
- If the user already used one of the target words, react warmly to what they said, and only mention a grammar or phrasing tweak if it would genuinely help — keep it brief and kind. If it's already good, just say so and move on.
- If the user hasn't used a target word yet, don't point that out directly — just ask another simple question that invites them to describe or compare something.
- Keep the chat going until every one of ${allWords} has been used naturally with strong grammar and natural phrasing — that has not happened yet, so do not say goodbye, wrap up, or hint that the chat is ending. If the user tries to end the chat early (says bye, gotta go, etc.), kindly keep it going with a new simple, friendly question.
- Never break character or mention that this is a language exercise, scoring, or practice.

Return only a JSON object with exactly these fields:
{
	"english": "Charles Duck's simple, casual chat reply in English",
	"japanese": "A natural Japanese translation of the same reply",
	"grammarScore": 0,
	"naturalnessScore": 0,
	"feedback": "One short, encouraging sentence with a concrete tip on how the user's latest message could be more natural, correct, or relevant to the conversation (for example, if it was vague or didn't really answer your question, kindly say so and suggest what detail to add), or a short specific compliment if it's already excellent. Write it in very simple, beginner-friendly English — short words, short sentences, no grammar jargon (no words like 'comparative', 'superlative', 'clause', 'tense')."
}
grammarScore is an integer from 0 to 10 for the grammatical correctness of the user's latest message, judged on its own.
naturalnessScore is an integer from 0 to 10 for how natural the user's latest message sounds AND how relevant it is as a reply to what you just said. A message can be grammatically perfect but still score low on naturalnessScore if it is vague, evasive, or doesn't actually connect to your last question or comment — a real friend's reply always relates to what was just asked. For example, replying "I couldn't tell" to "What have you been up to lately?" with no detail about what they couldn't tell, or an answer that ignores your question and talks about something unrelated, should score low on naturalnessScore even if the grammar is fine.
If the user's latest message is just casual chat without a full sentence using the target words, score generously based on general grammar/naturalness rather than penalizing them for not using the words yet.
Do not score based on spelling alone, and do not invent a correction when the sentence is already natural.`;
}

export async function chatWithCharles(
  history: ChatTurn[],
  sentence: string,
  targetWords: string[],
  remainingWords: string[],
): Promise<ChatActionResult> {
  const trimmedSentence = sentence.trim();

  if (!trimmedSentence) {
    return { success: false, error: "Please write a sentence first." };
  }

  if (trimmedSentence.length > 500) {
    return {
      success: false,
      error: "Please keep your sentence under 500 characters.",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error:
        "OpenAI is not configured. Add OPENAI_API_KEY to your environment.",
    };
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const recentHistory = history.slice(-MAX_HISTORY_TURNS);
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(targetWords, remainingWords),
        },
        ...recentHistory.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        {
          role: "user",
          content: trimmedSentence,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      return { success: false, error: "Charles Duck did not send a reply." };
    }

    const parsedReply: unknown = JSON.parse(content);
    if (!isLLMReply(parsedReply)) {
      return { success: false, error: "Charles Duck sent an invalid reply." };
    }

    const wordsUsed = detectWordsUsed(trimmedSentence, targetWords);
    const masteredWords =
      parsedReply.grammarScore >= MASTERY_THRESHOLD &&
      parsedReply.naturalnessScore >= MASTERY_THRESHOLD
        ? wordsUsed
        : [];

    return {
      success: true,
      reply: { ...parsedReply, wordsUsed, masteredWords },
    };
  } catch (error) {
    console.error("OpenAI chat request failed:", error);
    return {
      success: false,
      error: "Charles Duck could not reply right now. Please try again.",
    };
  }
}
