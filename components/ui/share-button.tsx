"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

type ShareButtonProps = {
  title: string;
  text: string;
  className?: string;
};

// Web Share API where available (mobile browsers, most desktop Safari/Edge);
// falls back to copying the message to the clipboard everywhere else.
export function ShareButton({ title, text, className }: ShareButtonProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled, or the platform rejected it — fall through to copy.
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button variant="outline" onClick={handleShare} className={className}>
      {copied ? t("share_button.copied", "Copied to clipboard!") : t("share_button.share", "Share")}
    </Button>
  );
}
