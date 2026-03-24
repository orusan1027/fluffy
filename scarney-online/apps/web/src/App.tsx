import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { initSocket, disconnectSocket } from './lib/socket.js';
import TitleScreen from './screens/TitleScreen.js';
import AuthScreen from './screens/AuthScreen.js';
import LobbyScreen from './screens/LobbyScreen.js';
import GameScreen from './screens/GameScreen.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.accessToken);
  if (!token) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  const { accessToken, refreshSession, logout } = useAuthStore();
  const navigate = useNavigate();

  // On mount: try to restore session via refresh token cookie
  useEffect(() => {
    refreshSession().catch(() => {});
  }, []);

  // Initialize/reinitialize socket when token changes
  useEffect(() => {
    if (accessToken) {
      initSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => {};
  }, [accessToken]);

  return (
    <Routes>
      <Route path="/" element={<TitleScreen />} />
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/lobby" element={<RequireAuth><LobbyScreen /></RequireAuth>} />
      <Route path="/game/:roomId" element={<RequireAuth><GameScreen /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
