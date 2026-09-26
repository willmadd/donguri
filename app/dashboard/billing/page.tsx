import type { Metadata } from "next";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { requireProfile } from "@/lib/dal";
import { getMembershipDisplayPrice } from "@/lib/billing";
import { openBillingPortal, startCheckout } from "@/lib/actions/billing";
import { TRIAL_PERIOD_DAYS } from "@/lib/stripe";
import { getTranslator } from "@/lib/i18n/server";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTitle, PageSubtitle } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { BillingActionButton } from "@/components/billing/billing-action-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Membership — Donguri",
};

type PageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

// Private cache scope, like loadCourseHome on the course page: the session
// read checks token expiry against `Date.now()`, which Cache Components only
// allows inside a cache scope during a (runtime) prerender. Arriving back
// from Checkout or the Customer Portal is a full page load, so this never
// serves a stale subscription after a change made on Stripe.
async function loadBilling() {
  "use cache: private";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const [profile, price] = await Promise.all([requireProfile(), getMembershipDisplayPrice()]);
  return { profile, price };
}

// Where everyone without an active trial/subscription lands (see
// requireSubscriber in lib/dal.ts), and where members manage billing.
// Reachable without a subscription, like profile and settings.
export default async function BillingPage({ searchParams }: PageProps) {
  const [{ profile, price }, { t, locale }] = await Promise.all([
    loadBilling(),
    getTranslator(),
  ]);

  const subscription = profile.subscription;
  const status = subscription?.status ?? null;
  const priceLabel = `${new Intl.NumberFormat(locale, {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.amount)}/${price.interval === "month" ? t("billing.per_month", "month") : price.interval}`;
  const formatDate = (date: Date | null) =>
    date ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date) : "";
  const trialEligible = !subscription?.trialUsed;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { href: "/dashboard", label: t("breadcrumbs.dashboard", "Dashboard") },
            { label: t("billing.title", "Membership") },
          ]}
        />
        <PageTitle>{t("billing.heading", "Membership")}</PageTitle>
        <PageSubtitle>
          {t("billing.subtitle", "Your Donguri membership, payment details and invoices.")}
        </PageSubtitle>
      </div>

      <Suspense fallback={null}>
        <CheckoutNotice
          searchParams={searchParams}
          hasAccess={profile.hasAccess}
          isTrial={status === "trialing"}
        />
      </Suspense>

      {profile.hasAccess && subscription ? (
        <section className="flex max-w-2xl flex-col gap-5 rounded-3xl border border-card-border bg-washi p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-sumi">
                {t("billing.plan_name", "Donguri Membership")}
              </h2>
              <p className="text-sm text-sumi-soft">{priceLabel}</p>
            </div>
            <StatusBadge status={status} cancelling={subscription.cancelAtPeriodEnd} t={t} />
          </div>

          <p className="text-sm text-sumi">
            {status === "trialing"
              ? subscription.cancelAtPeriodEnd
                ? t("billing.trial_cancelling", "Your free trial ends on {{date}} and won't renew. You won't be charged.", {
                    date: formatDate(subscription.trialEnd),
                  })
                : t("billing.trial_active", "Your free trial ends on {{date}}. After that you'll be charged {{price}} unless you cancel before then.", {
                    date: formatDate(subscription.trialEnd),
                    price: priceLabel,
                  })
              : status === "past_due"
                ? t("billing.past_due", "Your last payment didn't go through. Please update your payment method to keep your access.")
                : subscription.cancelAtPeriodEnd
                  ? t("billing.cancelling", "Your membership ends on {{date}} and won't renew.", {
                      date: formatDate(subscription.currentPeriodEnd),
                    })
                  : t("billing.renews", "Your membership renews on {{date}}.", {
                      date: formatDate(subscription.currentPeriodEnd),
                    })}
          </p>

          <div className="flex flex-col gap-2 border-t border-card-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-sumi-soft">
              {t("billing.portal_hint", "Update your card, download invoices or cancel on Stripe's secure page.")}
            </p>
            <BillingActionButton
              action={openBillingPortal}
              variant={status === "past_due" ? "primary" : "outline"}
              pendingText={t("billing.opening", "Opening…")}
            >
              {status === "past_due"
                ? t("billing.update_payment", "Update payment method")
                : t("billing.manage", "Manage billing")}
            </BillingActionButton>
          </div>
        </section>
      ) : profile.hasAccess ? (
        <p className="max-w-2xl rounded-2xl bg-washi-soft px-5 py-4 text-sm text-sumi-soft">
          {t("billing.admin_access", "You have full access as an admin — no membership needed.")}
        </p>
      ) : (
        <section className="flex max-w-2xl flex-col gap-6 overflow-hidden rounded-3xl border border-card-border bg-washi shadow-sm">
          <div className="flex flex-col gap-2 bg-matcha-soft/60 px-6 pb-6 pt-8">
            <span className="text-4xl" aria-hidden>
              🌰
            </span>
            <h2 className="text-2xl font-bold text-sumi">
              {subscription?.status && !trialEligible
                ? t("billing.resubscribe_title", "Pick up where you left off")
                : t("billing.trial_title", "Start your {{days}}-day free trial", {
                    days: TRIAL_PERIOD_DAYS,
                  })}
            </h2>
            <p className="text-sm text-sumi-soft">
              {subscription?.status && !trialEligible
                ? t("billing.resubscribe_body", "Your membership has ended. Resubscribe to get back to your courses — your progress is saved.")
                : t("billing.trial_body", "Full access to every course for {{days}} days, free. Then {{price}} — cancel any time before the trial ends and you won't be charged.", {
                    days: TRIAL_PERIOD_DAYS,
                    price: priceLabel,
                  })}
            </p>
          </div>

          <ul className="flex flex-col gap-3 px-6 text-sm text-sumi">
            {[
              t("billing.feature_courses", "Every course, deck and lesson"),
              t("billing.feature_challenge", "Daily chat challenges with Charles Duck"),
              t("billing.feature_feedback", "Feedback on your English in Japanese and English"),
              t("billing.feature_reviews", "Spaced-repetition reviews so words stick"),
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-matcha text-xs text-washi" aria-hidden>
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 px-6 pb-6">
            <BillingActionButton
              action={startCheckout}
              variant="secondary"
              size="lg"
              fullWidth
              pendingText={t("billing.redirecting", "Taking you to secure checkout…")}
            >
              {trialEligible
                ? t("billing.start_trial", "Start free trial")
                : t("billing.subscribe", "Subscribe for {{price}}", { price: priceLabel })}
            </BillingActionButton>
            <p className="text-center text-xs text-sumi-soft">
              {trialEligible
                ? t("billing.trial_fineprint", "Card required. We'll email you before your trial ends. Payments are handled securely by Stripe.")
                : t("billing.fineprint", "Cancel any time. Payments are handled securely by Stripe.")}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  cancelling,
  t,
}: {
  status: string | null;
  cancelling: boolean;
  t: Awaited<ReturnType<typeof getTranslator>>["t"];
}) {
  const [label, tone] =
    status === "trialing"
      ? [t("billing.status_trial", "Free trial"), "bg-kin/20 text-sumi"]
      : status === "past_due"
        ? [t("billing.status_past_due", "Payment failed"), "bg-shu/15 text-shu"]
        : cancelling
          ? [t("billing.status_cancelling", "Cancelling"), "bg-washi-soft text-sumi-soft"]
          : [t("billing.status_active", "Active"), "bg-matcha-soft text-matcha-dark"];

  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tone)}>{label}</span>
  );
}

