import * as z from "zod";
import type { AccessoryId } from "@/lib/levels";

export const LoginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }).trim(),
});

export const SignupFormSchema = z.object({
  firstName: z.string().min(1, { error: "First name is required." }).trim(),
  lastName: z.string().min(1, { error: "Last name is required." }).trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." })
    .trim(),
});

export const ForgotPasswordFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
});

export const ResetPasswordFormSchema = z.object({
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." })
    .trim(),
});

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type SignupFormState =
  | {
      errors?: {
        firstName?: string[];
        lastName?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type ForgotPasswordFormState =
  | {
      errors?: {
        email?: string[];
      };
      message?: string;
      success?: boolean;
    }
  | undefined;

export type ResetPasswordFormState =
  | {
      errors?: {
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export const AdminResetPasswordFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." })
    .trim(),
});

export type AdminResetPasswordFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
      success?: boolean;
    }
  | undefined;

export type UserRole = "admin" | "user";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  xp: number;
  donguriConfig: unknown;
  first_name: string | null;
  last_name: string | null;
};

// Streaks live on the enrollment, not the profile — each course is its own
// independent track.
export type CourseStreak = {
  currentStreak: number;
  longestStreak: number;
};

// Which side of a word pair the quiz prompts with: the term is the word in
// the language being learned, the translation is its meaning in the
// learner's base language. Generic across every course/language pair.
export type QuizDirection = "term-to-translation" | "translation-to-term";

// A cross-deck topical tag with its own admin-managed color — see the note
// on the `WordCategory` Prisma model. Distinct from a "category" elsewhere
// in this file/app, which means a deck (`LanguageDeck`).
export const WORD_TYPES = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "phrase",
  "numeral",
  "particle",
] as const;

export type WordType = (typeof WORD_TYPES)[number];

export type WordCategoryOption = {
  id: string;
  name: string;
  color: string;
};

export type WordFormSummary = {
  id: string;
  labelEn: string;
  labelJa: string;
  value: string;
};

export type WordExampleSummary = {
  id: string;
  formId: string | null;
  en: string;
  ja: string;
};

export type RevealWord = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  explanation: string | null;
  explanationJa: string | null;
  forms: WordFormSummary[];
  examples: WordExampleSummary[];
  image: string;
  targetLanguage: string;
  // The originating languageDeck's path — Learn now pools vocab and grammar
  // together (see getLearnQueueForCourse in lib/dal.ts), so each word
  // carries its own kind rather than the whole session being one or the
  // other.
  path: "vocab" | "grammar";
};

export type QuizOption = {
  text: string;
  romanization: string | null;
  image?: string | null;
};

export type MultipleChoiceQuestion = {
  kind: "multiple-choice";
  wordId: string;
  // Always "vocab" — grammar points never produce multiple-choice
  // questions (see buildAllClozeQuestions in lib/dal.ts). Present so Test
  // (which now pools vocab and grammar together) can label every question
  // kind uniformly.
  path: "vocab" | "grammar";
  direction: QuizDirection;
  prompt: string;
  // Romanization only applies to the term (the language being learned) —
  // null when the prompt is showing the translation side instead.
  promptRomanization: string | null;
  // Always the language being learned (course.targetLanguage), regardless
  // of which side the prompt/options are currently showing — read-aloud
  // only ever speaks this language, never the learner's base language.
  targetLanguage: string;
  options: QuizOption[];
  // Same convention as RevealWord.image — one picture per word, independent
  // of quiz direction.
  image: string;
};

// A cloze/fill-in-the-blank exercise built from one of the word's own
// example sentences with the tested form blanked out (e.g. "Yesterday I
// ___ to the shops." for "went") — only generated for a (form, example)
// pair where the form's value actually appears in that example's English
// text. `clozeSentenceJa` is that same example's Japanese sentence, shown
// underneath as context/translation.
type FormClozeQuestion = {
  wordId: string;
  formId: string;
  clozeSentence: string;
  clozeSentenceJa: string;
  targetLanguage: string;
  path: "vocab" | "grammar";
};

