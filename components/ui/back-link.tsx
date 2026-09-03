import Link from "next/link";

type BackLinkProps = {
  href: string;
  label: string;
  className?: string;
};

export function BackLink({ href, label, className = "mb-3" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-sumi-soft transition hover:text-sumi ${className}`}
    >
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
