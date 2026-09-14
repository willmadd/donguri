import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
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
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${entry.isSelf ? "bg-ai-soft/40" : ""}`}
    >
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-sumi-soft">{rank}</span>
      <div className="h-9 w-9 shrink-0">
        <DonguriAvatar equippedAccessory={entry.equippedAccessory} className="h-9 w-9" />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-sumi">
        {entry.name}
        {entry.isSelf && <span className="text-sumi-soft"> (you)</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold text-sumi-soft">{entry.xp} XP</span>
      {onRemove && !entry.isSelf && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${entry.name}`}
          className="shrink-0 text-sumi-soft transition hover:text-shu-dark"
        >
          ×
        </button>
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
    return <p className="py-4 text-center text-sm text-sumi-soft">{emptyMessage}</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-1">
      {entries.map((entry, index) => (
        <LeaderboardRow
          key={entry.id}
          rank={index + 1}
          entry={entry}
          onRemove={onRemove ? () => onRemove(entry.id) : undefined}
        />
      ))}
    </div>
  );
}
