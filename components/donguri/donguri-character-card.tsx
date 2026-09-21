"use client";

import { useState } from "react";
import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import { AccessoryPicker } from "@/components/donguri/accessory-picker";
import { ShareButton } from "@/components/ui/share-button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { AccessoryId } from "@/lib/levels";

type DonguriCharacterCardProps = {
  level: number;
  unlockedAccessories: AccessoryId[];
  initialEquippedAccessory: AccessoryId | null;
  initialCanChooseOutfit: boolean;
};

export function DonguriCharacterCard({
  level,
  unlockedAccessories,
  initialEquippedAccessory,
  initialCanChooseOutfit,
}: DonguriCharacterCardProps) {
  const t = useTranslations();
  const [equipped, setEquipped] = useState(initialEquippedAccessory);
  const [canChoose, setCanChoose] = useState(initialCanChooseOutfit);

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-card-border bg-washi-soft p-6">
      <div className="w-40">
        <DonguriAvatar equippedAccessory={equipped} className="w-40" />
      </div>

      {unlockedAccessories.length > 0 ? (
        <div className="w-full">
          <p className="mb-2 text-center text-sm font-medium text-sumi-soft">
            {t("character_card.your_look", "Your look")}
          </p>
          <AccessoryPicker
            unlockedAccessories={unlockedAccessories}
            equippedAccessory={equipped}
            locked={!canChoose}
            onEquipped={(id) => {
              setEquipped(id);
              setCanChoose(false);
            }}
          />
        </div>
      ) : (
        <p className="text-center text-sm text-sumi-soft">
          {t(
            "character_card.unlock_hint",
            "Reach Level 1 (10 XP) in a quiz to unlock your first accessory.",
          )}
        </p>
      )}

      <ShareButton
        title={t("level_up.share_title", "Donguri")}
        text={t("character_card.share_text", "I'm Level {{level}} in Donguri! 🌰", { level })}
      />
    </div>
  );
}
