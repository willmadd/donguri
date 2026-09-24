"use client";

import { useState } from "react";

function pickGreeting() {
  const hour = new Date().getHours();

  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const options = ["Welcome", "Welcome back", "Hello", timeGreeting];

  return options[Math.floor(Math.random() * options.length)];
}

// Scale the greeting to its column rather than the viewport, so it never runs
// into the illustration beside it. ~0.62em is a safe average glyph width for
// Nunito ExtraBold; the floor lets very long names (e.g. email fallback) wrap.
function greetingFontSize(text: string) {
  return `clamp(1.75rem, ${(100 / (text.length * 0.62)).toFixed(2)}cqi, 5.5rem)`;
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
    <div className="mt-2 grid grid-cols-1 items-center gap-6 sm:mt-6 sm:gap-8 sm:grid-cols-[5fr_3fr]">
      <div className="@container min-w-0">
        <p
          className="max-w-full font-nunito font-extrabold leading-[0.95] text-balance wrap-anywhere"
          style={{ fontSize: greetingFontSize(fullGreeting) }}
        >
          {fullGreeting}
        </p>

        <p className="mt-3 text-base font-bold sm:text-lg text-sumi-soft">
          {randomInspiration}
        </p>
      </div>

      <div className="flex min-w-0 justify-center sm:justify-end">
        <img
          src="/images/london4.webp"
          alt="Donguri peering"
          className="h-auto w-full max-w-sm object-contain sm:max-w-md"
        />
      </div>
    </div>
  );
};
