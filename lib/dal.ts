import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  AdminCategoryDetail,
  AdminCategorySummary,
  AdminCourseOption,
  AdminQuizQuestionSummary,
  AdminWordSummary,
  CourseSummary,
  DailyActivityCount,
  DailyChallengeStatus,
  EnrolledCourseSummary,
  LeaderboardEntry,
  LanguageDeckSummary,
  Profile,
  QuizDirection,
  QuizOption,
  QuizQuestion,
  ReviewQueueDebugEntry,
  ReviewQueueSummary,
  RevealWord,
  UserRole,
  WordCategoryOption,
  WordType,
} from "@/lib/definitions";
import {
  addDays,
  applyDailyActivity,
  MAX_STAGE,
  nextReviewAtForStage,
  SET_SIZE,
  stageInfo,
  startOfUTCDay,
} from "@/lib/srs";
import { deckCoverImagePath, wordImagePath } from "@/lib/images";
import { findClozeMatchesByForm, pickRandomClozeMatch } from "@/lib/cloze";
import { isLatinTypeable } from "@/lib/language";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

// Shared with completeDailyChallenge in lib/actions/daily-challenge.ts,
// which enforces the same cap on write.
export const MAX_DAILY_CHALLENGE_ATTEMPTS = 3;

// A plain cookie read (no network round-trip to Supabase's auth server) —
// safe here specifically because proxy.ts already calls the network-
// validating `getUser()` for every request this route tree is reached
// through, before any Server Component runs, and propagates any refreshed
// cookies onto the same request. Re-validating again here would just add a
// second sequential auth round-trip to every single navigation (this was
// previously the #1 source of navigation latency) for no extra security,
// since the token was already confirmed valid moments earlier in the same
// request. Do not use this pattern anywhere the proxy might not have run.
export const getSession = cache(async () => {
  const supabase = await createClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to retrieve Supabase session:", error);
    return null;
  }

  return session?.user ?? null;
});

export const requireUser = cache(async () => {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return user;
});

// Prisma connects using its own PostgreSQL role and does not carry the
// authenticated user's JWT. Supabase RLS therefore does not apply to
// Prisma queries.
//
// Always derive the profile ID from the verified Supabase user. Never
// accept a caller-provided user ID here.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSession();

  if (!user) {
    return null;
  }

  const profile = await prisma.profile.findUnique({
    where: {
      id: user.id,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      xp: true,
      donguriConfig: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.fullName,
    role: profile.role as UserRole,
    xp: profile.xp,
    donguriConfig: profile.donguriConfig,
    first_name: profile.firstName,
    last_name: profile.lastName,
  };
});

export const requireProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const profile = await getProfile();

  if (!profile) {
    console.error(`No Prisma profile exists for authenticated user ${user.id}`);

    redirect("/onboarding");
  }

  return profile;
});

export const requireAdminProfile = cache(async (): Promise<Profile> => {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return profile;
});

