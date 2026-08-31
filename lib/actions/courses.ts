"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function enrollInCourse(courseId: string): Promise<void> {
  const user = await requireUser();

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { slug: true },
  });

  await prisma.courseEnrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    create: { userId: user.id, courseId },
    update: {},
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/courses/${course.slug}`);
}
