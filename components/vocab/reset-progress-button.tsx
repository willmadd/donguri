"use client";

import { useState, useTransition } from "react";
import { resetCourseProgress } from "@/lib/actions/vocab";

export function ResetProgressButton({ courseId }: { courseId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      await resetCourseProgress(courseId);
      setConfirming(false);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
        confirming
          ? "border-shu bg-shu/5 text-shu-dark"
          : "border-sumi/15 text-sumi-soft hover:border-shu/40 hover:text-shu-dark"
      }`}
    >
      {pending ? "Resetting…" : confirming ? "Click again to confirm" : "Reset progress"}
    </button>
  );
}
