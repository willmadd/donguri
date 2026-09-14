"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildWordImageKey, uploadWordImage } from "@/lib/bunny";
import {
  BulkQuizQuestionsSchema,
  CreateCategoryFormSchema,
  CreateWordFormSchema,
  ImportWordsFormSchema,
  UpdateWordFormSchema,
  WordExampleInputSchema,
  WordFormInputSchema,
  WordQuizQuestionInputSchema,
  type BulkImportQuizQuestionsFormState,
  type CreateCategoryFormState,
  type CreateWordFormState,
  type ImportWordsFormState,
  type SaveQuizQuestionsFormState,
  type UpdateWordFormState,
} from "@/lib/definitions";

// Reconstructs repeatable "forms" / "examples" rows from indexed FormData
// keys (`forms.0.labelEn`, `examples.0.formClientId`, ...) — the admin word
// form renders one input group per array row under that naming convention.
function collectIndexedRows(formData: FormData, prefix: string): Record<string, string>[] {
  const rowPattern = new RegExp(`^${prefix}\\.(\\d+)\\.(.+)$`);
  const rows = new Map<number, Record<string, string>>();

  for (const [key, value] of formData.entries()) {
    const match = rowPattern.exec(key);
    if (!match || typeof value !== "string") continue;

    const index = Number(match[1]);
    const row = rows.get(index) ?? {};
    row[match[2]] = value;
    rows.set(index, row);
  }

  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row);
}

// A row the admin added but left entirely blank (e.g. clicked "Add form"
// then changed their mind) is silently dropped rather than rejected.
function isBlankRow(row: Record<string, string>, ignoreKeys: string[]): boolean {
  return Object.entries(row).every(([key, value]) => ignoreKeys.includes(key) || value.trim() === "");
}

// Validates the submitted forms/examples rows and replaces every existing
// row for this word with them, inside one transaction. Forms don't have real
// ids yet at submit time (especially on create), so each form row carries a
// client-generated `clientId` that examples reference via `formClientId` —
// this maps that to the real generated `WordForm.id` before inserting.
// Silent best-effort validation (drop invalid/blank rows) fits this
// admin-only, low-frequency tool the same way image-upload failures here are
// handled with a plain message rather than field-level errors.
async function replaceWordFormsAndExamples(wordId: string, formData: FormData): Promise<void> {
  const formRows = collectIndexedRows(formData, "forms")
    .filter((row) => !isBlankRow(row, ["clientId"]))
    .map((row) => WordFormInputSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);

  const exampleRows = collectIndexedRows(formData, "examples")
    .filter((row) => !isBlankRow(row, ["formClientId"]))
    .map((row) => WordExampleInputSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);

  const formIdByClientId = new Map<string, string>();
  const formsData = formRows.map((form, index) => {
    const id = randomUUID();
    formIdByClientId.set(form.clientId, id);
    return {
      id,
      wordId,
      labelEn: form.labelEn,
      labelJa: form.labelJa,
      value: form.value,
      position: index + 1,
    };
  });

  const examplesData = exampleRows.map((example, index) => ({
    id: randomUUID(),
    wordId,
    formId: example.formClientId ? (formIdByClientId.get(example.formClientId) ?? null) : null,
    en: example.en,
    ja: example.ja,
    position: index + 1,
  }));

  await prisma.$transaction([
    prisma.wordExample.deleteMany({ where: { wordId } }),
    prisma.wordForm.deleteMany({ where: { wordId } }),
    ...(formsData.length > 0 ? [prisma.wordForm.createMany({ data: formsData })] : []),
    ...(examplesData.length > 0 ? [prisma.wordExample.createMany({ data: examplesData })] : []),
  ]);
}

