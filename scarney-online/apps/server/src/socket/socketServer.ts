import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, JWTPayload } from '@scarney/shared';
import { config } from '../config.js';
import { registerLobbyHandlers } from './handlers/lobbyHandler.js';
import { registerGameHandlers } from './handlers/gameHandler.js';
import { GameRoomManager } from './GameRoomManager.js';

export type AppIO = SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export let io: AppIO;
export const gameRoomManager = new GameRoomManager();

export function createSocketServer(httpServer: HttpServer): AppIO {
  io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ─── JWT auth middleware ─────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('unauthorized'));
      return;
    }
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  // ─── Connection handler ──────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId, username } = socket.data;
    console.log(`[Socket] connected: ${username} (${userId}) — ${socket.id}`);

    // Re-auth over socket (for reconnection)
    socket.on('auth:login', (payload, cb) => {
      try {
        const decoded = jwt.verify(payload.token, config.JWT_ACCESS_SECRET) as JWTPayload;
        socket.data.userId = decoded.userId;
        socket.data.username = decoded.username;

        // Rejoin active room if any
        const activeRoomId = socket.data.activeRoomId;
        if (activeRoomId) {
          socket.join(activeRoomId);
          gameRoomManager.handleReconnect(activeRoomId, decoded.userId, socket.id);
        }

        cb({ ok: true, data: { userId: decoded.userId } });
      } catch {
        cb({ ok: false, error: 'トークンが無効です' });
      }
    });

    // Register feature handlers
    registerLobbyHandlers(io, socket, gameRoomManager);
    registerGameHandlers(io, socket, gameRoomManager);

    // Disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] disconnected: ${username} (${userId}) — reason: ${reason}`);
      const roomId = socket.data.activeRoomId;
      if (roomId) {
        gameRoomManager.handleDisconnect(roomId, userId);
      }
    });
  });

  return io;
}
