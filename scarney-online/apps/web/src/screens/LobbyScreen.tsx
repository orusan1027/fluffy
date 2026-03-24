import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useLobbyStore } from '../store/lobbyStore.js';
import { useSocketEvents } from '../hooks/useSocketEvents.js';
import type { RoomSettings } from '@scarney/shared';

const DEFAULT_SETTINGS: RoomSettings = {
  name: '',
  gameMode: 'tournament',
  bettingMode: 'NL',
  smallBlind: 100,
  bigBlind: 200,
  maxPlayers: 6,
  startingStack: 10000,
  isPrivate: false,
};

export default function LobbyScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { rooms, loading, error, fetchRooms, createRoom, joinRoom } = useLobbyStore();
  const accessToken = useAuthStore(s => s.accessToken);

  const [showCreate, setShowCreate] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useSocketEvents(!!accessToken);

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const room = await createRoom(settings);
      navigate(`/game/${room.id}`);
    } catch (err: unknown) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    try {
      await joinRoom(roomId);
      navigate(`/game/${roomId}`);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const modeLabel = { tournament: 'トーナメント', bomb_pot: 'ボムポット' };
  const bettingLabel = { NL: 'NL', PL: 'PL' };
  const statusLabel = { waiting: '待機中', playing: 'ゲーム中', finished: '終了' };
  const statusColor = { waiting: 'var(--color-green)', playing: 'var(--color-primary)', finished: 'var(--color-muted)' };

  return (
    <div className="screen" style={{ padding: '0 16px 16px' }}>
      {/* Header */}
      <header className="flex items-center justify-between" style={{ padding: '16px 0', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        <h1 className="font-title" style={{ fontSize: 28, color: 'var(--color-primary)', letterSpacing: '.05em' }}>
          SCARNEY LOBBY
        </h1>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 13 }}>
            {user?.avatarEmoji} {user?.username}
            <span className="chip-badge" style={{ marginLeft: 8 }}>¥{user?.chips.toLocaleString()}</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => logout().then(() => navigate('/'))}>
            ログアウト
          </button>
        </div>
      </header>

      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        {/* Room list */}
        <div style={{ flex: 1 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span className="font-label" style={{ fontSize: 13, letterSpacing: '.08em', color: 'var(--color-muted)' }}>
              テーブル一覧 {rooms.length > 0 && `(${rooms.length})`}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={fetchRooms} disabled={loading}>
                {loading ? '更新中...' : '更新'}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                + テーブル作成
              </button>
            </div>
          </div>

          {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}

          {rooms.length === 0 && !loading ? (
            <div className="panel" style={{ textAlign: 'center', color: 'var(--color-muted)', padding: 40 }}>
              テーブルがありません。作成してみましょう！
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rooms.map(r => (
                <div key={r.id} className="panel flex items-center justify-between animate-fadeIn">
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      <span className="chip-badge">{modeLabel[r.gameMode]}</span>
                      <span className="chip-badge">{bettingLabel[r.bettingMode]}</span>
                      <span className="chip-badge">
                        SB {r.smallBlind} / BB {r.bigBlind}
                      </span>
                      <span className="chip-badge">
                        {r.occupiedSeats}/{r.maxPlayers}人
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 12, color: statusColor[r.status], fontFamily: 'var(--font-label)' }}>
                      {statusLabel[r.status]}
                    </span>
                    {r.status === 'waiting' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleJoin(r.id)}>
                        参加
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create room sidebar */}
        {showCreate && (
          <div className="panel animate-slideIn" style={{ width: 300, flexShrink: 0 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <span className="font-label" style={{ letterSpacing: '.1em', fontSize: 13 }}>テーブル作成</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            {createError && <div className="form-error" style={{ marginBottom: 12 }}>{createError}</div>}

            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="form-group">
                <label className="input-label">テーブル名</label>
                <input
                  className="input"
                  required
                  maxLength={30}
                  value={settings.name}
                  onChange={e => setSettings(s => ({ ...s, name: e.target.value }))}
                  placeholder="My Table"
                />
              </div>

              <div className="form-group">
                <label className="input-label">ゲームモード</label>
                <select
                  className="input"
                  value={settings.gameMode}
                  onChange={e => setSettings(s => ({ ...s, gameMode: e.target.value as 'tournament' | 'bomb_pot' }))}
                >
                  <option value="tournament">トーナメント</option>
                  <option value="bomb_pot">ボムポット</option>
                </select>
              </div>

              <div className="form-group">
                <label className="input-label">ベッティング</label>
                <select
                  className="input"
                  value={settings.bettingMode}
                  onChange={e => setSettings(s => ({ ...s, bettingMode: e.target.value as 'NL' | 'PL' }))}
                >
                  <option value="NL">ノーリミット (NL)</option>
                  <option value="PL">ポットリミット (PL)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="input-label">SB</label>
                  <input
                    className="input"
                    type="number"
                    min={10}
                    value={settings.smallBlind}
                    onChange={e => setSettings(s => ({ ...s, smallBlind: Number(e.target.value), bigBlind: Number(e.target.value) * 2 }))}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="input-label">BB</label>
                  <input
                    className="input"
                    type="number"
                    min={20}
                    value={settings.bigBlind}
                    onChange={e => setSettings(s => ({ ...s, bigBlind: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="input-label">最大人数</label>
                  <select
                    className="input"
                    value={settings.maxPlayers}
                    onChange={e => setSettings(s => ({ ...s, maxPlayers: Number(e.target.value) }))}
                  >
                    {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}人</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="input-label">初期スタック</label>
                  <input
                    className="input"
                    type="number"
                    min={100}
                    step={100}
                    value={settings.startingStack}
                    onChange={e => setSettings(s => ({ ...s, startingStack: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2" style={{ fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.isPrivate}
                  onChange={e => setSettings(s => ({ ...s, isPrivate: e.target.checked }))}
                />
                プライベートルーム
              </label>

              <button className="btn btn-primary btn-full" type="submit" disabled={creating}>
                {creating ? '作成中...' : '作成してゲーム開始'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
