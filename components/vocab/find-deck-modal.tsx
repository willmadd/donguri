"use client";

import { useRef } from "react";
import { DeckList } from "@/components/vocab/deck-list";
import type { LessonSummary } from "@/lib/definitions";

type FindDeckModalProps = {
  slug: string;
  decks: LessonSummary[];
  activeDeckIds: string[];
};

export function FindDeckModal({ slug, decks, activeDeckIds }: FindDeckModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeSet = new Set(activeDeckIds);
  const activeDecks = decks.filter((deck) => activeSet.has(deck.id));

  const closeOnBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const inDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!inDialog) {
      dialogRef.current?.close();
    }
  };

  return (
    <>
      <section className="flex h-full flex-col items-center gap-3 rounded-2xl border border-sumi/10 bg-washi-soft p-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sumi/5 text-lg font-semibold text-sumi">
          探
        </span>
        <div>
          <h2 className="font-semibold text-sumi">Find a deck</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            Search all decks and manage which ones are active.
          </p>
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2">
          {activeDecks.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {activeDecks.map((deck) => (
                <span
                  key={deck.id}
                  className="inline-flex items-center rounded-full bg-ai-soft px-3 py-1 text-xs font-medium text-ai-dark"
                >
                  {deck.title}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-sumi-soft">
              No decks active yet — browse below to activate one.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="inline-flex h-11 items-center justify-center rounded-full bg-sumi px-6 font-medium text-washi transition hover:bg-sumi/90"
        >
          Browse decks
        </button>
      </section>

      <dialog
        ref={dialogRef}
        onClick={closeOnBackdropClick}
        className="m-auto max-h-[85vh] w-full max-w-2xl rounded-2xl border border-sumi/10 bg-washi p-0 backdrop:bg-sumi/40"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-sumi/10 p-6">
            <h2 className="font-semibold text-sumi">Find a deck</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-sumi-soft transition hover:bg-sumi/5 hover:text-sumi"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto p-6">
            <DeckList slug={slug} decks={decks} activeDeckIds={activeDeckIds} />
          </div>
        </div>
      </dialog>
    </>
  );
}