export const getEnrolledCourses = cache(
  async (): Promise<EnrolledCourseSummary[]> => {
    const user = await requireUser();

    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId: user.id, course: { active: true } },
      orderBy: { course: { position: "asc" } },
      include: {
        course: {
          include: {
            languageDecks: {
              select: {
                words: {
                  select: {
                    progress: {
                      where: { userId: user.id },
                      select: { status: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return enrollments.map((enrollment) => {
      const { course } = enrollment;
      const totalWords = course.languageDecks.reduce(
        (sum, languageDeck) => sum + languageDeck.words.length,
        0,
      );
      const knownWords = course.languageDecks.reduce(
        (sum, languageDeck) =>
          sum +
          languageDeck.words.filter((word) =>
            word.progress.some((p) => p.status === "known"),
          ).length,
        0,
      );
      const languageDecksDone = course.languageDecks.filter(
        (languageDeck) =>
          languageDeck.words.length > 0 &&
          languageDeck.words.every((word) => word.progress.length > 0),
      ).length;

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        targetLanguage: course.targetLanguage,
        sourceLanguage: course.sourceLanguage,
        currentStreak: enrollment.currentStreak,
        longestStreak: enrollment.longestStreak,
        totalWords,
        knownWords,
        totalLanguageDecks: course.languageDecks.length,
        languageDecksDone,
      };
    });
  },
);

export const getAdminCourses = cache(async (): Promise<AdminCourseOption[]> => {
  return prisma.course.findMany({
    orderBy: { position: "asc" },
    select: { id: true, slug: true, title: true, active: true },
  });
});

// Category (LanguageDeck) list for the admin content-management pages — includes
// every languageDeck regardless of `path`, unlike `getCourseDecks`'s learner-facing
// filter to active `path: 'vocab'` languageDecks only.
export const getAdminCategoryOverview = cache(
  async (
    courseSlug: string,
  ): Promise<{ course: CourseSummary; categories: AdminCategorySummary[] }> => {
    const course = await prisma.course.findUnique({
      where: { slug: courseSlug },
    });

    if (!course) {
      redirect("/dashboard/admin/courses");
    }

    const languageDecks = await prisma.languageDeck.findMany({
      where: { courseId: course.id },
      orderBy: { position: "asc" },
      include: { _count: { select: { words: true } } },
    });

    return {
      course: toCourseSummary(course),
      categories: languageDecks.map((languageDeck) => ({
        id: languageDeck.id,
        title: languageDeck.title,
        path: languageDeck.path,
        position: languageDeck.position,
        wordCount: languageDeck._count.words,
        active: languageDeck.active,
      })),
    };
  },
);

// Full word list for one category (LanguageDeck), unfiltered by `active` — used by
// the admin category-detail page and by the import flow's word-selection
// step (called with the *source* languageDeck's id there), both of which need to
// see and toggle inactive rows rather than have them silently excluded.
export const getAdminCategoryWords = cache(async (languageDeckId: string) => {
  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    include: {
      course: { select: { slug: true, title: true } },
      words: {
        orderBy: { position: "asc" },
        include: {
          forms: { orderBy: { position: "asc" } },
          examples: { orderBy: { position: "asc" } },
          category: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  if (!languageDeck) {
    redirect("/dashboard/admin/courses");
  }

  return {
    languageDeck: {
      id: languageDeck.id,
      title: languageDeck.title,
      subheading: languageDeck.subheading,
      description: languageDeck.description,
      coverImage: deckCoverImagePath(languageDeck),
      bgColor: languageDeck.bgColor,
      primaryColor: languageDeck.primaryColor,
    },
    course: languageDeck.course,
    words: languageDeck.words.map(
      (word): AdminWordSummary => toAdminWordSummary(word),
    ),
  };
});

// Single deck (LanguageDeck) for the admin edit-deck page, with just enough
// course context to build the "back to deck" link — mirrors `getAdminWord`.
export const getAdminCategory = cache(async (languageDeckId: string) => {
  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    include: { course: { select: { slug: true, title: true } } },
  });

  if (!languageDeck) {
    redirect("/dashboard/admin/courses");
  }

  const category: AdminCategoryDetail = {
    id: languageDeck.id,
    title: languageDeck.title,
    subheading: languageDeck.subheading,
    description: languageDeck.description,
    coverImageKey: languageDeck.coverImageKey,
    bgColor: languageDeck.bgColor,
    primaryColor: languageDeck.primaryColor,
  };

  return { category, course: languageDeck.course };
});

// Single word for the admin edit-word page, with enough languageDeck/course
// context to verify the route params and build the "back to category" link.
export const getAdminWord = cache(async (wordId: string) => {
  const word = await prisma.word.findUnique({
    where: { id: wordId },
    include: {
      languageDeck: {
        select: {
          id: true,
          title: true,
          course: { select: { slug: true, title: true } },
        },
      },
      forms: { orderBy: { position: "asc" } },
      examples: { orderBy: { position: "asc" } },
      category: { select: { id: true, name: true, color: true } },
    },
  });

  if (!word) {
    redirect("/dashboard/admin/courses");
  }

  return {
    word: toAdminWordSummary(word),
    languageDeck: { id: word.languageDeck.id, title: word.languageDeck.title },
    course: word.languageDeck.course,
  };
});

// Every word category, for the admin word-category management page and the
// dropdown on the word create/edit forms. Small, unfiltered, ordered for
// display — not scoped to a course, since a category is meant to be reused
// across decks/courses (unlike a `LanguageDeck`).
export const getWordCategories = cache(
  async (): Promise<WordCategoryOption[]> => {
    return prisma.wordCategory.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    });
  },
);

function toAdminWordSummary(word: {
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
  wordType: string | null;
  category: { id: string; name: string; color: string } | null;
  forms: { id: string; labelEn: string; labelJa: string; value: string }[];
  examples: { id: string; formId: string | null; en: string; ja: string }[];
}): AdminWordSummary {
  return {
    id: word.id,
    term: word.term,
    translation: word.translation,
    romanization: word.romanization,
    exampleSentence: word.exampleSentence,
    explanation: word.explanation,
    explanationJa: word.explanationJa,
    position: word.position,
    imageKey: word.imageKey,
    active: word.active,
    wordType: word.wordType as WordType | null,
    category: word.category,
    forms: word.forms.map((form) => ({
      id: form.id,
      labelEn: form.labelEn,
      labelJa: form.labelJa,
      value: form.value,
    })),
    examples: word.examples.map((example) => ({
      id: example.id,
      formId: example.formId,
      en: example.en,
      ja: example.ja,
    })),
  };
}

// Powers the admin "Quiz questions" page for one word: a summary of what
// the auto-generated question kinds currently produce (so the admin can see
// what's already covered before adding more) plus the full list of
// hand-authored questions to edit.
export const getAdminWordQuizQuestions = cache(async (wordId: string) => {
  const word = await prisma.word.findUnique({
    where: { id: wordId },
    include: {
      languageDeck: {
        select: {
          id: true,
          title: true,
          course: { select: { slug: true, title: true } },
        },
      },
      forms: { orderBy: { position: "asc" } },
      examples: { orderBy: { position: "asc" } },
      quizQuestions: { orderBy: { position: "asc" } },
    },
  });

  if (!word) {
    redirect("/dashboard/admin/courses");
  }

  // The actual sentences the real quiz would draw from for each form — not
  // just a count — so an admin can see (and fix, via the forms/examples
  // editor) a form that's under-represented, like "hottest" only ever
  // having one demonstrating example against "hot"'s six.
  const clozeByForm = findClozeMatchesByForm(word.forms, word.examples);

  return {
    word: { id: word.id, term: word.term, translation: word.translation },
    languageDeck: { id: word.languageDeck.id, title: word.languageDeck.title },
    course: word.languageDeck.course,
    autoForms: word.forms.map((form) => ({
      id: form.id,
      labelEn: form.labelEn,
      labelJa: form.labelJa,
      value: form.value,
      examples: (clozeByForm.get(form.id) ?? []).map((match) => ({
        en: match.en,
        ja: match.ja,
      })),
    })),
    questions: word.quizQuestions.map(
      (question): AdminQuizQuestionSummary => ({
        id: question.id,
        prompt: question.prompt,
        promptJa: question.promptJa,
        options: question.options,
        correctIndex: question.correctIndex,
      }),
    ),
  };
});

export const getAvailableCourses = cache(async (): Promise<CourseSummary[]> => {
  const user = await requireUser();

  const courses = await prisma.course.findMany({
    where: { active: true, enrollments: { none: { userId: user.id } } },
    orderBy: { position: "asc" },
  });

  return courses.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    targetLanguage: course.targetLanguage,
    sourceLanguage: course.sourceLanguage,
  }));
});

// Loads a course by slug and confirms the current user is enrolled in it,
// redirecting otherwise — so a direct URL hit can't reach a course's
// languageDecks/practice pages without having signed up for it first. Wrapped in
// `cache()` because nearly every course-scoped page calls several `dal.ts`
// functions in parallel (e.g. the course home page's getCourseDecks,
// getDailyWordCounts and getReviewQueueSummary), each of which calls this —
// without memoizing, that's 3+ redundant course+enrollment round trips to
// Postgres for one page view. One combined query instead of two separate
// ones for the same reason.
const requireEnrolledCourse = cache(async (courseSlug: string) => {
  const user = await requireUser();

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { userId: user.id, course: { slug: courseSlug, active: true } },
    include: { course: true },
  });

  if (!enrollment) {
    redirect("/dashboard/courses");
  }

  return { user, course: enrollment.course, enrollment };
});

function toCourseSummary(course: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetLanguage: string;
  sourceLanguage: string;
}): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    targetLanguage: course.targetLanguage,
    sourceLanguage: course.sourceLanguage,
  };
}

