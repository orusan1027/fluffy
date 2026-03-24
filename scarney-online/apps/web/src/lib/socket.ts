import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@scarney/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket | null {
  return socket;
}

export function initSocket(token: string): AppSocket {
  if (socket?.connected) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
  }

  const url = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
  socket = io(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  }) as AppSocket;

  socket.on('connect', () => {
    console.log('[socket] connected', socket?.id);
  });
  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected', reason);
  });
  socket.on('connect_error', (err) => {
    console.error('[socket] connect_error', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Helper: emit with acknowledgement, returns a Promise */
export function emitAck<T>(
  event: string,
  ...args: unknown[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket not connected'));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(event, ...args, (res: { ok: boolean; data?: T; error?: string }) => {
      if (res.ok) {
        resolve(res.data as T);
      } else {
        reject(new Error(res.error ?? 'Unknown error'));
      }
    });
  });
}
