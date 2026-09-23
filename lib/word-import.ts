import "server-only";

import ExcelJS from "exceljs";
import { WORD_TYPES } from "@/lib/definitions";

// Single source of truth for the spreadsheet's shape — both the downloadable
// template (`buildWordImportTemplate`) and the upload parser
// (`parseWordImportWorkbook`) key off these lists, so the two can never drift
// out of sync with each other. Deliberately a subset of `WordFieldsSchema`
// in lib/definitions.ts: no `image` (not a spreadsheet-shaped field) — that
// stays hand-edited per word after import, same as `categoryId`, which here
// is typed as a plain category *name* and resolved to an id at import time.
//
// Quiz questions are a word's *repeatable* child rows (see WordQuizQuestion
// in prisma/schema.prisma) that don't fit a flat one-row-per-word sheet, so
// they get their own sheet, each row tagged with the "Word #" of the word it
// belongs to — a plain admin-assigned label on the Words sheet, not a
// database id. Forms are also repeatable but scoped to their word alone
// (nothing outside the row ever references one by number), so instead of
// their own sheet they're packed into the "Forms" cell of the word's own row
// — see parseFormsCell below for the format. Examples are repeatable too,
// but split across two same-length columns ("Examples (English)"/"Examples
// (Japanese)") matched by position instead of packed into one cell, since
// unlike a form they have no other sub-fields to pack alongside — see
// parseExamplesColumns below. A spreadsheet-imported example is never tied
// to a specific form (an admin can still set that by hand afterward in the
// word editor).
const WORD_COLUMNS = [
  { header: "Word #", key: "wordNumber", width: 8 },
  { header: "Term", key: "term", width: 22 },
  { header: "Translation", key: "translation", width: 22 },
  { header: "Romanization", key: "romanization", width: 20 },
  { header: "Example sentence", key: "exampleSentence", width: 36 },
  { header: "Explanation (English)", key: "explanation", width: 36 },
  { header: "Explanation (Japanese)", key: "explanationJa", width: 36 },
  { header: "Category", key: "category", width: 20 },
  { header: "Word type", key: "wordType", width: 16 },
  { header: "Alternative spellings", key: "alternateSpellings", width: 28 },
  { header: "Forms", key: "forms", width: 40 },
  { header: "Examples (English)", key: "examplesEn", width: 40 },
  { header: "Examples (Japanese)", key: "examplesJa", width: 40 },
] as const;

const QUIZ_COLUMNS = [
  { header: "Word #", key: "wordNumber", width: 8 },
  { header: "Prompt", key: "prompt", width: 32 },
  { header: "Prompt (Japanese)", key: "promptJa", width: 32 },
  { header: "Option 1", key: "option1", width: 18 },
  { header: "Option 2", key: "option2", width: 18 },
  { header: "Option 3", key: "option3", width: 18 },
  { header: "Option 4", key: "option4", width: 18 },
  { header: "Correct option (1-4)", key: "correctOption", width: 12 },
] as const;

type SheetColumn = { header: string; key: string; width: number };

const WORDS_SHEET_NAME = "Words";
const QUIZ_SHEET_NAME = "Quiz questions";

// Separators for the packed "Forms"/"Examples" cells: "|" between a single
// entry's own fields, ";" between multiple entries in the same cell — the
// same semicolon convention "Alternative spellings" already uses for its
// (single-field) list.
const ENTRY_SEPARATOR = ";";
const FIELD_SEPARATOR = "|";

// How far down to extend the Word type / Category dropdown validation —
// generous enough for a large deck without making the file huge.
const VALIDATED_ROW_COUNT = 500;
// Excel/Sheets inline list-validation formulae have a practical length cap;
// past this we skip the Category dropdown rather than ship a corrupt one,
// and rely on the Instructions sheet's plain-text list instead.
const MAX_INLINE_LIST_CHARS = 250;

function addHeaderRow(sheet: ExcelJS.Worksheet, columns: readonly SheetColumn[]): void {
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A54C4" } };
    cell.alignment = { vertical: "middle" };
  });
}

function markExampleRow(sheet: ExcelJS.Worksheet, rowNumber: number, note: string): void {
  const row = sheet.getRow(rowNumber);
  row.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: "FF6F5C45" } };
  });
  row.getCell(1).note = note;
}

