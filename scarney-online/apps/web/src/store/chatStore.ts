import { create } from 'zustand';
import { getSocket } from '../lib/socket.js';

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  at: number;
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void;
  sendMessage: (roomId: string, text: string) => void;
  clear: () => void;
}

let msgCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],

  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages.slice(-99),
        { ...msg, id: String(++msgCounter) },
      ],
    })),

  sendMessage: (roomId, text) => {
    const socket = getSocket();
    if (socket && text.trim()) {
      socket.emit('chat:message', { roomId, text: text.trim() });
    }
  },

  clear: () => set({ messages: [] }),
}));
