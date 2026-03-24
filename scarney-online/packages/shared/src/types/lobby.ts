import type { GameMode, BettingMode } from './game.js';

export interface RoomSettings {
  name: string;
  gameMode: GameMode;
  bettingMode: BettingMode;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;      // 2–6
  startingStack: number;
  isPrivate: boolean;
  password?: string;
}

export interface SeatOccupant {
  userId: string;
  username: string;
  avatarEmoji: string;
  stack: number;
  isBot: boolean;
}

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  settings: RoomSettings;
  seats: (SeatOccupant | null)[];
  status: RoomStatus;
  createdBy: string;
  createdAt: number;
}

export interface RoomSummary {
  id: string;
  name: string;
  gameMode: GameMode;
  bettingMode: BettingMode;
  smallBlind: number;
  bigBlind: number;
  occupiedSeats: number;
  maxPlayers: number;
  status: RoomStatus;
}