// Course landing page: meta + streak only — no languageDeck join, since languageDecks
// render on the Vocabulary sub-page instead.
export const getCourseHome = cache(async (courseSlug: string) => {
  const { course, enrollment } = await requireEnrolledCourse(courseSlug);

  return {
    course: toCourseSummary(course),
    currentStreak: enrollment.currentStreak,
    longestStreak: enrollment.longestStreak,
  };
});

type LanguageDeckWordRow = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  progress: { status: string }[];
};

function toLanguageDeckSummary(languageDeck: {
  id: string;
  title: string;
  subheading: string | null;
  description: string | null;
  coverImageKey: string | null;
  bgColor: string | null;
  primaryColor: string | null;
  path: string;
  position: number;
  words: LanguageDeckWordRow[];
}): LanguageDeckSummary {
  const words = languageDeck.words.map((word) => ({
    id: word.id,
    term: word.term,
    translation: word.translation,
    romanization: word.romanization,
    known: word.progress.some((p) => p.status === "known"),
  }));

  return {
    id: languageDeck.id,
    title: languageDeck.title,
    subheading: languageDeck.subheading,
    description: languageDeck.description,
    coverImage: deckCoverImagePath(languageDeck),
    bgColor: languageDeck.bgColor,
    primaryColor: languageDeck.primaryColor,
    path: languageDeck.path,
    position: languageDeck.position,
    totalWords: words.length,
    learntWords: languageDeck.words.filter((word) => word.progress.length > 0)
      .length,
    knownWords: words.filter((word) => word.known).length,
    words,
  };
}

const LANGUAGE_DECK_WORDS_SELECT = {
  id: true,
  term: true,
  translation: true,
  romanization: true,
  progress: { select: { status: true } },
} as const;

// A "deck" is a LanguageDeck — vocab and grammar languageDecks are both independently
// pickable here (see the note on `LanguageDeck.path` in supabase/schema.sql
// section 19: a vocab languageDeck and its grammar sibling share one `position`,
// but each is its own row, its own title, and its own activation). Sorted
// by position, vocab before grammar within a position, so a pair still
// reads as adjacent. `activeDeckIds` is this user's personal "active decks"
// selection (see `getActiveDeckIds`) — which decks currently feed their
// Learn/Test pool, not an admin visibility toggle.
export const getCourseDecks = cache(async (courseSlug: string) => {
  const { user, course } = await requireEnrolledCourse(courseSlug);

  const [languageDecks, activeVocabIds, activeGrammarIds] = await Promise.all([
    prisma.languageDeck.findMany({
      where: { courseId: course.id, active: true },
      orderBy: { position: "asc" },
      include: {
        words: {
          where: { active: true },
          orderBy: { position: "asc" },
          select: {
            ...LANGUAGE_DECK_WORDS_SELECT,
            progress: { where: { userId: user.id }, select: { status: true } },
          },
        },
      },
    }),
    getActiveDeckIds(course.id, user.id, "vocab"),
    getActiveDeckIds(course.id, user.id, "grammar"),
  ]);

  const sortedLanguageDecks = [...languageDecks].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    if (a.path === b.path) return 0;
    return a.path === "vocab" ? -1 : 1;
  });

  return {
    course: toCourseSummary(course),
    decks: sortedLanguageDecks.map((languageDeck) =>
      toLanguageDeckSummary(languageDeck),
    ),
    activeDeckIds: [...activeVocabIds, ...activeGrammarIds],
  };
});

