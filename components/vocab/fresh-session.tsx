"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";

// With Cache Components, a page you navigate away from stays mounted
// (hidden, via React's <Activity>) and keeps its state, so coming back to
// Learn/Test/Review would resume the old session — its index, or its
// "complete!" screen — against the fresh queue the server just sent.
// `bfcacheId` changes on every push/replace navigation (a <Link> click) but
// not on `router.refresh()` or a server action's revalidation, so keying on
// it restarts the session only when the learner actually navigates in, and
// still restores it on browser back/forward. Not keyed on the queue itself:
// `refreshDashboardHeader()` re-renders the page underneath a finished
// session, and that must not swap the summary screen for a new session.
export function FreshSession({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter();

  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
