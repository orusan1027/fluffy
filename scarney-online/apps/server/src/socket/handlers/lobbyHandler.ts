import type { Socket } from 'socket.io';
import type { AppIO } from '../socketServer.js';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@scarney/shared';
import { RoomStore } from '../../game/RoomStore.js';
import type { GameRoomManager } from '../GameRoomManager.js';
import { prisma } from '../../db/prisma.js';
import { STARTING_STACK } from '@scarney/shared';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

function broadcastLobbyUpdate(io: AppIO): void {
  io.emit('lobby:update', RoomStore.listSummaries());
}

export function registerLobbyHandlers(io: AppIO, socket: AppSocket, _manager: GameRoomManager): void {
  const { userId, username } = socket.data;

  // ─── lobby:list ──────────────────────────────────────────────────────────
  socket.on('lobby:list', (cb) => {
    cb({ ok: true, data: RoomStore.listSummaries() });
  });

  // ─── room:create ─────────────────────────────────────────────────────────
  socket.on('room:create', (settings, cb) => {
    try {
      const room = RoomStore.create(userId, {
        name: settings.name?.trim() || `${username}のテーブル`,
        gameMode: settings.gameMode ?? 'tournament',
        bettingMode: settings.bettingMode ?? 'NL',
        smallBlind: settings.smallBlind ?? 100,
        bigBlind: settings.bigBlind ?? 200,
        maxPlayers: Math.min(6, Math.max(2, settings.maxPlayers ?? 6)),
        startingStack: settings.startingStack ?? STARTING_STACK,
        isPrivate: settings.isPrivate ?? false,
        password: settings.password,
      });
      socket.join(room.id);
      socket.data.activeRoomId = room.id;
      broadcastLobbyUpdate(io);
      cb({ ok: true, data: RoomStore.toRoomObject(room) as any });
    } catch (e) {
      cb({ ok: false, error: 'ルーム作成に失敗しました' });
    }
  });

  // ─── room:join ───────────────────────────────────────────────────────────
  socket.on('room:join', (roomId, cb) => {
    const room = RoomStore.join(roomId, userId);
    if (!room) { cb({ ok: false, error: 'ルームが見つかりません' }); return; }
    socket.join(roomId);
    socket.data.activeRoomId = roomId;
    io.to(roomId).emit('room:update', RoomStore.toRoomObject(room) as any);
    cb({ ok: true, data: RoomStore.toRoomObject(room) as any });
  });

  // ─── room:leave ──────────────────────────────────────────────────────────
  socket.on('room:leave', (roomId) => {
    RoomStore.leave(roomId, userId);
    socket.leave(roomId);
    socket.data.activeRoomId = undefined;
    const room = RoomStore.get(roomId);
    if (room) io.to(roomId).emit('room:update', RoomStore.toRoomObject(room) as any);
    broadcastLobbyUpdate(io);
  });

  // ─── room:seat ───────────────────────────────────────────────────────────
  socket.on('room:seat', async (payload, cb) => {
    const { roomId, seatIndex } = payload;
    // Get user's current chip count from DB
    let userChips = STARTING_STACK;
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) userChips = Math.max(user.chips, 100);
    } catch {}

    const avatarEmoji = '♠'; // TODO: from user profile
    const room = RoomStore.seat(roomId, userId, username, avatarEmoji, seatIndex, userChips);
    if (!room) { cb({ ok: false, error: '着席に失敗しました（席が埋まっているか無効です）' }); return; }
    io.to(roomId).emit('room:update', RoomStore.toRoomObject(room) as any);
    broadcastLobbyUpdate(io);
    cb({ ok: true, data: RoomStore.toRoomObject(room) as any });
  });

  // ─── room:unseat ─────────────────────────────────────────────────────────
  socket.on('room:unseat', (roomId, cb) => {
    const room = RoomStore.unseat(roomId, userId);
    if (!room) { cb({ ok: false, error: 'ルームが見つかりません' }); return; }
    io.to(roomId).emit('room:update', RoomStore.toRoomObject(room) as any);
    broadcastLobbyUpdate(io);
    cb({ ok: true, data: RoomStore.toRoomObject(room) as any });
  });
}
