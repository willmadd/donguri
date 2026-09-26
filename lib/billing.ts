import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { cacheLife } from "next/cache";
import { getMembershipPrice, stripe } from "@/lib/stripe";

// Subscription statuses that unlock /dashboard content. `past_due` stays in
// so a failed renewal doesn't lock someone out while Stripe retries the
// card (Smart Retries); once retries run out it moves to `unpaid` or
// `canceled` and access ends.
const ACCESS_STATUSES = new Set(["trialing", "active", "past_due"]);

export function hasActiveAccess(
  role: string,
  subscription: { status: string | null } | null,
): boolean {
  if (role === "admin") return true;
  return subscription?.status != null && ACCESS_STATUSES.has(subscription.status);
}

function toDate(seconds: number | null | undefined): Date | null {
  return seconds ? new Date(seconds * 1000) : null;
}

// Copies a Stripe customer's current subscription onto their
// `subscriptions` row. Always re-reads from Stripe rather than trusting the
// webhook payload, so events arriving out of order or twice still leave
// the row matching Stripe. Called by the webhook and right after Checkout.
export async function syncStripeCustomer(customerId: string): Promise<void> {
  const row = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true, trialUsed: true },
  });

  let userId = row?.userId;
  if (!userId) {
    // A customer we haven't linked yet (shouldn't happen — Checkout creates
    // the row first — but the customer's metadata is the fallback).
    const customer = await stripe().customers.retrieve(customerId);
    if (customer.deleted) return;
    userId = customer.metadata.userId;
    if (!userId) {
      console.warn(`Stripe customer ${customerId} has no linked user`);
      return;
    }
  }

  // Newest first; a customer normally has at most one live subscription.
  const { data } = await stripe().subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });
  const subscription: Stripe.Subscription | undefined = data[0];
  const item = subscription?.items.data[0];

  const fields = {
    stripeSubscriptionId: subscription?.id ?? null,
    status: subscription?.status ?? null,
    priceId: item?.price.id ?? null,
    trialEnd: toDate(subscription?.trial_end),
    // Period dates live on the subscription item in current API versions.
    currentPeriodEnd: toDate(item?.current_period_end),
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
    trialUsed: (row?.trialUsed ?? false) || subscription?.trial_start != null,
    updatedAt: new Date(),
  };

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customerId, ...fields },
    update: fields,
  });
}

// Syncs straight away when the user lands back from Checkout, so the page
// shows their trial without waiting on the webhook (which may arrive a
// moment later, or — in local dev without `stripe listen` — not at all).
// Only for the signed-in user's own session.
export async function syncCheckoutSession(sessionId: string, userId: string): Promise<void> {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== userId) return;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) await syncStripeCustomer(customerId);
}

// The membership price for display, cached — it only changes when the
// price is edited in Stripe.
export async function getMembershipDisplayPrice(): Promise<{
  amount: number;
  currency: string;
  interval: string;
}> {
  "use cache";
  cacheLife("hours");

  const price = await getMembershipPrice();
  return {
    amount: price.unit_amount ?? 0,
    currency: price.currency,
    interval: price.recurring?.interval ?? "month",
  };
}
