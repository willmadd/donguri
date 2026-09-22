"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildDeckCoverImageKey, buildWordImageKey, uploadImage } from "@/lib/bunny";
import {
  BulkQuizQuestionsSchema,
  CreateCategoryFormSchema,
  CreateWordCategoryFormSchema,
  CreateWordFormSchema,
  ImportWordsFormSchema,
  UpdateCategoryFormSchema,
  UpdateWordCategoryFormSchema,
  UpdateWordFormSchema,
  WordExampleInputSchema,
  WordFormInputSchema,
  WordQuizQuestionInputSchema,
  type BulkImportQuizQuestionsFormState,
  type CreateCategoryFormState,
  type CreateWordCategoryFormState,
  type CreateWordFormState,
  type ImportWordsFormState,
  type SaveQuizQuestionsFormState,
  type UpdateCategoryFormState,
  type UpdateWordCategoryFormState,
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
    select: { languageDeckId: true, languageDeck: { select: { course: { select: { slug: true } } } } },
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
    `/dashboard/admin/courses/${word.languageDeck.course.slug}/categories/${word.languageDeckId}/words/${wordId}/quiz`,
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
    select: { languageDeckId: true, languageDeck: { select: { course: { select: { slug: true } } } } },
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
    `/dashboard/admin/courses/${word.languageDeck.course.slug}/categories/${word.languageDeckId}/words/${wordId}/quiz`,
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

  const rawCoverImage = formData.get("coverImage");
  const coverImage = rawCoverImage instanceof File && rawCoverImage.size > 0 ? rawCoverImage : undefined;

  const validatedFields = CreateCategoryFormSchema.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    subheading: formData.get("subheading") || undefined,
    description: formData.get("description") || undefined,
    coverImage,
    bgColor: formData.get("bgColor") || undefined,
    primaryColor: formData.get("primaryColor") || undefined,
    tags: formData.get("tags") || "",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    courseId,
    title,
    subheading,
    description,
    coverImage: validCoverImage,
    bgColor,
    primaryColor,
    tags,
  } = validatedFields.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { slug: true },
  });

  if (!course) {
    return { message: "That course no longer exists." };
  }

  let coverImageKey: string | null = null;

  if (validCoverImage) {
    coverImageKey = buildDeckCoverImageKey(validCoverImage.type);

    try {
      await uploadImage(validCoverImage, coverImageKey);
    } catch (error) {
      console.error("Bunny image upload failed:", error);
      return { message: "Cover image upload failed. Try again." };
    }
  }

  // Category (LanguageDeck) content only exists under `path: "vocab"` today — see
  // the note in supabase/schema.sql. Not exposed as a form field.
  const { _max } = await prisma.languageDeck.aggregate({
    where: { courseId, path: "vocab" },
    _max: { position: true },
  });

  const languageDeck = await prisma.languageDeck.create({
    data: {
      courseId,
      path: "vocab",
      title,
      subheading: subheading || null,
      description: description || null,
      coverImageKey,
      bgColor: bgColor || null,
      primaryColor: primaryColor || null,
      tags,
      position: (_max.position ?? 0) + 1,
    },
  });

  revalidatePath(`/dashboard/admin/courses/${course.slug}`);
  revalidatePath(`/dashboard/courses/${course.slug}`);

  return { success: true, message: `"${title}" created.`, languageDeckId: languageDeck.id };
}

