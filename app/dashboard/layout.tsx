import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { HeaderXp } from "@/components/dashboard/header-xp";
import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { requireProfile } from "@/lib/dal";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";
import { getTranslator } from "@/lib/i18n/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const equippedAccessory = (parseDonguriConfig(profile.donguriConfig)
    .equippedAccessory ?? null) as AccessoryId | null;
  const { t } = await getTranslator();

  return (
    <div className="min-h-screen bg-washi">
      <header className="border-b border-header-border bg-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <HeaderXp xp={profile.xp} />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0">
                <DonguriAvatar
                  equippedAccessory={equippedAccessory}
                  className="h-10 w-10"
                />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-sumi">
                  {profile.full_name ?? profile.email}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    profile.role === "admin"
                      ? "bg-shu/10 text-shu-dark"
                      : "bg-matcha-soft text-matcha-dark"
                  }`}
                >
                  {profile.role === "admin"
                    ? t("dashboard_layout.role_admin", "Admin")
                    : t("dashboard_layout.role_member", "Member")}
                </span>
              </div>
            </div>
            <Button href="/dashboard/profile" variant="outline" size="sm">
              {t("dashboard_layout.profile", "Profile")}
            </Button>
            <LogoutButton />
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
