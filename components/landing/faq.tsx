import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function Faq({ t }: { t: TFunction }) {
  const faqs = [
    {
      q: t("faq.beginners_q", "Is Hello Donguri suitable for complete beginners?"),
      a: t(
        "faq.beginners_a",
        "Yes. Lessons start with the most common, everyday words and build up gradually, so you don't need any prior English knowledge to get started.",
      ),
    },
    {
      q: t("faq.japanese_q", "Are the explanations available in Japanese?"),
      a: t(
        "faq.japanese_a",
        "Yes — every word and example comes with a clear Japanese explanation alongside the English.",
      ),
    },
    {
      q: t("faq.daily_time_q", "How much should I study each day?"),
      a: t(
        "faq.daily_time_a",
        "Just five minutes a day is enough to make steady progress. You can always do more if you're enjoying it.",
      ),
    },
    {
      q: t("faq.mobile_q", "Can I use it on my phone?"),
      a: t("faq.mobile_a", "Yes, Hello Donguri works in your phone's browser — no app install required."),
    },
    {
      q: t("faq.free_q", "Is it free?"),
      a: t("faq.free_a", "Yes, Hello Donguri is completely free to use during early access."),
    },
    {
      q: t("faq.payment_q", "Do I need to enter payment details?"),
      a: t(
        "faq.payment_a",
        "No. You can create an account and start learning without entering any payment information.",
      ),
    },
    {
      q: t("faq.progress_q", "How is my progress saved?"),
      a: t(
        "faq.progress_a",
        "Your progress is saved to your account as you learn, so it's there whenever you come back — on any device.",
      ),
    },
    {
      q: t("faq.cancel_q", "Can I cancel at any time?"),
      a: t(
        "faq.cancel_a",
        "There's nothing to cancel — Hello Donguri is free, and you can stop or come back whenever you like.",
      ),
    },
  ];

  return (
    <Section>
      <SectionHeading
        eyebrow={t("faq.eyebrow", "Frequently asked questions")}
        heading={t("faq.heading", "Everything you might be wondering.")}
      />

      <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-3">
        {faqs.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-2xl border border-card-border bg-washi-soft p-5 open:pb-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-sumi marker:content-none">
              {faq.q}
              <span
                aria-hidden="true"
                className="shrink-0 text-sumi-soft transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-sumi-soft">{faq.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
