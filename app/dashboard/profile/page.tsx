import type { Metadata } from "next";
import { requireProfile } from "@/lib/dal";
import { ProfileForm } from "@/components/profile/profile-form";
import { DonguriCharacterCard } from "@/components/donguri/donguri-character-card";
import { XpCounter } from "@/components/xp/xp-counter";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle } from "@/components/ui/page-heading";
import { levelForXp, parseDonguriConfig, type AccessoryId } from "@/lib/levels";
import { getTranslator } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Profile — Donguri",
};

export default async function ProfilePage() {
  const profile = await requireProfile();
  const { t } = await getTranslator();

  const donguriConfigText = profile.donguriConfig ? JSON.stringify(profile.donguriConfig, null, 2) : "";
  const config = parseDonguriConfig(profile.donguriConfig);
  const unlockedAccessories = (config.unlockedAccessories ?? []) as AccessoryId[];
  const equippedAccessory = (config.equippedAccessory ?? null) as AccessoryId | null;
  // Absent means unlocked (older data, before this flag existed).
  const canChooseOutfit = config.canChooseOutfit ?? true;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { label: t("profile_page.title", "Profile") },
          ]}
        />
        <PageTitle>{t("profile_page.heading", "Your profile")}</PageTitle>
      </div>

      <DonguriCharacterCard
        level={levelForXp(profile.xp)}
        unlockedAccessories={unlockedAccessories}
        initialEquippedAccessory={equippedAccessory}
        initialCanChooseOutfit={canChooseOutfit}
      />

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-card-border bg-washi-soft p-6">
        <div>
          <h2 className="font-semibold text-sumi">{t("profile_page.xp_title", "Experience points")}</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            {t(
              "profile_page.xp_description",
              "+1 XP per correct quiz answer, +5 for a perfect quiz, and a growing bonus for every consecutive day you keep your streak going (+0.5 more each day you do a quiz — day 2 is +0.5, day 3 is +1, and so on). Level up to upgrade your Donguri character — unlocking new outfits, and more content to come.",
            )}
          </p>
        </div>
        <XpCounter value={profile.xp} />
      </div>

      <div className="max-w-lg rounded-2xl border border-card-border bg-washi-soft p-8">
        <ProfileForm fullName={profile.full_name ?? ""} donguriConfigText={donguriConfigText} />
      </div>
    </div>
  );
}