// Wrapping so a cell packed with several ";"-separated entries reads as
// stacked lines instead of one long run of text.
function wrapPackedColumns(sheet: ExcelJS.Worksheet): void {
  sheet.getColumn("forms").alignment = { wrapText: true, vertical: "top" };
  sheet.getColumn("examplesEn").alignment = { wrapText: true, vertical: "top" };
  sheet.getColumn("examplesJa").alignment = { wrapText: true, vertical: "top" };
}

function addWordTypeValidation(sheet: ExcelJS.Worksheet, rowCount: number): void {
  const wordTypeColumn = sheet.getColumn("wordType").letter;
  const wordTypeFormula = `"${WORD_TYPES.join(",")}"`;
  for (let row = 2; row <= rowCount; row++) {
    sheet.getCell(`${wordTypeColumn}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [wordTypeFormula],
      showErrorMessage: true,
      errorTitle: "Invalid word type",
      error: `Use one of: ${WORD_TYPES.join(", ")} — or leave blank.`,
    };
  }
}

// A suggestion list, not an enforced constraint — the import action matches
// by name case-insensitively and just warns (doesn't fail) on an
// unrecognized one, since this snapshot goes stale the moment someone adds a
// category after the sheet was downloaded. Returns the filtered names so the
// caller can reuse them in the Instructions sheet.
function addCategoryValidation(sheet: ExcelJS.Worksheet, categoryNames: string[], rowCount: number): string[] {
  const cleanCategoryNames = categoryNames.filter((name) => !name.includes(","));
  const categoryFormula = `"${cleanCategoryNames.join(",")}"`;
  if (cleanCategoryNames.length > 0 && categoryFormula.length <= MAX_INLINE_LIST_CHARS) {
    const categoryColumn = sheet.getColumn("category").letter;
    for (let row = 2; row <= rowCount; row++) {
      sheet.getCell(`${categoryColumn}${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [categoryFormula],
      };
    }
  }
  return cleanCategoryNames;
}

