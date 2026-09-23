import { Logo } from "@/components/logo";
import { HeaderActions } from "@/components/dashboard/header-actions";
import { DevModeProvider } from "@/components/dashboard/dev-mode-context";
import { requireProfile } from "@/lib/dal";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const equippedAccessory = (parseDonguriConfig(profile.donguriConfig)
    .equippedAccessory ?? null) as AccessoryId | null;

  return (
    <DevModeProvider>
      <div className="min-h-screen bg-washi">
        <header className="relative z-50 border-b border-header-border bg-header">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Logo />
            <HeaderActions
              profile={{
                fullName: profile.full_name,
                email: profile.email,
                role: profile.role,
              }}
              equippedAccessory={equippedAccessory}
            />
          </div>
        </header>
        <main className="mx-auto max-w-360 px-6 py-10">{children}</main>
      </div>
    </DevModeProvider>
  );
}
