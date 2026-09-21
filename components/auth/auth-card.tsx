import Link from "next/link";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: { text: string; linkText: string; href: string };
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-washi px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Logo />
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-washi-soft p-8 shadow-sm">
        <PageTitle>{title}</PageTitle>
        <PageSubtitle className="text-sm">{subtitle}</PageSubtitle>
        <div className="mt-6 relative">
          <img
            src="/images/donguri-peering.webp"
            alt="Coming Soon"
            className="absolute h-52 -right-33"
          />

          {children}
        </div>
      </div>
      {footer && (
        <p className="mt-6 text-sm text-sumi-soft">
          {footer.text}{" "}
          <Link
            href={footer.href}
            className="font-medium text-ai hover:text-ai-dark"
          >
            {footer.linkText}
          </Link>
        </p>
      )}
    </div>
  );
}
