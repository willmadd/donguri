// Shared by the quiz generator (lib/dal.ts) and the admin quiz-questions
// preview (also lib/dal.ts, for the admin page) — cross-references a word's
// forms against its example sentences with no admin tagging required, and
// blanks out whichever form's value an example literally contains as a
// whole word. Because the match is verified against the actual sentence
// text, there's no risk of asking the learner to fill in a form the
// sentence doesn't really demonstrate.

export type ClozeMatch = { formId: string | null; en: string; ja: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word, case-insensitive — so a form value like "you" doesn't match
// inside "yourself", and "Went" still matches "went".
function wholeWordPattern(value: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "i");
}

// Grouped by form (not a flat list) so a random pick can treat every
// qualifying form as equally likely, regardless of how many example
// sentences happen to demonstrate it — a word's own examples often lean
// heavily on its base form (e.g. "hot" appearing far more than "hottest"),
// and picking uniformly across the flat list would drown out the rarer
// forms.
export function findClozeMatchesByForm(
  forms: { id: string; value: string }[],
  examples: { en: string; ja: string }[],
): Map<string, ClozeMatch[]> {
  const byForm = new Map<string, ClozeMatch[]>();

  for (const form of forms) {
    const pattern = wholeWordPattern(form.value);
    const matches: ClozeMatch[] = [];

    for (const example of examples) {
      if (pattern.test(example.en)) {
        matches.push({ formId: form.id, en: example.en.replace(pattern, "___"), ja: example.ja });
      }
    }

    if (matches.length > 0) {
      byForm.set(form.id, matches);
    }
  }

  return byForm;
}

// Fallback for words with no form matches: blanks the word's own term out
// of whichever examples contain it (e.g. "I have ___ pencils" for "four").
// `formId: null` marks the answer as the term itself (see submitFormAnswer).
export function findTermClozeMatches(
  term: string,
  examples: { en: string; ja: string }[],
): ClozeMatch[] {
  const pattern = wholeWordPattern(term);
  return examples
    .filter((example) => pattern.test(example.en))
    .map((example) => ({ formId: null, en: example.en.replace(pattern, "___"), ja: example.ja }));
}

// Two-stage pick — a random form, then a random example for it — so every
// qualifying form gets an equal shot regardless of example count.
export function pickRandomClozeMatch(byForm: Map<string, ClozeMatch[]>): ClozeMatch | undefined {
  const formIds = [...byForm.keys()];
  if (formIds.length === 0) return undefined;

  const formId = formIds[Math.floor(Math.random() * formIds.length)];
  const candidates = byForm.get(formId)!;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
