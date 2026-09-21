import { imageUrl } from "@/lib/bunny";

// Words uploaded through the admin panel have a real `imageKey` pointing at
// a bunny.net object. Older words with no upload yet fall back to a naming
// convention (`<word>.webp` under public/vocab-images/) — the `<img>`
// element that uses this is expected to hide itself gracefully if the file
// 404s.

function isAsciiWord(value: string): boolean {
  return /^[\x20-\x7e]+$/.test(value);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Picks whichever of `term`/`translation` is ASCII (so it works regardless
// of which side of a course pair is English, e.g. Cantonese `term` falls
// back to the English `translation`).
export function wordImagePath(word: {
  term: string;
  translation: string;
  imageKey?: string | null;
}): string {
  if (word.imageKey) {
    return imageUrl(word.imageKey);
  }

  const label = isAsciiWord(word.term) ? word.term : word.translation;
  return `/vocab-images/${slugify(label)}.webp`;
}

// A deck's cover photo has no naming-convention fallback like words do
// (there's nothing to slugify a deck by) — null just means "no cover set",
// and callers render without one.
export function deckCoverImagePath(deck: { coverImageKey?: string | null }): string | null {
  return deck.coverImageKey ? imageUrl(deck.coverImageKey) : null;
}
