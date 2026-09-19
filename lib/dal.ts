import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  AdminCategorySummary,
  AdminCourseOption,
  AdminQuizQuestionSummary,
  AdminWordSummary,
  CourseSummary,
  DailyWordCount,
  EnrolledCourseSummary,
  LeaderboardEntry,
  LessonSummary,
  Profile,
  QuizDirection,
  QuizOption,
  QuizQuestion,
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
  startOfUTCDay,
} from "@/lib/srs";
import { wordImagePath } from "@/lib/images";
import { findClozeMatchesByForm, pickRandomClozeMatch } from "@/lib/cloze";
import { parseDonguriConfig, type AccessoryId } from "@/lib/levels";

export const getSession = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // "No session" is the normal state for a signed-out visitor (e.g. every
    // anonymous homepage visit) — only log genuinely unexpected failures.
    if (error.name !== "AuthSessionMissingError") {
      console.error("Failed to retrieve Supabase user:", error);
    }
    return null;
  }

  return user;
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

// Unlike the other course reads below, this one is intentionally public —
// used by the signed-out marketing homepage to list the course catalog, so
// it does not call `requireUser`.
export const getPublicCourses = cache(async (): Promise<CourseSummary[]> => {
  const courses = await prisma.course.findMany({
    where: { active: true },
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

export const getEnrolledCourses = cache(async (): Promise<EnrolledCourseSummary[]> => {
  const user = await requireUser();

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId: user.id, course: { active: true } },
    orderBy: { course: { position: "asc" } },
    include: {
      course: {
        include: {
          lessons: {
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
    const totalWords = course.lessons.reduce((sum, lesson) => sum + lesson.words.length, 0);
    const knownWords = course.lessons.reduce(
      (sum, lesson) =>
        sum + lesson.words.filter((word) => word.progress.some((p) => p.status === "known")).length,
      0,
    );
    const lessonsDone = course.lessons.filter(
      (lesson) => lesson.words.length > 0 && lesson.words.every((word) => word.progress.length > 0),
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
      totalLessons: course.lessons.length,
      lessonsDone,
    };
  });
});

export const getAdminCourses = cache(async (): Promise<AdminCourseOption[]> => {
  return prisma.course.findMany({
    orderBy: { position: "asc" },
    select: { id: true, slug: true, title: true, active: true },
  });
});

// Category (Lesson) list for the admin content-management pages — includes
// every lesson regardless of `path`, unlike `getCourseDecks`'s learner-facing
// filter to active `path: 'vocab'` lessons only.
export const getAdminCategoryOverview = cache(
  async (
    courseSlug: string,
  ): Promise<{ course: CourseSummary; categories: AdminCategorySummary[] }> => {
    const course = await prisma.course.findUnique({ where: { slug: courseSlug } });

    if (!course) {
      redirect("/dashboard/admin/courses");
    }

    const lessons = await prisma.lesson.findMany({
      where: { courseId: course.id },
      orderBy: { position: "asc" },
      include: { _count: { select: { words: true } } },
    });

    return {
      course: toCourseSummary(course),
      categories: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        path: lesson.path,
        position: lesson.position,
        wordCount: lesson._count.words,
        active: lesson.active,
      })),
    };
  },
);

// Full word list for one category (Lesson), unfiltered by `active` — used by
// the admin category-detail page and by the import flow's word-selection
// step (called with the *source* lesson's id there), both of which need to
// see and toggle inactive rows rather than have them silently excluded.
export const getAdminCategoryWords = cache(async (lessonId: string) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
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

  if (!lesson) {
    redirect("/dashboard/admin/courses");
  }

  return {
    lesson: { id: lesson.id, title: lesson.title },
    course: lesson.course,
    words: lesson.words.map((word): AdminWordSummary => toAdminWordSummary(word)),
  };
});

// Single word for the admin edit-word page, with enough lesson/course
// context to verify the route params and build the "back to category" link.
export const getAdminWord = cache(async (wordId: string) => {
  const word = await prisma.word.findUnique({
    where: { id: wordId },
    include: {
      lesson: { select: { id: true, title: true, course: { select: { slug: true, title: true } } } },
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
    lesson: { id: word.lesson.id, title: word.lesson.title },
    course: word.lesson.course,
  };
});

// Every word category, for the admin word-category management page and the
// dropdown on the word create/edit forms. Small, unfiltered, ordered for
// display — not scoped to a course, since a category is meant to be reused
// across decks/courses (unlike a `Lesson`).
export const getWordCategories = cache(async (): Promise<WordCategoryOption[]> => {
  return prisma.wordCategory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true },
  });
});

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
      lesson: { select: { id: true, title: true, course: { select: { slug: true, title: true } } } },
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
    lesson: { id: word.lesson.id, title: word.lesson.title },
    course: word.lesson.course,
    autoForms: word.forms.map((form) => ({
      id: form.id,
      labelEn: form.labelEn,
      labelJa: form.labelJa,
      value: form.value,
      examples: (clozeByForm.get(form.id) ?? []).map((match) => ({ en: match.en, ja: match.ja })),
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
// lessons/practice pages without having signed up for it first.
async function requireEnrolledCourse(courseSlug: string) {
  const user = await requireUser();

  const course = await prisma.course.findUnique({ where: { slug: courseSlug } });

  if (!course || !course.active) {
    redirect("/dashboard/courses");
  }

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
  });

  if (!enrollment) {
    redirect("/dashboard/courses");
  }

  return { user, course, enrollment };
}

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

// Course landing page: meta + streak only — no lesson join, since lessons
// render on the Vocabulary sub-page instead.
export const getCourseHome = cache(async (courseSlug: string) => {
  const { course, enrollment } = await requireEnrolledCourse(courseSlug);

  return {
    course: toCourseSummary(course),
    currentStreak: enrollment.currentStreak,
    longestStreak: enrollment.longestStreak,
  };
});

type LessonWordRow = {
  id: string;
  term: string;
  translation: string;
  romanization: string | null;
  progress: { status: string }[];
};

function toLessonSummary(lesson: {
  id: string;
  title: string;
  path: string;
  position: number;
  words: LessonWordRow[];
}): LessonSummary {
  const words = lesson.words.map((word) => ({
    id: word.id,
    term: word.term,
    translation: word.translation,
    romanization: word.romanization,
    known: word.progress.some((p) => p.status === "known"),
  }));

  return {
    id: lesson.id,
    title: lesson.title,
    path: lesson.path,
    position: lesson.position,
    totalWords: words.length,
    learntWords: lesson.words.filter((word) => word.progress.length > 0).length,
    knownWords: words.filter((word) => word.known).length,
    words,
  };
}

const LESSON_WORDS_SELECT = {
  id: true,
  term: true,
  translation: true,
  romanization: true,
  progress: { select: { status: true } },
} as const;

// A "deck" is a `path: 'vocab'` Lesson — see the note in supabase/schema.sql
// section 19: `lessons.path` was laid out for a `(vocab, grammar)` pair
// sharing one `position`, so a vocab lesson can have a grammar sibling (see
// `getGrammarDeck`), but the deck *picker* grid this powers only ever shows
// the vocab side — grammar is presented as a section within a deck, not a
// separately pickable one.
export const getCourseDecks = cache(async (courseSlug: string) => {
  const { user, course } = await requireEnrolledCourse(courseSlug);

  const lessons = await prisma.lesson.findMany({
    where: { courseId: course.id, path: "vocab", active: true },
    orderBy: { position: "asc" },
    include: {
      words: {
        where: { active: true },
        orderBy: { position: "asc" },
        select: {
          ...LESSON_WORDS_SELECT,
          progress: { where: { userId: user.id }, select: { status: true } },
        },
      },
    },
  });

  return {
    course: toCourseSummary(course),
    decks: lessons.map((lesson) => toLessonSummary(lesson)),
  };
});

// Single lesson's stats/words for the deck detail and learn/test/review
// pages — deliberately path-agnostic (unlike `getCourseDecks`), so it
// resolves a `path: 'grammar'` lesson by its own id exactly like a vocab
// one; the learn/quiz/review-queue mechanics never cared about path in the
// first place (see `requireDeck`). Redirects to the deck list if the id
// doesn't resolve to an active lesson in this course.
export const getDeckDetail = cache(async (courseSlug: string, deckId: string) => {
  const { user, course } = await requireEnrolledCourse(courseSlug);

  const lesson = await prisma.lesson.findFirst({
    where: { id: deckId, courseId: course.id, active: true },
    include: {
      words: {
        where: { active: true },
        orderBy: { position: "asc" },
        select: {
          ...LESSON_WORDS_SELECT,
          progress: { where: { userId: user.id }, select: { status: true } },
        },
      },
    },
  });

  if (!lesson) {
    redirect(`/dashboard/courses/${courseSlug}`);
  }

  return { course: toCourseSummary(course), deck: toLessonSummary(lesson) };
});

// The `path: 'grammar'` Lesson sharing this vocab deck's `position` (see the
// note on `getCourseDecks` above) — null if this deck has no grammar
// content yet. Powers the deck page's "Grammar" section; its own
// learn/test/review reuse the exact same routes/flows as vocabulary,
// addressed by this sibling lesson's own id.
export const getGrammarDeck = cache(
  async (courseSlug: string, deckId: string): Promise<LessonSummary | null> => {
    const { course } = await requireEnrolledCourse(courseSlug);

    const vocabLesson = await prisma.lesson.findFirst({
      where: { id: deckId, courseId: course.id, path: "vocab", active: true },
      select: { position: true },
    });

    if (!vocabLesson) {
      return null;
    }

    const grammarLesson = await prisma.lesson.findFirst({
      where: { courseId: course.id, path: "grammar", position: vocabLesson.position, active: true },
      select: { id: true },
    });

    if (!grammarLesson) {
      return null;
    }

    const { deck } = await getDeckDetail(courseSlug, grammarLesson.id);
    return deck;
  },
);

// A grammar lesson isn't itself "the deck" — it's a section within its
// vocab sibling's page (see `getGrammarDeck`) — so a direct visit to a
// grammar lesson's id (e.g. a practice session's "back to deck" link)
// should land on that vocab sibling's page, not render the grammar lesson
// as if it were a standalone deck. Returns `deckId` unchanged for a vocab
// lesson (the common case) or one that no longer resolves at all — the page
// calling this handles that redirect itself via `getDeckDetail`.
export const getCanonicalDeckId = cache(async (courseSlug: string, deckId: string): Promise<string> => {
  const { course } = await requireEnrolledCourse(courseSlug);

  const lesson = await prisma.lesson.findFirst({
    where: { id: deckId, courseId: course.id, active: true },
    select: { path: true, position: true },
  });

  if (!lesson || lesson.path === "vocab") {
    return deckId;
  }

  const vocabSibling = await prisma.lesson.findFirst({
    where: { courseId: course.id, path: "vocab", position: lesson.position, active: true },
    select: { id: true },
  });

  return vocabSibling?.id ?? deckId;
});

// Every lesson id that makes up "this deck" — the vocab lesson at `deckId`
// plus its `path: 'grammar'` sibling if one exists (same course + position,
// see `getGrammarDeck`) — so review-queue queries can span both. `deckId`
// itself is included even if the lookup below finds nothing else, so a
// caller can pass the result straight into a `lessonId: { in: ... }` filter
// without a special case for "no grammar content."
async function getDeckLessonIds(courseId: string, deckId: string): Promise<string[]> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: deckId, courseId, active: true },
    select: { position: true },
  });

  if (!lesson) {
    return [deckId];
  }

  const siblings = await prisma.lesson.findMany({
    where: { courseId, position: lesson.position, active: true },
    select: { id: true },
  });

  return siblings.length > 0 ? siblings.map((sibling) => sibling.id) : [deckId];
}

