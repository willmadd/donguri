import Link from "next/link";
import { Logo } from "@/components/logo";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: { text: string; linkText: string; href: string };
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-washi px-6 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-sumi/10 bg-washi-soft p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-sumi">{title}</h1>
        <p className="mt-1 text-sm text-sumi-soft">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      {footer && (
        <p className="mt-6 text-sm text-sumi-soft">
          {footer.text}{" "}
          <Link href={footer.href} className="font-medium text-ai hover:text-ai-dark">
            {footer.linkText}
          </Link>
        </p>
      )}
    </div>
  );
}
