"use client";
import { useState } from "react";
import { useTranslations } from "../i18n/locale-provider";

function pickGreeting() {
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const options = ["Welcome", "Welcome back", "Hello", timeGreeting];
  return options[Math.floor(Math.random() * options.length)];
}

// inside your component:

export const Greeting = ({ firstName }: { firstName: string }) => {
  const [greeting] = useState(pickGreeting);
  const t = useTranslations();

  return (
    <div className="mt-6 grid grid-cols-1 items-center gap-8 sm:grid-cols-[5fr_3fr]">
      <div className="min-w-0">
        <p className="font-nunito text-5xl font-extrabold leading-tight sm:text-6xl lg:text-7xl">
          {greeting}, {firstName}
        </p>

        <p className=" text-lg text-sumi-soft">
          {t("dashboard.subheading", "A little practice today goes a long way")}
        </p>
      </div>

      <div className="flex min-w-0 justify-center sm:justify-end">
        <img
          src="/images/london3.webp"
          alt="Donguri peering"
          className="h-auto w-full max-w-md object-contain"
        />
      </div>
    </div>
  );
};