// Free-text version: the learner types the missing form.
export type TypeFormQuestion = FormClozeQuestion & { kind: "type-form" };

// Multiple-choice version: the options are the word's own forms (e.g.
// go/goes/went/gone/going) rather than other words — only generated for
// words with 2+ forms, so there's something to choose between.
export type FormChoiceQuestion = FormClozeQuestion & {
  kind: "form-choice";
  options: string[];
};

// A hand-authored question an admin added for this specific word (see
// AdminQuizQuestionSummary/WordQuizQuestionInputSchema below) — mixed into
// the quiz pool alongside the auto-generated question kinds above, never
// replacing them. Presented either way at random, the same split as the
// auto-generated form questions: as multiple choice among the admin's own
// options, or as a free-text typed answer (never both for the same
// occurrence) — `correctAnswer` is deliberately omitted from the type-in
// variant so it isn't sent to the client before it's answered.
type CustomQuestionBase = {
  wordId: string;
  questionId: string;
  prompt: string;
  promptJa: string | null;
  targetLanguage: string;
  path: "vocab" | "grammar";
};

export type CustomChoiceQuestion = CustomQuestionBase & {
  kind: "custom-choice";
  options: string[];
};
export type CustomTypeQuestion = CustomQuestionBase & { kind: "custom-type" };

// The generic typed counterpart to `MultipleChoiceQuestion` — same term/
// translation prompt, but answered by typing instead of picking an option.
// Used as the "typed half" of a freshly-learned word's quiz (see
// `getTestQueue`) and as the fallback review-queue question for words with
// no form/example cloze content to draw on (see `getReviewQueue`).
export type TypeAnswerQuestion = {
  kind: "type-answer";
  wordId: string;
  // Always "vocab" in practice — a fresh grammar point's post-learn quiz
  // always has cloze content to build type-form questions from instead
  // (see buildAllClozeQuestions), and the review queue's fallback only
  // hits this for a word with no matching forms, which grammar rows
  // always have (see buildTypedQuestion). Present for the same uniform
  // labelling reason as MultipleChoiceQuestion.path.
  path: "vocab" | "grammar";
  direction: QuizDirection;
  prompt: string;
  promptRomanization: string | null;
  // True when the term isn't Latin-typeable and the expected typed answer
  // is therefore the term's romanization rather than the term itself (see
  // isLatinTypeable in lib/language.ts) — lets the UI ask for "the
  // romanized word" instead of just "the word".
  answerRomanized: boolean;
  targetLanguage: string;
  image: string;
};

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TypeFormQuestion
  | FormChoiceQuestion
  | CustomChoiceQuestion
  | CustomTypeQuestion
  | TypeAnswerQuestion;

// Deck-page summary of what's due in the scheduled review queue (see the
// STAGES table in lib/srs.ts) — deliberately just a count/next-due hint, not
// the full question set, which `getReviewQueue` builds only when the
// learner actually starts a review session.
export type ReviewQueueSummary = {
  dueCount: number;
  nextDueAt: Date | null;
};

// Admin-only "dev mode" debug view on the deck page — every word in this
// deck's review queue (see getReviewQueueDebug in lib/dal.ts), not just the
// due count, so an admin can see exactly what's queued and when each word
// is due. `lastSeenAt: null` means it hasn't had its post-learn quiz yet,
// so it isn't on the review schedule at all (`nextReviewAt` is also null).
export type ReviewQueueDebugEntry = {
  wordId: string;
  term: string;
  translation: string;
  stage: number;
  stageName: string;
  lastSeenAt: Date | null;
  nextReviewAt: Date | null;
};

export type LanguageDeckWordSummary = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  known: boolean;
};

