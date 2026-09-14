import Link from "next/link";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { HeaderXp } from "@/components/dashboard/header-xp";
import { DonguriAvatar } from "@/components/icons/DonguriAvatar";
import { requireProfile } from "@/lib/dal";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const equippedAccessory = (parseDonguriConfig(profile.donguriConfig).equippedAccessory ??
    null) as AccessoryId | null;

  return (
    <div className="min-h-screen bg-washi">
      <header className="border-b border-sumi/10 bg-washi-soft">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <HeaderXp xp={profile.xp} />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0">
                <DonguriAvatar equippedAccessory={equippedAccessory} className="h-10 w-10" />
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
                  {profile.role === "admin" ? "Admin" : "Member"}
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/profile"
              className="inline-flex h-9 items-center justify-center rounded-full border border-sumi/15 px-4 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
            >
              Profile
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
