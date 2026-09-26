import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import type { AccessoryId } from "@/lib/levels";
import { cn } from "@/lib/utils";

// The learner's own Donguri in a slowly turning rainbow ring, for moments
// worth celebrating (a finished challenge, a finished day). Size it with
// className; the ring holds still under reduced motion.
export function RainbowAvatar({
  equippedAccessory,
  className,
}: {
  equippedAccessory: AccessoryId | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-md",
        className,
      )}
    >
      <span
        className="absolute -inset-2 animate-[spin_4s_linear_infinite] motion-reduce:animate-none"
        style={{
          background:
            "conic-gradient(#ff5f6d, #ffb800, #7ed957, #3fc1ff, #8b5cf6, #ff5fa2, #ff5f6d)",
        }}
        aria-hidden
      />
      <span className="relative flex h-[calc(100%-6px)] w-[calc(100%-6px)] items-center justify-center overflow-hidden rounded-full bg-washi">
        <DonguriAvatar
          equippedAccessory={equippedAccessory}
          className="h-full w-full object-cover"
        />
      </span>
    </span>
  );
}
