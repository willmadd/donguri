import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { TFunction } from "@/lib/i18n/translate";

export function FinalCta({ t }: { t: TFunction }) {
  return (
    <section className="border-t border-card-border bg-washi-soft">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-20 text-center">
        <Image
          src="/images/mascot.png"
          alt="Donguri mascot"
          width={140}
          height={140}
          className="h-auto w-full max-w-[110px] object-contain"
        />

        <h2 className="text-2xl font-bold tracking-tight text-sumi sm:text-3xl">
          {t("final_cta.heading", "Start learning English, one word at a time.")}
        </h2>

        <Button href="/signup" size="lg" className="h-14 bg-shu px-8 hover:bg-shu-dark">
          {t("final_cta.cta", "Start for free")}
        </Button>

        <p className="text-xs text-sumi-soft">
          {t("final_cta.microcopy", "No credit card required.")}
        </p>
      </div>
    </section>
  );
}
