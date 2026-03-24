import type { Socket } from 'socket.io';
import type { AppIO } from '../socketServer.js';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@scarney/shared';
import { RoomStore } from '../../game/RoomStore.js';
import type { GameRoomManager } from '../GameRoomManager.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerGameHandlers(io: AppIO, socket: AppSocket, manager: GameRoomManager): void {
  const { userId } = socket.data;

  // ─── room:start ──────────────────────────────────────────────────────────
  socket.on('room:start', async (roomId, cb) => {
    const room = RoomStore.get(roomId);
    if (!room) { cb({ ok: false, error: 'ルームが見つかりません' }); return; }
    if (room.createdBy !== userId) { cb({ ok: false, error: 'ルームオーナーのみ開始できます' }); return; }
    if (room.status === 'playing') { cb({ ok: false, error: 'すでにゲーム中です' }); return; }

    const seatedCount = room.seats.filter(Boolean).length;
    if (seatedCount < 2) { cb({ ok: false, error: '2人以上着席が必要です' }); return; }

    manager.setIO(io);
    const started = await manager.startGame(roomId);
    if (!started) { cb({ ok: false, error: 'ゲーム開始に失敗しました' }); return; }

    // Register socket for all seated human players
    for (const seat of room.seats) {
      if (seat && !seat.isBot) {
        // We don't have socketId for other players here; they'll register on next broadcast
      }
    }
    manager.registerSocket(roomId, userId, socket.id);

    io.to(roomId).emit('room:update', RoomStore.toRoomObject(room) as any);
    cb({ ok: true, data: undefined });
  });

  // ─── game:action ─────────────────────────────────────────────────────────
  socket.on('game:action', async (payload, cb) => {
    const { roomId, action } = payload;
    const gameRoom = manager.get(roomId);
    if (!gameRoom) { cb({ ok: false, error: 'ゲームルームが見つかりません' }); return; }

    manager.registerSocket(roomId, userId, socket.id);
    const result = await gameRoom.handleAction(userId, action);
    if (!result.ok) { cb({ ok: false, error: result.error ?? 'アクション失敗' }); return; }
    cb({ ok: true, data: undefined });
  });

  // ─── chat:message ────────────────────────────────────────────────────────
  socket.on('chat:message', (payload) => {
    const { roomId, text } = payload;
    if (!text?.trim()) return;
    io.to(roomId).emit('chat:message', {
      userId,
      username: socket.data.username,
      text: text.trim().slice(0, 200),
      at: Date.now(),
    });
  });
}
