import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminProfile } from "@/lib/dal";
import { BackLink } from "@/components/ui/back-link";

export const metadata: Metadata = {
  title: "Admin — Donguri",
};

export default async function AdminHubPage() {
  await requireAdminProfile();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard" label="Dashboard" />
        <h1 className="text-2xl font-semibold text-sumi">Admin</h1>
        <p className="mt-1 text-sumi-soft">Manage users and course content.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/admin/reset-password"
          className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <h2 className="font-semibold text-sumi">Reset a user&apos;s password</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            Set a new password for any account by email.
          </p>
        </Link>
        <Link
          href="/dashboard/admin/courses"
          className="rounded-2xl border border-sumi/10 bg-washi-soft p-6 transition hover:border-ai/40"
        >
          <h2 className="font-semibold text-sumi">Manage course content</h2>
          <p className="mt-1 text-sm text-sumi-soft">
            Create categories, add words, and copy categories between courses.
          </p>
        </Link>
      </div>
    </div>
  );
}
