// Types
export type {
  Suit, Rank, Card, GameMode, BettingMode, DealPhase, ActionType, PlayerStatus,
  HandRank, HandEvalResult, PublicPlayerState, PersonalPlayerState,
  SidePot, Pot, GameState, PersonalGameState, GameAction,
  PlayerShowdownInfo, WinnerEntry, HandResult,
  HAND_RANK_VALUE, HAND_RANK_LABEL,
} from './types/game.js';

export type {
  SignupRequest, LoginRequest, AuthUser, AuthResponse, JWTPayload,
} from './types/auth.js';

export type {
  RoomSettings, SeatOccupant, RoomStatus, Room, RoomSummary,
} from './types/lobby.js';

export type { RankingEntry } from './types/ranking.js';

export type {
  AckFn, ClientToServerEvents, ServerToClientEvents, SocketData,
} from './types/socket.js';

// Re-export non-type values
export { HAND_RANK_VALUE, HAND_RANK_LABEL } from './types/game.js';

// Constants
export {
  SUITS, RANKS, SUIT_SYMBOL, SUIT_IS_RED, RANK_VALUE, RANK_LO_VALUE, RANK_DISPLAY,
  CARDS_PER_PLAYER, MAX_PLAYERS, MIN_PLAYERS,
  TOURNAMENT_SB, TOURNAMENT_BB, STARTING_STACK,
  IDLE_TIMEOUT_MS, RECONNECT_GRACE_MS, NEXT_HAND_DELAY_MS,
  PHASE_DEAL_COUNT, PHASE_LABEL_JP, DEAL_PHASE_SEQUENCE,
} from './constants/game.js';

export { SOCKET_EVENTS } from './constants/socket.js';

// Utils
export { bestHighHand, loSum } from './utils/handEvaluator.js';
