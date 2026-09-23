"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { buildDeckCoverImageKey, buildWordImageKey, uploadImage } from "@/lib/bunny";
import {
  parseExamplesColumns,
  parseFormsCell,
  parseWordImportWorkbook,
  type ParsedSheetRow,
  type ParsedWordImportRow,
} from "@/lib/word-import";
import {
  BulkQuizQuestionsSchema,
  CreateCategoryFormSchema,
  CreateWordCategoryFormSchema,
  CreateWordFormSchema,
  ImportWordsFormSchema,
  ImportWordsFromSpreadsheetFormSchema,
  UpdateCategoryFormSchema,
  UpdateWordCategoryFormSchema,
  UpdateWordFormSchema,
  WordAlternateAnswerInputSchema,
  WordExampleInputSchema,
  WordFormInputSchema,
  WordImportQuizRowSchema,
  WordImportRowSchema,
  WordQuizQuestionInputSchema,
  WORD_TYPES,
  type BulkImportQuizQuestionsFormState,
  type CreateCategoryFormState,
  type CreateWordCategoryFormState,
  type CreateWordFormState,
  type ImportWordsFormState,
  type ImportWordsFromSpreadsheetFormState,
  type SaveQuizQuestionsFormState,
  type UpdateCategoryFormState,
  type UpdateWordCategoryFormState,
  type UpdateWordFormState,
} from "@/lib/definitions";

// A spreadsheet-scale loop of individual inserts would race on `position`
// (each read-then-write needs the previous row's write to have landed) — the
// cap keeps a single import to a size where reading every row into memory
// and inserting in one `createMany` is still the right tool.
const MAX_IMPORT_ROWS = 1000;

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

// Validates the submitted alternate-answer rows and replaces every existing
// one for this word with them — same replace-all-in-one-transaction shape as
// `replaceWordFormsAndExamples` above, for the same reason (admin-only,
// low-frequency, no per-row identity worth preserving across a save).
async function replaceWordAlternateAnswers(wordId: string, formData: FormData): Promise<void> {
  const rows = collectIndexedRows(formData, "alternateAnswers")
    .filter((row) => !isBlankRow(row, []))
    .map((row) => WordAlternateAnswerInputSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);

  const alternateAnswersData = rows.map((row, index) => ({
    id: randomUUID(),
    wordId,
    value: row.value,
    position: index + 1,
  }));

  await prisma.$transaction([
    prisma.wordAlternateAnswer.deleteMany({ where: { wordId } }),
    ...(alternateAnswersData.length > 0
      ? [prisma.wordAlternateAnswer.createMany({ data: alternateAnswersData })]
      : []),
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

  const { _max } = await prisma.languageDeck.aggregate({
    where: { courseId },
    _max: { position: true },
  });

  const languageDeck = await prisma.languageDeck.create({
    data: {
      courseId,
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

  redirect(`/dashboard/admin/courses/${course.slug}/categories/${languageDeck.id}`);
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
    path: formData.get("path"),
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
    path,
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
      path,
      position: (_max.position ?? 0) + 1,
      imageKey,
    },
  });

  await replaceWordFormsAndExamples(word.id, formData);
  await replaceWordAlternateAnswers(word.id, formData);

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
    path: formData.get("path"),
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
    path,
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
      path,
      imageKey,
    },
  });

  await replaceWordFormsAndExamples(wordId, formData);
  await replaceWordAlternateAnswers(wordId, formData);

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

