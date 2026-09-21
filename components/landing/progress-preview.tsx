import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

// Illustrative stats — mirrors the real dashboard's shape (see
// app/dashboard/courses/[slug]/page.tsx and header-xp.tsx), not live data.
export function ProgressPreview({ t }: { t: TFunction }) {
  const daysUnit = t("progress_preview.days_unit", "days");
  const wordsUnit = t("progress_preview.words_unit", "words");

  const stats = [
    { icon: "📚", label: t("progress_preview.words_learned", "Words learned"), value: "128" },
    {
      icon: "🔥",
      label: t("progress_preview.current_streak", "Current streak"),
      value: `12 ${daysUnit}`,
    },
    { icon: "📈", label: t("progress_preview.course_progress", "Course progress"), value: "64%" },
    {
      icon: "🔁",
      label: t("progress_preview.review_queue", "Review queue"),
      value: `7 ${wordsUnit}`,
    },
  ];

  return (
    <Section tone="washi-soft">
      <SectionHeading
        heading={t("progress_preview.heading", "See yourself improve, one step at a time.")}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-2 rounded-2xl border border-sumi/10 bg-washi p-6 text-center"
          >
            <span aria-hidden="true" className="text-2xl">
              {stat.icon}
            </span>
            <p className="text-2xl font-semibold text-sumi">{stat.value}</p>
            <p className="text-sm text-sumi-soft">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-kin/30 bg-kin/10 p-4 text-center">
        <span aria-hidden="true" className="text-xl">
          🏆
        </span>
        <p className="text-sm text-sumi-soft">
          {t(
            "progress_preview.achievements",
            "Unlock new looks for your Donguri and earn achievements as you learn.",
          )}
        </p>
      </div>
    </Section>
  );
}
