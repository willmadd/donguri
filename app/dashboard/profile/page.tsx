import type { Metadata } from "next";
import { requireProfile } from "@/lib/dal";
import { ProfileForm } from "@/components/profile/profile-form";
import { XpCounter } from "@/components/xp/xp-counter";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = {
  title: "Profile — Donguri",
};

export default async function ProfilePage() {
  const profile = await requireProfile();

  const donguriConfigText = profile.donguriConfig ? JSON.stringify(profile.donguriConfig, null, 2) : "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard" label="Dashboard" />
        <h1 className="text-2xl font-semibold text-sumi">Your profile</h1>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-sumi/10 bg-washi-soft p-6">
        <div>
          <h2 className="font-semibold text-sumi">Experience points</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            Earned by answering quiz questions correctly — +1 per question, +5 for a perfect quiz.
          </p>
        </div>
        <XpCounter value={profile.xp} />
      </div>

      <div className="max-w-lg rounded-2xl border border-sumi/10 bg-washi-soft p-8">
        <ProfileForm fullName={profile.full_name ?? ""} donguriConfigText={donguriConfigText} />
      </div>
    </div>
  );
}