// One entry per day in the current streak's date range (zero-filled for a
// day with no *new* words — a review-only day is still a valid streak day).
// Empty when there's no active streak to show.
export const getDailyWordCounts = cache(async (courseSlug: string): Promise<DailyWordCount[]> => {
  const { user, course, enrollment } = await requireEnrolledCourse(courseSlug);

  if (enrollment.currentStreak <= 0 || !enrollment.lastActivityDate) {
    return [];
  }

  const rangeEnd = startOfUTCDay(enrollment.lastActivityDate);
  const rangeStart = addDays(rangeEnd, -(enrollment.currentStreak - 1));

  const progress = await prisma.userWordProgress.findMany({
    where: {
      userId: user.id,
      word: { lesson: { courseId: course.id } },
      introducedAt: { gte: rangeStart, lt: addDays(rangeEnd, 1) },
    },
    select: { introducedAt: true },
  });

  const counts = new Map<string, number>();
  for (const { introducedAt } of progress) {
    const day = startOfUTCDay(introducedAt).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const days: DailyWordCount[] = [];
  for (let day = rangeStart; day <= rangeEnd; day = addDays(day, 1)) {
    const date = day.toISOString().slice(0, 10);
    days.push({ date, count: counts.get(date) ?? 0 });
  }

  return days;
});

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

function toLeaderboardEntry(profile: LeaderboardProfile, selfId: string): LeaderboardEntry {
  return {
    id: profile.id,
    name: profile.fullName ?? profile.email.split("@")[0],
    xp: profile.xp,
    equippedAccessory:
      (parseDonguriConfig(profile.donguriConfig).equippedAccessory as AccessoryId | undefined) ?? null,
    isSelf: profile.id === selfId,
  };
}

// Every friend the user has added, plus themselves (so you can see your own
// rank among friends) — sorted by XP, highest first. Deliberately not
// wrapped in `cache()`: this is also called fresh from the add/remove-friend
// actions right after a mutation, where a memoized read would be stale.
export async function getFriendsLeaderboard(userId: string): Promise<LeaderboardEntry[]> {
  const [friendships, self] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      include: { friend: { select: LEADERBOARD_PROFILE_SELECT } },
    }),
    prisma.profile.findUniqueOrThrow({ where: { id: userId }, select: LEADERBOARD_PROFILE_SELECT }),
  ]);

  const entries = [self, ...friendships.map((friendship) => friendship.friend)].map((profile) =>
    toLeaderboardEntry(profile, userId),
  );

  return entries.sort((a, b) => b.xp - a.xp);
}

