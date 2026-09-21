"use client";

import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LeaderboardEntry } from "@/lib/definitions";

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
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
        entry.isSelf ? "bg-ai-soft/40" : ""
      }`}
    >
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-sumi-soft">
        {rank}
      </span>

      <div className="h-9 w-9 shrink-0">
        <DonguriAvatar
          equippedAccessory={entry.equippedAccessory}
          className="h-9 w-9"
        />
      </div>

      <span className="min-w-0 flex-1 truncate text-sm font-medium text-sumi">
        {entry.name}
        {entry.isSelf && (
          <span className="text-sumi-soft"> {t("leaderboard.you_suffix", "(you)")}</span>
        )}
      </span>

      <span className="shrink-0 text-sm font-semibold text-sumi-soft">
        {t("leaderboard.xp_value", "{{xp}} XP", { xp: entry.xp })}
      </span>

      {onRemove && !entry.isSelf && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("leaderboard.remove_aria", "Remove {{name}}", { name: entry.name })}
          className="shrink-0 text-sumi-soft transition hover:text-shu-dark"
        >
          ×
        </button>
      )}
    </div>
  );
}

function PodiumUser({
  entry,
  rank,
  className,
}: {
  entry: LeaderboardEntry;
  rank: 1 | 2 | 3;
  className: string;
}) {
  const t = useTranslations();

  return (
    <div
      className={`absolute z-10 flex -translate-x-1/2 flex-col items-center ${className}`}
    >
      <div
        className={`mb-1 max-w-[110px] rounded-full px-2 py-1 text-center shadow-sm backdrop-blur-sm ${
          entry.isSelf ? "bg-ai-soft/95" : "bg-washi/90"
        }`}
      >
        <p className="truncate text-xs font-bold leading-tight text-sumi sm:text-sm">
          {entry.name}
          {entry.isSelf && (
            <span className="font-medium text-sumi-soft"> {t("leaderboard.you_suffix", "(you)")}</span>
          )}
        </p>

        <p className="text-[10px] font-semibold leading-tight text-sumi-soft sm:text-xs">
          {t("leaderboard.xp_value", "{{xp}} XP", { xp: entry.xp })}
        </p>
      </div>

      <DonguriAvatar
        equippedAccessory={entry.equippedAccessory}
        className={[
          "drop-shadow-md",
          rank === 1
            ? "h-14 w-14 sm:h-20 sm:w-20"
            : "h-12 w-12 sm:h-16 sm:w-16",
        ].join(" ")}
      />
    </div>
  );
}

function LeaderboardPodium({ entries }: { entries: LeaderboardEntry[] }) {
  const t = useTranslations();
  const first = entries[0];
  const second = entries[1];
  const third = entries[2];

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
      <img
        src="/images/podium.webp"
        alt={t("leaderboard.podium_alt", "Winners' podium in front of a cheering crowd")}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {first && (
        <PodiumUser
          entry={first}
          rank={1}
          className="bottom-[31.5%] left-[50%]"
        />
      )}

      {second && (
        <PodiumUser
          entry={second}
          rank={2}
          className="bottom-[26.5%] left-[25%]"
        />
      )}

      {third && (
        <PodiumUser
          entry={third}
          rank={3}
          className="bottom-[22%] left-[75%]"
        />
      )}
    </div>
  );
}

export function LeaderboardList({
  entries,
  emptyMessage,
  onRemove,
}: {
  entries: LeaderboardEntry[];
  emptyMessage: string;
  onRemove?: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-sumi-soft">{emptyMessage}</p>
    );
  }

  const podiumEntries = entries.slice(0, 3);
  const remainingEntries = entries.slice(3, 9);

  return (
    <div className="mt-4">
      <LeaderboardPodium entries={podiumEntries} />

      {remainingEntries.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          {remainingEntries.map((entry, index) => (
            <LeaderboardRow
              key={entry.id}
              rank={index + 4}
              entry={entry}
              onRemove={onRemove ? () => onRemove(entry.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
