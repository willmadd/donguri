"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { addFriendByEmail, removeFriend } from "@/lib/actions/friends";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-row";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LeaderboardEntry } from "@/lib/definitions";

type TabKey = "top" | "friends";

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 24 : -24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -24 : 24, opacity: 0 }),
};

export function LeaderboardTabs({
  topEntries,
  initialFriends,
}: {
  topEntries: LeaderboardEntry[];
  initialFriends: LeaderboardEntry[];
}) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<TabKey>("top");
  const [direction, setDirection] = useState(0);

  const [friends, setFriends] = useState(initialFriends);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The friends list always includes the viewer (see getFriendsLeaderboard).
  const selfTotalXp = friends.find((entry) => entry.isSelf)?.xp ?? null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "top", label: t("leaderboard.top_10", "Top 10") },
    { key: "friends", label: t("leaderboard.friends", "Friends") },
  ];

  function switchTo(tab: TabKey) {
    if (tab === activeTab) return;
    setDirection(tab === "friends" ? 1 : -1);
    setActiveTab(tab);
  }

  async function handleAddFriend(event: React.FormEvent) {
    event.preventDefault();
    if (pending || email.trim() === "") return;

    setPending(true);
    setError(null);

    try {
      const result = await addFriendByEmail(email);

      if (result.error) {
        setError(result.error);
      } else if (result.friends) {
        setFriends(result.friends);
        setEmail("");
      }
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(friendId: string) {
    setFriends((current) => current.filter((entry) => entry.id !== friendId));
    const updated = await removeFriend(friendId);
    setFriends(updated);
  }

  return (
    <section className="flex flex-col rounded-2xl border border-card-border bg-washi-soft p-6">
      <div className="relative flex rounded-full bg-neutral-soft p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTo(tab.key)}
            className={`relative flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.key ? "text-sumi" : "text-sumi-soft hover:text-sumi"
            }`}
          >
            {activeTab === tab.key && (
              <motion.span
                layoutId="leaderboard-tab-pill"
                className="absolute inset-0 rounded-full bg-washi shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="relative mt-4 overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {activeTab === "top" ? (
            <motion.div
              key="top"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <LeaderboardList
                entries={topEntries}
                selfTotalXp={selfTotalXp}
                emptyMessage={t("leaderboard.no_xp_yet", "No one has earned XP yet.")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="friends"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <form onSubmit={handleAddFriend} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("leaderboard.friend_email_placeholder", "Friend's email")}
                  className="h-10 min-w-0 flex-1 rounded-full border border-sumi/15 bg-washi px-4 text-sm text-sumi outline-none transition focus:border-ai/50"
                />
                <Button type="submit" disabled={pending} className="h-10 shrink-0 px-5 text-sm">
                  {t("leaderboard.add", "Add")}
                </Button>
              </form>

              {error && <p className="mt-2 text-sm text-shu">{error}</p>}

              <LeaderboardList
                entries={friends}
                selfTotalXp={selfTotalXp}
                emptyMessage={t("leaderboard.no_friends_yet", "Add a friend by email to compare XP.")}
                onRemove={handleRemove}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
