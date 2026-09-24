"use client";

import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LeaderboardEntry } from "@/lib/definitions";

function Rank({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <svg
        viewBox="0 0 32 28"
        fill="none"
        className="h-5 w-6"
        aria-label="1st place"
        role="img"
      >
        <path
          d="m2 7 7.5 7L16 2l6.5 12L30 7l-3 18H5L2 7Z"
          fill="#E9B849"
          stroke="#D7A43A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <span
      className={`text-sm font-bold tabular-nums ${
        rank === 2
          ? "text-sumi/70"
          : rank === 3
            ? "text-shu-dark/80"
            : "text-sumi-soft"
      }`}
    >
      {rank}
    </span>
  );
}

export function LeaderboardRow({
  rank,
  entry,
  onRemove,
}: {
  rank: number;
  entry: LeaderboardEntry;
  onRemove?: () => void;
}) {
  const t = useTranslations();

  return (
    <li
      className={`flex min-w-0 items-center gap-2.5 px-2.5 py-1.5 sm:gap-3 sm:px-3 ${
        entry.isSelf
          ? "rounded-lg bg-ai-soft/50"
          : "border-b border-card-border/50 last:border-b-0"
      }`}
    >
      <span className="flex w-6 shrink-0 justify-center">
        <Rank rank={rank} />
      </span>

      <DonguriAvatar
        equippedAccessory={entry.equippedAccessory}
        className="h-8 w-8 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1 text-sm font-semibold text-sumi">
          <span className="truncate">{entry.name}</span>
          {entry.isSelf && (
            <span className="shrink-0 text-xs font-medium text-sumi-soft">
              {t("leaderboard.you_suffix", "(you)")}
            </span>
          )}
        </div>
        <span className="mt-0.5 inline-block rounded-full bg-sumi/5 px-1.5 py-px text-[10px] font-medium leading-4 text-sumi-soft">
          {t("leaderboard.total_xp_pill", "Total {{xp}} XP", { xp: entry.xp })}
        </span>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold leading-4 tabular-nums text-sumi">
          {t("leaderboard.xp_value", "{{xp}} XP", { xp: entry.weeklyXp })}
        </p>
        <p className="text-[10px] leading-4 text-sumi-soft">
          {t("leaderboard.this_week", "this week")}
        </p>
      </div>

      {onRemove && !entry.isSelf && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("leaderboard.remove_aria", "Remove {{name}}", {
            name: entry.name,
          })}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-lg leading-none text-sumi-soft transition hover:bg-shu/10 hover:text-shu-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ai"
        >
          ×
        </button>
      )}
    </li>
  );
}

function LeaderboardPodium({ entries }: { entries: LeaderboardEntry[] }) {
  const t = useTranslations();
  const placements = [
    { entry: entries[1], left: "34%", bottom: "40%", width: "14%" },
    { entry: entries[0], left: "50%", bottom: "48%", width: "16%" },
    { entry: entries[2], left: "66%", bottom: "38%", width: "14%" },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl bg-washi-soft pt-14">
      {/* Place leaderboard-podium.png in public/images. Its own size
          establishes the height, so the podium cannot collapse. */}
      <img
        src="/images/podium2.webp"
        width={1774}
        height={887}
        alt={t(
          "leaderboard.podium_alt",
          "Winners' podium in front of a cheering crowd",
        )}
        className="block h-auto w-full mb-4"
      />
      {placements.map(
        ({ entry, left, bottom, width }) =>
          entry && (
            <div
              key={entry.id}
              className="absolute -translate-x-1/2"
              style={{ left, bottom, width }}
              aria-hidden="true"
            >
              <span
                title={entry.name}
                className="absolute bottom-full left-1/2 mb-1.5 block max-w-[115%] -translate-x-1/2 truncate rounded-full border border-card-border bg-washi px-2 py-0.5 text-[10px] font-semibold leading-4 text-sumi shadow-sm"
              >
                {entry.name}
              </span>
              <DonguriAvatar
                equippedAccessory={entry.equippedAccessory}
                className="h-auto w-full drop-shadow-sm"
              />
            </div>
          ),
      )}
    </div>
  );
}

export function LeaderboardList({
  entries,
  selfTotalXp,
  emptyMessage,
  onRemove,
}: {
  entries: LeaderboardEntry[];
  selfTotalXp: number | null;
  emptyMessage: string;
  onRemove?: (id: string) => void;
}) {
  const t = useTranslations();

  return (
    <section className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-sumi-soft">
            {t("leaderboard.heading", "Leaderboard")}
          </h2>
          <p className="mt-0.5 text-xs text-sumi-soft">
            {t("leaderboard.xp_this_week", "XP this week")}
          </p>
        </div>
        {selfTotalXp !== null && (
          <span className="rounded-full bg-ai-soft/50 px-2.5 py-1 text-xs font-medium text-ai-dark">
            {t("leaderboard.your_total_xp", "Your total: {{xp}} XP", {
              xp: selfTotalXp,
            })}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-washi-soft py-6 text-center text-sm text-sumi-soft">
          {emptyMessage}
        </p>
      ) : (
        <div className="rounded-2xl border border-card-border bg-washi-soft p-2 sm:p-3">
          <LeaderboardPodium entries={entries.slice(0, 3)} />
          <ol className="mt-2">
            {entries.slice(0, 10).map((entry, index) => (
              <LeaderboardRow
                key={entry.id}
                rank={index + 1}
                entry={entry}
                onRemove={onRemove ? () => onRemove(entry.id) : undefined}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
