/**
 * Pure 5-card hand evaluator shared by server (authoritative) and client (preview).
 * No external dependencies.
 */
import type { Card, HandEvalResult, HandRank } from '../types/game.js';
import { RANK_VALUE } from '../constants/game.js';

// ─── Combination helper ───────────────────────────────────────────────────────

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  return [
    ...combinations(tail, k - 1).map(c => [head, ...c]),
    ...combinations(tail, k),
  ];
}

// ─── 5-card evaluator ────────────────────────────────────────────────────────

function evalFive(cards: Card[]): { rank: HandRank; score: number; label: string; cards: Card[] } {
  const rv = cards.map(c => RANK_VALUE[c.rank]);
  const sv = cards.map(c => c.suit);
  const sorted = [...rv].sort((a, b) => b - a);

  const isFlush = new Set(sv).size === 1;

  const unique = [...new Set(sorted)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true;
      straightHigh = unique[0];
    }
    // Wheel: A-2-3-4-5
    if (JSON.stringify(unique) === JSON.stringify([14, 5, 4, 3, 2])) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  // Count groups
  const cnt: Record<number, number> = {};
  for (const r of rv) cnt[r] = (cnt[r] ?? 0) + 1;
  const groups = Object.entries(cnt)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r);

  const g0 = groups[0];
  const g1 = groups[1] ?? { r: 0, c: 0 };

  let rank: HandRank;
  let score: number;
  const P = 15;

  if (isFlush && isStraight && straightHigh === 14) {
    rank = 'ROYAL_FLUSH'; score = 10 * 1e12;
  } else if (isFlush && isStraight) {
    rank = 'STRAIGHT_FLUSH'; score = 9 * 1e12 + straightHigh;
  } else if (g0.c === 4) {
    rank = 'FOUR_OF_A_KIND'; score = 8 * 1e12 + g0.r * 100 + g1.r;
  } else if (g0.c === 3 && g1.c === 2) {
    rank = 'FULL_HOUSE'; score = 7 * 1e12 + g0.r * 100 + g1.r;
  } else if (isFlush) {
    rank = 'FLUSH';
    score = 6 * 1e12 + sorted.reduce((x, r, i) => x + r * P ** (4 - i), 0);
  } else if (isStraight) {
    rank = 'STRAIGHT'; score = 5 * 1e12 + straightHigh;
  } else if (g0.c === 3) {
    const kickers = sorted.filter(r => r !== g0.r);
    rank = 'THREE_OF_A_KIND'; score = 4 * 1e12 + g0.r * 1e4 + kickers[0] * 100 + kickers[1];
  } else if (g0.c === 2 && g1.c === 2) {
    const pairs = groups.filter(x => x.c === 2).map(x => x.r).sort((a, b) => b - a);
    const k = groups.find(x => x.c === 1)?.r ?? 0;
    rank = 'TWO_PAIR'; score = 3 * 1e12 + pairs[0] * 1e4 + pairs[1] * 100 + k;
  } else if (g0.c === 2) {
    const kickers = sorted.filter(r => r !== g0.r);
    rank = 'ONE_PAIR'; score = 2 * 1e12 + g0.r * 1e5 + kickers[0] * 1e3 + kickers[1] * 10 + kickers[2];
  } else {
    rank = 'HIGH_CARD';
    score = 1 * 1e12 + sorted.reduce((x, r, i) => x + r * P ** (4 - i), 0);
  }

  const LABEL: Record<HandRank, string> = {
    HIGH_CARD: 'ハイカード', ONE_PAIR: 'ワンペア', TWO_PAIR: 'ツーペア',
    THREE_OF_A_KIND: 'スリーカード', STRAIGHT: 'ストレート', FLUSH: 'フラッシュ',
    FULL_HOUSE: 'フルハウス', FOUR_OF_A_KIND: 'フォーカード',
    STRAIGHT_FLUSH: 'ストレートフラッシュ', ROYAL_FLUSH: 'ロイヤルフラッシュ',
  };

  return { rank, score, label: LABEL[rank], cards };
}

// ─── Best hand from N cards ───────────────────────────────────────────────────

/**
 * Find the best 5-card hand from an array of cards (up to 11 = 6 hole + 5 board).
 * Returns null if fewer than 5 cards are provided.
 */
export function bestHighHand(cards: Card[]): HandEvalResult | null {
  if (cards.length < 5) return null;
  const combos = combinations(cards, 5);
  let best: ReturnType<typeof evalFive> | null = null;
  for (const combo of combos) {
    const result = evalFive(combo);
    if (!best || result.score > best.score) best = result;
  }
  return best as HandEvalResult;
}

/**
 * Lo score: sum of remaining hole cards (after discards).
 * A=1, 2–9 face value, T/J/Q/K=10.
 * Lower is better.
 */
export function loSum(holeCards: Card[]): number {
  const LO_VAL: Record<string, number> = {
    A: 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9,
    T: 10, J: 10, Q: 10, K: 10,
  };
  return holeCards.reduce((s, c) => s + (LO_VAL[c.rank] ?? 10), 0);
}
