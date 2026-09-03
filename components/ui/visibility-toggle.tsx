"use client";

import { useOptimistic, useTransition } from "react";

type VisibilityToggleProps = {
  active: boolean;
  // A server action bound to the item's id, left curried on the one
  // remaining `active` argument — e.g. `setWordActive.bind(null, word.id)`.
  toggleAction: (active: boolean) => Promise<void>;
  label: string;
};

// A switch, not a button-with-text: flips instantly via `useOptimistic` while
// the server action runs in the background, then reconciles with whatever
// the server actually persisted once `revalidatePath` refreshes this page's
// data (or reverts on failure, since the base `active` prop never changed).
export function VisibilityToggle({ active, toggleAction, label }: VisibilityToggleProps) {
  const [optimisticActive, setOptimisticActive] = useOptimistic(active);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    const next = !optimisticActive;
    startTransition(async () => {
      setOptimisticActive(next);
      await toggleAction(next);
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-sumi-soft">
        {optimisticActive ? "Visible" : "Hidden"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={optimisticActive}
        aria-label={`${optimisticActive ? "Hide" : "Show"} ${label}`}
        onClick={handleClick}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          optimisticActive ? "bg-matcha" : "bg-sumi/25"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-washi shadow transition-transform ${
            optimisticActive ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
