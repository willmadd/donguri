"use server";

import { requireUser, getFriendsLeaderboard } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import type { LeaderboardEntry } from "@/lib/definitions";

export async function addFriendByEmail(email: string): Promise<{
  error?: string;
  friends?: LeaderboardEntry[];
}> {
  const user = await requireUser();
  const trimmed = email.trim();

  if (trimmed === "") {
    return { error: "Enter an email address." };
  }

  const friend = await prisma.profile.findFirst({
    where: { email: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });

  if (!friend) {
    return { error: "No user found with that email." };
  }

  if (friend.id === user.id) {
    return { error: "That's your own email." };
  }

  await prisma.friendship.upsert({
    where: { userId_friendId: { userId: user.id, friendId: friend.id } },
    create: { userId: user.id, friendId: friend.id },
    update: {},
  });

  return { friends: await getFriendsLeaderboard(user.id) };
}

export async function removeFriend(friendId: string): Promise<LeaderboardEntry[]> {
  const user = await requireUser();

  await prisma.friendship.deleteMany({ where: { userId: user.id, friendId } });

  return getFriendsLeaderboard(user.id);
}
