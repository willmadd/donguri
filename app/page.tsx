// hellodonguri.com landing page.
// The original app homepage is preserved below, commented out, so it can be
// restored by deleting the /* ... */ wrapper and the new code beneath it.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { getTranslator } from "@/lib/i18n/server";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ForJapaneseSpeakers } from "@/components/landing/for-japanese-speakers";
import { Collections } from "@/components/landing/collections";
import { Method } from "@/components/landing/method";
import { PracticalEnglish } from "@/components/landing/practical-english";
import { ProgressPreview } from "@/components/landing/progress-preview";
import { BetaInvite } from "@/components/landing/beta-invite";
import { MeetDonguri } from "@/components/landing/meet-donguri";
import { Creators } from "@/components/landing/creators";
import { FreeBanner } from "@/components/landing/free-banner";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";

export default async function Home() {
  const user = await getSession();

  if (user) {
    redirect("/dashboard");
  }

  const { t } = await getTranslator();

  return (
    <div className="flex min-h-screen flex-col bg-washi">
      <header className="border-b border-header-border bg-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo />

          <nav className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-sm font-medium text-sumi-soft transition hover:text-sumi sm:px-4"
            >
              {t("nav.log_in", "Log in")}
            </Link>

            <Button href="/signup" size="sm">
              {t("nav.sign_up", "Sign up")}
            </Button>

            <ThemeToggle className="ml-1" />
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Hero t={t} />
        <Benefits t={t} />
        <HowItWorks t={t} />
        <ForJapaneseSpeakers t={t} />
        <Collections t={t} />
        <Method t={t} />
        <PracticalEnglish t={t} />
        <ProgressPreview t={t} />
        <BetaInvite t={t} />
        <MeetDonguri t={t} />
        <Creators t={t} />
        <FreeBanner t={t} />
        <Faq t={t} />
      </main>

      <FinalCta t={t} />

      <footer className="border-t border-sumi/10 px-6 py-8 text-center text-sm text-sumi-soft">
        {t("footer.tagline", "Hello Donguri — English learning designed for Japanese speakers.")}
      </footer>
    </div>
  );
}

// import type { Metadata } from "next";
// import Image from "next/image";
// import { redirect } from "next/navigation";
// import { getSession } from "@/lib/dal";

// // Page-specific metadata (merges with, and overrides, the root layout's
// // metadata for this route only — other pages are unaffected).
// const title = "Hello Donguri — もうすぐ公開！";
// const description =
//   "Hello Donguri is a friendly, character-led way for Japanese speakers to learn everyday English. Launching soon.";
// // OG image file to be added at public/images/og-image.png.
// const ogImage = "/images/og-image.png";

// export const metadata: Metadata = {
//   metadataBase: new URL("https://hellodonguri.com"),
//   title,
//   description,
//   openGraph: {
//     title,
//     description,
//     url: "https://hellodonguri.com",
//     siteName: "Hello Donguri",
//     images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
//     locale: "ja_JP",
//     type: "website",
//   },
//   twitter: {
//     card: "summary_large_image",
//     title,
//     description,
//     images: [ogImage],
//   },
// };

// // Brand palette — dark brown / muted red, per the Hello Donguri brief.
// const BROWN = "#4A2414";
// const RED = "#C4312B";

// export default async function Home() {
//   const user = await getSession();

//   if (user) {
//     redirect("/dashboard");
//   }

//   return (
//     <main className="flex min-h-dvh items-center justify-center bg-washi px-5 py-8 text-center sm:px-8 sm:py-14">
//       <div className="flex w-full max-w-2xl flex-col items-center">
//         <Image
//           src="/images/mascots.webp"
//           alt="Hello Donguri acorn mascot"
//           width={500}
//           height={500}
//           priority
//           sizes="(max-width: 640px) 280px, 500px"
//           className="h-auto w-full max-w-[280px] object-contain xs:max-w-[320px] sm:max-w-[500px]"
//         />
//         <h1
//           className="font-zen-maru mt-5 text-[clamp(2.25rem,12vw,3.75rem)] leading-tight font-bold tracking-tight sm:mt-7"
//           style={{ color: BROWN }}
//         >
//           もうすぐ公開！
//         </h1>
//         <p className="font-fredoka tracking-tight mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-2xl font-bold sm:mt-3 sm:gap-3 sm:text-6xl">
//           <span style={{ color: BROWN }}>Hello</span>
//           <span style={{ color: RED }}>Donguri</span>
//         </p>
//         <p className="mt-5 max-w-xl text-[15px] leading-7 text-pretty text-sumi-soft sm:mt-6 sm:text-lg sm:leading-8">
//           Hello
//           Donguriは、かわいいキャラクターたちと一緒に、楽しく英語を学べる新しい学習サービスです。
//           日常で使える英語を、少しずつ、自分のペースで身につけていきましょう。
//           現在、公開に向けて準備中です。もうしばらくお待ちください。
//         </p>
//         <div
//           aria-hidden="true"
//           className="my-4 h-px w-12 bg-current opacity-15 sm:my-5"
//           style={{ color: BROWN }}
//         />
//         <p className="max-w-lg text-sm leading-6 text-pretty text-sumi-soft sm:text-base sm:leading-7">
//           Hello Donguri is a new way for Japanese speakers to learn everyday
//           English with a friendly cast of characters—a little at a time, at your
//           own pace. We&apos;re putting the finishing touches on it now.
//         </p>
//       </div>
//     </main>
//   );
// }
