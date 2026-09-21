import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

// We don't have real testimonials yet — inviting early users in beats
// inventing quotes. Swap this for genuine reviews once they exist.
export function BetaInvite({ t }: { t: TFunction }) {
  return (
    <Section>
      <SectionHeading
        eyebrow={t("beta_invite.eyebrow", "Be one of the first")}
        heading={t("beta_invite.heading", "We're just getting started.")}
      />

      <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-card-border bg-washi-soft p-8 text-center">
        <p className="text-sumi-soft">
          {t(
            "beta_invite.description",
            "Hello Donguri is new, so we don't have learner stories to share just yet. Sign up today and you'll be one of our first learners — your feedback will directly shape what we build next.",
          )}
        </p>
        <Button href="/signup" variant="outline">
          {t("beta_invite.cta", "Join as an early learner")}
        </Button>
      </div>
    </Section>
  );
}
