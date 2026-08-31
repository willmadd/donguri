import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-semibold tracking-tight text-sumi ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-shu text-lg text-washi">
        🌰
      </span>
      <span className="text-xl">Donguri</span>
    </Link>
  );
}