// This user's personal "active decks" selection within a course, for one
// path — which decks currently feed the Learn/Test pool (see
// `getLearnQueueForCourse`). Vocab and grammar are independent selections;
// a brand-new enrollment has no activation rows yet for either, so:
//   - vocab lazily activates the first vocab deck (lowest position) the
//     first time it's read, so Learn isn't dead on arrival.
//   - grammar, the first time *it's* read with no rows of its own,
//     defaults to whichever grammar languageDecks share a position with the
//     user's currently-active vocab decks — the same pairing grammar
//     implicitly followed before it became independently activatable — and
//     persists that as real rows, so it's a one-time migration default, not
//     a standing behavior.
// From then on it's purely the user's own selection per path — deactivating
// a deck later is respected, not re-activated. Wrapped in `cache()`: the
// grammar branch below recursively calls this for "vocab" with the same
// args `getCourseDecks` already called directly in the same Promise.all —
// without memoizing, every course-home-page view ran that lookup (and,
// worse, its auto-activate-first-deck fallback and write) twice.
const getActiveDeckIds = cache(
  async (
    courseId: string,
    userId: string,
    path: "vocab" | "grammar",
  ): Promise<string[]> => {
    const activations = await prisma.userDeckActivation.findMany({
      where: { userId, languageDeck: { courseId, path } },
      select: { languageDeckId: true, active: true },
    });

    // Any row at all (active or not) means the user has touched deck
    // activation for this path before — respect it exactly, including
    // "everything's off," rather than second-guessing it.
    if (activations.length > 0) {
      return activations
        .filter((activation) => activation.active)
        .map((activation) => activation.languageDeckId);
    }

    if (path === "grammar") {
      const activeVocabIds = await getActiveDeckIds(courseId, userId, "vocab");
      if (activeVocabIds.length === 0) {
        return [];
      }

      const activeVocabLanguageDecks = await prisma.languageDeck.findMany({
        where: { id: { in: activeVocabIds }, courseId, path: "vocab" },
        select: { position: true },
      });
      const positions = activeVocabLanguageDecks.map(
        (languageDeck) => languageDeck.position,
      );

      if (positions.length === 0) {
        return [];
      }

      const grammarLanguageDecks = await prisma.languageDeck.findMany({
        where: {
          courseId,
          path: "grammar",
          position: { in: positions },
          active: true,
        },
        select: { id: true },
      });

      if (grammarLanguageDecks.length === 0) {
        return [];
      }

      await prisma.userDeckActivation.createMany({
        data: grammarLanguageDecks.map((languageDeck) => ({
          userId,
          languageDeckId: languageDeck.id,
          active: true,
        })),
        skipDuplicates: true,
      });

      return grammarLanguageDecks.map((languageDeck) => languageDeck.id);
    }

    // vocab, never touched — auto-activate the first deck so Learn isn't dead
    // on arrival for a brand-new enrollment.
    const firstDeck = await prisma.languageDeck.findFirst({
      where: { courseId, path: "vocab", active: true },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    if (!firstDeck) {
      return [];
    }

    await prisma.userDeckActivation.create({
      data: { userId, languageDeckId: firstDeck.id },
    });

    return [firstDeck.id];
  },
);

// Single languageDeck's stats/words for the deck detail and learn/test/review
// pages — deliberately path-agnostic (unlike `getCourseDecks`), so it
// resolves a `path: 'grammar'` languageDeck by its own id exactly like a vocab
// one; the learn/quiz/review-queue mechanics never cared about path in the
// first place (see `requireDeck`). Redirects to the deck list if the id
// doesn't resolve to an active languageDeck in this course.
export const getDeckDetail = cache(
  async (courseSlug: string, deckId: string) => {
    const { user, course } = await requireEnrolledCourse(courseSlug);

    const languageDeck = await prisma.languageDeck.findFirst({
      where: { id: deckId, courseId: course.id, active: true },
      include: {
        words: {
          where: { active: true },
          orderBy: { position: "asc" },
          select: {
            ...LANGUAGE_DECK_WORDS_SELECT,
            progress: { where: { userId: user.id }, select: { status: true } },
          },
        },
      },
    });

    if (!languageDeck) {
      redirect(`/dashboard/courses/${courseSlug}`);
    }

    return {
      course: toCourseSummary(course),
      deck: toLanguageDeckSummary(languageDeck),
    };
  },
);

// One entry per day in the current streak's date range (zero-filled for a
// day with no activity — a review-only day is still a valid streak day),
// always at least the trailing 7 days so a short or empty streak still
// renders as a proper week-wide chart instead of one or two bars. Splits
// each day's total across vocab words learned, grammar points learned
// (both from `UserWordProgress.introducedAt`, keyed by the word's
// `languageDeck.path`), and daily challenge attempts completed.
export const getDailyActivityCounts = cache(
  async (courseSlug: string): Promise<DailyActivityCount[]> => {
    const { user, course, enrollment } =
      await requireEnrolledCourse(courseSlug);

    // The streak's own date range is anchored on the last day it was
    // actually extended, but the chart itself always runs through today —
    // even before today has any activity of its own — so a day with
    // nothing logged yet still shows up as an empty bar to fill in, rather
    // than silently disappearing from the chart until something is learned.
    const today = startOfUTCDay(new Date());
    const lastActive = enrollment.lastActivityDate
      ? startOfUTCDay(enrollment.lastActivityDate)
      : today;
    const streakStart =
      enrollment.currentStreak > 0
        ? addDays(lastActive, -(enrollment.currentStreak - 1))
        : lastActive;
    const weekStart = addDays(today, -6);
    const rangeStart = streakStart < weekStart ? streakStart : weekStart;
    const rangeEnd = today;
    const rangeEndExclusive = addDays(rangeEnd, 1);

    const [progress, challengeAttempts] = await Promise.all([
      prisma.userWordProgress.findMany({
        where: {
          userId: user.id,
          word: { languageDeck: { courseId: course.id } },
          introducedAt: { gte: rangeStart, lt: rangeEndExclusive },
        },
        select: { introducedAt: true, word: { select: { languageDeck: { select: { path: true } } } } },
      }),
      prisma.dailyChallengeAttempt.findMany({
        where: {
          userId: user.id,
          courseId: course.id,
          challengeDate: { gte: rangeStart, lt: rangeEndExclusive },
        },
        select: { challengeDate: true },
      }),
    ]);

    const vocabCounts = new Map<string, number>();
    const grammarCounts = new Map<string, number>();
    for (const { introducedAt, word } of progress) {
      const day = startOfUTCDay(introducedAt).toISOString().slice(0, 10);
      const counts = word.languageDeck.path === "grammar" ? grammarCounts : vocabCounts;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }

    const challengeCounts = new Map<string, number>();
    for (const { challengeDate } of challengeAttempts) {
      const day = challengeDate.toISOString().slice(0, 10);
      challengeCounts.set(day, (challengeCounts.get(day) ?? 0) + 1);
    }

    const days: DailyActivityCount[] = [];
    for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
      const date = day.toISOString().slice(0, 10);
      days.push({
        date,
        vocab: vocabCounts.get(date) ?? 0,
        grammar: grammarCounts.get(date) ?? 0,
        challenge: challengeCounts.get(date) ?? 0,
      });
    }

    return days;
  },
);

// How many of today's (UTC) 3 daily-challenge attempts this user has used up
// for this course — see completeDailyChallenge in
// lib/actions/daily-challenge.ts, which enforces the same cap on write.
export const getDailyChallengeStatus = cache(
  async (courseSlug: string): Promise<DailyChallengeStatus> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);

    const attemptsToday = await prisma.dailyChallengeAttempt.count({
      where: {
        userId: user.id,
        courseId: course.id,
        challengeDate: startOfUTCDay(new Date()),
      },
    });

    return { attemptsToday, maxAttemptsPerDay: MAX_DAILY_CHALLENGE_ATTEMPTS };
  },
);

