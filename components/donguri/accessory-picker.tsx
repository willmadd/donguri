"use client";

import { useState } from "react";
import Image from "next/image";
import { equipAccessory } from "@/lib/actions/donguri";
import { ACCESSORIES, type AccessoryId } from "@/lib/levels";
import { useTranslations } from "@/components/i18n/locale-provider";

type AccessoryPickerProps = {
  unlockedAccessories: AccessoryId[];
  equippedAccessory: AccessoryId | null;
  // Any just-unlocked accessories — shown with a "New!" badge.
  highlightAccessories?: AccessoryId[];
  // True once the learner has already made their pick for this level —
  // locked until their next level-up reopens it. Always false in the
  // level-up modal itself, since that's the choice window opening.
  locked?: boolean;
  onEquipped?: (id: AccessoryId | null) => void;
};

export function AccessoryPicker({
  unlockedAccessories,
  equippedAccessory,
  highlightAccessories = [],
  locked = false,
  onEquipped,
}: AccessoryPickerProps) {
  const t = useTranslations();
  const [current, setCurrent] = useState(equippedAccessory);
  const [pending, setPending] = useState(false);

  const handleEquip = async (id: AccessoryId | null) => {
    if (pending || locked || id === current) return;

    setPending(true);

    try {
      await equipAccessory(id);
      setCurrent(id);
      onEquipped?.(id);
    } finally {
      setPending(false);
    }
  };

  const unlocked = ACCESSORIES.filter((accessory) => unlockedAccessories.includes(accessory.id));
  const disabled = pending || locked;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleEquip(null)}
          className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-sm font-medium transition disabled:cursor-not-allowed ${
            locked ? "opacity-50" : "disabled:opacity-60"
          } ${
            current === null
              ? "border-ai bg-ai-soft/40 text-ai-dark"
              : "border-sumi/10 bg-washi hover:border-ai/40"
          }`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-washi-soft text-2xl">
            🌰
          </span>
          {t("accessory_picker.none", "None")}
        </button>

        {unlocked.map((accessory) => (
          <button
            key={accessory.id}
            type="button"
            disabled={disabled}
            onClick={() => handleEquip(accessory.id)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-sm font-medium transition disabled:cursor-not-allowed ${
              locked ? "opacity-50" : "disabled:opacity-60"
            } ${
              current === accessory.id
                ? "border-ai bg-ai-soft/40 text-ai-dark"
                : "border-sumi/10 bg-washi hover:border-ai/40"
            }`}
          >
            {highlightAccessories.includes(accessory.id) && (
              <span className="absolute -top-2 -right-2 rounded-full bg-shu px-2 py-0.5 text-[10px] font-bold text-washi">
                {t("accessory_picker.new_badge", "New!")}
              </span>
            )}
            <Image
              src={accessory.image}
              alt={accessory.label}
              width={64}
              height={67}
              className="h-16 w-16 rounded-full bg-washi-soft object-cover"
            />
            {accessory.label}
          </button>
        ))}
      </div>

      {locked && (
        <p className="mt-3 text-center text-sm text-sumi-soft">
          {t(
            "accessory_picker.locked",
            "Your look is locked in — change it again next time you level up.",
          )}
        </p>
      )}
    </div>
  );
}
