// Loading skeleton for the learn/test/review/daily-challenge session routes —
// shaped like a session (breadcrumbs, XP pill, progress line, question card)
// so navigating in doesn't flash the course home page's deck-grid skeleton,
// which is what these routes inherited from app/dashboard/courses/[slug]/loading.tsx.
export function SessionLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-64 animate-pulse rounded-full bg-sumi/10" />

      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="mb-4 h-8 w-24 animate-pulse rounded-full bg-sumi/10" />
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="h-8 w-20 animate-pulse rounded-full bg-sumi/10" />
          <div className="h-4 w-32 animate-pulse rounded-full bg-sumi/10" />
        </div>
        <div className="h-80 w-full animate-pulse rounded-3xl border border-card-border bg-washi-soft" />
      </div>
    </div>
  );
}
