import { create } from 'zustand';
import { getSocket, emitAck } from '../lib/socket.js';
import type { Room, RoomSettings, RoomSummary } from '@scarney/shared';

interface LobbyState {
  rooms: RoomSummary[];
  currentRoom: Room | null;
  loading: boolean;
  error: string | null;

  fetchRooms: () => Promise<void>;
  createRoom: (settings: RoomSettings) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<Room>;
  leaveRoom: (roomId: string) => void;
  takeSeat: (roomId: string, seatIndex: number) => Promise<Room>;
  leaveSeat: (roomId: string) => Promise<Room>;
  startGame: (roomId: string) => Promise<void>;
  setCurrentRoom: (room: Room | null) => void;
  applyRoomsUpdate: (rooms: RoomSummary[]) => void;
  applyRoomUpdate: (room: Room) => void;
  clearError: () => void;
}

export const useLobbyStore = create<LobbyState>((set) => ({
  rooms: [],
  currentRoom: null,
  loading: false,
  error: null,

  fetchRooms: async () => {
    set({ loading: true, error: null });
    try {
      const rooms = await emitAck<RoomSummary[]>('lobby:list');
      set({ rooms, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createRoom: async (settings) => {
    const room = await emitAck<Room>('room:create', settings);
    set({ currentRoom: room });
    return room;
  },

  joinRoom: async (roomId) => {
    const room = await emitAck<Room>('room:join', roomId);
    set({ currentRoom: room });
    return room;
  },

  leaveRoom: (roomId) => {
    const socket = getSocket();
    if (socket) socket.emit('room:leave', roomId);
    set({ currentRoom: null });
  },

  takeSeat: async (roomId, seatIndex) => {
    const room = await emitAck<Room>('room:seat', { roomId, seatIndex });
    set({ currentRoom: room });
    return room;
  },

  leaveSeat: async (roomId) => {
    const room = await emitAck<Room>('room:unseat', roomId);
    set({ currentRoom: room });
    return room;
  },

  startGame: async (roomId) => {
    await emitAck<void>('room:start', roomId);
  },

  setCurrentRoom: (room) => set({ currentRoom: room }),

  applyRoomsUpdate: (rooms) => set({ rooms }),

  applyRoomUpdate: (room) =>
    set((s) => ({
      currentRoom: s.currentRoom?.id === room.id ? room : s.currentRoom,
    })),

  clearError: () => set({ error: null }),
}));
