import Link from "next/link";

export type BreadcrumbItem = {
  // Omit on the last item (the current page) — rendered as plain text
  // instead of a link.
  href?: string;
  label: string;
  // Per-link prefetch (see <Link prefetch>) — set on crumbs whose page
  // depends on its URL params, like the course home, so its per-user content
  // is ready before the click instead of just its loading skeleton.
  prefetch?: boolean;
};

export function Breadcrumbs({
  items,
  className = "mb-3",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-sumi-soft/50">
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link href={item.href} prefetch={item.prefetch} className="text-sumi-soft transition hover:text-sumi">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "text-sumi" : "text-sumi-soft"}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
