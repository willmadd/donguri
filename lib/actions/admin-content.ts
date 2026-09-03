"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildWordImageKey, uploadWordImage } from "@/lib/bunny";
import {
  CreateCategoryFormSchema,
  CreateWordFormSchema,
  ImportWordsFormSchema,
  UpdateWordFormSchema,
  type CreateCategoryFormState,
  type CreateWordFormState,
  type ImportWordsFormState,
  type UpdateWordFormState,
} from "@/lib/definitions";

// Same asymmetry as `lib/actions/admin.ts`: the *page* guard redirects a
// non-admin away, but an action is directly callable regardless of which
// page rendered it, so it re-checks here and returns a FormState message
// instead of redirecting.

export async function createCategory(
  _state: CreateCategoryFormState,
  formData: FormData,
): Promise<CreateCategoryFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const validatedFields = CreateCategoryFormSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { courseId, title } = validatedFields.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { slug: true },
  });

  if (!course) {
    return { message: "That course no longer exists." };
  }

  // Category (Lesson) content only exists under `path: "vocab"` today — see
  // the note in supabase/schema.sql. Not exposed as a form field.
  const { _max } = await prisma.lesson.aggregate({
    where: { courseId, path: "vocab" },
    _max: { position: true },
  });

  const lesson = await prisma.lesson.create({
    data: { courseId, path: "vocab", title, position: (_max.position ?? 0) + 1 },
  });

  revalidatePath(`/dashboard/admin/courses/${course.slug}`);
  revalidatePath(`/dashboard/courses/${course.slug}/vocab`);

  return { success: true, message: `"${title}" created.`, lessonId: lesson.id };
}

export async function createWord(
  _state: CreateWordFormState,
  formData: FormData,
): Promise<CreateWordFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  // An unfilled `<input type="file">` still submits a zero-byte File — treat
  // that as "no image" so the optional-image schema branch actually applies.
  const rawImage = formData.get("image");
  const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : undefined;

  const validatedFields = CreateWordFormSchema.safeParse({
    lessonId: formData.get("lessonId"),
    term: formData.get("term"),
    translation: formData.get("translation"),
    romanization: formData.get("romanization") || undefined,
    exampleSentence: formData.get("exampleSentence") || undefined,
    image,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { lessonId, term, translation, romanization, exampleSentence, image: validImage } =
    validatedFields.data;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, course: { select: { slug: true } } },
  });

  if (!lesson) {
    return { message: "That category no longer exists." };
  }

  const { _max } = await prisma.word.aggregate({
    where: { lessonId },
    _max: { position: true },
  });

  let imageKey: string | null = null;

  if (validImage) {
    imageKey = buildWordImageKey(validImage.type);

    try {
      await uploadWordImage(validImage, imageKey);
    } catch (error) {
      console.error("Bunny image upload failed:", error);
      return { message: "Image upload failed. Try again." };
    }
  }

  await prisma.word.create({
    data: {
      lessonId,
      term,
      translation,
      romanization: romanization || null,
      exampleSentence: exampleSentence || null,
      position: (_max.position ?? 0) + 1,
      imageKey,
    },
  });

  revalidatePath(`/dashboard/admin/courses/${lesson.course.slug}/categories/${lessonId}/words/new`);
  revalidatePath(`/dashboard/courses/${lesson.course.slug}/vocab`);

  return { success: true, message: `"${term}" added.` };
}