// Validates the submitted hand-authored quiz-question rows and replaces
// every existing custom question for this word with them — same
// replace-all-in-one-transaction shape as `replaceWordFormsAndExamples`
// above, for the same reason (admin-only, low-frequency, no per-row
// ordering/identity worth preserving across a save). Blank option2/option3
// slots are dropped, so a question can have 2, 3, or 4 options; if the
// admin marked a now-missing slot as correct, this falls back to the last
// remaining option rather than pointing past the end of the array.
export async function saveQuizQuestions(
  _state: SaveQuizQuestionsFormState,
  formData: FormData,
): Promise<SaveQuizQuestionsFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const wordId = formData.get("wordId");

  if (typeof wordId !== "string" || wordId === "") {
    return { message: "Missing word." };
  }

  const word = await prisma.word.findUnique({
    where: { id: wordId },
    select: { lessonId: true, lesson: { select: { course: { select: { slug: true } } } } },
  });

  if (!word) {
    return { message: "That word no longer exists." };
  }

  const rows = collectIndexedRows(formData, "questions")
    .filter((row) => !isBlankRow(row, ["correctIndex"]))
    .map((row) => WordQuizQuestionInputSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);

  const questionsData = rows.map((row, index) => {
    const options = [row.option0, row.option1, row.option2, row.option3].filter(
      (option): option is string => Boolean(option && option.trim() !== ""),
    );
    const correctIndex = Math.min(Math.max(row.correctIndex, 0), options.length - 1);

    return {
      wordId,
      prompt: row.prompt,
      promptJa: row.promptJa || null,
      options,
      correctIndex,
      position: index + 1,
    };
  });

  await prisma.$transaction([
    prisma.wordQuizQuestion.deleteMany({ where: { wordId } }),
    ...(questionsData.length > 0 ? [prisma.wordQuizQuestion.createMany({ data: questionsData })] : []),
  ]);

  revalidatePath(
    `/dashboard/admin/courses/${word.lesson.course.slug}/categories/${word.lessonId}/words/${wordId}/quiz`,
  );

  return { success: true, message: "Quiz questions saved." };
}

