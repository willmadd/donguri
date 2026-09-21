import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function HowItWorks({ t }: { t: TFunction }) {
  const steps = [
    {
      icon: "🌱",
      title: t("how_it_works.discover_title", "Discover a new word"),
      description: t(
        "how_it_works.discover_description",
        "See it in context, with an example sentence and a picture.",
      ),
    },
    {
      icon: "🔊",
      title: t("how_it_works.listen_title", "Listen and repeat"),
      description: t(
        "how_it_works.listen_description",
        "Hear natural pronunciation from native audio.",
      ),
    },
    {
      icon: "✅",
      title: t("how_it_works.choose_title", "Choose the correct answer"),
      description: t(
        "how_it_works.choose_description",
        "A quick quiz checks that it's sinking in.",
      ),
    },
    {
      icon: "🔁",
      title: t("how_it_works.review_title", "Review it later"),
      description: t(
        "how_it_works.review_description",
        "It comes back at just the right time to stick.",
      ),
    },
  ];

  return (
    <Section id="how-it-works">
      <SectionHeading
        eyebrow={t("how_it_works.eyebrow", "See how learning works")}
        heading={t("how_it_works.heading", "What actually happens after you sign up.")}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="relative flex flex-col gap-3 rounded-2xl border border-card-border bg-washi-soft p-6"
          >
            <span className="absolute top-4 right-4 text-sm font-semibold text-sumi-soft/50">
              {index + 1}
            </span>
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-soft text-2xl"
            >
              {step.icon}
            </span>
            <div>
              <p className="font-medium text-sumi">{step.title}</p>
            </div>
            <p className="text-sm text-sumi-soft">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
