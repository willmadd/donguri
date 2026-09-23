import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { DeckPreview } from "@/components/vocab/deck-preview";
import { getPublicDeckDetail, getSession } from "@/lib/dal";
import { getTranslator } from "@/lib/i18n/server";

type PageProps = {
  params: Promise<{ slug: string; deckId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, deckId } = await params;
  const detail = await getPublicDeckDetail(slug, deckId);
  if (!detail) return {};
  return {
    title: `${detail.deck.title} — ${detail.course.title}`,
    description: detail.deck.description ?? detail.deck.subheading ?? undefined,
  };
}

// Shareable, logged-out view of a deck — outside /dashboard so proxy.ts
// doesn't redirect to /login. Shows the deck's contents with no progress;
// logged-in visitors get a link through to the dashboard version instead
// of the sign-up pitch.
export default async function PublicDeckPage({ params }: PageProps) {
  const { slug, deckId } = await params;

  const [detail, user, { t }] = await Promise.all([
    getPublicDeckDetail(slug, deckId),
    getSession(),
    getTranslator(),
  ]);

  if (!detail) {
    notFound();
  }

  const { course, deck } = detail;
  const dashboardHref = `/dashboard/courses/${slug}/decks/${deckId}`;

  return (
    <div className="flex min-h-screen flex-col bg-washi">
      <header className="border-b border-header-border bg-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo />

          <nav className="flex items-center gap-1 sm:gap-3">
            {user ? (
              <Button href={dashboardHref} size="sm">
                {t("public_deck.open_in_dashboard", "Open in dashboard")}
              </Button>
            ) : (
              <>
                <Link
                  href={`/login?next=${encodeURIComponent(dashboardHref)}`}
                  className="rounded-full px-3 py-2 text-sm font-medium text-sumi-soft transition hover:text-sumi sm:px-4"
                >
                  {t("nav.log_in", "Log in")}
                </Link>
                <Button href="/signup" size="sm">
                  {t("nav.sign_up", "Sign up")}
                </Button>
              </>
            )}
            <ThemeToggle className="ml-1" />
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-sumi-soft">
          {course.title}
        </p>

        <DeckPreview deck={deck} t={t} titleAs="h1" />

        {!user && (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-card-border bg-washi-soft p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-sumi-soft">
              {t(
                "public_deck.signup_pitch",
                "Sign up for free to add this deck to your word list and start learning.",
              )}
            </p>
            <Button href="/signup" size="sm">
              {t("public_deck.start_learning", "Start learning")}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