// Global top 10 by XP, plus the viewer's own friends leaderboard (which
// always includes themselves) — XP is an app-wide stat, not per-course, so
// this isn't scoped to whichever course happens to display it.
export const getLeaderboards = cache(
  async (): Promise<{ top: LeaderboardEntry[]; friends: LeaderboardEntry[] }> => {
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

// Finds the lesson and redirects to the course's deck list if it doesn't
// resolve — shared by `getLearnQueue`/`getTestQueue`/`getReviewQueue` so a
// stale/bad `deckId` in the URL can't reach any of them. Path-agnostic on
// purpose — a `path: 'grammar'` lesson runs through the exact same
// learn/quiz/review-queue mechanics as a vocab one (see `getGrammarDeck`),
// just addressed by its own id.
async function requireDeck(courseSlug: string, courseId: string, deckId: string) {
  const deck = await prisma.lesson.findFirst({
    where: { id: deckId, courseId, active: true },
    select: { id: true, path: true },
  });

  if (!deck) {
    redirect(`/dashboard/courses/${courseSlug}`);
  }

  return deck;
}

// Introduces up to SET_SIZE new words from this deck (creating their
// `UserWordProgress` rows and bumping the streak) — the "Learn" half of what
// used to be one combined practice queue. Read-heavy but also writes:
// introducing the set has to happen exactly when the queue is built, not as
// a separate step a caller could forget.
export const getLearnQueue = cache(
  async (courseSlug: string, deckId: string): Promise<RevealWord[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const deck = await requireDeck(courseSlug, course.id, deckId);

    const newWords = await prisma.word.findMany({
      where: {
        lessonId: deck.id,
        active: true,
        progress: { none: { userId: user.id } },
      },
      orderBy: { position: "asc" },
      take: SET_SIZE,
      include: {
        forms: { orderBy: { position: "asc" } },
        examples: { orderBy: { position: "asc" } },
      },
    });

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
    }));
  },
);

