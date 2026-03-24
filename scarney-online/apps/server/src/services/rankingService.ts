import { prisma } from '../db/prisma.js';
import type { RankingEntry } from '@scarney/shared';

export async function getTopRankings(limit = 20): Promise<RankingEntry[]> {
  const users = await prisma.user.findMany({
    orderBy: { chips: 'desc' },
    take: limit,
    include: { ranking: true },
  });
  return users.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    avatarEmoji: u.avatarEmoji,
    chips: u.chips,
    handsPlayed: u.ranking?.handsPlayed ?? 0,
    handsWon: u.ranking?.handsWon ?? 0,
    totalProfit: u.ranking?.totalProfit ?? 0,
  }));
}

export async function updateRanking(
  userId: string,
  chipsDelta: number,
  won: boolean,
  wonHi: boolean,
  wonLo: boolean,
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: chipsDelta } },
    }),
    prisma.ranking.upsert({
      where: { userId },
      create: {
        userId,
        handsPlayed: 1,
        handsWon: won ? 1 : 0,
        hiWins: wonHi ? 1 : 0,
        loWins: wonLo ? 1 : 0,
        totalProfit: chipsDelta,
      },
      update: {
        handsPlayed: { increment: 1 },
        handsWon: { increment: won ? 1 : 0 },
        hiWins: { increment: wonHi ? 1 : 0 },
        loWins: { increment: wonLo ? 1 : 0 },
        totalProfit: { increment: chipsDelta },
      },
    }),
  ]);
}