type LeaderboardProfile = {
  id: string;
  fullName: string | null;
  email: string;
  xp: number;
  donguriConfig: unknown;
};

const LEADERBOARD_PROFILE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  xp: true,
  donguriConfig: true,
} as const;

function toLeaderboardEntry(
  profile: LeaderboardProfile,
  selfId: string,
): LeaderboardEntry {
  return {
    id: profile.id,
    name: profile.fullName ?? profile.email.split("@")[0],
    xp: profile.xp,
    equippedAccessory:
      (parseDonguriConfig(profile.donguriConfig).equippedAccessory as
        | AccessoryId
        | undefined) ?? null,
    isSelf: profile.id === selfId,
  };
}

// Every friend the user has added, plus themselves (so you can see your own
// rank among friends) — sorted by XP, highest first. Deliberately not
// wrapped in `cache()`: this is also called fresh from the add/remove-friend
// actions right after a mutation, where a memoized read would be stale.
export async function getFriendsLeaderboard(
  userId: string,
): Promise<LeaderboardEntry[]> {
  const [friendships, self] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      include: { friend: { select: LEADERBOARD_PROFILE_SELECT } },
    }),
    prisma.profile.findUniqueOrThrow({
      where: { id: userId },
      select: LEADERBOARD_PROFILE_SELECT,
    }),
  ]);

  const entries = [
    self,
    ...friendships.map((friendship) => friendship.friend),
  ].map((profile) => toLeaderboardEntry(profile, userId));

  return entries.sort((a, b) => b.xp - a.xp);
}

// Global top 10 by XP, plus the viewer's own friends leaderboard (which
// always includes themselves) — XP is an app-wide stat, not per-course, so
// this isn't scoped to whichever course happens to display it.
export const getLeaderboards = cache(
  async (): Promise<{
    top: LeaderboardEntry[];
    friends: LeaderboardEntry[];
  }> => {
    const user = await requireUser();

    const [topProfiles, friends] = await Promise.all([
      prisma.profile.findMany({
        orderBy: { xp: "desc" },
        take: 10,
        select: LEADERBOARD_PROFILE_SELECT,
      }),
      getFriendsLeaderboard(user.id),
    ]);

    return {
      top: topProfiles.map((profile) => toLeaderboardEntry(profile, user.id)),
      friends,
    };
  },
);