function addCorrectOptionValidation(sheet: ExcelJS.Worksheet, rowCount: number): void {
  const correctOptionColumn = sheet.getColumn("correctOption").letter;
  for (let row = 2; row <= rowCount; row++) {
    sheet.getCell(`${correctOptionColumn}${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"1,2,3,4"'],
    };
  }
}

function addInstructionsSheet(workbook: ExcelJS.Workbook, cleanCategoryNames: string[]): void {
  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 24 }, { width: 90 }];
  const headingRow = instructions.addRow(["Column", "What to put in it"]);
  headingRow.font = { bold: true };

  const rows: [string, string][] = [
    [
      "Word #",
      'Give each word on the "Words" sheet a short, unique number (1, 2, 3, ...). Only needed if you\'re also adding rows for it on the Quiz questions sheet — that sheet uses the same number to say which word a row belongs to. Leave blank on words with no quiz rows.',
    ],
    ["Term", "Required. The word or phrase in the language being learned."],
    ["Translation", "Required. What it means, in the learner's language."],
    ["Romanization", "Optional. A pronunciation aid (e.g. romaji)."],
    ["Example sentence", "Optional. One example sentence using the word."],
    ["Explanation (English)", "Optional. A plain-language definition, in English."],
    ["Explanation (Japanese)", "Optional. A plain-language definition, in Japanese."],
    [
      "Category",
      cleanCategoryNames.length > 0
        ? `Optional. Existing categories: ${cleanCategoryNames.join(", ")}. Leave blank if unsure — an unrecognized name is skipped, not an error.`
        : "Optional. Leave blank if unsure — an unrecognized name is skipped, not an error.",
    ],
    ["Word type", `Optional. One of: ${WORD_TYPES.join(", ")}.`],
    [
      "Alternative spellings",
      'Optional. Other answers that should also count as correct when a learner types this word — e.g. "3; three" for a word whose Term is "三". Separate multiple alternatives with a semicolon ( ; ). Checked regardless of which side (Term or Translation) the learner is typing.',
    ],
    [
      "Forms",
      'Optional. This word\'s inflected/conjugated forms (e.g. go/goes/went/gone/going). One entry per form: "Label (English)|Label (Japanese)|Value" — e.g. "Past simple|過去形|ate". Separate multiple forms with a semicolon ( ; ).',
    ],
    [
      "Examples (English) / Examples (Japanese)",
      'Optional. Example sentences using this word — one semicolon-separated ( ; ) list per language, e.g. "Yesterday I ate an apple.; I eat every day." in the English column and "昨日私はりんごを食べた。; 私は毎日食べます。" in the Japanese column. The two lists must have the same number of entries — the Nth entry in each is paired up as one example.',
    ],
  ];
  for (const row of rows) {
    instructions.addRow(row).alignment = { wrapText: true, vertical: "top" };
  }

  instructions.addRow([]);
  instructions.addRow(["Quiz questions sheet", "One row per hand-authored quiz question — mixed in with the auto-generated ones."]).font = {
    bold: true,
  };
  const quizRows: [string, string][] = [
    ["Word #", "Required. Which word (from the Words sheet) this question belongs to."],
    ["Prompt", "Required."],
    ["Prompt (Japanese)", "Optional."],
    ["Option 1 / Option 2", "Required — every question needs at least two options."],
    ["Option 3 / Option 4", "Optional — leave blank for a 2- or 3-option question."],
    ["Correct option (1-4)", "Required. Which option number is the right answer."],
  ];
  for (const row of quizRows) {
    instructions.addRow(row).alignment = { wrapText: true, vertical: "top" };
  }

  instructions.addRow([]);
  instructions.addRow([
    "",
    "Don't rename or reorder the column headers — the upload matches columns by header name, and only recognizes these exact names.",
  ]).alignment = { wrapText: true, vertical: "top" };
}

export async function buildWordImportTemplate(categoryNames: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Donguri";
  workbook.created = new Date();

  const wordsSheet = workbook.addWorksheet(WORDS_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  addHeaderRow(wordsSheet, WORD_COLUMNS);
  wrapPackedColumns(wordsSheet);

  wordsSheet.addRow({
    wordNumber: "1",
    term: "食べる",
    translation: "to eat",
    romanization: "taberu",
    exampleSentence: "私はりんごを食べる。",
    explanation: "A common ichidan verb.",
    explanationJa: "",
    category: categoryNames[0] ?? "",
    wordType: "verb",
    alternateSpellings: "eat",
    forms: "Past simple|過去形|ate",
    examplesEn: "Yesterday I ate an apple.",
    examplesJa: "昨日私はりんごを食べた。",
  });
  markExampleRow(wordsSheet, 2, "Example row — replace or delete this before uploading.");

  addWordTypeValidation(wordsSheet, VALIDATED_ROW_COUNT);
  const cleanCategoryNames = addCategoryValidation(wordsSheet, categoryNames, VALIDATED_ROW_COUNT);

  const quizSheet = workbook.addWorksheet(QUIZ_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  addHeaderRow(quizSheet, QUIZ_COLUMNS);
  quizSheet.addRow({
    wordNumber: "1",
    prompt: 'What does "食べる" mean?',
    promptJa: "",
    option1: "to eat",
    option2: "to drink",
    option3: "to sleep",
    option4: "",
    correctOption: "1",
  });
  markExampleRow(quizSheet, 2, "Example row — replace or delete this before uploading. Leave Option 3/4 blank for a 2- or 3-option question.");
  addCorrectOptionValidation(quizSheet, VALIDATED_ROW_COUNT);

  addInstructionsSheet(workbook, cleanCategoryNames);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// A word's current data, shaped for `buildWordExportWorkbook` — one level up
// from the raw Prisma rows so the caller (the export route) owns the DB
// query and this stays a pure workbook builder, same as
// `buildWordImportTemplate` above. `forms`/`examples`/`quizQuestions` are
// each already in the order they should appear in their cell/sheet.
export type WordExportForm = { labelEn: string; labelJa: string; value: string };
export type WordExportExample = { en: string; ja: string };
export type WordExportQuizQuestion = {
  prompt: string;
  promptJa: string | null;
  options: string[];
  correctIndex: number;
};
export type WordExportRow = {
  term: string;
  translation: string;
  romanization: string | null;
  exampleSentence: string | null;
  explanation: string | null;
  explanationJa: string | null;
  categoryName: string | null;
  wordType: string | null;
  alternateSpellings: string[];
  forms: WordExportForm[];
  examples: WordExportExample[];
  quizQuestions: WordExportQuizQuestion[];
};

// Inverse of parseFormsCell/parseExamplesColumns below — kept next to them
// so the packed-column format only has one place it can drift.
function serializeFormsCell(forms: WordExportForm[]): string {
  return forms.map((form) => [form.labelEn, form.labelJa, form.value].join(FIELD_SEPARATOR)).join(`${ENTRY_SEPARATOR} `);
}

function serializeExamplesColumn(sentences: string[]): string {
  return sentences.join(`${ENTRY_SEPARATOR} `);
}

// Same sheet shape as buildWordImportTemplate, populated with a deck's
// current words instead of one example row — so re-uploading it (after
// edits) round-trips through the same importer. Word #s are assigned
// sequentially here rather than reused from anywhere, since the import
// pipeline only ever needs them to be unique within this file.
export async function buildWordExportWorkbook(words: WordExportRow[], categoryNames: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Donguri";
  workbook.created = new Date();

  const rowCount = Math.max(VALIDATED_ROW_COUNT, words.length + 20);

  const wordsSheet = workbook.addWorksheet(WORDS_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  addHeaderRow(wordsSheet, WORD_COLUMNS);
  wrapPackedColumns(wordsSheet);

  const quizSheet = workbook.addWorksheet(QUIZ_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  addHeaderRow(quizSheet, QUIZ_COLUMNS);

  words.forEach((word, wordIndex) => {
    const wordNumber = String(wordIndex + 1);

    wordsSheet.addRow({
      wordNumber,
      term: word.term,
      translation: word.translation,
      romanization: word.romanization ?? "",
      exampleSentence: word.exampleSentence ?? "",
      explanation: word.explanation ?? "",
      explanationJa: word.explanationJa ?? "",
      category: word.categoryName ?? "",
      wordType: word.wordType ?? "",
      alternateSpellings: word.alternateSpellings.join("; "),
      forms: serializeFormsCell(word.forms),
      examplesEn: serializeExamplesColumn(word.examples.map((example) => example.en)),
      examplesJa: serializeExamplesColumn(word.examples.map((example) => example.ja)),
    });

    word.quizQuestions.forEach((quiz) => {
      quizSheet.addRow({
        wordNumber,
        prompt: quiz.prompt,
        promptJa: quiz.promptJa ?? "",
        option1: quiz.options[0] ?? "",
        option2: quiz.options[1] ?? "",
        option3: quiz.options[2] ?? "",
        option4: quiz.options[3] ?? "",
        correctOption: String(quiz.correctIndex + 1),
      });
    });
  });

  addWordTypeValidation(wordsSheet, rowCount);
  const cleanCategoryNames = addCategoryValidation(wordsSheet, categoryNames, rowCount);
  addCorrectOptionValidation(quizSheet, rowCount);

  addInstructionsSheet(workbook, cleanCategoryNames);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type ParsedSheetRow = {
  // 1-based spreadsheet row number, for pointing an admin back at a
  // specific row when a value fails validation.
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedWordImportRow = ParsedSheetRow;

export type ParsedWorkbook =
  | {
      ok: true;
      rows: ParsedWordImportRow[];
      quizRows: ParsedSheetRow[];
    }
  | { ok: false; message: string };

// One entry of a "Forms" cell — see WORD_COLUMNS' comment for why forms are
// packed into the Words sheet instead of their own sheet.
export type ParsedFormEntry = { labelEn: string; labelJa: string; value: string };

export type ParsedFormsCell = { ok: true; forms: ParsedFormEntry[] } | { ok: false; error: string };

// "Label (English)|Label (Japanese)|Value" per form, multiple forms
// separated by ";" — the inverse of serializeFormsCell above. An empty cell
// parses to zero forms, not an error.
export function parseFormsCell(text: string): ParsedFormsCell {
  const entries = text
    .split(ENTRY_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  const forms: ParsedFormEntry[] = [];
  for (const entry of entries) {
    const parts = entry.split(FIELD_SEPARATOR).map((part) => part.trim());
    if (parts.length !== 3 || parts.some((part) => part === "")) {
      return { ok: false, error: `"${entry}" isn't in "Label (English)|Label (Japanese)|Value" format.` };
    }
    const [labelEn, labelJa, value] = parts;
    forms.push({ labelEn, labelJa, value });
  }
  return { ok: true, forms };
}

