import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { HeaderActions } from "@/components/dashboard/header-actions";
import { DevModeProvider } from "@/components/dashboard/dev-mode-context";
import { getGlobalStreak, requireProfile } from "@/lib/dal";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DevModeProvider>
      <div className="min-h-screen bg-washi">
        <header className="relative z-50 border-b border-header-border bg-header">
          <div className="mx-auto flex max-w-360 items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <Logo wordmarkClassName="sr-only md:not-sr-only" />
            {/* The session reads live behind their own boundary so they don't
                hold up the page below — on a full page load the page's data
                streams in parallel with the header's instead of after it. */}
            <Suspense fallback={<div className="h-10" />}>
              <DashboardHeaderActions />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto max-w-360 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      </div>
    </DevModeProvider>
  );
}

async function DashboardHeaderActions() {
  const [profile, { currentStreak }] = await Promise.all([requireProfile(), getGlobalStreak()]);
  const equippedAccessory = (parseDonguriConfig(profile.donguriConfig)
    .equippedAccessory ?? null) as AccessoryId | null;

  return (
    <HeaderActions
      profile={{
        fullName: profile.full_name,
        email: profile.email,
        role: profile.role,
      }}
      equippedAccessory={equippedAccessory}
      currentStreak={currentStreak}
      xp={profile.xp}
    />
  );
}
