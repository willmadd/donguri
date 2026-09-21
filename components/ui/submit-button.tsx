"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

type SubmitButtonProps = {
  pending: boolean;
  children: React.ReactNode;
  pendingText?: string;
};

export function SubmitButton({ pending, children, pendingText }: SubmitButtonProps) {
  const t = useTranslations();
  const resolvedPendingText = pendingText ?? t("common.please_wait", "Please wait…");

  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? resolvedPendingText : children}
    </Button>
  );
}