// A new image replaces the old one (fresh key, old bunny.net object left
// orphaned rather than deleted — not worth the extra failure handling for an
// admin-only tool); omitting the image keeps whatever is already there.
export async function updateWord(
  _state: UpdateWordFormState,
  formData: FormData,
): Promise<UpdateWordFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const rawImage = formData.get("image");
  const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : undefined;

  const validatedFields = UpdateWordFormSchema.safeParse({
    wordId: formData.get("wordId"),
    term: formData.get("term"),
    translation: formData.get("translation"),
    romanization: formData.get("romanization") || undefined,
    exampleSentence: formData.get("exampleSentence") || undefined,
    image,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { wordId, term, translation, romanization, exampleSentence, image: validImage } =
    validatedFields.data;

  const existing = await prisma.word.findUnique({
    where: { id: wordId },
    select: { imageKey: true, lessonId: true, lesson: { select: { course: { select: { slug: true } } } } },
  });

  if (!existing) {
    return { message: "That word no longer exists." };
  }

  let imageKey = existing.imageKey;

  if (validImage) {
    imageKey = buildWordImageKey(validImage.type);

    try {
      await uploadWordImage(validImage, imageKey);
    } catch (error) {
      console.error("Bunny image upload failed:", error);
      return { message: "Image upload failed. Try again." };
    }
  }

  await prisma.word.update({
    where: { id: wordId },
    data: {
      term,
      translation,
      romanization: romanization || null,
      exampleSentence: exampleSentence || null,
      imageKey,
    },
  });

  const courseSlug = existing.lesson.course.slug;
  revalidatePath(`/dashboard/admin/courses/${courseSlug}/categories/${existing.lessonId}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/vocab`);

  redirect(`/dashboard/admin/courses/${courseSlug}/categories/${existing.lessonId}`);
}

export async function setWordActive(wordId: string, active: boolean): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  const word = await prisma.word.update({
    where: { id: wordId },
    data: { active },
    select: { lessonId: true, lesson: { select: { course: { select: { slug: true } } } } },
  });

  revalidatePath(`/dashboard/admin/courses/${word.lesson.course.slug}/categories/${word.lessonId}`);
  revalidatePath(`/dashboard/courses/${word.lesson.course.slug}/vocab`);
}

export async function setCategoryActive(lessonId: string, active: boolean): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data: { active },
    select: { course: { select: { slug: true } } },
  });

  revalidatePath(`/dashboard/admin/courses/${lesson.course.slug}`);
  revalidatePath(`/dashboard/courses/${lesson.course.slug}/vocab`);
}

export async function setCourseActive(courseId: string, active: boolean): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { active },
  });

  revalidatePath("/dashboard/admin/courses");
  revalidatePath("/dashboard/courses");
}

// Clones the given words (by id, from whichever lesson they currently belong
// to) into `targetLessonId`, appending position. Fresh ids/timestamps via
// Prisma defaults; `UserWordProgress` is per-user and is never read or
// written here. Unlike the other actions in this file, it redirects back to
// the destination category on success rather than returning a FormState —
// there's no multi-submit workflow on this page to preserve, matching the
// redirect-after-success pattern already used by login/signup in
// lib/actions/auth.ts.
export async function importWords(
  _state: ImportWordsFormState,
  formData: FormData,
): Promise<ImportWordsFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const validatedFields = ImportWordsFormSchema.safeParse({
    targetLessonId: formData.get("targetLessonId"),
    wordIds: formData.getAll("wordIds"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { targetLessonId, wordIds } = validatedFields.data;

  const targetLesson = await prisma.lesson.findUnique({
    where: { id: targetLessonId },
    select: { id: true, course: { select: { slug: true } } },
  });

  if (!targetLesson) {
    return { message: "That category no longer exists." };
  }

  const sourceWords = await prisma.word.findMany({ where: { id: { in: wordIds } } });

  if (sourceWords.length === 0) {
    return { message: "Those words no longer exist." };
  }

  const { _max } = await prisma.word.aggregate({
    where: { lessonId: targetLessonId },
    _max: { position: true },
  });

  await prisma.word.createMany({
    data: sourceWords.map((word, index) => ({
      lessonId: targetLessonId,
      term: word.term,
      translation: word.translation,
      romanization: word.romanization,
      exampleSentence: word.exampleSentence,
      imageKey: word.imageKey,
      position: (_max.position ?? 0) + 1 + index,
    })),
  });

  revalidatePath(`/dashboard/courses/${targetLesson.course.slug}/vocab`);
  redirect(`/dashboard/admin/courses/${targetLesson.course.slug}/categories/${targetLessonId}`);
}
