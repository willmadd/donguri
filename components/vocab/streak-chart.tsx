import type { DailyWordCount } from "@/lib/definitions";

function formatDayShort(dateStr: string): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

function formatDayFull(dateStr: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${dateStr}T00:00:00Z`),
  );
}

// A single magnitude series (words learned per day), so one hue end to end —
// no categorical palette to assign or validate. Direct-labeled (the count
// above each bar) rather than a separate axis, since values are small.
export function StreakChart({ data }: { data: DailyWordCount[] }) {
  const max = Math.max(3, ...data.map((day) => day.count));

  return (
    <div className="rounded-2xl border border-sumi/10 bg-washi-soft p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
        Words learned this streak
      </h2>
      <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-1">
        {data.map((day) => (
          <div key={day.date} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-sumi">{day.count}</span>
            <div className="flex h-24 w-full items-end">
              <div
                title={`${day.count} word${day.count === 1 ? "" : "s"} on ${formatDayFull(day.date)}`}
                className="w-full rounded-t bg-ai transition hover:bg-ai-dark"
                style={{ height: `${Math.max((day.count / max) * 100, day.count > 0 ? 6 : 2)}%` }}
              />
            </div>
            <span className="text-[10px] text-sumi-soft/70">{formatDayShort(day.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
