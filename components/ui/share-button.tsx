"use client";

import { useState } from "react";

type ShareButtonProps = {
  title: string;
  text: string;
  className?: string;
};

// Web Share API where available (mobile browsers, most desktop Safari/Edge);
// falls back to copying the message to the clipboard everywhere else.
export function ShareButton({ title, text, className }: ShareButtonProps) {
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
    <button
      type="button"
      onClick={handleShare}
      className={
        className ??
        "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-sumi/15 px-6 font-medium text-sumi transition hover:border-sumi/30"
      }
    >
      {copied ? "Copied to clipboard!" : "Share"}
    </button>
  );
}
