import type { Pot, SidePot } from '@scarney/shared';

export interface PlayerBet {
  userId: string;
  totalBet: number;  // total chips committed to pot this hand
  folded: boolean;
}

/**
 * Calculate main pot and side pots from player bets.
 * Algorithm: sort by totalBet, create successive pots for each all-in level.
 */
export function calculatePots(players: PlayerBet[]): Pot {
  const active = players.filter(p => !p.folded || p.totalBet > 0);
  if (active.length === 0) return { main: 0, sides: [], total: 0 };

  // Sort by totalBet ascending to create side pots at each all-in level
  const sorted = [...active].sort((a, b) => a.totalBet - b.totalBet);

  const pots: SidePot[] = [];
  let prev = 0;

  for (let i = 0; i < sorted.length; i++) {
    const level = sorted[i].totalBet;
    if (level <= prev) continue;

    const perPlayer = level - prev;
    const eligible = players.filter(p => !p.folded && p.totalBet >= level).map(p => p.userId);
    // Include folded players' contributions (they still contribute to pot)
    const contributors = players.filter(p => p.totalBet >= level);
    const potAmount = perPlayer * contributors.length;

    pots.push({ amount: potAmount, eligibleUserIds: eligible });
    prev = level;
  }

  // Add remaining (if non-folder bet more than all-in players)
  // already handled above

  const total = pots.reduce((s, p) => s + p.amount, 0);
  const main = pots[0]?.amount ?? 0;
  const sides = pots.slice(1);

  return { main, sides, total };
}
