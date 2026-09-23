"use client";

import { useTransition } from "react";
import { deleteWord } from "@/lib/actions/admin-content";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

type DeleteWordButtonProps = {
  wordId: string;
  label: string;
};

export function DeleteWordButton({ wordId, label }: DeleteWordButtonProps) {
  const t = useTranslations();
  const [deleting, startDeleteTransition] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(
        t(
          "admin_category_words.confirm_delete",
          'Permanently delete "{{label}}"? This also deletes every learner\'s progress on it. This can\'t be undone — use the show/hide toggle instead if you just want to hide it.',
          { label },
        ),
      )
    )
      return;
    startDeleteTransition(() => deleteWord(wordId));
  };

  return (
    <Button variant="outline" tone="danger" size="sm" onClick={handleDelete} disabled={deleting}>
      {t("common.delete", "Delete")}
    </Button>
  );
}
