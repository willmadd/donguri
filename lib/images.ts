// Study-card images are looked up by a naming convention for now
// (`<word>.png`), not a real asset pipeline — there's no `image` column, and
// no files are generated here. The `<img>` element that uses this is
// expected to hide itself gracefully if the file 404s.

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
export function wordImagePath(word: { term: string; translation: string }): string {
  const label = isAsciiWord(word.term) ? word.term : word.translation;
  return `/vocab-images/${slugify(label)}.png`;
}
