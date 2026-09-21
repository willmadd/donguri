import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function PracticalEnglish({ t }: { t: TFunction }) {
  const situations = [
    { icon: "🍽️", label: t("practical_english.restaurant", "Ordering in a restaurant") },
    { icon: "👋", label: t("practical_english.introducing", "Introducing yourself") },
    { icon: "🧭", label: t("practical_english.directions", "Asking for directions") },
    { icon: "🎣", label: t("practical_english.hobbies", "Talking about your hobbies") },
    { icon: "🪧", label: t("practical_english.signs", "Understanding common signs") },
    { icon: "💬", label: t("practical_english.conversation", "Having a simple conversation") },
  ];

  return (
    <Section>
      <SectionHeading
        eyebrow={t("practical_english.eyebrow", "Learn practical English")}
        heading={t("practical_english.heading", "Not just vocabulary — things you can actually say.")}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {situations.map((situation) => (
          <div
            key={situation.label}
            className="flex items-center gap-3 rounded-2xl border border-card-border bg-washi-soft p-5"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-soft text-xl"
            >
              {situation.icon}
            </span>
            <p className="font-medium text-sumi">{situation.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