// Quiz-only, deck-scoped, never introduces new words — the "Test yourself"
// half of the learn/quiz pair. Pool is every word in *this deck* that's been
// learned but never yet answered (`lastSeenAt: null`). For a vocab deck,
// each word gets exactly two questions (one multiple-choice, one typed —
// see `buildTypedQuestion`), so a fresh 3-word learn session always
// produces a 6-question quiz. For a grammar deck, every fresh point's
// example sentences each become their own fill-in-the-blank question (see
// `buildAllClozeQuestions`) — never multiple choice, since what's being
// tested is production of the structure itself, not recognition among
// options — so a fresh 3-point learn session (3 examples each) produces a
// 9-question quiz. Either way, answering these never advances the word's stage
// (see `recordAnswer`'s `advancesStage` in lib/actions/vocab.ts) — its
// stage-1 review stays due 4 hours after it was *learned* (see
// `getLearnQueue`), not from whenever it happens to get quizzed. A word
// drops out of this pool the moment its first question is answered and
// from then on is governed entirely by its stage/`nextReviewAt` — i.e. by
// `getReviewQueue` below.
export const getTestQueue = cache(
  async (courseSlug: string, deckId: string): Promise<QuizQuestion[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const deck = await requireDeck(courseSlug, course.id, deckId);

    const freshProgress = await prisma.userWordProgress.findMany({
      where: {
        userId: user.id,
        lastSeenAt: null,
        word: { lessonId: deck.id, active: true },
      },
      include: {
        word: {
          include: {
            forms: { orderBy: { position: "asc" } },
            examples: { orderBy: { position: "asc" } },
          },
        },
      },
    });

    if (freshProgress.length === 0) {
      return [];
    }

    await bumpStreak(user.id, course.id, new Date());

    if (deck.path === "grammar") {
      const questions = freshProgress.flatMap((progress) =>
        buildAllClozeQuestions(progress.word, course),
      );
      return shuffle(questions);
    }

    const distractorPool = await prisma.word.findMany({
      where: { lesson: { courseId: course.id, active: true }, active: true },
      select: {
        id: true,
        term: true,
        translation: true,
        romanization: true,
        lessonId: true,
        imageKey: true,
      },
    });

    const questions = freshProgress.flatMap((progress) => [
      buildMultipleChoiceQuestion(progress.word, distractorPool, course),
      buildTypedQuestion(progress.word, course),
    ]);

    return shuffle(questions);
  },
);

