import { BookOpen, Flame, Sparkles, Target } from "lucide-react";
import type { DailyActivityCount, WeeklyStats } from "@/lib/definitions";
import { getTranslator } from "@/lib/i18n/server";
import { StreakChart } from "@/components/vocab/streak-chart";

// The course home page's activity card: "Your progress this week" (words
// learnt, accuracy, XP earned, streak — a 2x2 grid) beside the day-by-day
// activity chart. Level/total XP live in the header instead (see
// HeaderStats in components/dashboard/header-actions.tsx).
export async function ActivityOverviewCard({
  dailyActivity,
  currentStreak,
  longestStreak,
  activeToday,
  weeklyStats,
}: {
  dailyActivity: DailyActivityCount[];
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  weeklyStats: WeeklyStats;
}) {
  const { t } = await getTranslator();

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-washi-soft shadow-sm">
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col border-b border-card-border p-6 lg:border-b-0 lg:border-r">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            {t("weekly_stats.title", "Your progress this week")}
          </h2>
          <div className="mt-4 grid flex-1 auto-rows-fr grid-cols-2 gap-3">
            <StatTile
              icon={<BookOpen className="h-5 w-5 fill-ai/20 text-ai" />}
              tileClass="bg-ai-soft"
              iconClass="bg-ai/10"
              value={String(weeklyStats.wordsLearnt)}
              label={t("weekly_stats.words_learnt", "Words learnt")}
            />
            <StatTile
              icon={<Target className="h-5 w-5 text-matcha-dark" />}
              tileClass="bg-matcha-soft"
              iconClass="bg-matcha/15"
              value={
                weeklyStats.accuracy === null ? "—" : `${weeklyStats.accuracy}%`
              }
              label={t("weekly_stats.review_accuracy", "Review accuracy")}
            />
            <StatTile
              icon={<Sparkles className="h-5 w-5 fill-sakura/20 text-sakura" />}
              tileClass="bg-sakura-soft"
              iconClass="bg-sakura/10"
              value={String(weeklyStats.xpEarned)}
              label={t("weekly_stats.xp_earned", "XP earned")}
            />
            <StatTile
              icon={<Flame className="h-5 w-5 fill-kin text-kin" />}
              tileClass="bg-kin/15"
              iconClass="bg-kin/20"
              value={String(currentStreak)}
              label={t("weekly_stats.day_streak", "Day streak")}
            />
          </div>
        </div>

        <StreakChart
          data={dailyActivity}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          activeToday={activeToday}
        />
      </div>
    </div>
  );
}

function StatTile({
  icon,
  tileClass,
  iconClass,
  value,
  label,
}: {
  icon: React.ReactNode;
  tileClass: string;
  iconClass: string;
  value: string;
  label: string;
}) {
  return (
    <div
      className={`flex flex-col items-start gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center ${tileClass}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none text-sumi tabular-nums">
          {value}
        </p>
        <p className="mt-1 text-xs text-sumi-soft">{label}</p>
      </div>
    </div>
  );
}
