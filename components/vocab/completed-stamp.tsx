import { cn } from "@/lib/utils";

// A hanko-style "Completed" rubber stamp laid across a deck card once every
// word in it has been learnt. Purely decorative — the parent must be
// `relative` (and ideally `overflow-hidden`), and the stamp never takes
// pointer events, so the card's own links and buttons stay clickable.
export function CompletedStamp({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center",
        className,
      )}
    >
      <span className="completed-stamp rounded-xl border-[5px] border-double border-shu px-5 py-1.5 font-nunito text-3xl font-extrabold uppercase tracking-[0.2em] text-shu sm:text-4xl">
        {label}
      </span>
    </div>
  );
}
