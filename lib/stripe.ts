import "server-only";
import Stripe from "stripe";

// Created lazily so importing this module (e.g. during `next build`) doesn't
// throw when STRIPE_SECRET_KEY isn't set — only an actual Stripe call does.
// The SDK pins its own API version, so no apiVersion is passed here.
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, {
      appInfo: { name: "Donguri", url: "https://hellodonguri.com" },
    });
  }
  return client;
}

// The membership price, found by lookup key rather than a hard-coded ID so
// test and live mode (and a future price change) need no code change: give
// the new price this lookup key in Stripe and it's picked up.
export const MEMBERSHIP_PRICE_LOOKUP_KEY =
  process.env.STRIPE_PRICE_LOOKUP_KEY ?? "donguri_monthly_jpy";

export const TRIAL_PERIOD_DAYS = 14;

export async function getMembershipPrice(): Promise<Stripe.Price> {
  const { data } = await stripe().prices.list({
    lookup_keys: [MEMBERSHIP_PRICE_LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  const price = data[0];
  if (!price) {
    throw new Error(`No active Stripe price with lookup key "${MEMBERSHIP_PRICE_LOOKUP_KEY}"`);
  }
  return price;
}
