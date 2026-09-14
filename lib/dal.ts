import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  AdminCategorySummary,
  AdminCourseOption,
  AdminWordSummary,
  CourseSummary,
  DailyWordCount,
  EnrolledCourseSummary,
  LessonSummary,
  Profile,
  QuizDirection,
  QuizOption,
  QuizQuestion,
  RevealWord,
  UserRole,
} from "@/lib/definitions";
import {
  addDays,
  applyDailyActivity,
  CATEGORY_BOOST,
  QUIZ_SIZE,
  SET_SIZE,
  startOfUTCDay,
  weightForBox,
  weightedSampleWithRepeats,
} from "@/lib/srs";
import { wordImagePath } from "@/lib/images";

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

// A "deck" is a `path: 'vocab'` Lesson — see the note in supabase/schema.sql
// section 19 and the plan behind this function: `lessons.path` was already
// laid out for a `(vocab, grammar)` pair sharing one `position`, but no
// grammar content exists yet, so a deck is just this vocab lesson for now.
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
          id: true,
          term: true,
          translation: true,
          romanization: true,
          progress: {
            where: { userId: user.id },
            select: { status: true },
          },
        },
      },
    },
  });

  const deckSummaries: LessonSummary[] = lessons.map((lesson) => {
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
      position: lesson.position,
      totalWords: words.length,
      learntWords: lesson.words.filter((word) => word.progress.length > 0).length,
      knownWords: words.filter((word) => word.known).length,
      words,
    };
  });

  return {
    course: toCourseSummary(course),
    decks: deckSummaries,
  };
});

// Single deck's stats/words for the deck detail page (Grammar placeholder +
// Vocab section header). Redirects to the deck list if the id doesn't
// resolve to an active vocab lesson in this course.
export const getDeckDetail = cache(async (courseSlug: string, deckId: string) => {
  const { course, decks } = await getCourseDecks(courseSlug);

  const deck = decks.find((candidate) => candidate.id === deckId);

  if (!deck) {
    redirect(`/dashboard/courses/${courseSlug}`);
  }

  return { course, deck };
});

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

// Finds the deck (a `path: 'vocab'` Lesson) and redirects to the course's
// deck list if it doesn't resolve — shared by `getLearnQueue`/`getTestQueue`
// so a stale/bad `deckId` in the URL can't reach either queue.
async function requireDeck(courseSlug: string, courseId: string, deckId: string) {
  const deck = await prisma.lesson.findFirst({
    where: { id: deckId, courseId, path: "vocab", active: true },
    select: { id: true },
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
          box: 1,
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

// The "Test yourself" half: quiz-only, never introduces new words. Draws
// from every word already `learning` across the whole course — weighted by
// `weightForBox` (so recently-introduced/weaker words dominate) times
// `CATEGORY_BOOST` for words in this deck. Bumps the streak only when
// there's actually something to review.
export const getTestQueue = cache(
  async (courseSlug: string, deckId: string): Promise<QuizQuestion[]> => {
    const { user, course } = await requireEnrolledCourse(courseSlug);
    const deck = await requireDeck(courseSlug, course.id, deckId);

    const activePool = await prisma.userWordProgress.findMany({
      where: {
        userId: user.id,
        status: "learning",
        word: { lesson: { courseId: course.id, active: true }, active: true },
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

    if (activePool.length === 0) {
      return [];
    }

    await bumpStreak(user.id, course.id, new Date());

    const quizCandidates = activePool.map((progress) => ({
      item: progress.word,
      weight:
        weightForBox(progress.box) * (progress.word.lessonId === deck.id ? CATEGORY_BOOST : 1),
    }));

    const reviewSample = weightedSampleWithRepeats(quizCandidates, QUIZ_SIZE);

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

    return shuffle(reviewSample.map((word) => buildQuestion(word, distractorPool, course)));
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word, case-insensitive — so a form value like "you" doesn't match
// inside "yourself", and "Went" still matches "went".
function wholeWordPattern(value: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "i");
}

type ClozeCandidate = { formId: string; clozeSentence: string; clozeSentenceJa: string };

// Cross-references every form against every example sentence — no admin
// tagging required — and blanks out the form's value wherever an example
// literally contains it as a whole word. Because the match is verified
// against the actual sentence text, there's no risk of asking the learner
// to fill in a form the sentence doesn't really demonstrate.
function findClozeCandidates(word: QuestionWord): ClozeCandidate[] {
  const forms = word.forms ?? [];
  const examples = word.examples ?? [];
  const candidates: ClozeCandidate[] = [];

  for (const form of forms) {
    const pattern = wholeWordPattern(form.value);
    for (const example of examples) {
      if (pattern.test(example.en)) {
        candidates.push({
          formId: form.id,
          clozeSentence: example.en.replace(pattern, "___"),
          clozeSentenceJa: example.ja,
        });
      }
    }
  }

  return candidates;
}

// A word with at least one (form, example) cloze match gets this chance,
// per question, to be asked as a fill-in-the-blank form question instead of
// the usual term/translation multiple choice — split evenly between typing
// the answer and choosing it from the word's own forms (the latter only
// when there are at least 2 distinct forms to choose between). Words with
// no qualifying forms are unaffected and always fall through to multiple
// choice.
const FORM_QUESTION_CHANCE = 2 / 3;

function buildQuestion(
  word: QuestionWord,
  pool: QuestionWord[],
  course: { targetLanguage: string; sourceLanguage: string },
): QuizQuestion {
  const clozeCandidates = findClozeCandidates(word);

  if (clozeCandidates.length > 0 && Math.random() < FORM_QUESTION_CHANCE) {
    const candidate = clozeCandidates[Math.floor(Math.random() * clozeCandidates.length)];
    const uniqueFormValues = [...new Set((word.forms ?? []).map((form) => form.value))];

    if (uniqueFormValues.length >= 2 && Math.random() < 0.5) {
      return {
        kind: "form-choice",
        wordId: word.id,
        formId: candidate.formId,
        clozeSentence: candidate.clozeSentence,
        clozeSentenceJa: candidate.clozeSentenceJa,
        targetLanguage: course.targetLanguage,
        options: shuffle(uniqueFormValues),
      };
    }

    return {
      kind: "type-form",
      wordId: word.id,
      formId: candidate.formId,
      clozeSentence: candidate.clozeSentence,
      clozeSentenceJa: candidate.clozeSentenceJa,
      targetLanguage: course.targetLanguage,
    };
  }

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

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