export type LanguageDeckSummary = {
  id: string;
  title: string;
  subheading: string | null;
  description: string | null;
  // Resolved bunny.net URL, or null if no cover has been uploaded — see
  // `deckCoverImagePath` in lib/images.ts.
  coverImage: string | null;
  // Admin-set theme hex colors — pass through `getContrastTextClass` (see
  // lib/utils.ts) rather than assuming light or dark text.
  bgColor: string | null;
  primaryColor: string | null;
  // 'vocab' | 'grammar' — lets learn/test/review pages branch behavior
  // (e.g. one grammar point per languageDeck instead of three, an all-cloze quiz)
  // without a second round trip. See the note on LanguageDeck.path in
  // supabase/schema.sql.
  path: string;
  position: number;
  totalWords: number;
  // Words with any practice history (revealed or quizzed at least once),
  // regardless of mastery — a superset of knownWords.
  learntWords: number;
  knownWords: number;
  words: LanguageDeckWordSummary[];
};

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetLanguage: string;
  sourceLanguage: string;
};

export type EnrolledCourseSummary = CourseSummary &
  CourseStreak & {
    totalWords: number;
    knownWords: number;
    totalLanguageDecks: number;
    languageDecksDone: number;
  };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_FIELD_SCHEMA = z
  .file({ error: "Choose an image." })
  .max(MAX_IMAGE_BYTES, { error: "Image must be under 5MB." })
  .mime(["image/webp", "image/png", "image/jpeg"], {
    error: "Use a WebP, PNG, or JPEG image.",
  })
  .optional();

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const OPTIONAL_HEX_COLOR_SCHEMA = z
  .string()
  .trim()
  .regex(HEX_COLOR_REGEX, { error: "Use a hex color like #2563eb." })
  .optional();

// Shared by create and edit — only the id fields (which course, which deck)
// differ between the two. `bgColor`/`primaryColor` aren't rendered anywhere
// yet — just admin-editable and stored, for a later UI pass.
const CategoryFieldsSchema = {
  title: z
    .string()
    .trim()
    .min(1, { error: "Title is required." })
    .max(100, { error: "Keep it under 100 characters." }),
  subheading: z
    .string()
    .trim()
    .max(150, { error: "Keep it under 150 characters." })
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, { error: "Keep it under 500 characters." })
    .optional(),
  coverImage: IMAGE_FIELD_SCHEMA,
  bgColor: OPTIONAL_HEX_COLOR_SCHEMA,
  primaryColor: OPTIONAL_HEX_COLOR_SCHEMA,
};

type CategoryFieldErrors = {
  title?: string[];
  subheading?: string[];
  description?: string[];
  coverImage?: string[];
  bgColor?: string[];
  primaryColor?: string[];
};

export const CreateCategoryFormSchema = z.object({
  courseId: z.uuid({ error: "Missing course." }),
  ...CategoryFieldsSchema,
});

export type CreateCategoryFormState =
  | {
      errors?: CategoryFieldErrors & { courseId?: string[] };
      message?: string;
      success?: boolean;
      languageDeckId?: string;
    }
  | undefined;

export const UpdateCategoryFormSchema = z.object({
  languageDeckId: z.uuid({ error: "Missing deck." }),
  ...CategoryFieldsSchema,
});

export type UpdateCategoryFormState =
  | {
      errors?: CategoryFieldErrors & { languageDeckId?: string[] };
      message?: string;
    }
  | undefined;

const WordCategoryFieldsSchema = {
  name: z
    .string()
    .trim()
    .min(1, { error: "Name is required." })
    .max(100, { error: "Keep it under 100 characters." }),
  color: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, { error: "Use a hex color like #2563eb." }),
};

export const CreateWordCategoryFormSchema = z.object(WordCategoryFieldsSchema);

export type CreateWordCategoryFormState =
  | {
      errors?: { name?: string[]; color?: string[] };
      message?: string;
      success?: boolean;
    }
  | undefined;

export const UpdateWordCategoryFormSchema = z.object({
  categoryId: z.uuid({ error: "Missing category." }),
  ...WordCategoryFieldsSchema,
});

export type UpdateWordCategoryFormState =
  | {
      errors?: { name?: string[]; color?: string[] };
      message?: string;
      success?: boolean;
    }
  | undefined;

