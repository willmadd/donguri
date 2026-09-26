import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { syncStripeCustomer } from "@/lib/billing";
import { stripe } from "@/lib/stripe";

// Stripe → app: keeps each user's `subscriptions` row in step with Stripe
// (trial started, renewed, payment failed, cancelled, ...). Every relevant
// event just re-syncs that customer from Stripe (see syncStripeCustomer),
// so duplicate or out-of-order deliveries are harmless.
//
// Local dev: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
// and put the whsec_ it prints in STRIPE_WEBHOOK_SECRET. Production: add
// this URL as an endpoint in the Stripe dashboard with the events below.
const RELEVANT_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
]);

function customerIdOf(object: unknown): string | null {
  const customer = (object as { customer?: string | { id: string } | null }).customer;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // The raw body, exactly as sent — the signature is over these bytes.
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return Response.json({ received: true });
  }

  const customerId = customerIdOf(event.data.object);
  if (customerId) {
    try {
      await syncStripeCustomer(customerId);
    } catch (error) {
      // A 500 makes Stripe retry the delivery with backoff.
      console.error(`Stripe webhook ${event.type} sync failed:`, error);
      return new Response("Sync failed", { status: 500 });
    }
    // Access and the header both read the synced row.
    revalidatePath("/dashboard", "layout");
  }

  return Response.json({ received: true });
}
