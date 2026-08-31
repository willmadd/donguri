"use client";

import { useCallback, useState } from "react";

// Maps this app's plain language codes (as stored on `courses`) to the
// BCP-47 tags the browser's SpeechSynthesis API expects.
const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  ja: "ja-JP",
  yue: "zh-HK",
};

export function speechLang(languageCode: string): string {
  return SPEECH_LANG[languageCode] ?? languageCode;
}

// Thin wrapper around the browser's native SpeechSynthesis API — no
// third-party dependency needed for this.
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string, languageCode: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang(languageCode);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
}
