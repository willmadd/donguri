"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import {
  chatWithCharles,
  type ChatReply,
  type ChatTurn,
} from "./_actions/chat";
import { TARGET_WORDS } from "./_lib/session";

type Message = {
  id: number;
  role: "ai" | "user";
  text: string;
  reply?: ChatReply;
};

const initialMessages: Message[] = [
  {
    id: 1,
    role: "ai",
    text: "Hey! What have you been up to lately?",
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [masteredWords, setMasteredWords] = useState<Set<string>>(new Set());
  const [isReplying, startReply] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const remainingWords = TARGET_WORDS.filter(
    (word) => !masteredWords.has(word),
  );
  const isSessionComplete = remainingWords.length === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isReplying]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || isReplying || isSessionComplete) return;

    const history: ChatTurn[] = messages.map((current) => ({
      role: current.role === "ai" ? "assistant" : "user",
      content:
        current.role === "ai"
          ? (current.reply?.english ?? current.text)
          : current.text,
    }));

    setMessages((currentMessages) => [
      ...currentMessages,
      { id: Date.now(), role: "user", text: message },
    ]);
    setDraft("");
    setError(null);

    startReply(async () => {
      const result = await chatWithCharles(
        history,
        message,
        TARGET_WORDS,
        remainingWords,
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          role: "ai",
          text: result.reply.english,
          reply: result.reply,
        },
      ]);

      if (result.reply.masteredWords.length > 0) {
        setMasteredWords((current) => {
          const next = new Set(current);
          result.reply.masteredWords.forEach((word) => next.add(word));
          return next;
        });
      }
    });
  }

  const feedbackItems = messages.reduce<
    { id: number; userText: string; reply: ChatReply }[]
  >((items, message, index) => {
    if (message.role === "ai" && message.reply) {
      const previous = messages[index - 1];
      if (previous?.role === "user") {
        items.push({
          id: message.id,
          userText: previous.text,
          reply: message.reply,
        });
      }
    }
    return items;
  }, []);

  return (
    <main className="flex min-h-full flex-col items-center gap-10 px-4 py-10 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <h1 className="font-fredoka text-2xl text-sumi">
            Chat with Charles Duck
          </h1>
          <p className="text-sm text-sumi-soft">
            Try to use{" "}
            {TARGET_WORDS.map((word, index) => (
              <span key={word}>
                <strong>{word}</strong>
                {index < TARGET_WORDS.length - 2
                  ? ", "
                  : index === TARGET_WORDS.length - 2
                    ? ", and "
                    : ""}
              </span>
            ))}
            .
          </p>
        </div>

        <ul className="flex gap-2 text-xs">
          {TARGET_WORDS.map((word) => {
            const isMastered = masteredWords.has(word);
            return (
              <li
                key={word}
                className={`rounded-full border px-2 py-0.5 ${
                  isMastered
                    ? "border-ai bg-ai/10 text-ai"
                    : "border-washi-soft text-sumi-soft"
                }`}
              >
                {isMastered ? "✓ " : ""}
                {word}
              </li>
            );
          })}
        </ul>

        <div className="w-[320px] rounded-[2.5rem] bg-sumi p-2 shadow-xl">
          <div className="flex h-150 flex-col overflow-hidden rounded-4xl bg-white">
            <div className="flex items-center justify-center bg-washi-soft py-2">
              <div className="h-5 w-24 rounded-full bg-sumi" />
            </div>

            <div className="flex items-center justify-center gap-2 border-b border-washi-soft bg-white px-4 py-2">
              <Image
                src="/images/charles.webp"
                alt="Charles Duck"
                width={64}
                height={64}
                className="h-6 w-6 rounded-full object-cover"
              />
              <p className="text-sm font-semibold text-sumi">Charles Duck</p>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <Image
                    src={
                      message.role === "user"
                        ? "/images/mascot.png"
                        : "/images/charles.webp"
                    }
                    alt={message.role === "user" ? "You" : "Charles Duck"}
                    width={64}
                    height={64}
                    className="h-7 w-7 shrink-0 rounded-full border border-washi-soft object-cover"
                  />
                  <p
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "rounded-br-sm bg-ai text-white"
                        : "rounded-bl-sm bg-gray-200 text-sumi"
                    }`}
                  >
                    {message.text}
                  </p>
                </div>
              ))}
              {isReplying && (
                <div className="flex items-end gap-2">
                  <Image
                    src="/images/charles.webp"
                    alt="Charles Duck"
                    width={64}
                    height={64}
                    className="h-7 w-7 shrink-0 rounded-full border border-washi-soft object-cover"
                  />
                  <p className="max-w-[75%] rounded-2xl rounded-bl-sm bg-gray-200 px-3 py-2 text-sm text-sumi-soft">
                    …
                  </p>
                </div>
              )}
              {isSessionComplete && (
                <div className="flex justify-center pt-2">
                  <p className="rounded-full bg-ai/10 px-3 py-1 text-xs font-medium text-ai">
                    🎉 Session complete! You used every word naturally.
                  </p>
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-washi-soft bg-white px-3 py-2"
            >
              <label htmlFor="message" className="sr-only">
                Your message
              </label>
              <input
                id="message"
                name="message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={
                  isSessionComplete ? "Session complete!" : "Type a message"
                }
                disabled={isReplying || isSessionComplete}
                className="flex-1 rounded-full border border-washi-soft bg-washi px-3 py-1.5 text-sm text-sumi outline-none focus:border-ai"
              />
              <button
                type="submit"
                disabled={isReplying || isSessionComplete || !draft.trim()}
                className="rounded-full bg-ai px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Send
              </button>
            </form>

            <div className="flex justify-center bg-white pb-2 pt-1">
              <div className="h-1 w-28 rounded-full bg-sumi/60" />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-shu">
            {error}
          </p>
        )}
      </div>

      <div className="w-full max-w-sm">
        <h2 className="mb-2 font-fredoka text-lg text-sumi">Feedback</h2>
        {feedbackItems.length === 0 ? (
          <p className="text-sm text-sumi-soft">
            Send a message to see feedback here.
          </p>
        ) : (
          <ul className="space-y-3">
            {feedbackItems.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-washi-soft bg-washi-soft/60 p-3"
              >
                <p className="text-sm text-sumi-soft">
                  You said: <span className="text-sumi">{item.userText}</span>
                </p>
                <p className="mt-1 text-sm text-sumi">{item.reply.japanese}</p>
                <div className="mt-2 flex gap-3 text-xs text-sumi-soft">
                  <span>Grammar: {item.reply.grammarScore}/10</span>
                  <span>Natural phrasing: {item.reply.naturalnessScore}/10</span>
                </div>
                <p className="mt-2 text-xs text-sumi-soft">
                  {item.reply.feedback}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
