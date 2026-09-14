import { LeaderboardList } from "@/components/leaderboard/leaderboard-row";
import type { LeaderboardEntry } from "@/lib/definitions";

export function TopLeaderboardCard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-sumi/10 bg-washi-soft p-6">
      <h2 className="text-sm font-semibold tracking-wide text-sumi-soft uppercase">Top 10</h2>
      <LeaderboardList entries={entries} emptyMessage="No one has earned XP yet." />
    </section>
  );
}