// Unlike setWordActive (reversible — hide the word, keep everything), this
// is permanent: WordForm/WordExample/WordAlternateAnswer/WordQuizQuestion
// and — critically — every learner's UserWordProgress on this word all
// cascade-delete with it (see the Word relation's `onDelete: Cascade` on
// each of those models in prisma/schema.prisma). The caller is expected to
// have already confirmed with the admin; this action itself has no
// confirmation step of its own.
export async function deleteWord(wordId: string): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  const word = await prisma.word.delete({
    where: { id: wordId },
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

// Unlike setCategoryActive (reversible — hide the deck, keep everything),
// this is permanent: every Word in it cascade-deletes, which cascades
// further to each word's WordForm/WordExample/WordQuizQuestion/
// WordAlternateAnswer AND — critically — every learner's UserWordProgress
// on every one of those words (see the cascade chain in
// prisma/schema.prisma), plus this deck's own UserDeckActivation rows. The
// caller is expected to have already confirmed with the admin; this action
// itself has no confirmation step of its own.
export async function deleteCategory(languageDeckId: string): Promise<void> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return;
  }

  const languageDeck = await prisma.languageDeck.delete({
    where: { id: languageDeckId },
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
            path: word.path,
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

type ImportedWordRow = {
  id: string;
  isUpdate: boolean;
  path: "vocab" | "grammar";
  wordNumber: string | null;
  term: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  explanation: string | null;
  explanationJa: string | null;
  categoryId: string | null;
  wordType: string | null;
};
type ImportedFormRow = { id: string; wordId: string; labelEn: string; labelJa: string; value: string };
type ImportedExampleRow = { wordId: string; formId: string | null; en: string; ja: string };
type ImportedQuizRow = { wordId: string; prompt: string; promptJa: string | null; options: string[]; correctIndex: number };

type ProcessedWordSheet = {
  rowErrors: string[];
  warnings: string[];
  validRows: ImportedWordRow[];
  alternateAnswersByWordId: Map<string, string[]>;
  formsByWordId: Map<string, ImportedFormRow[]>;
  examplesByWordId: Map<string, ImportedExampleRow[]>;
  quizByWordId: Map<string, ImportedQuizRow[]>;
};

// One path's worth of a spreadsheet import — called once for the Words/Quiz
// questions sheets (`path: "vocab"`) and once for Grammar/Grammar quiz
// questions (`path: "grammar"`), both writing into the same deck (see
// GRAMMAR_SHEET_NAME's comment in lib/word-import.ts for why grammar gets
// its own sheet pair instead of a column on Words). `existingWordsForPath`
// must already be filtered to this path, so a Word ID or Term match can
// never cross paths — a Grammar row can't silently update a vocab word,
// or vice versa.
function processWordSheet(
  rows: ParsedWordImportRow[],
  quizRows: ParsedSheetRow[],
  path: "vocab" | "grammar",
  sheetLabel: string,
  quizSheetLabel: string,
  existingWordsForPath: { id: string; term: string }[],
  categoryIdByName: Map<string, string>,
  wordTypes: readonly string[],
): ProcessedWordSheet {
  const existingWordIds = new Set(existingWordsForPath.map((word) => word.id));
  // Fallback match for a row with no (or no *matching*) Word ID — e.g. every
  // row from the blank template — so re-uploading a file of words that
  // already exist in this deck updates them instead of piling up duplicates
  // each time. First existing word wins if this deck already has more than
  // one with the same term.
  const existingIdByTerm = new Map<string, string>();
  for (const word of existingWordsForPath) {
    const key = word.term.trim().toLowerCase();
    if (!existingIdByTerm.has(key)) existingIdByTerm.set(key, word.id);
  }
  const seenWordIds = new Set<string>();

  const rowErrors: string[] = [];
  const warnings: string[] = [];
  const validRows: ImportedWordRow[] = [];
  // Semicolon-separated within the "Alternative spellings" cell — split out
  // here per word id, same shape as formsByWordId/examplesByWordId below.
  const alternateAnswersByWordId = new Map<string, string[]>();
  const formsByWordId = new Map<string, ImportedFormRow[]>();
  const examplesByWordId = new Map<string, ImportedExampleRow[]>();

  for (const row of rows) {
    const result = WordImportRowSchema.safeParse(row.values);

    if (!result.success) {
      rowErrors.push(`${sheetLabel} row ${row.rowNumber}: ${result.error.issues[0]?.message ?? "invalid data"}`);
      continue;
    }

    const data = result.data;

    const formsResult = parseFormsCell(data.forms ?? "");
    if (!formsResult.ok) {
      rowErrors.push(`${sheetLabel} row ${row.rowNumber}: Forms — ${formsResult.error}`);
      continue;
    }

    const examplesResult = parseExamplesColumns(data.examplesEn ?? "", data.examplesJa ?? "");
    if (!examplesResult.ok) {
      rowErrors.push(`${sheetLabel} row ${row.rowNumber}: ${examplesResult.error}`);
      continue;
    }

    let categoryId: string | null = null;
    if (data.category) {
      const match = categoryIdByName.get(data.category.toLowerCase());
      if (match) {
        categoryId = match;
      } else {
        warnings.push(`${sheetLabel} row ${row.rowNumber}: category "${data.category}" doesn't exist — imported without one.`);
      }
    }

    let wordType: string | null = null;
    if (data.wordType) {
      const normalized = data.wordType.toLowerCase();
      if (wordTypes.includes(normalized)) {
        wordType = normalized;
      } else {
        warnings.push(`${sheetLabel} row ${row.rowNumber}: word type "${data.wordType}" isn't recognized — imported without one.`);
      }
    }

    const providedWordId = data.wordId || null;

    let id: string;
    let isUpdate = false;

    if (providedWordId && existingWordIds.has(providedWordId)) {
      if (seenWordIds.has(providedWordId)) {
        rowErrors.push(`${sheetLabel} row ${row.rowNumber}: Word ID "${providedWordId}" is used more than once — remove the duplicate row.`);
        continue;
      }
      seenWordIds.add(providedWordId);
      id = providedWordId;
      isUpdate = true;
    } else {
      const termMatchId = existingIdByTerm.get(data.term.trim().toLowerCase());

      if (termMatchId && !seenWordIds.has(termMatchId)) {
        seenWordIds.add(termMatchId);
        id = termMatchId;
        isUpdate = true;
        if (providedWordId) {
          warnings.push(
            `${sheetLabel} row ${row.rowNumber}: Word ID "${providedWordId}" doesn't match an existing word in this deck — matched to the existing word "${data.term}" by Term instead.`,
          );
        }
      } else {
        if (providedWordId) {
          warnings.push(
            `${sheetLabel} row ${row.rowNumber}: Word ID "${providedWordId}" doesn't match an existing word in this deck — imported as a new word instead.`,
          );
        }
        id = randomUUID();
      }
    }

    validRows.push({
      id,
      isUpdate,
      path,
      wordNumber: data.wordNumber || null,
      term: data.term,
      translation: data.translation,
      romanization: data.romanization || null,
      exampleSentence: data.exampleSentence || null,
      explanation: data.explanation || null,
      explanationJa: data.explanationJa || null,
      categoryId,
      wordType,
    });

    if (data.alternateSpellings) {
      const values = data.alternateSpellings
        .split(";")
        .map((value) => value.trim())
        .filter((value) => value !== "");
      if (values.length > 0) alternateAnswersByWordId.set(id, values);
    }

    if (formsResult.forms.length > 0) {
      formsByWordId.set(
        id,
        formsResult.forms.map((form) => ({
          id: randomUUID(),
          wordId: id,
          labelEn: form.labelEn,
          labelJa: form.labelJa,
          value: form.value,
        })),
      );
    }

    if (examplesResult.examples.length > 0) {
      examplesByWordId.set(
        id,
        examplesResult.examples.map((example) => ({
          wordId: id,
          // Spreadsheet-imported examples are never tied to a specific
          // form — an admin can still set that by hand afterward in the
          // word editor, which does support it.
          formId: null,
          en: example.en,
          ja: example.ja,
        })),
      );
    }
  }

  // Maps each spreadsheet-assigned "Word #" to the word it labels — how the
  // quiz sheet says which word a row belongs to, since those rows are
  // validated (and need a real wordId to insert against) before any word
  // has an id a spreadsheet cell could reference.
  const wordIdByNumber = new Map<string, string>();
  for (const row of validRows) {
    if (!row.wordNumber) continue;
    if (wordIdByNumber.has(row.wordNumber)) {
      rowErrors.push(`${sheetLabel} row: "Word #" ${row.wordNumber} is used more than once — each must be unique.`);
      continue;
    }
    wordIdByNumber.set(row.wordNumber, row.id);
  }

  const quizByWordId = new Map<string, ImportedQuizRow[]>();

  for (const row of quizRows) {
    const result = WordImportQuizRowSchema.safeParse(row.values);

    if (!result.success) {
      rowErrors.push(`${quizSheetLabel} row ${row.rowNumber}: ${result.error.issues[0]?.message ?? "invalid data"}`);
      continue;
    }

    const data = result.data;
    const wordId = wordIdByNumber.get(data.wordNumber);

    if (!wordId) {
      rowErrors.push(`${quizSheetLabel} row ${row.rowNumber}: Word # "${data.wordNumber}" doesn't match any row on the ${sheetLabel} sheet.`);
      continue;
    }

    const options = [data.option1, data.option2, data.option3, data.option4].filter(
      (option): option is string => Boolean(option && option.trim() !== ""),
    );

    const quizQuestions = quizByWordId.get(wordId) ?? [];
    quizQuestions.push({
      wordId,
      prompt: data.prompt,
      promptJa: data.promptJa || null,
      options,
      correctIndex: Number(data.correctOption) - 1,
    });
    quizByWordId.set(wordId, quizQuestions);
  }

  return { rowErrors, warnings, validRows, alternateAnswersByWordId, formsByWordId, examplesByWordId, quizByWordId };
}

// Bulk-creates words (plus their forms, example sentences, and hand-authored
// quiz questions) in one deck from an uploaded .xlsx (see lib/word-import.ts
// for the template/parser, built around this template's exact column
// headers/sheet names). Vocab (Words/Quiz questions) and grammar
// (Grammar/Grammar quiz questions) are each processed independently by
// `processWordSheet` and merged below — see its comment for why they can
// never cross-match. All-or-nothing on structural problems — a row missing
// its required fields, or a Quiz questions row whose "Word #" doesn't match
// any word row, blocks the whole batch, same as `bulkImportQuizQuestions`'s
// all-or-nothing JSON validation — but an unrecognized Category or Word type
// is just a warning: that one field is left blank and the row still
// imports, since a name that doesn't match isn't evidence of a typo needing
// a re-upload the way a missing Term is.
export async function importWordsFromSpreadsheet(
  _state: ImportWordsFromSpreadsheetFormState,
  formData: FormData,
): Promise<ImportWordsFromSpreadsheetFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const rawFile = formData.get("file");
  const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : undefined;
  // A plain checkbox flag, not spreadsheet data — read straight off the
  // FormData rather than through the zod schema below, which validates what
  // came from the uploaded file itself.
  const deactivateMissing = formData.get("deactivateMissing") === "on";

  const validatedFields = ImportWordsFromSpreadsheetFormSchema.safeParse({
    languageDeckId: formData.get("languageDeckId"),
    file,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { languageDeckId, file: validFile } = validatedFields.data;

  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { id: true, course: { select: { slug: true } } },
  });

  if (!languageDeck) {
    return { message: "That category no longer exists." };
  }

  const buffer = Buffer.from(await validFile.arrayBuffer());
  const parsed = await parseWordImportWorkbook(buffer);

  if (!parsed.ok) {
    return { message: parsed.message };
  }

  if (parsed.rows.length === 0 && parsed.grammarRows.length === 0) {
    return { message: "That spreadsheet has no words in it." };
  }

  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return { message: `That's ${parsed.rows.length} rows on the Words sheet — split it into batches of ${MAX_IMPORT_ROWS} or fewer.` };
  }

  if (parsed.grammarRows.length > MAX_IMPORT_ROWS) {
    return { message: `That's ${parsed.grammarRows.length} rows on the Grammar sheet — split it into batches of ${MAX_IMPORT_ROWS} or fewer.` };
  }

  if (parsed.quizRows.length > MAX_IMPORT_ROWS) {
    return { message: `That's ${parsed.quizRows.length} rows on the Quiz questions sheet — split it into batches of ${MAX_IMPORT_ROWS} or fewer.` };
  }

  if (parsed.grammarQuizRows.length > MAX_IMPORT_ROWS) {
    return {
      message: `That's ${parsed.grammarQuizRows.length} rows on the Grammar quiz questions sheet — split it into batches of ${MAX_IMPORT_ROWS} or fewer.`,
    };
  }

  const categories = await prisma.wordCategory.findMany({ select: { id: true, name: true } });
  const categoryIdByName = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));
  const wordTypes: readonly string[] = WORD_TYPES;

  // Split by path so a Words-sheet row can never Word ID/Term-match a
  // grammar point, or vice versa — see processWordSheet's comment.
  const existingWords = await prisma.word.findMany({
    where: { languageDeckId },
    select: { id: true, term: true, path: true },
  });
  const existingVocabWords = existingWords.filter((word) => word.path === "vocab");
  const existingGrammarWords = existingWords.filter((word) => word.path === "grammar");

  const vocab = processWordSheet(
    parsed.rows,
    parsed.quizRows,
    "vocab",
    "Words",
    "Quiz questions",
    existingVocabWords,
    categoryIdByName,
    wordTypes,
  );
  const grammar = processWordSheet(
    parsed.grammarRows,
    parsed.grammarQuizRows,
    "grammar",
    "Grammar",
    "Grammar quiz questions",
    existingGrammarWords,
    categoryIdByName,
    wordTypes,
  );

  const rowErrors = [...vocab.rowErrors, ...grammar.rowErrors];
  const warnings = [...vocab.warnings, ...grammar.warnings];

  if (rowErrors.length > 0) {
    return {
      message: `${rowErrors.length} row${rowErrors.length === 1 ? "" : "s"} couldn't be imported — fix these and re-upload the whole file:`,
      rowErrors,
    };
  }

  const validRows = [...vocab.validRows, ...grammar.validRows];
  const alternateAnswersByWordId = new Map([...vocab.alternateAnswersByWordId, ...grammar.alternateAnswersByWordId]);
  const formsByWordId = new Map([...vocab.formsByWordId, ...grammar.formsByWordId]);
  const examplesByWordId = new Map([...vocab.examplesByWordId, ...grammar.examplesByWordId]);
  const quizByWordId = new Map([...vocab.quizByWordId, ...grammar.quizByWordId]);

  const { _max } = await prisma.word.aggregate({
    where: { languageDeckId },
    _max: { position: true },
  });

  const basePosition = _max.position ?? 0;

  const newRows = validRows.filter((row) => !row.isUpdate);
  const updatedRows = validRows.filter((row) => row.isUpdate);
  const updatedWordIds = updatedRows.map((row) => row.id);
  const updatedVocabWordIds = vocab.validRows.filter((row) => row.isUpdate).map((row) => row.id);
  const updatedGrammarWordIds = grammar.validRows.filter((row) => row.isUpdate).map((row) => row.id);

  const formsData = [...formsByWordId.values()].flatMap((forms) =>
    forms.map((form, index) => ({ ...form, position: index + 1 })),
  );
  const examplesData = [...examplesByWordId.values()].flatMap((examples) =>
    examples.map((example, index) => ({ id: randomUUID(), ...example, position: index + 1 })),
  );
  const quizData = [...quizByWordId.values()].flatMap((questions) =>
    questions.map((question, index) => ({ ...question, position: index + 1 })),
  );
  const alternateAnswersData = [...alternateAnswersByWordId.entries()].flatMap(([wordId, values]) =>
    values.map((value, index) => ({ id: randomUUID(), wordId, value, position: index + 1 })),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous Prisma operations, batched together below
  const ops: any[] = [];

  if (newRows.length > 0) {
    ops.push(
      prisma.word.createMany({
        data: newRows.map((row, index) => ({
          id: row.id,
          languageDeckId,
          path: row.path,
          term: row.term,
          translation: row.translation,
          romanization: row.romanization,
          exampleSentence: row.exampleSentence,
          explanation: row.explanation,
          explanationJa: row.explanationJa,
          categoryId: row.categoryId,
          wordType: row.wordType,
          position: basePosition + 1 + index,
        })),
      }),
    );
  }

  // One bulk UPDATE...FROM VALUES rather than N `word.update()` calls, each
  // of which is its own DB round trip — with this DB's ~250-300ms RTT (see
  // lib/prisma.ts), a few dozen row-by-row updates alone blew past the
  // transaction's 5s timeout. Every value is explicitly cast since Postgres
  // can't otherwise infer a VALUES column's type from a row where it's
  // NULL. Position is deliberately left untouched (the spreadsheet doesn't
  // represent word order).
  if (updatedRows.length > 0) {
    const updateValueRows = updatedRows.map(
      (row) =>
        Prisma.sql`(${row.id}::uuid, ${row.term}::text, ${row.translation}::text, ${row.romanization}::text, ${row.exampleSentence}::text, ${row.explanation}::text, ${row.explanationJa}::text, ${row.categoryId}::uuid, ${row.wordType}::text)`,
    );

    ops.push(
      prisma.$executeRaw`
        UPDATE words AS w
        SET
          term = v.term,
          translation = v.translation,
          romanization = v.romanization,
          example_sentence = v.example_sentence,
          explanation = v.explanation,
          explanation_ja = v.explanation_ja,
          category_id = v.category_id,
          word_type = v.word_type
        FROM (VALUES ${Prisma.join(updateValueRows)})
          AS v(id, term, translation, romanization, example_sentence, explanation, explanation_ja, category_id, word_type)
        WHERE w.id = v.id
      `,
    );
  }

  if (updatedWordIds.length > 0) {
    // An updated word's forms/examples/alternate spellings/quiz questions
    // are fully replaced by what the row now says (cleared if the row now
    // leaves that cell/sheet-section blank), not merged — the spreadsheet is
    // treated as the current full state of the word, same as every other
    // field on it. Must run before the createMany calls below, which
    // reinsert this same set of updated word ids alongside any brand-new
    // ones.
    ops.push(
      prisma.wordForm.deleteMany({ where: { wordId: { in: updatedWordIds } } }),
      prisma.wordExample.deleteMany({ where: { wordId: { in: updatedWordIds } } }),
      prisma.wordAlternateAnswer.deleteMany({ where: { wordId: { in: updatedWordIds } } }),
      prisma.wordQuizQuestion.deleteMany({ where: { wordId: { in: updatedWordIds } } }),
    );
  }

  if (formsData.length > 0) ops.push(prisma.wordForm.createMany({ data: formsData }));
  if (examplesData.length > 0) ops.push(prisma.wordExample.createMany({ data: examplesData }));
  if (quizData.length > 0) ops.push(prisma.wordQuizQuestion.createMany({ data: quizData }));
  if (alternateAnswersData.length > 0) {
    ops.push(prisma.wordAlternateAnswer.createMany({ data: alternateAnswersData }));
  }

  // Only when the admin explicitly ticked the "deactivate missing" checkbox
  // — treating the spreadsheet as this deck's full word list, not just a
  // batch of additions — is a word matched to no row in the file (by Word ID
  // or Term) deactivated, the same as manually flipping the admin word
  // list's show/hide toggle (`setWordActive`). Never a hard delete: that
  // would cascade to every learner's progress on the word (`deleteWord`, a
  // separate, explicit, one-word-at-a-time action, exists for that). This is
  // opt-in per upload rather than inferred from the file's shape, since a
  // small file (the blank template, or a hand-made one with no "Word ID"
  // column at all) uploaded without meaning to sync the whole deck must
  // never silently deactivate everything it left out. Applied independently
  // per path: a file with a Words sheet but no Grammar rows at all never
  // deactivates grammar points, even with the checkbox ticked — each
  // `updatedXWordIds` set only reliably represents "everything that sheet
  // covers" because processWordSheet never lets a match cross paths.
  let vocabDeactivateResultIndex = -1;
  if (deactivateMissing && updatedVocabWordIds.length > 0) {
    vocabDeactivateResultIndex = ops.length;
    ops.push(
      prisma.word.updateMany({
        where: { languageDeckId, path: "vocab", active: true, id: { notIn: updatedVocabWordIds } },
        data: { active: false },
      }),
    );
  }

  let grammarDeactivateResultIndex = -1;
  if (deactivateMissing && updatedGrammarWordIds.length > 0) {
    grammarDeactivateResultIndex = ops.length;
    ops.push(
      prisma.word.updateMany({
        where: { languageDeckId, path: "grammar", active: true, id: { notIn: updatedGrammarWordIds } },
        data: { active: false },
      }),
    );
  }

  // The bulk-update fix above keeps this transaction's op count fixed
  // (roughly a dozen statements) regardless of how many rows are in the
  // file, but a generous timeout is cheap insurance against this DB's
  // occasionally-slow round trips (see lib/prisma.ts) — the default 5s cut
  // it close even for a handful of rows before that fix.
  const results = await prisma.$transaction(ops, { timeout: 20_000 });
  const deactivatedCount =
    (vocabDeactivateResultIndex >= 0 ? (results[vocabDeactivateResultIndex] as { count: number }).count : 0) +
    (grammarDeactivateResultIndex >= 0 ? (results[grammarDeactivateResultIndex] as { count: number }).count : 0);

  revalidatePath(`/dashboard/admin/courses/${languageDeck.course.slug}/categories/${languageDeckId}`);
  revalidatePath(`/dashboard/courses/${languageDeck.course.slug}/decks/${languageDeckId}`);

  // A clean import (nothing for the admin to double-check) goes straight to
  // the deck's word list, so they land on what they just imported instead
  // of a message they then have to navigate away from. A row-level warning
  // (unrecognized category/word type, a Word ID that fell back to a Term
  // match, etc.) holds here instead — those are worth reading before moving
  // on, and this codebase has no cross-navigation flash-message mechanism
  // (see ShareProgressButton's note) to carry them across a redirect.
  if (warnings.length === 0) {
    redirect(`/dashboard/admin/courses/${languageDeck.course.slug}/categories/${languageDeckId}`);
  }

  let summary = `Imported ${validRows.length} word${validRows.length === 1 ? "" : "s"}`;
  summary += updatedRows.length > 0 ? ` (${newRows.length} new, ${updatedRows.length} updated).` : ".";
  if (deactivatedCount > 0) {
    summary += ` Deactivated ${deactivatedCount} word${deactivatedCount === 1 ? "" : "s"} no longer on the sheet.`;
  }

  return {
    success: true,
    message: summary,
    warnings,
  };
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