// Parses a pasted JSON array and appends it to this word's existing custom
// questions (unlike `saveQuizQuestions` above, this never deletes anything —
// it's additive, so it's safe to paste the same batch into several words in
// a row without re-typing the repeatable-row form each time).
export async function bulkImportQuizQuestions(
  _state: BulkImportQuizQuestionsFormState,
  formData: FormData,
): Promise<BulkImportQuizQuestionsFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const wordId = formData.get("wordId");
  const json = formData.get("json");

  if (typeof wordId !== "string" || wordId === "") {
    return { message: "Missing word." };
  }

  if (typeof json !== "string" || json.trim() === "") {
    return { message: "Paste some JSON first." };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    return { message: "That isn't valid JSON." };
  }

  const validated = BulkQuizQuestionsSchema.safeParse(parsed);

  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    return {
      message: firstIssue
        ? `Invalid at item ${String(firstIssue.path[0])}: ${firstIssue.message}`
        : "That JSON doesn't match the expected shape.",
    };
  }

  const word = await prisma.word.findUnique({
    where: { id: wordId },
    select: { lessonId: true, lesson: { select: { course: { select: { slug: true } } } } },
  });

  if (!word) {
    return { message: "That word no longer exists." };
  }

  const { _max } = await prisma.wordQuizQuestion.aggregate({
    where: { wordId },
    _max: { position: true },
  });

  await prisma.wordQuizQuestion.createMany({
    data: validated.data.map((entry, index) => ({
      wordId,
      prompt: entry.prompt,
      promptJa: entry.promptJa || null,
      options: entry.options,
      correctIndex: entry.correctIndex,
      position: (_max.position ?? 0) + 1 + index,
    })),
  });

  revalidatePath(
    `/dashboard/admin/courses/${word.lesson.course.slug}/categories/${word.lessonId}/words/${wordId}/quiz`,
  );

  return {
    success: true,
    message: `Imported ${validated.data.length} question${validated.data.length === 1 ? "" : "s"}.`,
  };
}

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
  revalidatePath(`/dashboard/courses/${course.slug}`);

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
    explanation: formData.get("explanation") || undefined,
    explanationJa: formData.get("explanationJa") || undefined,
    image,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    lessonId,
    term,
    translation,
    romanization,
    exampleSentence,
    explanation,
    explanationJa,
    image: validImage,
  } = validatedFields.data;

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

  const word = await prisma.word.create({
    data: {
      lessonId,
      term,
      translation,
      romanization: romanization || null,
      exampleSentence: exampleSentence || null,
      explanation: explanation || null,
      explanationJa: explanationJa || null,
      position: (_max.position ?? 0) + 1,
      imageKey,
    },
  });

  await replaceWordFormsAndExamples(word.id, formData);

  revalidatePath(`/dashboard/admin/courses/${lesson.course.slug}/categories/${lessonId}/words/new`);
  revalidatePath(`/dashboard/courses/${lesson.course.slug}/decks/${lessonId}`);

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
    explanation: formData.get("explanation") || undefined,
    explanationJa: formData.get("explanationJa") || undefined,
    image,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    wordId,
    term,
    translation,
    romanization,
    exampleSentence,
    explanation,
    explanationJa,
    image: validImage,
  } = validatedFields.data;

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
      explanation: explanation || null,
      explanationJa: explanationJa || null,
      imageKey,
    },
  });

  await replaceWordFormsAndExamples(wordId, formData);

  const courseSlug = existing.lesson.course.slug;
  revalidatePath(`/dashboard/admin/courses/${courseSlug}/categories/${existing.lessonId}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/decks/${existing.lessonId}`);

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
  revalidatePath(`/dashboard/courses/${word.lesson.course.slug}/decks/${word.lessonId}`);
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
  revalidatePath(`/dashboard/courses/${lesson.course.slug}`);
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

  const sourceWords = await prisma.word.findMany({
    where: { id: { in: wordIds } },
    include: { forms: { orderBy: { position: "asc" } }, examples: { orderBy: { position: "asc" } } },
  });

  if (sourceWords.length === 0) {
    return { message: "Those words no longer exist." };
  }

  const { _max } = await prisma.word.aggregate({
    where: { lessonId: targetLessonId },
    _max: { position: true },
  });

  const basePosition = _max.position ?? 0;

  // Each new word needs its own id up front so its cloned forms/examples can
  // reference it, and (for examples tied to a form) the form's *new* id —
  // mirrored the same way `replaceWordFormsAndExamples` maps client ids to
  // freshly generated ones.
  await prisma.$transaction(
    sourceWords.flatMap((word, wordIndex) => {
      const newWordId = randomUUID();
      const formIdBySourceId = new Map(word.forms.map((form) => [form.id, randomUUID()]));

      return [
        prisma.word.create({
          data: {
            id: newWordId,
            lessonId: targetLessonId,
            term: word.term,
            translation: word.translation,
            romanization: word.romanization,
            exampleSentence: word.exampleSentence,
            explanation: word.explanation,
            explanationJa: word.explanationJa,
            imageKey: word.imageKey,
            position: basePosition + 1 + wordIndex,
          },
        }),
        ...(word.forms.length > 0
          ? [
              prisma.wordForm.createMany({
                data: word.forms.map((form) => ({
                  id: formIdBySourceId.get(form.id)!,
                  wordId: newWordId,
                  labelEn: form.labelEn,
                  labelJa: form.labelJa,
                  value: form.value,
                  position: form.position,
                })),
              }),
            ]
          : []),
        ...(word.examples.length > 0
          ? [
              prisma.wordExample.createMany({
                data: word.examples.map((example) => ({
                  wordId: newWordId,
                  formId: example.formId ? (formIdBySourceId.get(example.formId) ?? null) : null,
                  en: example.en,
                  ja: example.ja,
                  position: example.position,
                })),
              }),
            ]
          : []),
      ];
    }),
  );

  revalidatePath(`/dashboard/courses/${targetLesson.course.slug}/decks/${targetLessonId}`);
  redirect(`/dashboard/admin/courses/${targetLesson.course.slug}/categories/${targetLessonId}`);
}
