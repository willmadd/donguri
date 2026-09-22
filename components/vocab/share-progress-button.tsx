"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";

// Native share sheet where it exists (mobile browsers, most desktop
// Safari/Edge); everywhere else falls back to a clipboard copy with a
// transient label swap instead of a toast, matching ResetProgressButton's
// no-toast-system pattern.
export function ShareProgressButton({ shareText }: { shareText: string }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        // Cancelled by the user, or the share sheet failed mid-flight —
        // either way there's nothing to recover.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — no fallback beyond the button itself.
    }
  }

  return (
    <Button variant="outline" size="sm" fullWidth onClick={handleShare} className="mt-4">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? t("share_progress.copied", "Copied!") : t("share_progress.button", "Share progress")}
    </Button>
  );
}