// One example, paired up from the same-position entries of the "Examples
// (English)"/"Examples (Japanese)" columns.
export type ParsedExampleEntry = { en: string; ja: string };

export type ParsedExamplesColumns = { ok: true; examples: ParsedExampleEntry[] } | { ok: false; error: string };

// Each column is a ";"-separated list — the inverse of serializeExamplesColumn
// above — and the two lists are paired up by position (1st with 1st, 2nd
// with 2nd, ...), so they must have the same number of entries. Both empty
// parses to zero examples, not an error.
export function parseExamplesColumns(enText: string, jaText: string): ParsedExamplesColumns {
  const enEntries = enText
    .split(ENTRY_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const jaEntries = jaText
    .split(ENTRY_SEPARATOR)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  if (enEntries.length !== jaEntries.length) {
    return {
      ok: false,
      error: `"Examples (English)" has ${enEntries.length} entr${enEntries.length === 1 ? "y" : "ies"} but "Examples (Japanese)" has ${jaEntries.length} — they need the same number, matched by position.`,
    };
  }

  return { ok: true, examples: enEntries.map((en, index) => ({ en, ja: jaEntries[index] })) };
}

function parseSheetRows(sheet: ExcelJS.Worksheet, columns: readonly { header: string; key: string }[]): ParsedSheetRow[] {
  const headerToKey = new Map(columns.map((column) => [column.header.toLowerCase(), column.key]));
  const columnIndexByKey = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = headerToKey.get(cellText(cell.value).toLowerCase());
    if (key) columnIndexByKey.set(key, colNumber);
  });

  const rows: ParsedSheetRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values: Record<string, string> = {};
    for (const [key, colNumber] of columnIndexByKey) {
      const raw = cellText(row.getCell(colNumber).value);
      if (raw) values[key] = raw;
    }

    if (Object.keys(values).length === 0) return; // fully blank row — skip

    rows.push({ rowNumber, values });
  });

  return rows;
}

