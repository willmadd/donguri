import { scoreTone } from "@/components/vocab/challenge-score";
import { cn } from "@/lib/utils";

// A 0-10 daily-challenge score as ten segments: earned ones in the score's
// colour, lost ones faintly red, so where the points went reads at a glance.
// Averages round to the nearest segment.
export function ScoreBar({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const filled = Math.round(score);
  const tone = scoreTone(filled);

  return (
    <span className={cn("flex gap-0.5", className)} aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-sm",
            i < filled ? tone.dot : "bg-shu/25",
          )}
        />
      ))}
    </span>
  );
}
