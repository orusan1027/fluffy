// ─── Card ────────────────────────────────────────────────────────────────────

export type Suit = 'c' | 'd' | 'h' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string; // e.g. "Ah", "Td", "2c"
}

// ─── Game meta ───────────────────────────────────────────────────────────────

export type GameMode = 'tournament' | 'bomb_pot';
export type BettingMode = 'NL' | 'PL';

export type DealPhase =
  | 'waiting'
  | 'preflop'
  | 'flop_deal'
  | 'flop'
  | 'turn_deal'
  | 'turn'
  | 'river_deal'
  | 'river'
  | 'showdown';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export type PlayerStatus = 'active' | 'folded' | 'all_in' | 'disconnected' | 'sitting_out';

// ─── Hand evaluation ─────────────────────────────────────────────────────────

export type HandRank =
  | 'HIGH_CARD'
  | 'ONE_PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH';

export const HAND_RANK_VALUE: Record<HandRank, number> = {
  HIGH_CARD: 1,
  ONE_PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10,
};

export const HAND_RANK_LABEL: Record<HandRank, string> = {
  HIGH_CARD: 'ハイカード',
  ONE_PAIR: 'ワンペア',
  TWO_PAIR: 'ツーペア',
  THREE_OF_A_KIND: 'スリーカード',
  STRAIGHT: 'ストレート',
  FLUSH: 'フラッシュ',
  FULL_HOUSE: 'フルハウス',
  FOUR_OF_A_KIND: 'フォーカード',
  STRAIGHT_FLUSH: 'ストレートフラッシュ',
  ROYAL_FLUSH: 'ロイヤルフラッシュ',
};

export interface HandEvalResult {
  rank: HandRank;
  score: number;       // numeric for comparison
  label: string;       // Japanese label
  cards: Card[];       // best 5 cards
}

// ─── Player states ───────────────────────────────────────────────────────────

/** What every client sees about a player (no secret hole cards) */
export interface PublicPlayerState {
  userId: string;
  username: string;
  avatarEmoji: string;
  seatIndex: number;
  stack: number;
  betThisRound: number;
  status: PlayerStatus;
  holeCardCount: number;       // remaining hole cards (decreases as bottomBoard grows)
  discardedCards: Card[];      // cards auto-discarded to bottomBoard (visible to all)
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  lastAction?: ActionType;
  isBot: boolean;
}

/** What a player receives about themselves (includes secret hole cards) */
export interface PersonalPlayerState extends PublicPlayerState {
  holeCards: Card[];
}

// ─── Pot ─────────────────────────────────────────────────────────────────────

export interface SidePot {
  amount: number;
  eligibleUserIds: string[];
}

export interface Pot {
  main: number;
  sides: SidePot[];
  total: number;
}

// ─── Game state ──────────────────────────────────────────────────────────────

/** Sanitized game state sent to each client (their own holeCards are in their PlayerState) */
export interface GameState {
  roomId: string;
  handNumber: number;
  phase: DealPhase;
  gameMode: GameMode;
  bettingMode: BettingMode;
  topBoard: Card[];          // community cards for Hi evaluation
  bottomBoard: Card[];       // discard pile cards
  pot: Pot;
  players: PublicPlayerState[];
  activePlayerIndex: number;  // -1 if no active player
  dealerIndex: number;
  sbIndex: number;
  bbIndex: number;
  smallBlind: number;
  bigBlind: number;
  currentBet: number;        // highest bet this round
  minRaise: number;
  lastActionAt: number;      // epoch ms for idle timer display
  updatedAt: number;
}

/** Combined state sent to each individual player (includes their own cards) */
export interface PersonalGameState extends GameState {
  myUserId: string;
  myHoleCards: Card[];
  myDiscardedCards: Card[];
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export interface GameAction {
  type: ActionType;
  amount?: number;  // for bet/raise
}

// ─── Showdown / Result ───────────────────────────────────────────────────────

export interface PlayerShowdownInfo {
  userId: string;
  username: string;
  avatarEmoji: string;
  holeCards: Card[];
  discardedCards: Card[];
  hiHand: HandEvalResult | null;
  loSum: number;
  finalStack: number;
}

export interface WinnerEntry {
  userId: string;
  username: string;
  avatarEmoji: string;
  amount: number;
  type: 'hi' | 'lo' | 'scoop';
  handLabel?: string;
}

export interface HandResult {
  handNumber: number;
  winners: WinnerEntry[];
  hiWinner: WinnerEntry | null;
  loWinner: WinnerEntry | null;
  scoopWinner: WinnerEntry | null;
  playerInfos: PlayerShowdownInfo[];
  potAmount: number;
  winLog: string[];
}
