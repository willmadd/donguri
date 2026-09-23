"use client";

import { useTransition } from "react";
import { deleteCategory } from "@/lib/actions/admin-content";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

type DeleteDeckButtonProps = {
  languageDeckId: string;
  label: string;
  wordCount: number;
};

export function DeleteDeckButton({ languageDeckId, label, wordCount }: DeleteDeckButtonProps) {
  const t = useTranslations();
  const [deleting, startDeleteTransition] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(
        t(
          "admin_course_decks.confirm_delete",
          'Permanently delete "{{label}}" and all {{count}} of its words? This also deletes every learner\'s progress on them. This can\'t be undone — use the show/hide toggle instead if you just want to hide it.',
          { label, count: wordCount },
        ),
      )
    )
      return;
    startDeleteTransition(() => deleteCategory(languageDeckId));
  };

  return (
    <Button variant="outline" tone="danger" size="sm" onClick={handleDelete} disabled={deleting}>
      {t("common.delete", "Delete")}
    </Button>
  );
}
