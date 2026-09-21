import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function Benefits({ t }: { t: TFunction }) {
  const items = [
    { icon: "⏱️", label: t("benefits.five_minutes", "Learn in just five minutes a day") },
    { icon: "🗾", label: t("benefits.japanese_support", "Clear Japanese explanations") },
    { icon: "🔊", label: t("benefits.native_audio", "Hear natural English pronunciation") },
    { icon: "🔁", label: t("benefits.smart_review", "Remember words through smart reviews") },
  ];

  return (
    <Section tone="washi-soft">
      <SectionHeading
        eyebrow={t("benefits.eyebrow", "Why Hello Donguri?")}
        heading={t("benefits.heading", "Built to fit your day.")}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi p-6 text-center"
          >
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-ai-soft text-2xl"
            >
              {item.icon}
            </span>
            <p className="font-medium text-sumi">{item.label}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
