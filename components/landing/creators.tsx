import Image from "next/image";
import { Section, SectionHeading } from "@/components/landing/section";
import type { TFunction } from "@/lib/i18n/translate";

// Scaffold copy — replace with the real story, a real photo/illustration of
// the team, and how lesson content actually gets reviewed once that's
// written down. Keeping this section honest matters more than filling it in.
export function Creators({ t }: { t: TFunction }) {
  return (
    <Section>
      <SectionHeading
        eyebrow={t("creators.eyebrow", "Created with care")}
        heading={t("creators.heading", "A small team, made with care.")}
      />

      <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-6 text-center">
        <Image
          src="/images/mascot.png"
          alt="Hello Donguri team illustration"
          width={160}
          height={160}
          className="h-auto w-full max-w-[120px] object-contain"
        />

        <p className="text-sumi-soft">
          {t(
            "creators.description",
            "Hello Donguri is made by a small team who care about language learning and about getting the details right for Japanese speakers learning English. Every lesson is written and checked before it reaches you, and we're always refining it based on how people actually learn.",
          )}
        </p>
      </div>
    </Section>
  );
}
