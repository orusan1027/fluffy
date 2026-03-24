/**
 * GTO-inspired bot AI for SCARNEY.
 * Decisions are based on pot odds, hand strength estimation, and position.
 */
import type { Card, GameAction, DealPhase } from '@scarney/shared';
import { bestHighHand, loSum, RANK_VALUE } from '@scarney/shared';
import type { ServerPlayer } from './GameEngine.js';

interface BotContext {
  holeCards: Card[];
  topBoard: Card[];
  pot: number;
  currentBet: number;
  myBetThisRound: number;
  myStack: number;
  phase: DealPhase;
  isLatePosition: boolean;
  gameMode: 'tournament' | 'bomb_pot';
}

function estimateHiStrength(holeCards: Card[], topBoard: Card[]): number {
  if (holeCards.length === 0) return 0;
  const allCards = [...holeCards, ...topBoard];
  const result = bestHighHand(allCards);
  if (!result) return 0.05;
  // Normalize score to [0,1]
  const normalized = Math.min(1, result.score / (10 * 1e12) * 0.9 + 0.05);
  return normalized;
}

function estimateLoStrength(holeCards: Card[]): number {
  if (holeCards.length === 0) return 0;
  const lo = loSum(holeCards);
  // Lower lo score is better. Map [0, 60] → [1, 0]
  return Math.max(0, 1 - lo / 40);
}

function potOdds(toCall: number, pot: number): number {
  if (toCall <= 0) return 1;
  return toCall / (pot + toCall);
}

export function botDecide(ctx: BotContext): GameAction {
  const { holeCards, topBoard, pot, currentBet, myBetThisRound, myStack, phase, isLatePosition } = ctx;

  const hiStr = estimateHiStrength(holeCards, topBoard);
  const loStr = estimateLoStrength(holeCards);
  const equity = hiStr * 0.5 + loStr * 0.5;

  const toCall = Math.max(0, currentBet - myBetThisRound);
  const odds = potOdds(toCall, pot);
  const posBonus = isLatePosition ? 0.06 : 0;
  const effectiveEquity = equity + posBonus;

  const bluffFreq: Record<string, number> = {
    preflop: 0.22, flop: 0.18, turn: 0.12, river: 0.06, showdown: 0,
  };
  const bluff = bluffFreq[phase] ?? 0.08;
  const rng = Math.random();

  if (toCall === 0) {
    // Check or bet
    if (effectiveEquity > 0.72) {
      const betAmt = Math.min(myStack, Math.floor(pot * (0.55 + effectiveEquity * 0.35)));
      if (betAmt > 0) return { type: 'bet', amount: myBetThisRound + betAmt };
    }
    if (rng < bluff && effectiveEquity > 0.45) {
      const betAmt = Math.min(myStack, Math.floor(pot * 0.55));
      if (betAmt > 0) return { type: 'bet', amount: myBetThisRound + betAmt };
    }
    return { type: 'check' };
  }

  // Facing a bet
  const foldThreshold = Math.max(0.1, odds - 0.05);

  if (effectiveEquity < foldThreshold && rng > 0.18) {
    return { type: 'fold' };
  }

  if (effectiveEquity > 0.82 && myStack <= pot * 1.5) {
    return { type: 'all_in' };
  }

  if (effectiveEquity > 0.78 && rng < 0.65) {
    const raiseAmt = Math.min(myStack, Math.floor(pot * 0.75) + toCall);
    if (raiseAmt > toCall) return { type: 'raise', amount: myBetThisRound + raiseAmt };
  }

  if (isLatePosition && rng < bluff * 0.5 && effectiveEquity > 0.38) {
    const raiseAmt = Math.min(myStack, Math.floor(pot * 0.75));
    if (raiseAmt > toCall) return { type: 'raise', amount: myBetThisRound + raiseAmt };
  }

  if (effectiveEquity >= foldThreshold) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}

/** Named bots for seating */
export const BOT_PROFILES = [
  { username: 'Kenji', avatarEmoji: '🎭' },
  { username: 'Yuki', avatarEmoji: '🦊' },
  { username: 'Ryo', avatarEmoji: '🎲' },
  { username: 'Hana', avatarEmoji: '🌸' },
  { username: 'Taro', avatarEmoji: '⚡' },
  { username: 'Mika', avatarEmoji: '🔥' },
];
