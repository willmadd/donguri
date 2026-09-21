"use client";

import { useState } from "react";
import { addFriendByEmail, removeFriend } from "@/lib/actions/friends";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-row";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/i18n/locale-provider";
import type { LeaderboardEntry } from "@/lib/definitions";

export function FriendsLeaderboardCard({ initialFriends }: { initialFriends: LeaderboardEntry[] }) {
  const t = useTranslations();
  const [friends, setFriends] = useState(initialFriends);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddFriend = async (event: React.FormEvent) => {
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
  };

  const handleRemove = async (friendId: string) => {
    setFriends((current) => current.filter((entry) => entry.id !== friendId));
    const updated = await removeFriend(friendId);
    setFriends(updated);
  };

  return (
    <section className="flex h-full flex-col rounded-2xl border border-card-border bg-washi-soft p-6">
      <h2 className="text-sm font-semibold tracking-wide text-sumi-soft uppercase">
        {t("leaderboard.friends", "Friends")}
      </h2>

      <form onSubmit={handleAddFriend} className="mt-4 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t("leaderboard.friend_email_placeholder", "Friend's email")}
          className="h-10 min-w-0 flex-1 rounded-full border border-sumi/15 bg-washi px-4 text-sm text-sumi outline-none transition focus:border-ai/50"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 px-5 text-sm"
        >
          {t("leaderboard.add", "Add")}
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-shu">{error}</p>}

      <LeaderboardList
        entries={friends}
        emptyMessage={t("leaderboard.no_friends_yet", "Add a friend by email to compare XP.")}
        onRemove={handleRemove}
      />
    </section>
  );
}
