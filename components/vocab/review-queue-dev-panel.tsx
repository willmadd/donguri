"use client";

import type { ReviewQueueDebugEntry } from "@/lib/definitions";
import { useTranslations } from "@/components/i18n/locale-provider";
import { useDevMode } from "@/components/dashboard/dev-mode-context";

type ReviewQueueDevPanelProps = {
  entries: ReviewQueueDebugEntry[];
};

// A dev tool, so precise rather than the coarse rounding the learner-facing
// "next review in ..." hint uses elsewhere — rounding a whole-hour count
// (`Math.round(3.67) === 4`) made this display "in 4h" for the entire hour
// from ~3h30m to ~4h29m remaining, which reads as "nothing has counted down
// yet" even though it has. Showing minutes within the hour avoids that.
function formatDueIn(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const pastDue = diffMs <= 0;
  const totalMinutes = Math.round(Math.abs(diffMs) / (60 * 1000));

  if (totalMinutes < 60) {
    return pastDue ? `${totalMinutes}m overdue` : `in ${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 24) {
    const label = minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
    return pastDue ? `${label} overdue` : `in ${label}`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const label = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  return pastDue ? `${label} overdue` : `in ${label}`;
}

export function ReviewQueueDevPanel({ entries }: ReviewQueueDevPanelProps) {
  const t = useTranslations();
  const { enabled } = useDevMode();

  if (!enabled) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-washi-soft">
      <div className="border-b border-sumi/10 px-4 py-3">
        <p className="text-sm font-semibold text-sumi">
          {t("review_queue_dev.title", "Review queue (admin only)")}
        </p>
        <p className="text-xs text-sumi-soft">
          {t(
            "review_queue_dev.subtitle",
            "Every word tracked for this deck — vocabulary and grammar together — and when each one is next due.",
          )}
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-4 text-sm text-sumi-soft">
          {t("review_queue_dev.empty", "Nothing learned in this deck yet.")}
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-washi-soft text-xs uppercase tracking-wide text-sumi-soft">
              <tr>
                <th className="px-4 py-2 font-medium">{t("review_queue_dev.term", "Term")}</th>
                <th className="px-4 py-2 font-medium">{t("review_queue_dev.stage", "Stage")}</th>
                <th className="px-4 py-2 font-medium">{t("review_queue_dev.due", "Due")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.wordId} className="border-t border-sumi/5">
                  <td className="px-4 py-2">
                    <span className="text-sumi">{entry.term}</span>
                    <span className="ml-1.5 text-sumi-soft">— {entry.translation}</span>
                  </td>
                  <td className="px-4 py-2 text-sumi-soft">
                    {entry.stage}. {entry.stageName}
                  </td>
                  <td className="px-4 py-2 text-sumi-soft">
                    {entry.lastSeenAt === null
                      ? t("review_queue_dev.not_quizzed", "not quizzed yet")
                      : entry.nextReviewAt === null
                        ? t("review_queue_dev.mastered", "mastered")
                        : formatDueIn(entry.nextReviewAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
