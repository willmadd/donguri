import type { TFunction } from "@/lib/i18n/translate";

// A static mockup of a real learn-session card (see
// components/vocab/learn-session.tsx) — same visual language, no live data,
// used purely to show what a lesson looks like before signing up. The
// English word + Japanese translation shown are the actual demo lesson
// content (what the product teaches), so unlike the surrounding chrome they
// always show both languages regardless of the UI locale.
export function LessonPreviewCard({ t }: { t: TFunction }) {
  return (
    <div className="w-full max-w-xs rounded-3xl border border-card-border bg-washi-soft p-6 text-center shadow-sm">
      <p className="text-xs font-medium tracking-wide text-sumi-soft uppercase">
        {t("hero.preview_label", "A new word to learn")}
      </p>

      <div className="mt-3 flex items-center justify-center gap-3">
        <p className="text-4xl font-semibold tracking-tight text-sumi">library</p>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ai-soft text-lg text-ai"
        >
          🔊
        </span>
      </div>

      <p className="mt-2 text-lg text-sumi-soft">ˈlaɪbrəri</p>

      <div className="mx-auto my-5 h-px w-12 bg-sumi/10" />

      <p className="text-2xl font-medium text-ai-dark">図書館</p>

      <div className="mt-6 rounded-2xl bg-washi px-5 py-4 text-left">
        <p className="mb-1 text-xs font-medium tracking-wide text-sumi-soft uppercase">
          {t("hero.preview_example_label", "Example")}
        </p>
        <p className="leading-relaxed text-sumi">I borrowed this book from the library.</p>
      </div>
    </div>
  );
}
