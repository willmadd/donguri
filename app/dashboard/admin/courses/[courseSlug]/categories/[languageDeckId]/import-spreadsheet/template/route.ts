import { NextResponse } from "next/server";
import { getProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { buildWordImportTemplate } from "@/lib/word-import";

type RouteParams = {
  params: Promise<{ courseSlug: string; languageDeckId: string }>;
};

// A GET route rather than a Server Action, so the browser can trigger a
// plain file download (Content-Disposition) from an <a href>. Auth is
// checked directly with `getProfile()` here instead of the page-oriented
// `requireAdminProfile()` — that one calls `next/navigation`'s `redirect()`,
// which route handlers don't support, so an unauthorized request gets a
// plain 404 instead of a redirect (the proxy in proxy.ts already keeps
// signed-out requests to /dashboard/* from reaching this far at all).
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getProfile();

  if (!profile || profile.role !== "admin") {
    return new NextResponse("Not found.", { status: 404 });
  }

  const { courseSlug, languageDeckId } = await params;

  const languageDeck = await prisma.languageDeck.findUnique({
    where: { id: languageDeckId },
    select: { title: true, course: { select: { slug: true } } },
  });

  if (!languageDeck || languageDeck.course.slug !== courseSlug) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const categories = await prisma.wordCategory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { name: true },
  });

  const buffer = await buildWordImportTemplate(categories.map((category) => category.name));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slugifyFilename(languageDeck.title)}-word-template.xlsx"`,
    },
  });
}

function slugifyFilename(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "words";
}
