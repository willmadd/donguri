import { LeaderboardList } from "@/components/leaderboard/leaderboard-row";
import { getTranslator } from "@/lib/i18n/server";
import type { LeaderboardEntry } from "@/lib/definitions";

export async function TopLeaderboardCard({ entries }: { entries: LeaderboardEntry[] }) {
  const { t } = await getTranslator();

  return (
    <section className="flex h-full flex-col rounded-2xl border border-card-border bg-washi-soft p-6">
      <h2 className="text-sm font-semibold tracking-wide text-sumi-soft uppercase">
        {t("leaderboard.top_10", "Top 10")}
      </h2>
      <LeaderboardList
        entries={entries}
        emptyMessage={t("leaderboard.no_xp_yet", "No one has earned XP yet.")}
      />
    </section>
  );
}
