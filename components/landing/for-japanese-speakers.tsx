import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function ForJapaneseSpeakers({ t }: { t: TFunction }) {
  const points = [
    t("for_japanese_speakers.point_sounds", "English sounds Japanese learners often find difficult"),
    t("for_japanese_speakers.point_translations", "Natural translations rather than literal translations"),
    t("for_japanese_speakers.point_vocabulary", "Common vocabulary for everyday situations"),
    t("for_japanese_speakers.point_comparisons", "Explanations that compare English and Japanese"),
    t("for_japanese_speakers.point_mistakes", "Typical mistakes made by Japanese learners"),
  ];

  return (
    <Section tone="washi-soft">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
        <SectionHeading
          eyebrow={t("for_japanese_speakers.eyebrow", "Built especially for Japanese speakers")}
          heading={t(
            "for_japanese_speakers.heading",
            "English learning designed for Japanese speakers.",
          )}
          center={false}
        />

        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-2xl border border-sumi/10 bg-washi p-4"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shu/10 text-sm font-bold text-shu-dark"
              >
                ✓
              </span>
              <p className="text-sumi">{point}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
