// Shown immediately on navigation into any /dashboard route that doesn't
// have its own more specific loading.tsx, while that page's Server
// Component data fetching is still in flight — without this, Next has
// nothing to stream back until the whole page (every parallel query)
// resolves, so navigation looks like it's hung rather than in progress.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-40 animate-pulse rounded-full bg-sumi/10" />
        <div className="h-7 w-64 animate-pulse rounded-full bg-sumi/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl border border-card-border bg-washi-soft"
          />
        ))}
      </div>

      <div className="h-48 animate-pulse rounded-2xl border border-card-border bg-washi-soft" />
    </div>
  );
}
