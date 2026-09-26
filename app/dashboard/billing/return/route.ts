import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { syncCheckoutSession } from "@/lib/billing";

// Stripe Checkout's success_url (see startCheckout in lib/actions/billing.ts).
// Syncs the new subscription straight away — rather than waiting on the
// webhook — then sends the user to the billing page, which now shows their
// trial and lets them into the dashboard. A route handler rather than work
// in the page itself: it runs per request, so reading the session (and
// writing the sync) never happens during prerendering.
export async function GET(request: Request) {
  const user = await requireUser();
  const sessionId = new URL(request.url).searchParams.get("session_id");

  if (sessionId) {
    try {
      await syncCheckoutSession(sessionId, user.id);
    } catch (error) {
      // The webhook will still catch up; the page just may not show the
      // trial for a moment.
      console.error("Syncing Checkout session failed:", error);
    }
  }

  redirect("/dashboard/billing?checkout=success");
}
