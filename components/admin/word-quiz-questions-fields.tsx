"use client";

import { useState } from "react";

// Repeatable "custom quiz questions" section for the admin word-quiz page.
// Submitted as indexed FormData fields (`questions.0.prompt`,
// `questions.0.option0`, `questions.0.correctIndex`, ...) parsed
// server-side by `saveQuizQuestions` in lib/actions/admin-content.ts. Each
// row always carries 4 option slots — server-side, blank trailing ones are
// dropped, so a 2- or 3-option question works too.

type QuestionRow = {
  clientId: string;
  prompt: string;
  promptJa: string;
  options: [string, string, string, string];
  correctIndex: number;
};

export type WordQuizQuestionsFieldsInitial = {
  id: string;
  prompt: string;
  promptJa: string | null;
  options: string[];
  correctIndex: number;
};

let rowSeq = 0;
function newClientId(): string {
  rowSeq += 1;
  return `new-${rowSeq}`;
}

const inputClass =
  "rounded-lg border border-sumi/15 bg-washi px-3 py-2 text-sm text-sumi placeholder:text-sumi-soft/50 outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft";

function toRow(question: WordQuizQuestionsFieldsInitial): QuestionRow {
  const options = [0, 1, 2, 3].map((index) => question.options[index] ?? "") as [
    string,
    string,
    string,
    string,
  ];
  return {
    clientId: question.id,
    prompt: question.prompt,
    promptJa: question.promptJa ?? "",
    options,
    correctIndex: question.correctIndex,
  };
}

export function WordQuizQuestionsFields({
  initialQuestions = [],
}: {
  initialQuestions?: WordQuizQuestionsFieldsInitial[];
}) {
  const [questions, setQuestions] = useState<QuestionRow[]>(initialQuestions.map(toRow));

  const addQuestion = () =>
    setQuestions((current) => [
      ...current,
      {
        clientId: newClientId(),
        prompt: "",
        promptJa: "",
        options: ["", "", "", ""],
        correctIndex: 0,
      },
    ]);

  const removeQuestion = (clientId: string) =>
    setQuestions((current) => current.filter((row) => row.clientId !== clientId));

  const updateQuestion = (clientId: string, field: "prompt" | "promptJa", value: string) =>
    setQuestions((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, [field]: value } : row)),
    );

  const updateOption = (clientId: string, index: number, value: string) =>
    setQuestions((current) =>
      current.map((row) => {
        if (row.clientId !== clientId) return row;
        const options = [...row.options] as [string, string, string, string];
        options[index] = value;
        return { ...row, options };
      }),
    );

  const setCorrectIndex = (clientId: string, index: number) =>
    setQuestions((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, correctIndex: index } : row)),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-sumi-soft">Hand-authored questions</span>
        <button
          type="button"
          onClick={addQuestion}
          className="text-sm font-medium text-ai-dark transition hover:text-ai"
        >
          + Add question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-sumi-soft">
          No custom questions yet — they&apos;ll be mixed in with the auto-generated ones once added.
        </p>
      )}

      {questions.map((question, index) => (
        <div
          key={question.clientId}
          className="flex flex-col gap-3 rounded-lg border border-sumi/10 bg-washi p-4"
        >
          <input type="hidden" name={`questions.${index}.correctIndex`} value={question.correctIndex} />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-sumi-soft">
              Prompt
              <input
                name={`questions.${index}.prompt`}
                value={question.prompt}
                onChange={(event) => updateQuestion(question.clientId, "prompt", event.target.value)}
                placeholder='What does "Hello" mean?'
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-sumi-soft">
              Prompt (Japanese, optional)
              <input
                name={`questions.${index}.promptJa`}
                value={question.promptJa}
                onChange={(event) => updateQuestion(question.clientId, "promptJa", event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-sumi-soft">Options — pick the correct one</span>
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={question.correctIndex === optionIndex}
                  onChange={() => setCorrectIndex(question.clientId, optionIndex)}
                  aria-label={`Option ${optionIndex + 1} is correct`}
                  className="size-4 shrink-0"
                />
                <input
                  name={`questions.${index}.option${optionIndex}`}
                  value={option}
                  onChange={(event) => updateOption(question.clientId, optionIndex, event.target.value)}
                  placeholder={
                    optionIndex < 2 ? `Option ${optionIndex + 1}` : `Option ${optionIndex + 1} (optional)`
                  }
                  className={`flex-1 ${inputClass}`}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => removeQuestion(question.clientId)}
            className="self-start rounded-full border border-sumi/15 px-3 py-1 text-xs font-medium text-sumi-soft transition hover:border-shu/40 hover:text-shu-dark"
          >
            Remove question
          </button>
        </div>
      ))}
    </div>
  );
}