// The one-off banners after Stripe Checkout (?checkout=success from
// /dashboard/billing/return, which has already synced; ?checkout=cancelled
// from Checkout's cancel link). Reads the URL behind its own Suspense
// boundary so the rest of the page doesn't wait on it.
async function CheckoutNotice({
  searchParams,
  hasAccess,
  isTrial,
}: {
  searchParams: PageProps["searchParams"];
  hasAccess: boolean;
  isTrial: boolean;
}) {
  const [{ checkout }, { t }] = await Promise.all([searchParams, getTranslator()]);
  const justStarted = checkout === "success" && hasAccess;

  return (
    <>
        {justStarted && (
          <div className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-matcha/40 bg-matcha-soft/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-sumi">
                {isTrial
                  ? t("billing.welcome_trial", "Your free trial has started 🎉")
                  : t("billing.welcome_member", "Welcome to Donguri 🎉")}
              </p>
              <p className="text-sm text-sumi-soft">
                {t("billing.welcome_body", "Everything is unlocked — let's get learning.")}
              </p>
            </div>
            <Button variant="secondary" href="/dashboard">
              {t("billing.start_learning", "Start learning")}
            </Button>
          </div>
        )}

        {checkout === "cancelled" && !hasAccess && (
          <p className="max-w-2xl rounded-2xl bg-washi-soft px-5 py-3 text-sm text-sumi-soft">
            {t("billing.checkout_cancelled", "Checkout was cancelled — nothing was charged.")}
          </p>
        )}
    </>
  );
}
