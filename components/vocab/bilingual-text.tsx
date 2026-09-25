import { cn } from "@/lib/utils";

type Props = {
  en: string;
  ja: string | null | undefined;
  className?: string;
};

// Daily-challenge feedback in both languages: the Japanese first, as the
// main text learners read in their own language, with the original English
// underneath as a smaller sub-line. Just the English when there's no
// Japanese (older attempts, or the model leaving it out). Spans rather than
// divs so it can sit inside a <p>. No hooks, so Server and Client
// Components can both render it.
export function BilingualText({ en, ja, className }: Props) {
  if (!ja) {
    return (
      <span lang="en" className={className}>
        {en}
      </span>
    );
  }

  return (
    <span className={cn("flex flex-col gap-1", className)}>
      <span lang="ja">{ja}</span>
      <span lang="en" className="text-xs leading-snug text-sumi-soft">
        {en}
      </span>
    </span>
  );
}