// One review queue per *deck*, combining its vocab lesson and its grammar
// sibling if it has one (see `getDeckLessonIds`) — not two separate queues,
// and not shared across other decks in the course either. Deck-page summary
// card: just a count of words due right now plus the earliest upcoming due
// time (for a "next review in ..." hint when nothing's due), not the full
// question set — building that is deferred to `getReviewQueue`, only once
// the learner actually starts a session.
export const getReviewQueueSummary = cache(
  async (courseSlug: string, deckId: string): Promise<ReviewQueueSummary> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const lessonIds = await getDeckLessonIds(course.id, deckId);
    const now = new Date();

    const reviewable = {
      userId: user.id,
      stage: { lt: MAX_STAGE },
      lastSeenAt: { not: null },
      word: { lessonId: { in: lessonIds }, active: true },
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

// The scheduled review session itself — every word due right now
// (`nextReviewAt <= now`, stage below Mastered) in this deck's vocab lesson
// or its grammar sibling, one typed question each (see `buildTypedQuestion`;
// the review queue never asks multiple choice, unlike the post-learn quiz
// above).
export const getReviewQueue = cache(
  async (courseSlug: string, deckId: string): Promise<QuizQuestion[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const lessonIds = await getDeckLessonIds(course.id, deckId);

    const dueProgress = await prisma.userWordProgress.findMany({
      where: {
        userId: user.id,
        stage: { lt: MAX_STAGE },
        lastSeenAt: { not: null },
        nextReviewAt: { lte: new Date() },
        word: { lessonId: { in: lessonIds }, active: true },
      },
      include: {
        word: {
          include: {
            forms: { orderBy: { position: "asc" } },
            examples: { orderBy: { position: "asc" } },
          },
        },
      },
    });

    if (dueProgress.length === 0) {
      return [];
    }

    await bumpStreak(user.id, course.id, new Date());

    return shuffle(dueProgress.map((progress) => buildTypedQuestion(progress.word, course)));
  },
);

async function bumpStreak(userId: string, courseId: string, now: Date) {
  const enrollment = await prisma.courseEnrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId, courseId } },
    select: { currentStreak: true, longestStreak: true, lastActivityDate: true },
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
  lessonId: string;
  imageKey?: string | null;
  // Only populated for the reviewed word itself (never for distractor-pool
  // candidates) — cross-referenced against `examples` to build fill-in-the-
  // blank "cloze" questions.
  forms?: { id: string; value: string }[];
  examples?: { en: string; ja: string }[];
};

