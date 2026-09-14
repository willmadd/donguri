"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { UpdateProfileFormSchema, type UpdateProfileFormState } from "@/lib/definitions";

export async function updateProfile(
  _state: UpdateProfileFormState,
  formData: FormData,
): Promise<UpdateProfileFormState> {
  const user = await requireUser();

  const validatedFields = UpdateProfileFormSchema.safeParse({
    fullName: formData.get("fullName"),
    donguriConfig: formData.get("donguriConfig") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { fullName, donguriConfig } = validatedFields.data;

  await prisma.profile.update({
    where: { id: user.id },
    data: {
      fullName,
      // An empty textarea clears the config back to null rather than
      // storing an empty string in a `Json` column.
      donguriConfig: donguriConfig ? JSON.parse(donguriConfig) : null,
    },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");

  return { success: true, message: "Profile updated." };
}
