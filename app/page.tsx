import Link from "next/link";
import { Logo } from "@/components/logo";
import { getPublicCourses } from "@/lib/dal";

const ACCENTS = [
  "bg-ai-soft text-ai-dark",
  "bg-sakura-soft text-sakura-dark",
  "bg-matcha-soft text-matcha-dark",
];

export default async function Home() {
  const courses = await getPublicCourses();

  return (
    <div className="flex min-h-screen flex-col bg-washi">
      <header className="border-b border-sumi/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-sumi-soft transition hover:text-sumi"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-ai px-4 py-2 text-sm font-medium text-washi transition hover:bg-ai-dark"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
          <span className="rounded-full bg-sakura-soft px-4 py-1 text-sm font-medium text-sakura-dark">
            Welcome to Donguri
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-sumi sm:text-5xl">
            Grow your vocabulary, one word at a time.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-sumi-soft">
            Donguri is a calm, friendly way to learn a new language — pick a
            course, practice a few words a day, and watch it grow.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-shu px-8 font-medium text-washi transition hover:bg-shu-dark"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full border border-sumi/15 px-8 font-medium text-sumi transition hover:border-sumi/30"
            >
              I already have an account
            </Link>
          </div>
        </section>

        {courses.length > 0 && (
          <section className="border-t border-sumi/10 bg-washi-soft">
            <div className="mx-auto max-w-5xl px-6 py-20">
              <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-sumi-soft">
                Courses
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {courses.map((course, index) => (
                  <Link
                    key={course.id}
                    href="/signup"
                    className="rounded-2xl border border-sumi/10 bg-washi p-6 transition hover:border-ai/40"
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold uppercase ${ACCENTS[index % ACCENTS.length]}`}
                    >
                      {course.targetLanguage}
                    </span>
                    <h3 className="mt-4 font-semibold text-sumi">{course.title}</h3>
                    {course.description && (
                      <p className="mt-1.5 text-sm text-sumi-soft">{course.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-sumi/10 px-6 py-8 text-center text-sm text-sumi-soft">
        Donguri — a friendly way to grow a new language.
      </footer>
    </div>
  );
}
