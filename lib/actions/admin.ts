"use server";

import { requireProfile } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminResetPasswordFormSchema,
  type AdminResetPasswordFormState,
} from "@/lib/definitions";

// `requireProfile` verifies the session server-side, and the role check
// below re-guards the action itself (not just the page) since server
// actions are directly callable regardless of which page rendered them.
export async function adminResetPassword(
  _state: AdminResetPasswordFormState,
  formData: FormData,
): Promise<AdminResetPasswordFormState> {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    return { message: "You don't have permission to do that." };
  }

  const validatedFields = AdminResetPasswordFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;

  const target = await prisma.profile.findFirst({ where: { email } });

  if (!target) {
    return { message: "No user found with that email." };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    password,
  });

  if (error) {
    console.error("Admin password reset failed:", error);
    return { message: "Could not update the password. Try again." };
  }

  return { success: true, message: `Password updated for ${email}.` };
}
