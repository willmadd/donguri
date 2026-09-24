import type { Metadata } from "next";
import { Geist_Mono, Nunito, Open_Sans } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/vocab/GoogleAnalytics";
import { WebVitals } from "@/components/WebVitals";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Site content — body text everywhere.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Site titles — headings and the wordmark (see the `h1`-`h6` rule in
// globals.css and font-nunito on the logo).
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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

// Allowed to block: `<html lang>` comes from the locale cookie, so this
// layout can't be part of a static shell. It only renders on full page
// loads — client navigations never re-render the root layout — so the
// dashboard's instant navigations (see app/dashboard/layout.tsx) aren't
// affected.
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const dictionary = getDictionary(locale);

  return (
    <html
      lang={locale}
      className={`${openSans.variable} ${geistMono.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LocaleProvider locale={locale} dictionary={dictionary}>
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>

      {/* Google Analytics - @next/third-parties optimized - loads after hydration */}
      <GoogleAnalytics />
      {/* Core Web Vitals Tracking */}
      <WebVitals />
    </html>
  );
}
