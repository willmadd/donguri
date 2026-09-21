import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

// Hello Donguri has no pricing tiers yet, so a free/paid comparison table
// would be premature — a clear, prominent "it's free" beats that.
export function FreeBanner({ t }: { t: TFunction }) {
  return (
    <Section tone="washi-soft">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="rounded-full bg-matcha-soft px-4 py-1 text-sm font-medium text-matcha-dark">
          {t("free_banner.eyebrow", "Free during early access")}
        </span>
        <SectionHeading heading={t("free_banner.heading", "Every lesson, free — no catches.")} />
        <p className="max-w-md text-sm text-sumi-soft">
          {t(
            "free_banner.description",
            "No credit card, no hidden limits. As Hello Donguri grows we may introduce a paid plan, but everything you see today stays free to use.",
          )}
        </p>
        <Button href="/signup">{t("free_banner.cta", "Start for free")}</Button>
      </div>
    </Section>
  );
}
