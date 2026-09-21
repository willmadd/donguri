"use client";

import { useState, useTransition } from "react";
import { resetCourseProgress } from "@/lib/actions/vocab";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function ResetProgressButton({ courseId }: { courseId: string }) {
  const t = useTranslations();
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
    <Button
      variant="outline"
      tone={confirming ? "danger" : "neutral"}
      size="sm"
      disabled={pending}
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      className={confirming ? "border-shu bg-shu/5" : "hover:border-shu/40 hover:text-shu-dark"}
    >
      {pending
        ? t("reset_progress.resetting", "Resetting…")
        : confirming
          ? t("reset_progress.confirm", "Click again to confirm")
          : t("reset_progress.button", "Reset progress")}
    </Button>
  );
}