// Shared by create and edit — only the id field (which category vs. which
// word) differs between the two.
const WordFieldsSchema = {
  term: z
    .string()
    .trim()
    .min(1, { error: "Term is required." })
    .max(200, { error: "Keep it under 200 characters." }),
  translation: z
    .string()
    .trim()
    .min(1, { error: "Translation is required." })
    .max(200, { error: "Keep it under 200 characters." }),
  romanization: z
    .string()
    .trim()
    .max(200, { error: "Keep it under 200 characters." })
    .optional(),
  exampleSentence: z
    .string()
    .trim()
    .max(500, { error: "Keep it under 500 characters." })
    .optional(),
  explanation: z
    .string()
    .trim()
    .max(500, { error: "Keep it under 500 characters." })
    .optional(),
  explanationJa: z
    .string()
    .trim()
    .max(500, { error: "Keep it under 500 characters." })
    .optional(),
  categoryId: z.uuid({ error: "Invalid category." }).optional(),
  wordType: z.enum(WORD_TYPES, { error: "Invalid word type." }).optional(),
  image: IMAGE_FIELD_SCHEMA,
};

type WordFieldErrors = {
  term?: string[];
  translation?: string[];
  romanization?: string[];
  exampleSentence?: string[];
  explanation?: string[];
  explanationJa?: string[];
  categoryId?: string[];
  wordType?: string[];
  image?: string[];
};

// One row of a word's inflected forms, submitted from a repeatable admin-form
// section as indexed fields (`forms[0].labelEn`, `forms[0].value`, ...).
// `clientId` round-trips whichever example rows in the same submission
// reference this form (see `WordExampleInputSchema.formClientId`) — it never
// reaches the database, just correlates the two arrays for one request.
export const WordFormInputSchema = z.object({
  clientId: z.string().min(1),
  labelEn: z.string().trim().min(1, { error: "Label is required." }).max(100),
  labelJa: z
    .string()
    .trim()
    .min(1, { error: "Japanese label is required." })
    .max(100),
  value: z.string().trim().min(1, { error: "Value is required." }).max(200),
});

export const WordExampleInputSchema = z.object({
  en: z
    .string()
    .trim()
    .min(1, { error: "English sentence is required." })
    .max(500),
  ja: z
    .string()
    .trim()
    .min(1, { error: "Japanese sentence is required." })
    .max(500),
  // Empty string means "not tied to a form" — the browser <select> submits
  // "" for its blank option, so this stays a string rather than an optional.
  formClientId: z.string(),
});

export type WordFormInput = z.infer<typeof WordFormInputSchema>;
export type WordExampleInput = z.infer<typeof WordExampleInputSchema>;

// One row of a word's hand-authored quiz questions, submitted the same
// indexed-field way as forms/examples above (`questions.0.prompt`, ...).
// Fixed option0-3 slots (rather than a nested array) so it fits the same
// flat-row parser; only the first two are required, so a 2- or 3-option
// question is fine too.
export const WordQuizQuestionInputSchema = z.object({
  prompt: z.string().trim().min(1, { error: "Prompt is required." }).max(300),
  promptJa: z.string().trim().max(300).optional(),
  option0: z
    .string()
    .trim()
    .min(1, { error: "At least two options are required." })
    .max(150),
  option1: z
    .string()
    .trim()
    .min(1, { error: "At least two options are required." })
    .max(150),
  option2: z.string().trim().max(150).optional(),
  option3: z.string().trim().max(150).optional(),
  correctIndex: z.coerce.number().int().min(0).max(3),
});

export type WordQuizQuestionInput = z.infer<typeof WordQuizQuestionInputSchema>;

export type AdminQuizQuestionSummary = {
  id: string;
  prompt: string;
  promptJa: string | null;
  options: string[];
  correctIndex: number;
};

export type SaveQuizQuestionsFormState =
  | {
      message?: string;
      success?: boolean;
    }
  | undefined;

// One entry of a bulk-imported JSON array (see BulkImportQuizQuestionsForm) —
// a plainer shape than WordQuizQuestionInputSchema above (a real array of
// options rather than 4 named slots) since this is meant to be easy to
// generate outside the app, not tied to the repeatable-row form fields.
export const BulkQuizQuestionSchema = z
  .object({
    prompt: z.string().trim().min(1, { error: "prompt is required" }).max(300),
    promptJa: z.string().trim().max(300).optional(),
    options: z
      .array(z.string().trim().min(1).max(150))
      .min(2, { error: "options needs at least 2 entries" })
      .max(4, { error: "options allows at most 4 entries" }),
    correctIndex: z.number().int().min(0),
  })
  .refine((entry) => entry.correctIndex < entry.options.length, {
    error: "correctIndex is out of range for options",
  });

