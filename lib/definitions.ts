import * as z from "zod";

export const LoginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }).trim(),
});

export const SignupFormSchema = z.object({
  fullName: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
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
        fullName?: string[];
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

export type RevealWord = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  image: string;
  targetLanguage: string;
};

export type QuizOption = {
  text: string;
  romanization: string | null;
  image?: string | null;
};

export type QuizQuestion = {
  wordId: string;
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

export type PracticeQueue = {
  reveals: RevealWord[];
  quiz: QuizQuestion[];
};

export type LessonWordSummary = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  known: boolean;
};

export type LessonSummary = {
  id: string;
  title: string;
  position: number;
  totalWords: number;
  // Words with any practice history (revealed or quizzed at least once),
  // regardless of mastery — a superset of knownWords.
  learntWords: number;
  knownWords: number;
  words: LessonWordSummary[];
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
    totalLessons: number;
    lessonsDone: number;
  };

export const CreateCategoryFormSchema = z.object({
  courseId: z.uuid({ error: "Missing course." }),
  title: z
    .string()
    .trim()
    .min(1, { error: "Title is required." })
    .max(100, { error: "Keep it under 100 characters." }),
});

export type CreateCategoryFormState =
  | {
      errors?: { courseId?: string[]; title?: string[] };
      message?: string;
      success?: boolean;
      lessonId?: string;
    }
  | undefined;

const MAX_WORD_IMAGE_BYTES = 5 * 1024 * 1024;

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
  image: z
    .file({ error: "Choose an image." })
    .max(MAX_WORD_IMAGE_BYTES, { error: "Image must be under 5MB." })
    .mime(["image/webp", "image/png", "image/jpeg"], {
      error: "Use a WebP, PNG, or JPEG image.",
    })
    .optional(),
};

type WordFieldErrors = {
  term?: string[];
  translation?: string[];
  romanization?: string[];
  exampleSentence?: string[];
  image?: string[];
};

export const CreateWordFormSchema = z.object({
  lessonId: z.uuid({ error: "Missing category." }),
  ...WordFieldsSchema,
});

export type CreateWordFormState =
  | {
      errors?: WordFieldErrors & { lessonId?: string[] };
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
  targetLessonId: z.uuid({ error: "Missing destination category." }),
  wordIds: z
    .array(z.uuid())
    .min(1, { error: "Select at least one word." }),
});

export type ImportWordsFormState =
  | {
      errors?: { targetLessonId?: string[]; wordIds?: string[] };
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

export type AdminWordSummary = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  position: number;
  imageKey: string | null;
  active: boolean;
};

export type DailyWordCount = {
  date: string;
  count: number;
};
