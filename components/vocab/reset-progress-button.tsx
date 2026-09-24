"use client";

import { useId, useRef, useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
import { resetCourseProgress } from "@/lib/actions/vocab";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

export function ResetProgressButton({ courseId }: { courseId: string }) {
  const t = useTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleReset() {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      try {
        await resetCourseProgress(courseId);
        dialogRef.current?.close();
      } catch {
        setError(true);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        tone="neutral"
        size="sm"
        onClick={() => {
          setError(false);
          dialogRef.current?.showModal();
        }}
        className="hover:border-shu/40 hover:text-shu-dark"
      >
        {t("reset_progress.button", "Reset progress")}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={pending}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-shu/20 bg-washi p-6 text-sumi shadow-2xl backdrop:bg-sumi/40 backdrop:backdrop-blur-[2px] sm:p-8"
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-shu/10 text-shu">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 id={titleId} className="text-xl font-bold">
          {t("reset_progress.title", "Reset your progress?")}
        </h2>
        <div id={descriptionId} className="mt-3 space-y-4 text-sm leading-relaxed text-sumi-soft">
          <p>
            {t(
              "reset_progress.description",
              "This will permanently delete your progress, streaks and review history for this course. It will also reset your account XP and remove all unlocked and equipped accessories.",
            )}
          </p>
          <p className="rounded-xl border border-shu/20 bg-shu/5 px-4 py-3 font-semibold text-shu">
            {t("reset_progress.warning", "This action cannot be undone.")}
          </p>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-shu">
            {t("reset_progress.error", "Couldn't reset your progress. Please try again.")}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            autoFocus
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            disabled={pending}
            onClick={handleReset}
            className="bg-shu text-white hover:bg-shu-dark"
          >
            {pending
              ? t("reset_progress.resetting", "Resetting…")
              : t("reset_progress.button", "Reset progress")}
          </Button>
        </div>
      </dialog>
    </>
  );
}
