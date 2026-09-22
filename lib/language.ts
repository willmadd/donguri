// Whether a target-language term can be safely typed on a standard Latin
// keyboard. ASCII-only is a blunt check, but this app's only non-Latin-
// script course right now is Cantonese, so it's precise enough: it decides
// whether a typed quiz question needs a romanized answer (vocab, whose
// `romanization` is a full transliteration of the term) or should avoid
// asking the learner to type the term back at all (grammar, whose
// `romanization` — when present — is just a key-particle pronunciation
// note, not a full transliteration of the pattern).
export function isLatinTypeable(term: string): boolean {
  return /^[\x00-\x7F]*$/.test(term);
}
