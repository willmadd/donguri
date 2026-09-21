import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  tone?: "washi" | "washi-soft";
  className?: string;
  children: ReactNode;
};

export function Section({ id, tone = "washi", className, children }: SectionProps) {
  return (
    <section
      id={id}
      className={cn("border-t border-sumi/10", tone === "washi-soft" && "bg-washi-soft")}
    >
      <div className={cn("mx-auto max-w-5xl px-6 py-16 sm:py-20", className)}>{children}</div>
    </section>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  heading: string;
  subtext?: string;
  center?: boolean;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  heading,
  subtext,
  center = true,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col", center && "items-center text-center", className)}>
      {eyebrow && (
        <span className="rounded-full bg-sakura-soft px-4 py-1 text-sm font-medium text-sakura-dark">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-sumi sm:text-3xl">
        {heading}
      </h2>
      {subtext && (
        <p className={cn("mt-2 text-lg text-sumi-soft", center && "max-w-xl")}>{subtext}</p>
      )}
    </div>
  );
}