// A new cover image replaces the old one (fresh key, old bunny.net object
// left orphaned — same tradeoff as `updateWord`'s image handling below);
// omitting it keeps whatever is already there.
export async function updateCategory(
  _state: UpdateCategoryFormState,
  formData: FormData,
): Promise<UpdateCategoryFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const rawCoverImage = formData.get("coverImage");
  const coverImage = rawCoverImage instanceof File && rawCoverImage.size > 0 ? rawCoverImage : undefined;

  const validatedFields = UpdateCategoryFormSchema.safeParse({
    languageDeckId: formData.get("languageDeckId"),
    title: formData.get("title"),
    subheading: formData.get("subheading") || undefined,
    description: formData.get("description") || undefined,
    coverImage,
    bgColor: formData.get("bgColor") || undefined,
    primaryColor: formData.get("primaryColor") || undefined,
    tags: formData.get("tags") || "",
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    languageDeckId,
    title,
    subheading,
    description,
    coverImage: validCoverImage,
    bgColor,
    primaryColor,
    tags,
  } = validatedFields.data;

  const existing = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { coverImageKey: true, course: { select: { slug: true } } },
  });

  if (!existing) {
    return { message: "That deck no longer exists." };
  }

  let coverImageKey = existing.coverImageKey;

  if (validCoverImage) {
    coverImageKey = buildDeckCoverImageKey(validCoverImage.type);

    try {
      await uploadImage(validCoverImage, coverImageKey);
    } catch (error) {
      console.error("Bunny image upload failed:", error);
      return { message: "Cover image upload failed. Try again." };
    }
  }

  await prisma.languageDeck.update({
    where: { id: languageDeckId },
    data: {
      title,
      subheading: subheading || null,
      description: description || null,
      coverImageKey,
      bgColor: bgColor || null,
      primaryColor: primaryColor || null,
      tags,
    },
  });

  const courseSlug = existing.course.slug;
  revalidatePath(`/dashboard/admin/courses/${courseSlug}`);
  revalidatePath(`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}`);
  revalidatePath(`/dashboard/courses/${courseSlug}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/decks/${languageDeckId}`);

  redirect(`/dashboard/admin/courses/${courseSlug}/categories/${languageDeckId}`);
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
    languageDeckId: formData.get("languageDeckId"),
    term: formData.get("term"),
    translation: formData.get("translation"),
    romanization: formData.get("romanization") || undefined,
    exampleSentence: formData.get("exampleSentence") || undefined,
    explanation: formData.get("explanation") || undefined,
    explanationJa: formData.get("explanationJa") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    wordType: formData.get("wordType") || undefined,
    image,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    languageDeckId,
    term,
    translation,
    romanization,
    exampleSentence,
    explanation,
    explanationJa,
    categoryId,
    wordType,
    image: validImage,
  } = validatedFields.data;

  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { id: true, course: { select: { slug: true } } },
  });

  if (!languageDeck) {
    return { message: "That category no longer exists." };
  }

  const { _max } = await prisma.word.aggregate({
    where: { languageDeckId },
    _max: { position: true },
  });

  let imageKey: string | null = null;

  if (validImage) {
    imageKey = buildWordImageKey(validImage.type);

    try {
      await uploadImage(validImage, imageKey);
    } catch (error) {
      console.error("Bunny image upload failed:", error);
      return { message: "Image upload failed. Try again." };
    }
  }

  const word = await prisma.word.create({
    data: {
      languageDeckId,
      term,
      translation,
      romanization: romanization || null,
      exampleSentence: exampleSentence || null,
      explanation: explanation || null,
      explanationJa: explanationJa || null,
      categoryId: categoryId || null,
      wordType: wordType || null,
      position: (_max.position ?? 0) + 1,
      imageKey,
    },
  });

  await replaceWordFormsAndExamples(word.id, formData);

  revalidatePath(`/dashboard/admin/courses/${languageDeck.course.slug}/categories/${languageDeckId}/words/new`);
  revalidatePath(`/dashboard/courses/${languageDeck.course.slug}/decks/${languageDeckId}`);

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
    categoryId: formData.get("categoryId") || undefined,
    wordType: formData.get("wordType") || undefined,
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
    categoryId,
    wordType,
    image: validImage,
  } = validatedFields.data;

  const existing = await prisma.word.findUnique({
    where: { id: wordId },
    select: { imageKey: true, languageDeckId: true, languageDeck: { select: { course: { select: { slug: true } } } } },
  });

  if (!existing) {
    return { message: "That word no longer exists." };
  }

  let imageKey = existing.imageKey;

  if (validImage) {
    imageKey = buildWordImageKey(validImage.type);

    try {
      await uploadImage(validImage, imageKey);
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
      categoryId: categoryId || null,
      wordType: wordType || null,
      imageKey,
    },
  });

  await replaceWordFormsAndExamples(wordId, formData);

  const courseSlug = existing.languageDeck.course.slug;
  revalidatePath(`/dashboard/admin/courses/${courseSlug}/categories/${existing.languageDeckId}`);
  revalidatePath(`/dashboard/courses/${courseSlug}/decks/${existing.languageDeckId}`);

  redirect(`/dashboard/admin/courses/${courseSlug}/categories/${existing.languageDeckId}`);
}

