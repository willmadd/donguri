import Image from "next/image";
import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

export function MeetDonguri({ t }: { t: TFunction }) {
  return (
    <Section tone="washi-soft">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[0.8fr_1.2fr]">
        <div className="flex items-center justify-center">
          <Image
            src="/images/mascot.png"
            alt="Donguri mascot"
            width={320}
            height={320}
            className="h-auto w-full max-w-[220px] object-contain"
          />
        </div>

        <div>
          <SectionHeading
            eyebrow={t("meet_donguri.eyebrow", "Meet Donguri")}
            heading={t("meet_donguri.heading", "Your learning companion.")}
            center={false}
          />
          <p className="mt-4 max-w-md text-sumi-soft">
            {t(
              "meet_donguri.description",
              "Donguri will guide you through lessons, celebrate your progress and help you build a learning habit — one word at a time.",
            )}
          </p>
        </div>
      </div>
    </Section>
  );
}
