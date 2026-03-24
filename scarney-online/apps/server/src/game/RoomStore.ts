/**
 * In-memory room store. In production, replace with Redis for horizontal scaling.
 */
import type { RoomSummary } from '@scarney/shared';
import { STARTING_STACK } from '@scarney/shared';
import { v4 as uuidv4 } from 'uuid';
import { BOT_PROFILES } from './BotPlayer.js';

export interface RoomSeat {
  userId: string;
  username: string;
  avatarEmoji: string;
  stack: number;
  isBot: boolean;
}

export interface RoomSettings {
  name: string;
  gameMode: 'tournament' | 'bomb_pot';
  bettingMode: 'NL' | 'PL';
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  startingStack: number;
  isPrivate: boolean;
  password?: string;
}

export interface Room {
  id: string;
  settings: RoomSettings;
  seats: (RoomSeat | null)[];
  status: 'waiting' | 'playing' | 'finished';
  createdBy: string;
  createdAt: number;
  memberIds: Set<string>;
}

class RoomStoreClass {
  private rooms = new Map<string, Room>();

  create(createdBy: string, settings: RoomSettings): Room {
    const id = uuidv4();
    const room: Room = {
      id,
      settings,
      seats: Array(settings.maxPlayers).fill(null),
      status: 'waiting',
      createdBy,
      createdAt: Date.now(),
      memberIds: new Set([createdBy]),
    };
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  list(): Room[] {
    return Array.from(this.rooms.values()).filter(r => r.status !== 'finished');
  }

  listSummaries(): RoomSummary[] {
    return this.list().map(r => ({
      id: r.id,
      name: r.settings.name,
      gameMode: r.settings.gameMode,
      bettingMode: r.settings.bettingMode,
      smallBlind: r.settings.smallBlind,
      bigBlind: r.settings.bigBlind,
      occupiedSeats: r.seats.filter(Boolean).length,
      maxPlayers: r.settings.maxPlayers,
      status: r.status,
    }));
  }

  join(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.memberIds.add(userId);
    return room;
  }

  leave(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.memberIds.delete(userId);
    // Remove from seat
    for (let i = 0; i < room.seats.length; i++) {
      if (room.seats[i]?.userId === userId) room.seats[i] = null;
    }
    // Clean up empty finished rooms
    if (room.memberIds.size === 0 && room.status === 'waiting') {
      this.rooms.delete(roomId);
      return null;
    }
    return room;
  }

  seat(roomId: string, userId: string, username: string, avatarEmoji: string, seatIndex: number, stack: number): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (seatIndex < 0 || seatIndex >= room.seats.length) return null;
    if (room.seats[seatIndex] !== null) return null;
    // Remove from any existing seat
    for (let i = 0; i < room.seats.length; i++) {
      if (room.seats[i]?.userId === userId) room.seats[i] = null;
    }
    room.seats[seatIndex] = { userId, username, avatarEmoji, stack, isBot: false };
    return room;
  }

  unseat(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    for (let i = 0; i < room.seats.length; i++) {
      if (room.seats[i]?.userId === userId) { room.seats[i] = null; break; }
    }
    return room;
  }

  fillWithBots(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const usedNames = new Set(room.seats.filter(Boolean).map(s => s!.username));
    const available = BOT_PROFILES.filter(b => !usedNames.has(b.username));
    let botIdx = 0;
    for (let i = 0; i < room.seats.length; i++) {
      if (!room.seats[i] && botIdx < available.length) {
        const bot = available[botIdx++];
        const botId = `bot_${bot.username.toLowerCase()}_${Date.now()}`;
        room.seats[i] = { userId: botId, username: bot.username, avatarEmoji: bot.avatarEmoji, stack: room.settings.startingStack, isBot: true };
      }
    }
    return room;
  }

  setStatus(roomId: string, status: Room['status']): void {
    const room = this.rooms.get(roomId);
    if (room) room.status = status;
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }

  toRoomObject(room: Room) {
    return {
      id: room.id,
      settings: room.settings,
      seats: room.seats.map(s => s ? { userId: s.userId, username: s.username, avatarEmoji: s.avatarEmoji, stack: s.stack, isBot: s.isBot } : null),
      status: room.status,
      createdBy: room.createdBy,
      createdAt: room.createdAt,
    };
  }
}

export const RoomStore = new RoomStoreClass();