// Introduces up to SET_SIZE new words (creating their `UserWordProgress`
// rows and bumping the streak) pooled from *every currently active deck*,
// vocab and grammar together (see `getActiveDeckIds`) — "you can have more
// than one activated deck," and the words are drawn at random from across
// all of them, not in position order from a single one, so a batch can mix
// vocab words and grammar points (each `RevealWord` carries its own `path`
// so the UI can label which is which). Read-heavy but also writes:
// introducing the set has to happen exactly when the queue is built, not as
// a separate step a caller could forget.
export const getLearnQueueForCourse = cache(
  async (courseSlug: string): Promise<RevealWord[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const [vocabIds, grammarIds] = await Promise.all([
      getActiveDeckIds(course.id, user.id, "vocab"),
      getActiveDeckIds(course.id, user.id, "grammar"),
    ]);
    const languageDeckIds = [...vocabIds, ...grammarIds];

    if (languageDeckIds.length === 0) {
      return [];
    }

    const candidates = await prisma.word.findMany({
      where: {
        languageDeckId: { in: languageDeckIds },
        active: true,
        progress: { none: { userId: user.id } },
      },
      include: {
        forms: { orderBy: { position: "asc" } },
        examples: { orderBy: { position: "asc" } },
        languageDeck: { select: { path: true } },
      },
    });

    const newWords = shuffle(candidates).slice(0, SET_SIZE);

    if (newWords.length > 0) {
      await prisma.userWordProgress.createMany({
        data: newWords.map((word) => ({
          userId: user.id,
          wordId: word.id,
          stage: 1,
          // Set immediately, not deferred to the first quiz answer — a
          // word's stage-1 review is due 4 hours after it's *learned*,
          // regardless of when (or how well) its post-learn quiz goes; the
          // quiz never advances stage (see `recordAnswer` in
          // lib/actions/vocab.ts).
          nextReviewAt: nextReviewAtForStage(1),
        })),
        skipDuplicates: true,
      });

      await bumpStreak(user.id, course.id, new Date());
    }

    return newWords.map((word) => ({
      id: word.id,
      term: word.term,
      translation: word.translation,
      romanization: word.romanization,
      exampleSentence: word.exampleSentence,
      explanation: word.explanation,
      explanationJa: word.explanationJa,
      forms: word.forms.map((form) => ({
        id: form.id,
        labelEn: form.labelEn,
        labelJa: form.labelJa,
        value: form.value,
      })),
      examples: word.examples.map((example) => ({
        id: example.id,
        formId: example.formId,
        en: example.en,
        ja: example.ja,
      })),
      image: wordImagePath(word),
      targetLanguage: course.targetLanguage,
      path: word.languageDeck.path as "vocab" | "grammar",
    }));
  },
);

// Quiz-only, never introduces new words — the "Test yourself" half of the
// learn/quiz pair. Pool is every word *anywhere in the course*, vocab and
// grammar together, that's been learned but never yet answered
// (`lastSeenAt: null`) — not filtered to currently-active decks, since
// deactivating a deck after learning some of its words shouldn't hide their
// pending quiz. For vocab, each word gets exactly two questions (one
// multiple-choice, one typed — see `buildTypedQuestion`), so a fresh
// 3-word learn batch always produces 6 questions. For grammar, every fresh
// point's example sentences each become their own fill-in-the-blank
// question (see `buildAllClozeQuestions`) — never multiple choice, since
// what's being tested is production of the structure itself, not
// recognition among options — so a fresh 3-point learn batch (3 examples
// each) produces 9 questions. Both kinds are shuffled together into one
// quiz; each question carries its own `path` (see the QuizQuestion variants
// in lib/definitions.ts) so the UI can label which is which. Either way,
// answering these never advances the word's stage (see `recordAnswer`'s
// `advancesStage` in lib/actions/vocab.ts) — its stage-1 review stays due 4
// hours after it was *learned* (see `getLearnQueueForCourse`), not from
// whenever it happens to get quizzed. A word drops out of this pool the
// moment its first question is answered and from then on is governed
// entirely by its stage/`nextReviewAt` — i.e. by `getReviewQueue` below.
export const getTestQueueForCourse = cache(
  async (courseSlug: string): Promise<QuizQuestion[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);

    const freshProgress = await prisma.userWordProgress.findMany({
      where: {
        userId: user.id,
        lastSeenAt: null,
        word: {
          languageDeck: { courseId: course.id, active: true },
          active: true,
        },
      },
      include: {
        word: {
          include: {
            forms: { orderBy: { position: "asc" } },
            examples: { orderBy: { position: "asc" } },
            languageDeck: { select: { path: true } },
          },
        },
      },
    });

    if (freshProgress.length === 0) {
      return [];
    }

    await bumpStreak(user.id, course.id, new Date());

    const grammarWords = freshProgress
      .filter((progress) => progress.word.languageDeck.path === "grammar")
      .map((progress) => ({ ...progress.word, path: "grammar" as const }));
    const vocabWords = freshProgress
      .filter((progress) => progress.word.languageDeck.path === "vocab")
      .map((progress) => ({ ...progress.word, path: "vocab" as const }));

    const grammarQuestions = grammarWords.flatMap((word) =>
      buildAllClozeQuestions(word, course),
    );

    let vocabQuestions: QuizQuestion[] = [];
    if (vocabWords.length > 0) {
      const distractorPool = await prisma.word.findMany({
        where: {
          languageDeck: { courseId: course.id, path: "vocab", active: true },
          active: true,
        },
        select: {
          id: true,
          term: true,
          translation: true,
          romanization: true,
          languageDeckId: true,
          imageKey: true,
        },
      });
      const distractorWords = distractorPool.map((word) => ({
        ...word,
        path: "vocab" as const,
      }));

      vocabQuestions = vocabWords.flatMap((word) => [
        buildMultipleChoiceQuestion(word, distractorWords, course),
        buildTypedQuestion(word, course),
      ]);
    }

    return shuffle([...grammarQuestions, ...vocabQuestions]);
  },
);

