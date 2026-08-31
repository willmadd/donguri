import { logout } from "@/lib/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-full border border-sumi/15 px-4 py-2 text-sm font-medium text-sumi-soft transition hover:border-sumi/30 hover:text-sumi"
      >
        Log out
      </button>
    </form>
  );
}
