import type { Metadata } from "next";
import { Fredoka, Geist, Geist_Mono, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/vocab/GoogleAnalytics";
import { WebVitals } from "@/components/WebVitals";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Hello Donguri brand headline font.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Toppan Bunkyu Midashi Gothic (the brand's Japanese headline font) isn't on
// Google Fonts and has no next/font entry, so it can't be self-hosted here.
// Zen Maru Gothic is a free, freely-licensed rounded gothic used as a
// stand-in — swap this loader for next/font/local once real font files or a
// hosted kit are available.
const zenMaru = Zen_Maru_Gothic({
  variable: "--font-zen-maru",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "Donguri — Language learning, one word at a time",
  description:
    "A friendly, calm way to build real vocabulary and grammar in a new language, course by course.",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "Hello Donguri",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} ${zenMaru.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>

      {/* Google Analytics - @next/third-parties optimized - loads after hydration */}
      <GoogleAnalytics />
      {/* Core Web Vitals Tracking */}
      <WebVitals />
    </html>
  );
}
