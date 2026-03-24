/**
 * Manages all active GameRoom instances.
 */
import type { AppIO } from './socketServer.js';
import { GameRoom } from '../game/GameRoom.js';
import { RoomStore } from '../game/RoomStore.js';

export class GameRoomManager {
  private gameRooms = new Map<string, GameRoom>();
  private io: AppIO | null = null;

  setIO(io: AppIO): void {
    this.io = io;
  }

  getOrCreate(roomId: string): GameRoom | null {
    if (!this.io) return null;
    const room = RoomStore.get(roomId);
    if (!room) return null;
    if (!this.gameRooms.has(roomId)) {
      this.gameRooms.set(roomId, new GameRoom(this.io, room));
    }
    return this.gameRooms.get(roomId)!;
  }

  get(roomId: string): GameRoom | undefined {
    return this.gameRooms.get(roomId);
  }

  async startGame(roomId: string): Promise<boolean> {
    if (!this.io) return false;
    const room = RoomStore.get(roomId);
    if (!room) return false;

    // Fill empty seats with bots if < 2 humans
    const humanSeats = room.seats.filter(s => s && !s.isBot);
    if (humanSeats.length < 1) return false;

    // Fill remaining seats with bots
    RoomStore.fillWithBots(roomId);
    RoomStore.setStatus(roomId, 'playing');

    const gameRoom = new GameRoom(this.io, room);
    this.gameRooms.set(roomId, gameRoom);
    await gameRoom.startGame();
    return true;
  }

  registerSocket(roomId: string, userId: string, socketId: string): void {
    this.gameRooms.get(roomId)?.registerSocket(userId, socketId);
  }

  handleReconnect(roomId: string, userId: string, socketId: string): void {
    const gameRoom = this.gameRooms.get(roomId);
    if (gameRoom?.isActive()) {
      gameRoom.handleReconnect(userId, socketId);
    }
  }

  handleDisconnect(roomId: string, userId: string): void {
    this.gameRooms.get(roomId)?.handleDisconnect(userId);
  }

  destroyRoom(roomId: string): void {
    this.gameRooms.get(roomId)?.destroy();
    this.gameRooms.delete(roomId);
  }
}
