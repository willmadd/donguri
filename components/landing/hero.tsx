import { Button } from "@/components/ui/button";
import { LessonPreviewCard } from "@/components/landing/lesson-preview-card";
import type { TFunction } from "@/lib/i18n/translate";

export function Hero({ t }: { t: TFunction }) {
  return (
    <section className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-6 py-16 sm:py-20 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-14 md:py-24">
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <span className="rounded-full bg-sakura-soft px-4 py-1 text-sm font-medium text-sakura-dark">
          {t("hero.eyebrow", "Welcome to Hello Donguri")}
        </span>

        <h1 className="mt-6 max-w-2xl text-3xl font-bold tracking-tight text-sumi sm:text-4xl">
          {t("hero.headline", "Make English a small part of every day.")}
        </h1>

        <p className="mt-4 max-w-xl text-lg text-sumi-soft">
          {t(
            "hero.subtext",
            "Learn useful English vocabulary through short, friendly lessons designed for Japanese speakers.",
          )}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button href="/signup" size="lg" className="h-14 bg-shu px-8 hover:bg-shu-dark">
            {t("hero.cta_primary", "Start for free")}
          </Button>

          <Button href="#how-it-works" variant="outline" size="lg" className="h-14 px-8">
            {t("hero.cta_secondary", "Explore lessons")}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <LessonPreviewCard t={t} />
      </div>
    </section>
  );
}