// One review queue per *course* — combining every deck's vocab and grammar
// together, not scoped to currently-active decks (an already-learned word
// stays reviewable even if its deck is later deactivated). Course-home-page
// summary card: just a count of words due right now plus the earliest
// upcoming due time (for a "next review in ..." hint when nothing's due),
// not the full question set — building that is deferred to
// `getReviewQueue`, only once the learner actually starts a session.
export const getReviewQueueSummary = cache(
  async (courseSlug: string): Promise<ReviewQueueSummary> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const now = new Date();

    const reviewable = {
      userId: user.id,
      stage: { lt: MAX_STAGE },
      lastSeenAt: { not: null },
      word: {
        languageDeck: { courseId: course.id, active: true },
        active: true,
      },
    } as const;

    const [dueCount, next] = await Promise.all([
      prisma.userWordProgress.count({
        where: { ...reviewable, nextReviewAt: { lte: now } },
      }),
      prisma.userWordProgress.findFirst({
        where: { ...reviewable, nextReviewAt: { not: null } },
        orderBy: { nextReviewAt: "asc" },
        select: { nextReviewAt: true },
      }),
    ]);

    return { dueCount, nextDueAt: next?.nextReviewAt ?? null };
  },
);

// Admin-only "dev mode" debug view for the course home page — every word
// tracked anywhere in this course's review queue (learning or mastered,
// quizzed or not), not just the due count `getReviewQueueSummary` shows, so
// an admin can see exactly what's queued and when each word becomes due.
// Scoped to the viewing admin's own progress, same as everything else on
// the page — this is "what's in my queue," not a cross-user report.
// Silently returns an empty list for a non-admin caller rather than
// redirecting, since this is a data helper for an optional page section,
// not a page of its own.
export const getReviewQueueDebug = cache(
  async (courseSlug: string): Promise<ReviewQueueDebugEntry[]> => {
    const profile = await requireProfile();

    if (profile.role !== "admin") {
      return [];
    }

    const { user, course } = await requireEnrolledCourse(courseSlug);

    const progress = await prisma.userWordProgress.findMany({
      where: {
        userId: user.id,
        word: {
          languageDeck: { courseId: course.id, active: true },
          active: true,
        },
      },
      include: { word: { select: { term: true, translation: true } } },
      orderBy: [{ nextReviewAt: "asc" }],
    });

    return progress.map((entry) => ({
      wordId: entry.wordId,
      term: entry.word.term,
      translation: entry.word.translation,
      stage: entry.stage,
      stageName: stageInfo(entry.stage).nameEn,
      lastSeenAt: entry.lastSeenAt,
      nextReviewAt: entry.nextReviewAt,
    }));
  },
);

// The scheduled review session itself — every word due right now
// (`nextReviewAt <= now`, stage below Mastered) anywhere in the course,
// vocab or grammar, one typed question each (see `buildTypedQuestion`; the
// review queue never asks multiple choice, unlike the post-learn quiz
// above).
export const getReviewQueue = cache(
  async (courseSlug: string): Promise<QuizQuestion[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);

    const dueProgress = await prisma.userWordProgress.findMany({
      where: {
        userId: user.id,
        stage: { lt: MAX_STAGE },
        lastSeenAt: { not: null },
        nextReviewAt: { lte: new Date() },
        word: {
          languageDeck: { courseId: course.id, active: true },
          active: true,
        },
      },
      include: {
        word: {
          include: {
            forms: { orderBy: { position: "asc" } },
            examples: { orderBy: { position: "asc" } },
            languageDeck: { select: { path: true } },
          },
        },
      },
    });

    if (dueProgress.length === 0) {
      return [];
    }

    await bumpStreak(user.id, course.id, new Date());

    return shuffle(
      dueProgress.map((progress) =>
        buildTypedQuestion(
          {
            ...progress.word,
            path: progress.word.languageDeck.path as "vocab" | "grammar",
          },
          course,
        ),
      ),
    );
  },
);

async function bumpStreak(userId: string, courseId: string, now: Date) {
  const enrollment = await prisma.courseEnrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId, courseId } },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActivityDate: true,
    },
  });

  const updated = applyDailyActivity(enrollment, now);

  if (updated === enrollment) {
    return;
  }

  await prisma.courseEnrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: {
      currentStreak: updated.currentStreak,
      longestStreak: updated.longestStreak,
      lastActivityDate: updated.lastActivityDate,
    },
  });
}

type QuestionWord = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  languageDeckId: string;
  imageKey?: string | null;
  // The originating languageDeck's path, carried onto every question this word
  // produces (see the QuizQuestion variants in lib/definitions.ts) so Test
  // and Review — which now pool vocab and grammar together — can label
  // each question. Distractor-pool candidates carry it too (unused there,
  // just structurally required) since they share this type.
  path: "vocab" | "grammar";
  // Only populated for the reviewed word itself (never for distractor-pool
  // candidates) — cross-referenced against `examples` to build fill-in-the-
  // blank "cloze" questions.
  forms?: { id: string; value: string }[];
  examples?: { en: string; ja: string }[];
};

