"use client";

import { useState } from "react";

function pickGreeting() {
  const hour = new Date().getHours();

  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const options = ["Welcome", "Welcome back", "Hello", timeGreeting];

  return options[Math.floor(Math.random() * options.length)];
}

function greetingSize(text: string) {
  const length = text.length;

  if (length <= 10) return "text-[4rem] sm:text-[5.5rem]";
  if (length <= 14) return "text-[3.5rem] sm:text-[4.75rem]";
  if (length <= 18) return "text-[3rem] sm:text-[4rem]";
  if (length <= 22) return "text-[2.5rem] sm:text-[3.5rem]";
  if (length <= 26) return "text-[2.125rem] sm:text-[3rem]";

  return "text-[1.875rem] sm:text-[2.625rem]";
}

const inspirationOptions = [
  "小さな一歩も、ちゃんと冒険だよ。",
  "ゆっくり、自分のペースでやろう。",
  "今日の一歩が、明日へつながるよ。",
  "目標は、だんだん近づいてるよ。",
  "君はすごい！",
];

export const Greeting = ({ firstName }: { firstName: string }) => {
  const [greeting] = useState(pickGreeting);

  const [randomInspiration] = useState(
    () =>
      inspirationOptions[Math.floor(Math.random() * inspirationOptions.length)],
  );

  const fullGreeting = `${greeting}, ${firstName}`;

  return (
    <div className="mt-6 grid grid-cols-1 items-center gap-8 sm:grid-cols-[5fr_3fr]">
      <div className="min-w-0">
        <p
          className={`w-fit max-w-full whitespace-nowrap font-nunito font-extrabold leading-[0.95] ${greetingSize(
            fullGreeting,
          )}`}
        >
          {fullGreeting}
        </p>

        <p className="mt-3 text-lg font-bold text-sumi-soft">
          {randomInspiration}
        </p>
      </div>

      <div className="flex min-w-0 justify-center sm:justify-end">
        <img
          src="/images/london4.webp"
          alt="Donguri peering"
          className="h-auto w-full max-w-md object-contain"
        />
      </div>
    </div>
  );
};
