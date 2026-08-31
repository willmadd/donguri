import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  CourseSummary,
  DailyWordCount,
  EnrolledCourseSummary,
  LessonSummary,
  PracticeQueue,
  Profile,
  QuizDirection,
  QuizOption,
  QuizQuestion,
  UserRole,
} from "@/lib/definitions";
import {
  addDays,
  applyDailyActivity,
  REVIEW_BATCH_SIZE,
  SET_SIZE,
  startOfUTCDay,
  weightForBox,
  weightedSample,
} from "@/lib/srs";
import { wordImagePath } from "@/lib/images";

export const getSession = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to retrieve Supabase user:", error);
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

// Unlike the other course reads below, this one is intentionally public —
// used by the signed-out marketing homepage to list the course catalog, so
// it does not call `requireUser`.
export const getPublicCourses = cache(async (): Promise<CourseSummary[]> => {
  const courses = await prisma.course.findMany({ orderBy: { position: "asc" } });

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
    where: { userId: user.id },
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

export const getAvailableCourses = cache(async (): Promise<CourseSummary[]> => {
  const user = await requireUser();

  const courses = await prisma.course.findMany({
    where: { enrollments: { none: { userId: user.id } } },
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

  if (!course) {
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

export const getCourseVocabOverview = cache(async (courseSlug: string) => {
  const { user, course } = await requireEnrolledCourse(courseSlug);

  const lessons = await prisma.lesson.findMany({
    where: { courseId: course.id },
    orderBy: { position: "asc" },
    include: {
      words: {
        select: {
          progress: {
            where: { userId: user.id },
            select: { status: true },
          },
        },
      },
    },
  });

  const lessonSummaries: LessonSummary[] = lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    position: lesson.position,
    totalWords: lesson.words.length,
    knownWords: lesson.words.filter((word) => word.progress.some((p) => p.status === "known"))
      .length,
  }));

  return {
    course: toCourseSummary(course),
    lessons: lessonSummaries,
  };
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

// This is a read-heavy function that also writes: introducing a new set's
// words and bumping the streak both need to happen exactly when the queue
// is built, not as separate steps a caller could forget.
// `requireEnrolledCourse` still derives identity from the verified session
// and gates on enrollment, so the same authorization guarantee applies as
// everywhere else in this file.
//
// There's no daily cap — a "set" is just SET_SIZE new words, and a user can
// run as many sets as they want in a day. Review questions are drawn from
// every word that was already `learning` *before* this set started, weighted
// by `weightForBox` so newer/weaker words come up far more often than
// consistently-correct ones — a sliding scale rather than a due-date cutoff.
// A word only enters the review pool starting from the *next* set after it
// was introduced, never the same one — that's why `activePool` is read
// before this set's new words are inserted below, not after. Otherwise a
// word could be quizzed seconds after being revealed for the first time,
// which is what was happening before this was fixed.
export const getPracticeQueue = cache(async (courseSlug: string): Promise<PracticeQueue> => {
  const { user, course } = await requireEnrolledCourse(courseSlug);
  const now = new Date();

  const newWords = await prisma.word.findMany({
    where: {
      lesson: { courseId: course.id },
      progress: { none: { userId: user.id } },
    },
    orderBy: [{ lesson: { position: "asc" } }, { position: "asc" }],
    take: SET_SIZE,
  });

  const activePool = await prisma.userWordProgress.findMany({
    where: {
      userId: user.id,
      status: "learning",
      word: { lesson: { courseId: course.id } },
    },
    include: { word: true },
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
  }

  if (newWords.length > 0 || activePool.length > 0) {
    await bumpStreak(user.id, course.id, now);
  }

  const reviewSample = weightedSample(
    activePool.map((progress) => ({ item: progress.word, weight: weightForBox(progress.box) })),
    REVIEW_BATCH_SIZE,
  );

  const distractorPool =
    reviewSample.length > 0
      ? await prisma.word.findMany({
          where: { lesson: { courseId: course.id } },
          select: { id: true, term: true, translation: true, romanization: true },
        })
      : [];

  return {
    reveals: newWords.map((word) => ({
      id: word.id,
      term: word.term,
      translation: word.translation,
      romanization: word.romanization,
      exampleSentence: word.exampleSentence,
      image: wordImagePath(word),
    })),
    quiz: shuffle(
      reviewSample.map((word) => buildQuestion(word, distractorPool, course)),
    ),
  };
});

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

type QuestionWord = { id: string; term: string; translation: string; romanization: string | null };

function buildQuestion(
  word: QuestionWord,
  pool: QuestionWord[],
  course: { targetLanguage: string; sourceLanguage: string },
): QuizQuestion {
  const direction: QuizDirection =
    Math.random() < 0.5 ? "term-to-translation" : "translation-to-term";
  const showingTerm = direction === "translation-to-term";

  const toOption = (candidate: QuestionWord): QuizOption =>
    showingTerm
      ? { text: candidate.term, romanization: candidate.romanization }
      : { text: candidate.translation, romanization: null };

  const distractors = shuffle(pool.filter((candidate) => candidate.id !== word.id))
    .slice(0, 3)
    .map(toOption);

  return {
    wordId: word.id,
    direction,
    prompt: direction === "term-to-translation" ? word.term : word.translation,
    promptRomanization: direction === "term-to-translation" ? word.romanization : null,
    targetLanguage: course.targetLanguage,
    options: shuffle([toOption(word), ...distractors]),
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
