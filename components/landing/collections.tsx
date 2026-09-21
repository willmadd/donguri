import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

// Illustrative catalog cards — swap in real deck data (word counts,
// difficulty, estimated time) once a public per-collection query exists.
export function Collections({ t }: { t: TFunction }) {
  const beginner = t("collections.level_beginner", "Beginner");
  const intermediate = t("collections.level_intermediate", "Intermediate");

  const items = [
    { icon: "🎨", name: t("collections.colours", "Colours"), level: beginner, words: 20, minutes: 10 },
    { icon: "🍙", name: t("collections.food", "Food"), level: beginner, words: 32, minutes: 15 },
    {
      icon: "👨‍👩‍👧",
      name: t("collections.family_and_friends", "Family and friends"),
      level: beginner,
      words: 24,
      minutes: 12,
    },
    { icon: "✈️", name: t("collections.travel", "Travel"), level: intermediate, words: 40, minutes: 20 },
    {
      icon: "💬",
      name: t("collections.everyday_conversations", "Everyday conversations"),
      level: intermediate,
      words: 36,
      minutes: 18,
    },
    {
      icon: "🏢",
      name: t("collections.work_and_school", "Work and school"),
      level: intermediate,
      words: 30,
      minutes: 15,
    },
  ];

  const wordsUnit = t("collections.words_unit", "words");
  const minutesUnit = t("collections.minutes_unit", "min");

  return (
    <Section>
      <SectionHeading
        eyebrow={t("collections.eyebrow", "Explore the learning collections")}
        heading={t("collections.heading", "Pick a topic and start learning words you'll actually use.")}
      />

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex flex-col gap-3 rounded-2xl border border-card-border bg-washi-soft p-6 transition hover:border-ai/40"
          >
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-sakura-soft text-2xl"
            >
              {item.icon}
            </span>
            <p className="font-medium text-sumi">{item.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-sumi-soft">
              <span className="rounded-full border border-sumi/15 px-2.5 py-0.5">{item.level}</span>
              <span className="rounded-full border border-sumi/15 px-2.5 py-0.5">
                {item.words} {wordsUnit}
              </span>
              <span className="rounded-full border border-sumi/15 px-2.5 py-0.5">
                ~{item.minutes} {minutesUnit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
