import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function Method({ t }: { t: TFunction }) {
  const modes = [
    { icon: "👁️", label: t("method.mode_recognise", "Recognise") },
    { icon: "👂", label: t("method.mode_listen", "Listen") },
    { icon: "🧠", label: t("method.mode_recall", "Recall") },
  ];

  return (
    <Section tone="washi-soft">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
        <div>
          <SectionHeading
            eyebrow={t("method.eyebrow", "A learning method that helps words stick")}
            heading={t("method.heading", "Words that actually stay with you.")}
            center={false}
          />

          <p className="mt-4 max-w-md text-sumi-soft">
            {t(
              "method.description",
              "Hello Donguri introduces words gradually and brings them back at the right time. You'll practise recognising, listening to and recalling each word — not simply read through a list.",
            )}
          </p>

          <p className="mt-3 max-w-md text-sm text-sumi-soft">
            {t(
              "method.spaced_repetition",
              "Behind the scenes, a spaced-repetition schedule tracks every word you learn and resurfaces it just as you're about to forget it.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {modes.map((mode) => (
            <div
              key={mode.label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-sumi/10 bg-washi p-5 text-center"
            >
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha-soft text-2xl"
              >
                {mode.icon}
              </span>
              <p className="text-sm font-medium text-sumi">{mode.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
