import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { getTranslator } from "@/lib/i18n/server";

export async function LogoutButton() {
  const { t } = await getTranslator();

  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm">
        {t("dashboard_layout.log_out", "Log out")}
      </Button>
    </form>
  );
}