export async function setWordActive(wordId: string, active: boolean): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  const word = await prisma.word.update({
    where: { id: wordId },
    data: { active },
    select: { languageDeckId: true, languageDeck: { select: { course: { select: { slug: true } } } } },
  });

  revalidatePath(`/dashboard/admin/courses/${word.languageDeck.course.slug}/categories/${word.languageDeckId}`);
  revalidatePath(`/dashboard/courses/${word.languageDeck.course.slug}/decks/${word.languageDeckId}`);
}

export async function setCategoryActive(languageDeckId: string, active: boolean): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  const languageDeck = await prisma.languageDeck.update({
    where: { id: languageDeckId },
    data: { active },
    select: { course: { select: { slug: true } } },
  });

  revalidatePath(`/dashboard/admin/courses/${languageDeck.course.slug}`);
  revalidatePath(`/dashboard/courses/${languageDeck.course.slug}`);
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

// Clones the given words (by id, from whichever languageDeck they currently belong
// to) into `targetLanguageDeckId`, appending position. Fresh ids/timestamps via
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
    targetLanguageDeckId: formData.get("targetLanguageDeckId"),
    wordIds: formData.getAll("wordIds"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { targetLanguageDeckId, wordIds } = validatedFields.data;

  const targetLanguageDeck = await prisma.languageDeck.findUnique({
    where: { id: targetLanguageDeckId },
    select: { id: true, course: { select: { slug: true } } },
  });

  if (!targetLanguageDeck) {
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
    where: { languageDeckId: targetLanguageDeckId },
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
            languageDeckId: targetLanguageDeckId,
            term: word.term,
            translation: word.translation,
            romanization: word.romanization,
            exampleSentence: word.exampleSentence,
            explanation: word.explanation,
            explanationJa: word.explanationJa,
            imageKey: word.imageKey,
            categoryId: word.categoryId,
            wordType: word.wordType,
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

  revalidatePath(`/dashboard/courses/${targetLanguageDeck.course.slug}/decks/${targetLanguageDeckId}`);
  redirect(`/dashboard/admin/courses/${targetLanguageDeck.course.slug}/categories/${targetLanguageDeckId}`);
}

// Word categories (see the `WordCategory` model note in prisma/schema.prisma
// for how this differs from a "category"/`LanguageDeck` elsewhere in this file) —
// a small global lookup list, not scoped to a course, so create/update/delete
// only ever revalidate the word-category admin page itself plus the generic
// course-content paths a word's category badge could show up on.

export async function createWordCategory(
  _state: CreateWordCategoryFormState,
  formData: FormData,
): Promise<CreateWordCategoryFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const validatedFields = CreateWordCategoryFormSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, color } = validatedFields.data;

  const existing = await prisma.wordCategory.findUnique({ where: { name } });

  if (existing) {
    return { errors: { name: ["A category with that name already exists."] } };
  }

  const { _max } = await prisma.wordCategory.aggregate({ _max: { position: true } });

  await prisma.wordCategory.create({
    data: { name, color, position: (_max.position ?? 0) + 1 },
  });

  revalidatePath("/dashboard/admin/word-categories");

  return { success: true, message: `"${name}" created.` };
}

export async function updateWordCategory(
  _state: UpdateWordCategoryFormState,
  formData: FormData,
): Promise<UpdateWordCategoryFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const validatedFields = UpdateWordCategoryFormSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { categoryId, name, color } = validatedFields.data;

  const existing = await prisma.wordCategory.findUnique({ where: { name } });

  if (existing && existing.id !== categoryId) {
    return { errors: { name: ["A category with that name already exists."] } };
  }

  await prisma.wordCategory.update({
    where: { id: categoryId },
    data: { name, color },
  });

  revalidatePath("/dashboard/admin/word-categories");

  return { success: true, message: `"${name}" saved.` };
}

export async function deleteWordCategory(categoryId: string): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  // Words keeping this category are left uncategorized rather than blocked
  // — `Word.categoryId` is `onDelete: SetNull` — so deleting a category is a
  // plain, no-confirmation-needed action like the rest of this admin tool.
  await prisma.wordCategory.delete({ where: { id: categoryId } });

  revalidatePath("/dashboard/admin/word-categories");
}
