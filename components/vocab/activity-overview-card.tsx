import type { DailyActivityCount } from "@/lib/definitions";
import type { AccessoryId } from "@/lib/levels";
import { getTranslator } from "@/lib/i18n/server";
import { StreakChart } from "@/components/vocab/streak-chart";
import { ShareProgressButton } from "@/components/vocab/share-progress-button";
import { XpCounter } from "@/components/xp/xp-counter";
import { DonguriAvatar } from "@/components/icons/DonguriAvatar";

// The unified card for a course's home page: character + XP/level + share
// on the left, the day-by-day activity chart (with the account-wide streak)
// on the right. XP/level reuse the exact same XpCounter the header badge
// renders — driven by the same `Profile.xp`, not a re-derived number — so
// this never disagrees with what the header shows.
export async function ActivityOverviewCard({
  courseTitle,
  dailyActivity,
  currentStreak,
  longestStreak,
  activeToday,
  xp,
  equippedAccessory,
}: {
  courseTitle: string;
  dailyActivity: DailyActivityCount[];
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  xp: number;
  equippedAccessory: AccessoryId | null;
}) {
  const { t } = await getTranslator();

  const roundedXp = Math.round(xp);
  const shareText =
    currentStreak > 0
      ? t(
          "share_progress.text_streak",
          "🔥 {{streak}}-day streak learning {{course}} on Donguri — {{xp}} XP and counting!",
          { streak: currentStreak, course: courseTitle, xp: roundedXp },
        )
      : t(
          "share_progress.text_no_streak",
          "Learning {{course}} on Donguri — {{xp}} XP and counting!",
          { course: courseTitle, xp: roundedXp },
        );

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-washi-soft shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-4 border-b border-card-border p-6 text-center lg:border-b-0 lg:border-r">
          <div className="h-20 w-20 shrink-0">
            <DonguriAvatar equippedAccessory={equippedAccessory} className="h-20 w-20" />
          </div>
          <XpCounter value={xp} />
          <ShareProgressButton shareText={shareText} />
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
