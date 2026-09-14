"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isAccessoryId, parseDonguriConfig, type AccessoryId } from "@/lib/levels";

export async function equipAccessory(accessoryId: AccessoryId | null): Promise<void> {
  const user = await requireUser();

  if (accessoryId !== null && !isAccessoryId(accessoryId)) {
    throw new Error("Unknown accessory.");
  }

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: user.id },
    select: { donguriConfig: true },
  });

  const config = parseDonguriConfig(profile.donguriConfig);
  const unlocked = new Set(config.unlockedAccessories ?? []);

  if (accessoryId !== null && !unlocked.has(accessoryId)) {
    throw new Error("That accessory hasn't been unlocked yet.");
  }

  // Absent means unlocked (older data, before this flag existed) — only an
  // explicit `false` (set by a previous equip this level) blocks a change.
  if (config.canChooseOutfit === false) {
    throw new Error("Your look is locked in until you next level up.");
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: { donguriConfig: { ...config, equippedAccessory: accessoryId, canChooseOutfit: false } },
  });

  // "page" scope only, and only the profile page — this action is also
  // called from inside the level-up modal, which is shown *on top of* an
  // active test session. A "layout" scope revalidation there would re-render
  // the currently-displayed test route in the same response (same reasoning
  // as the note on `submitAnswer` in lib/actions/vocab.ts), which re-runs
  // `getTestQueue` and can knock the learner back to its empty state mid
  // celebration. The header's avatar/costume badge goes briefly stale until
  // the next `completeQuiz` (which does revalidate the layout) — an
  // acceptable trade-off for not breaking the flow it's shown inside.
  revalidatePath("/dashboard/profile");
}
