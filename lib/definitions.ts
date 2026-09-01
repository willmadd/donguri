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

export type DailyWordCount = {
  date: string;
  count: number;
};