// Distractors lean heavily toward the word's own category: 2 of the 3 come
// from the same lesson and 1 from elsewhere in the course, so together with
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
  const sameCategory = shuffle(rest.filter((candidate) => candidate.lessonId === word.lessonId));
  const otherCategory = shuffle(rest.filter((candidate) => candidate.lessonId !== word.lessonId));

  const picked: QuestionWord[] = [
    ...sameCategory.slice(0, SAME_CATEGORY_DISTRACTORS),
    ...otherCategory.slice(0, OTHER_CATEGORY_DISTRACTORS),
  ];

  if (picked.length < 3) {
    const used = new Set(picked.map((candidate) => candidate.id));
    const fallback = shuffle(rest.filter((candidate) => !used.has(candidate.id)));
    picked.push(...fallback.slice(0, 3 - picked.length));
  }

  const distractors = picked.map(toOption);

  return {
    kind: "multiple-choice",
    wordId: word.id,
    direction,
    prompt: direction === "term-to-translation" ? word.term : word.translation,
    promptRomanization: direction === "term-to-translation" ? word.romanization : null,
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
  const clozeByForm = findClozeMatchesByForm(word.forms ?? [], word.examples ?? []);

  if (clozeByForm.size > 0) {
    const match = pickRandomClozeMatch(clozeByForm)!;

    return {
      kind: "type-form",
      wordId: word.id,
      formId: match.formId,
      clozeSentence: match.en,
      clozeSentenceJa: match.ja,
      targetLanguage: course.targetLanguage,
    };
  }

  const direction: QuizDirection =
    Math.random() < 0.5 ? "term-to-translation" : "translation-to-term";

  return {
    kind: "type-answer",
    wordId: word.id,
    direction,
    prompt: direction === "term-to-translation" ? word.term : word.translation,
    promptRomanization: direction === "term-to-translation" ? word.romanization : null,
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
  const clozeByForm = findClozeMatchesByForm(word.forms ?? [], word.examples ?? []);
  const matches = [...clozeByForm.values()].flat();

  if (matches.length === 0) {
    return [buildTypedQuestion(word, course)];
  }

  return matches.map((match) => ({
    kind: "type-form",
    wordId: word.id,
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
