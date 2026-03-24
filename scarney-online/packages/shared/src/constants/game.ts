import type { Suit, Rank } from '../types/game.js';

export const SUITS: Suit[] = ['c', 'd', 'h', 's'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOL: Record<Suit, string> = {
  c: '♣', d: '♦', h: '♥', s: '♠',
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  c: false, d: true, h: true, s: false,
};

export const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, 'T': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/** For Lo evaluation: A=1, 2–9 face value, T/J/Q/K=10 */
export const RANK_LO_VALUE: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 10, 'Q': 10, 'K': 10,
};

export const RANK_DISPLAY: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

// ─── Game constants ───────────────────────────────────────────────────────────

export const CARDS_PER_PLAYER = 6;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

export const TOURNAMENT_SB = 100;
export const TOURNAMENT_BB = 200;
export const STARTING_STACK = 30_000;

export const IDLE_TIMEOUT_MS = 30_000;
export const RECONNECT_GRACE_MS = 60_000;
export const NEXT_HAND_DELAY_MS = 4_000;

/** Cards dealt per phase: [topBoard, bottomBoard] pairs */
export const PHASE_DEAL_COUNT: Record<string, number> = {
  flop_deal: 3,
  turn_deal: 2,
  river_deal: 1,
};

export const PHASE_LABEL_JP: Record<string, string> = {
  waiting: '待機中',
  preflop: 'プリフロップ',
  flop_deal: '公開中…',
  flop: 'フロップ',
  turn_deal: '公開中…',
  turn: 'ターン',
  river_deal: '公開中…',
  river: 'リバー',
  showdown: 'ショーダウン',
};

export const DEAL_PHASE_SEQUENCE: string[] = [
  'preflop', 'flop_deal', 'flop', 'turn_deal', 'turn', 'river_deal', 'river', 'showdown',
];
