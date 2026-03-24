export const SOCKET_EVENTS = {
  // Client → Server
  AUTH_LOGIN: 'auth:login',
  LOBBY_LIST: 'lobby:list',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_SEAT: 'room:seat',
  ROOM_UNSEAT: 'room:unseat',
  ROOM_START: 'room:start',
  GAME_ACTION: 'game:action',
  CHAT_MESSAGE: 'chat:message',

  // Server → Client
  GAME_STATE: 'game:state',
  GAME_RESULT: 'game:result',
  LOBBY_UPDATE: 'lobby:update',
  ROOM_UPDATE: 'room:update',
  PLAYER_DISCONNECTED: 'player:disconnected',
  PLAYER_RECONNECTED: 'player:reconnected',
  PLAYER_TIMEOUT: 'player:timeout',
  ERROR: 'error',
} as const;
