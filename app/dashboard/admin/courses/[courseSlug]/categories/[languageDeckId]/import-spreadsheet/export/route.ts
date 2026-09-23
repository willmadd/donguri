import { NextResponse } from "next/server";
import { getProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildWordExportWorkbook, type WordExportRow } from "@/lib/word-import";

type RouteParams = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
};

// A GET route rather than a Server Action, for the same reason as the
// sibling template route: it needs a plain <a href> file download, and auth
// is checked directly here since route handlers can't use next/navigation's
// redirect().
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getProfile();

  if (!profile || profile.role !== "admin") {
    return new NextResponse("Not found.", { status: 404 });
  }

  const { courseSlug, languageDeckId } = await params;

  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { title: true, course: { select: { slug: true } } },
  });

  if (!languageDeck || languageDeck.course.slug !== courseSlug) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const [categories, words] = await Promise.all([
    prisma.wordCategory.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { name: true },
    }),
    prisma.word.findMany({
      where: { languageDeckId },
      orderBy: { position: "asc" },
      select: {
        term: true,
        translation: true,
        romanization: true,
        exampleSentence: true,
        explanation: true,
        explanationJa: true,
        wordType: true,
        category: { select: { name: true } },
        alternateAnswers: { orderBy: { position: "asc" }, select: { value: true } },
        forms: { orderBy: { position: "asc" }, select: { labelEn: true, labelJa: true, value: true } },
        // `formId` isn't selected — the spreadsheet's Examples columns don't
        // carry a form reference (see WORD_COLUMNS' comment in
        // lib/word-import.ts), so an example tied to a form loses that tie
        // on export.
        examples: { orderBy: { position: "asc" }, select: { en: true, ja: true } },
        quizQuestions: {
          orderBy: { position: "asc" },
          select: { prompt: true, promptJa: true, options: true, correctIndex: true },
        },
      },
    }),
  ]);

  const exportRows: WordExportRow[] = words.map((word) => ({
    term: word.term,
    translation: word.translation,
    romanization: word.romanization,
    exampleSentence: word.exampleSentence,
    explanation: word.explanation,
    explanationJa: word.explanationJa,
    categoryName: word.category?.name ?? null,
    wordType: word.wordType,
    alternateSpellings: word.alternateAnswers.map((answer) => answer.value),
    forms: word.forms.map((form) => ({ labelEn: form.labelEn, labelJa: form.labelJa, value: form.value })),
    examples: word.examples.map((example) => ({ en: example.en, ja: example.ja })),
    quizQuestions: word.quizQuestions.map((quiz) => ({
      prompt: quiz.prompt,
      promptJa: quiz.promptJa,
      options: quiz.options,
      correctIndex: quiz.correctIndex,
    })),
  }));

  const buffer = await buildWordExportWorkbook(
    exportRows,
    categories.map((category) => category.name),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slugifyFilename(languageDeck.title)}-words.xlsx"`,
    },
  });
}

function slugifyFilename(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "words";
}
