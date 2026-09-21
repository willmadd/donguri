"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AccessoryPicker } from "@/components/donguri/accessory-picker";
import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import { ShareButton } from "@/components/ui/share-button";
import { Button } from "@/components/ui/button";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { AccessoryId } from "@/lib/levels";

const CONFETTI_COLORS = ["#c0392b", "#3f8f5f", "#3d7dc4", "#e0a92e", "#b5548f"];

type ConfettiPiece = { id: number; x: number; rotate: number; delay: number; color: string };

function randomConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    x: (Math.random() - 0.5) * 340,
    rotate: Math.random() * 360,
    delay: Math.random() * 0.3,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  }));
}

// Randomness has to happen outside of render (component render must stay a
// pure function), so the burst starts empty and is generated once in an
// effect right after mount — imperceptible, since this only ever mounts
// client-side in response to a user finishing a quiz.
function useConfetti(count: number): ConfettiPiece[] {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time random burst generated after mount, since render itself must stay pure (no Math.random there).
    setConfetti(randomConfetti(count));
  }, [count]);

  return confetti;
}

type LevelUpModalProps = {
  newLevel: number;
  newlyUnlockedAccessories: AccessoryId[];
  unlockedAccessories: AccessoryId[];
  equippedAccessory: AccessoryId | null;
  onDone: (equippedAccessory: AccessoryId | null) => void;
};

export function LevelUpModal({
  newLevel,
  newlyUnlockedAccessories,
  unlockedAccessories,
  equippedAccessory,
  onDone,
}: LevelUpModalProps) {
  const t = useTranslations();
  const [phase, setPhase] = useState<"celebrate" | "choose">("celebrate");
  const [chosen, setChosen] = useState<AccessoryId | null>(equippedAccessory);
  const confetti = useConfetti(18);

  const hasNewAccessories = newlyUnlockedAccessories.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sumi/60 p-4">
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-washi-soft p-8 text-center shadow-xl"
      >
        {phase === "celebrate" && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            {confetti.map((piece) => (
              <motion.span
                key={piece.id}
                initial={{ x: 0, y: -20, opacity: 1, rotate: 0 }}
                animate={{ x: piece.x, y: 220, opacity: 0, rotate: piece.rotate }}
                transition={{ duration: 1.4, delay: piece.delay, ease: "easeOut" }}
                className="absolute h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: piece.color }}
              />
            ))}
          </div>
        )}

        {phase === "celebrate" ? (
          <>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.15 }}
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-ai text-4xl font-bold text-washi shadow-lg"
            >
              {newLevel}
            </motion.div>

            <PageTitle className="mt-5">{t("level_up.title", "Level up!")}</PageTitle>

            <PageSubtitle className="mt-2">
              {hasNewAccessories
                ? t(
                    "level_up.reached_with_accessories",
                    "You've reached Level {{level}} and unlocked new looks for your Donguri.",
                    { level: newLevel },
                  )
                : t("level_up.reached", "You've reached Level {{level}}.", { level: newLevel })}
            </PageSubtitle>

            <Button
              size="lg"
              fullWidth
              onClick={() => setPhase("choose")}
              className="mt-7 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
            >
              {t("level_up.choose_look", "Choose your look")}
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-sumi">
              {t("level_up.pick_a_look", "Pick a look")}
            </h1>

            <div className="mx-auto mt-4 flex w-40 justify-center">
              <DonguriAvatar equippedAccessory={chosen} className="w-40" />
            </div>

            <div className="mt-5">
              <AccessoryPicker
                unlockedAccessories={unlockedAccessories}
                equippedAccessory={equippedAccessory}
                highlightAccessories={newlyUnlockedAccessories}
                onEquipped={setChosen}
              />
            </div>

            <div className="mt-7 flex flex-col gap-3">
              <ShareButton
                title={t("level_up.share_title", "Donguri")}
                text={t("level_up.share_text", "I just reached Level {{level}} in Donguri! 🌰", {
                  level: newLevel,
                })}
              />
              <Button
                size="lg"
                fullWidth
                onClick={() => onDone(chosen)}
                className="shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              >
                {t("common.continue", "Continue")}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
