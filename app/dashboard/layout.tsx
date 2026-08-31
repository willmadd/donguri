import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { requireProfile } from "@/lib/dal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen bg-washi">
      <header className="border-b border-sumi/10 bg-washi-soft">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
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
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
