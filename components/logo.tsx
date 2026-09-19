import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-fredoka font-bold tracking-tight ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-shu text-lg text-washi">
        <img src="/images/mascot.png" alt="Duck" className="h-8 w-8" />
      </span>
      <span className="text-xl">
        <span style={{ color: "#4a2414" }}>Hello</span>{" "}
        <span style={{ color: "#c4312b" }}>Donguri</span>
      </span>
    </Link>
  );
}
