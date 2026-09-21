// The course home page is the heaviest dashboard route — five parallel
// queries (decks, streak chart data, leaderboards, review summary,
// profile) — so it benefits the most from a tailored skeleton rather than
// the generic app/dashboard/loading.tsx fallback.
export default function CourseHomeLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-48 animate-pulse rounded-full bg-sumi/10" />
        <div className="h-7 w-56 animate-pulse rounded-full bg-sumi/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />
        <div className="h-40 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />
      </div>

      <div className="h-40 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />

      <div className="h-32 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />
        <div className="h-56 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />
      </div>
    </div>
  );
}
