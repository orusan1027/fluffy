import type { PersonalGameState, HandResult, GameAction } from './game.js';
import type { Room, RoomSummary, RoomSettings } from './lobby.js';
import type { RankingEntry } from './ranking.js';

// ─── Ack helper ──────────────────────────────────────────────────────────────

export type AckFn<T = void> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

// ─── Client → Server events ──────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Re-authenticate over socket (on reconnect) */
  'auth:login': (payload: { token: string }, cb: AckFn<{ userId: string }>) => void;

  /** List rooms in the lobby */
  'lobby:list': (cb: AckFn<RoomSummary[]>) => void;

  /** Create a new room */
  'room:create': (settings: RoomSettings, cb: AckFn<Room>) => void;

  /** Join a room (spectate / ready to sit) */
  'room:join': (roomId: string, cb: AckFn<Room>) => void;

  /** Leave a room */
  'room:leave': (roomId: string) => void;

  /** Sit in a seat */
  'room:seat': (payload: { roomId: string; seatIndex: number }, cb: AckFn<Room>) => void;

  /** Stand up from a seat */
  'room:unseat': (roomId: string, cb: AckFn<Room>) => void;

  /** Start the game (room creator only, or auto-filled with bots) */
  'room:start': (roomId: string, cb: AckFn<void>) => void;

  /** Send a game action */
  'game:action': (payload: { roomId: string; action: GameAction }, cb: AckFn<void>) => void;

  /** Chat message in room */
  'chat:message': (payload: { roomId: string; text: string }) => void;
}

// ─── Server → Client events ──────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** Full game state (personal view, includes own hole cards) */
  'game:state': (state: PersonalGameState) => void;

  /** Hand result after showdown */
  'game:result': (result: HandResult) => void;

  /** Lobby room list updated */
  'lobby:update': (rooms: RoomSummary[]) => void;

  /** Single room updated */
  'room:update': (room: Room) => void;

  /** Player disconnected */
  'player:disconnected': (userId: string) => void;

  /** Player reconnected */
  'player:reconnected': (userId: string) => void;

  /** Player idle-timed out (auto-folded) */
  'player:timeout': (userId: string) => void;

  /** Chat message received */
  'chat:message': (payload: { userId: string; username: string; text: string; at: number }) => void;

  /** Server error */
  'error': (message: string) => void;
}

// ─── Rankings ────────────────────────────────────────────────────────────────

export interface ServerToClientRankingEvents {
  'ranking:update': (entries: RankingEntry[]) => void;
}

// ─── Socket data (attached to each socket) ───────────────────────────────────

export interface SocketData {
  userId: string;
  username: string;
  activeRoomId?: string;
}
