import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';
import { useGameStore } from '../store/gameStore.js';
import { useLobbyStore } from '../store/lobbyStore.js';
import { useChatStore } from '../store/chatStore.js';

/**
 * Registers global socket event listeners.
 * Mount once at the App level when the socket is ready.
 */
export function useSocketEvents(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const socket = getSocket();
    if (!socket) return;

    const { applyGameState, applyResult } = useGameStore.getState();
    const { applyRoomsUpdate, applyRoomUpdate } = useLobbyStore.getState();
    const { addMessage } = useChatStore.getState();

    socket.on('game:state', applyGameState);
    socket.on('game:result', applyResult);
    socket.on('lobby:update', applyRoomsUpdate);
    socket.on('room:update', applyRoomUpdate);
    socket.on('chat:message', (payload) => addMessage(payload));

    return () => {
      socket.off('game:state', applyGameState);
      socket.off('game:result', applyResult);
      socket.off('lobby:update', applyRoomsUpdate);
      socket.off('room:update', applyRoomUpdate);
      socket.off('chat:message');
    };
  }, [active]);
}