export const BulkQuizQuestionsSchema = z
  .array(BulkQuizQuestionSchema)
  .min(1, { error: "Paste at least one question." })
  .max(200, { error: "Keep it to 200 questions or fewer per import." });

export type BulkImportQuizQuestionsFormState =
  | {
      message?: string;
      success?: boolean;
    }
  | undefined;

export const CreateWordFormSchema = z.object({
  languageDeckId: z.uuid({ error: "Missing category." }),
  ...WordFieldsSchema,
});

export type CreateWordFormState =
  | {
      errors?: WordFieldErrors & { languageDeckId?: string[] };
      message?: string;
      success?: boolean;
    }
  | undefined;

export const UpdateWordFormSchema = z.object({
  wordId: z.uuid({ error: "Missing word." }),
  ...WordFieldsSchema,
});

export type UpdateWordFormState =
  | {
      errors?: WordFieldErrors & { wordId?: string[] };
      message?: string;
    }
  | undefined;

export const ImportWordsFormSchema = z.object({
  targetLanguageDeckId: z.uuid({ error: "Missing destination category." }),
  wordIds: z.array(z.uuid()).min(1, { error: "Select at least one word." }),
});

export type ImportWordsFormState =
  | {
      errors?: { targetLanguageDeckId?: string[]; wordIds?: string[] };
      message?: string;
    }
  | undefined;

export type AdminCourseOption = {
  id: string;
  slug: string;
  title: string;
  active: boolean;
};

export type AdminCategorySummary = {
  id: string;
  title: string;
  path: string;
  position: number;
  wordCount: number;
  active: boolean;
};

// Loaded by the admin deck-edit page to prefill `EditCategoryForm` — the
// raw `coverImageKey`, not a resolved URL, since `WordImage`/`wordImagePath`-
// style components take an already-built src, and the edit form builds that
// itself via `deckCoverImagePath`.
export type AdminCategoryDetail = {
  id: string;
  title: string;
  subheading: string | null;
  description: string | null;
  coverImageKey: string | null;
  bgColor: string | null;
  primaryColor: string | null;
};

export type AdminWordSummary = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  explanation: string | null;
  explanationJa: string | null;
  position: number;
  imageKey: string | null;
  active: boolean;
  category: WordCategoryOption | null;
  wordType: WordType | null;
  forms: WordFormSummary[];
  examples: WordExampleSummary[];
};

// One entry per day, split by the three things that feed the course-home
// activity chart: vocab words learned, grammar points learned, and daily
// challenge attempts completed that day.
export type DailyActivityCount = {
  date: string;
  vocab: number;
  grammar: number;
  challenge: number;
};

// Today's daily-challenge attempt count for a course, and the fixed cap —
// see completeDailyChallenge in lib/actions/daily-challenge.ts.
export type DailyChallengeStatus = {
  attemptsToday: number;
  maxAttemptsPerDay: number;
};

// `donguriConfig` is submitted as raw JSON text from a textarea — validated
// here (must parse, or be empty to clear it) and parsed to a JS value by the
// action before writing to the `Json` column.
export const UpdateProfileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Name is required." })
    .max(100, { error: "Keep it under 100 characters." }),
  donguriConfig: z
    .string()
    .trim()
    .max(10000, { error: "Keep it under 10,000 characters." })
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      },
      { error: "Must be valid JSON." },
    ),
});

export type UpdateProfileFormState =
  | {
      errors?: { fullName?: string[]; donguriConfig?: string[] };
      message?: string;
      success?: boolean;
    }
  | undefined;

export type LeaderboardEntry = {
  id: string;
  name: string;
  xp: number;
  equippedAccessory: AccessoryId | null;
  isSelf: boolean;
};