export async function parseWordImportWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    // exceljs's own bundled type declares `load(buffer: Buffer)` against a
    // stricter/older Buffer shape than this project's @types/node resolves
    // to — a type-only mismatch (the value itself is a plain Buffer).
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return { ok: false, message: "Couldn't read that file — make sure it's a valid .xlsx spreadsheet." };
  }

  // The main sheet is matched by name (falling back to the first sheet, for
  // a file where it's been renamed) rather than always workbook.worksheets[0]
  // now that the workbook has several sheets.
  const wordsSheet = workbook.getWorksheet(WORDS_SHEET_NAME) ?? workbook.worksheets[0];

  if (!wordsSheet) {
    return { ok: false, message: "That spreadsheet has no sheets." };
  }

  const rows = parseSheetRows(wordsSheet, WORD_COLUMNS);

  const headerRow = wordsSheet.getRow(1);
  const headerKeys = new Set<string>();
  headerRow.eachCell((cell) => headerKeys.add(cellText(cell.value).toLowerCase()));
  if (!headerKeys.has("term") || !headerKeys.has("translation")) {
    return {
      ok: false,
      message:
        'Missing "Term" and/or "Translation" columns — use the template\'s headers exactly, on the first row.',
    };
  }

  const quizSheet = workbook.getWorksheet(QUIZ_SHEET_NAME);

  return {
    ok: true,
    rows,
    quizRows: quizSheet ? parseSheetRows(quizSheet, QUIZ_COLUMNS) : [],
  };
}

// ExcelJS cell values can be a plain string/number, a rich-text run, a
// formula-result wrapper, or a Date — normalize whatever a non-technical
// admin's spreadsheet (or a Google Sheets export) might contain down to
// plain text.
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value) {
      return cellText(value.result as ExcelJS.CellValue);
    }
  }
  return String(value).trim();
}