// Distractors lean heavily toward the word's own category: 2 of the 3 come
// from the same languageDeck and 1 from elsewhere in the course, so together with
// the correct answer (always same-category) 3 of the 4 options share a
// category — close to the requested 4-out-of-5 split, given there are only
// 4 options on screen. Falls back to whatever's left in the course when a
// category is too small to fill on its own.
const SAME_CATEGORY_DISTRACTORS = 2;
const OTHER_CATEGORY_DISTRACTORS = 1;

function buildMultipleChoiceQuestion(
  word: QuestionWord,
  pool: QuestionWord[],
  course: { targetLanguage: string; sourceLanguage: string },
): QuizQuestion {
  const direction: QuizDirection =
    Math.random() < 0.5 ? "term-to-translation" : "translation-to-term";
  const showingTerm = direction === "translation-to-term";

  const toOption = (candidate: QuestionWord): QuizOption =>
    showingTerm
      ? {
          text: candidate.term,
          romanization: candidate.romanization,
          image: wordImagePath(candidate),
        }
      : {
          text: candidate.translation,
          romanization: null,
          image: wordImagePath(candidate),
        };

  const rest = pool.filter((candidate) => candidate.id !== word.id);
  const sameCategory = shuffle(
    rest.filter(
      (candidate) => candidate.languageDeckId === word.languageDeckId,
    ),
  );
  const otherCategory = shuffle(
    rest.filter(
      (candidate) => candidate.languageDeckId !== word.languageDeckId,
    ),
  );

  const picked: QuestionWord[] = [
    ...sameCategory.slice(0, SAME_CATEGORY_DISTRACTORS),
    ...otherCategory.slice(0, OTHER_CATEGORY_DISTRACTORS),
  ];

  if (picked.length < 3) {
    const used = new Set(picked.map((candidate) => candidate.id));
    const fallback = shuffle(
      rest.filter((candidate) => !used.has(candidate.id)),
    );
    picked.push(...fallback.slice(0, 3 - picked.length));
  }

  const distractors = picked.map(toOption);

  return {
    kind: "multiple-choice",
    wordId: word.id,
    path: word.path,
    direction,
    prompt: direction === "term-to-translation" ? word.term : word.translation,
    promptRomanization:
      direction === "term-to-translation" ? word.romanization : null,
    targetLanguage: course.targetLanguage,
    options: shuffle([toOption(word), ...distractors]),
    image: wordImagePath(word),
  };
}

// The typed counterpart to `buildMultipleChoiceQuestion` — prefers a
// fill-in-the-blank cloze question built from the word's own forms/examples
// when one exists (reusing the admin-authored example-sentence content),
// falling back to a generic "type the term/translation" question for words
// with no form data. Used both for the typed half of the post-learn quiz
// and, exclusively, for every review-queue question.
function buildTypedQuestion(
  word: QuestionWord,
  course: { targetLanguage: string; sourceLanguage: string },
): QuizQuestion {
  const clozeByForm = findClozeMatchesByForm(
    word.forms ?? [],
    word.examples ?? [],
  );

  if (clozeByForm.size > 0) {
    const match = pickRandomClozeMatch(clozeByForm)!;

    return {
      kind: "type-form",
      wordId: word.id,
      path: word.path,
      formId: match.formId,
      clozeSentence: match.en,
      clozeSentenceJa: match.ja,
      targetLanguage: course.targetLanguage,
    };
  }

  // A word whose term isn't Latin-typeable can only be typed *back* (the
  // translation-to-term direction) when its romanization is a full
  // transliteration of the term — true for vocab, not for grammar (see
  // isLatinTypeable in lib/language.ts). Otherwise translation-to-term is
  // skipped entirely rather than asking for an untypeable answer.
  const termIsTypeable = isLatinTypeable(word.term);
  const canTypeTermBack =
    termIsTypeable || (word.path === "vocab" && Boolean(word.romanization));

  const direction: QuizDirection = !canTypeTermBack
    ? "term-to-translation"
    : Math.random() < 0.5
      ? "term-to-translation"
      : "translation-to-term";

  const answerRomanized = direction === "translation-to-term" && !termIsTypeable;

  return {
    kind: "type-answer",
    wordId: word.id,
    path: word.path,
    direction,
    prompt: direction === "term-to-translation" ? word.term : word.translation,
    promptRomanization:
      direction === "term-to-translation" ? word.romanization : null,
    answerRomanized,
    targetLanguage: course.targetLanguage,
    image: wordImagePath(word),
  };
}

// Every (form, example) cloze match becomes its own question — used only
// for a freshly-learned grammar point's post-learn quiz (see
// `getTestQueue`), where the point is meant to be drilled across all of its
// example sentences at once, not just one at random the way
// `buildTypedQuestion` picks for ordinary review. Falls back to a single
// generic typed question for the rare word with no matchable forms/examples
// at all, so a quiz question is always produced.
function buildAllClozeQuestions(
  word: QuestionWord,
  course: { targetLanguage: string; sourceLanguage: string },
): QuizQuestion[] {
  const clozeByForm = findClozeMatchesByForm(
    word.forms ?? [],
    word.examples ?? [],
  );
  const matches = [...clozeByForm.values()].flat();

  if (matches.length === 0) {
    return [buildTypedQuestion(word, course)];
  }

  return matches.map((match) => ({
    kind: "type-form",
    wordId: word.id,
    path: word.path,
    formId: match.formId,
    clozeSentence: match.en,
    clozeSentenceJa: match.ja,
    targetLanguage: course.targetLanguage,
  }));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
