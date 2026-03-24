import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useLobbyStore } from '../store/lobbyStore.js';
import { useGameStore } from '../store/gameStore.js';
import { useChatStore } from '../store/chatStore.js';
import { useSocketEvents } from '../hooks/useSocketEvents.js';
import CardView from '../components/CardView.js';
import PlayerSeat from '../components/PlayerSeat.js';
import ActionPanel from '../components/ActionPanel.js';
import ChatBox from '../components/ChatBox.js';
import ResultModal from '../components/ResultModal.js';
import type { ActionType } from '@scarney/shared';

export default function GameScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const { currentRoom, joinRoom, leaveRoom, takeSeat, leaveSeat, startGame } = useLobbyStore();
  const { gameState, lastResult, showResult, dismissResult, sendAction, reset } = useGameStore();
  const { clear: clearChat } = useChatStore();

  useSocketEvents(!!accessToken);

  // Join room on mount
  useEffect(() => {
    if (!roomId) return;
    if (!currentRoom || currentRoom.id !== roomId) {
      joinRoom(roomId).catch(() => navigate('/lobby'));
    }
    return () => {
      if (roomId) leaveRoom(roomId);
      reset();
      clearChat();
    };
  }, [roomId]);

  if (!roomId) return null;

  const myUserId = user?.id ?? '';
  const room = currentRoom;

  const iAmSeated = room?.seats.some(s => s?.userId === myUserId) ?? false;
  const mySeatIndex = room?.seats.findIndex(s => s?.userId === myUserId) ?? -1;

  const isMyTurn =
    gameState !== null &&
    gameState.activePlayerIndex >= 0 &&
    gameState.players[gameState.activePlayerIndex]?.userId === myUserId;

  const handleAction = (type: ActionType, amount?: number) => {
    if (!roomId) return;
    sendAction(roomId, type, amount);
  };

  const handleSit = async (seatIndex: number) => {
    if (!roomId) return;
    await takeSeat(roomId, seatIndex).catch(err => alert(err.message));
  };

  const handleUnseat = async () => {
    if (!roomId) return;
    await leaveSeat(roomId).catch(err => alert(err.message));
  };

  const handleStart = async () => {
    if (!roomId) return;
    await startGame(roomId).catch(err => alert(err.message));
  };

  const phaseLabel: Record<string, string> = {
    waiting: '待機中',
    preflop: 'プリフロップ',
    flop_deal: 'フロップ配布中',
    flop: 'フロップ',
    turn_deal: 'ターン配布中',
    turn: 'ターン',
    river_deal: 'リバー配布中',
    river: 'リバー',
    showdown: 'ショーダウン',
  };

  return (
    <div className="screen" style={{ background: 'radial-gradient(ellipse at 50% 50%, #143d28 0%, var(--color-bg) 80%)' }}>
      {/* Header bar */}
      <header className="flex items-center justify-between" style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'rgba(0,0,0,.5)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/lobby')}>
          ← ロビー
        </button>
        <div className="flex items-center gap-3">
          {room && (
            <span className="font-label" style={{ fontSize: 13, letterSpacing: '.1em', color: 'var(--color-muted)' }}>
              {room.settings.name}
            </span>
          )}
          {gameState && (
            <>
              <span className="chip-badge">{phaseLabel[gameState.phase] ?? gameState.phase}</span>
              <span className="chip-badge">
                POT: {gameState.pot.total.toLocaleString()}
              </span>
              <span className="chip-badge">
                Hand #{gameState.handNumber}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user && <span style={{ fontSize: 13 }}>{user.avatarEmoji} {user.username}</span>}
          {room?.status === 'waiting' && iAmSeated && room.createdBy === myUserId && (
            <button className="btn btn-primary btn-sm" onClick={handleStart}>
              ゲーム開始
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 57px)' }}>
        {/* Main table area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Seats + table */}
          <div style={{ flex: 1, position: 'relative', padding: '16px', overflowY: 'auto' }}>

            {/* Felt table */}
            <div style={{
              background: 'radial-gradient(ellipse at 50% 50%, var(--color-felt) 40%, var(--color-felt2) 100%)',
              border: '3px solid #2d6a4f',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              minHeight: 320,
              position: 'relative',
            }}>
              {/* Community cards (top board) */}
              {gameState && gameState.topBoard.length > 0 && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font-label)', letterSpacing: '.1em', marginBottom: 8 }}>
                    TOP BOARD
                  </div>
                  <div className="flex justify-center gap-2" style={{ flexWrap: 'wrap' }}>
                    {gameState.topBoard.map((c, i) => (
                      <CardView key={c.id} card={c} size="lg" animateDelay={i * 100} />
                    ))}
                    {Array.from({ length: 5 - gameState.topBoard.length }).map((_, i) => (
                      <div key={`empty-${i}`} style={{
                        width: 54, height: 78, borderRadius: 4,
                        border: '1.5px dashed rgba(255,255,255,.2)',
                      }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom board */}
              {gameState && gameState.bottomBoard.length > 0 && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font-label)', letterSpacing: '.1em', marginBottom: 6 }}>
                    BOTTOM BOARD (捨て牌)
                  </div>
                  <div className="flex justify-center gap-1" style={{ flexWrap: 'wrap' }}>
                    {gameState.bottomBoard.map((c) => (
                      <CardView key={c.id} card={c} size="sm" />
                    ))}
                  </div>
                </div>
              )}

              {/* Pot display */}
              {gameState && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <span className="chip-badge" style={{ fontSize: 14 }}>
                    🪙 POT: {gameState.pot.total.toLocaleString()}
                  </span>
                  {gameState.pot.sides.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {gameState.pot.sides.map((sp, i) => (
                        <span key={i} className="chip-badge" style={{ fontSize: 11 }}>
                          サイドポット{i + 1}: {sp.amount.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Waiting state */}
              {(!gameState || gameState.phase === 'waiting') && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', padding: '20px 0' }}>
                  {room?.status === 'waiting' ? (
                    <div>
                      <div style={{ fontSize: 18, fontFamily: 'var(--font-label)', letterSpacing: '.1em', marginBottom: 8 }}>
                        プレイヤーを待っています...
                      </div>
                      {!iAmSeated && (
                        <p style={{ fontSize: 13, marginBottom: 12 }}>席を選んで参加してください</p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Seats grid */}
            {room && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(room.settings.maxPlayers, 3)}, 1fr)`,
                gap: 12,
                marginTop: 16,
              }}>
                {Array.from({ length: room.settings.maxPlayers }).map((_, seatIdx) => {
                  const occupant = room.seats[seatIdx];
                  const player = gameState?.players.find(p => p.seatIndex === seatIdx);
                  const isActive =
                    gameState !== null &&
                    gameState.activePlayerIndex >= 0 &&
                    gameState.players[gameState.activePlayerIndex]?.seatIndex === seatIdx;

                  if (!occupant) {
                    return (
                      <PlayerSeat
                        key={seatIdx}
                        empty={true}
                        seatIndex={seatIdx}
                        onSit={!iAmSeated ? handleSit : undefined}
                      />
                    );
                  }

                  if (!player) {
                    return (
                      <div key={seatIdx} className="panel" style={{ textAlign: 'center', opacity: .7 }}>
                        {occupant.avatarEmoji} {occupant.username}
                        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                          ¥{occupant.stack.toLocaleString()}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <PlayerSeat
                      key={seatIdx}
                      player={player}
                      gameState={gameState!}
                      myUserId={myUserId}
                      isActive={isActive}
                    />
                  );
                })}
              </div>
            )}

            {/* Unseat button */}
            {iAmSeated && (!gameState || gameState.phase === 'waiting') && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={handleUnseat}>
                  席を立つ
                </button>
              </div>
            )}
          </div>

          {/* Action panel */}
          {isMyTurn && gameState && (
            <div style={{
              borderTop: '1px solid var(--color-border)',
              padding: '16px',
              background: 'rgba(0,0,0,.4)',
              backdropFilter: 'blur(8px)',
            }}>
              <ActionPanel gameState={gameState} onAction={handleAction} />
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div style={{
          width: 260,
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(0,0,0,.3)',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '.1em', color: 'var(--color-muted)' }}>
            CHAT
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ChatBox roomId={roomId} />
          </div>
        </div>
      </div>

      {/* Result modal */}
      {showResult && lastResult && (
        <ResultModal result={lastResult} onClose={dismissResult} />
      )}

      {/* Component styles */}
      <style>{`
        .player-seat {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
          position: relative;
          transition: border-color .2s;
          min-height: 110px;
        }
        .player-seat--active {
          border-color: var(--color-primary);
          box-shadow: 0 0 12px rgba(245,158,11,.3);
        }
        .player-seat--me {
          border-color: var(--color-blue);
        }
        .player-seat--folded { opacity: .5; }
        .player-seat--allin { border-color: var(--color-red); }
        .player-seat--empty {
          border-style: dashed;
          cursor: pointer;
          justify-content: center;
          color: var(--color-muted);
          font-size: 12px;
          opacity: .6;
          transition: opacity .15s;
        }
        .player-seat--empty:hover { opacity: 1; }
        .player-seat__avatar { font-size: 28px; line-height: 1; }
        .player-seat__name { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: center; }
        .player-seat__stack { font-size: 12px; color: var(--color-muted); }
        .player-seat__bet { font-size: 11px; color: var(--color-primary); }
        .player-seat__status { font-size: 11px; color: var(--color-muted); background: rgba(255,255,255,.07); padding: 1px 6px; border-radius: 4px; }
        .player-seat__countdown { font-size: 11px; color: var(--color-primary); font-family: var(--font-label); }
        .player-seat__cards { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
        .player-seat__badge { font-size: 10px; padding: 1px 5px; border-radius: 3px; font-family: var(--font-label); }
        .player-seat__badge.dealer { background: var(--color-primary); color: #000; }
        .player-seat__badge.sb { background: var(--color-blue); color: #fff; }
        .player-seat__badge.bb { background: var(--color-green); color: #000; }
        .player-seat__timer { position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; }

        .action-panel { display: flex; flex-direction: column; gap: 10px; }
        .action-panel__buttons { display: flex; gap: 8px; flex-wrap: wrap; }
        .action-panel__raise { display: flex; flex-direction: column; gap: 8px; }
        .action-panel__raise-row { display: flex; align-items: center; justify-content: space-between; }
        .action-panel__raise-presets { display: flex; gap: 4px; }
        .action-panel__slider { width: 100%; accent-color: var(--color-primary); }
        .action-panel__raise-actions { display: flex; gap: 8px; justify-content: flex-end; }

        .chat-box { display: flex; flex-direction: column; height: 100%; }
        .chat-box__messages { flex: 1; overflow-y: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
        .chat-message { font-size: 12px; }
        .chat-message__user { font-weight: 600; color: var(--color-primary); margin-right: 4px; }
        .chat-message__text { color: var(--color-text); word-break: break-word; }
        .chat-box__form { display: flex; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--color-border); }
        .chat-box__form .input { flex: 1; padding: 6px 10px; font-size: 12px; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; max-width: 480px; width: 100%; max-height: 80vh; overflow-y: auto; }
        .modal__title { font-size: 22px; color: var(--color-primary); margin-bottom: 16px; }
        .result-modal__winners { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .result-winner { display: flex; gap: 12px; align-items: center; padding: 10px; background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); border-radius: var(--radius-md); }
        .result-winner__avatar { font-size: 28px; }
        .result-winner__name { font-weight: 600; font-size: 14px; }
        .result-winner__amount { font-size: 18px; font-family: var(--font-label); }
        .result-winner__hand { font-size: 12px; }
        .result-winner__type { font-size: 11px; color: var(--color-muted); }
        .result-modal__players { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
        .result-player { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; padding: 6px; background: var(--color-surface2); border-radius: var(--radius-sm); }
        .result-player__cards { display: flex; gap: 3px; }
        .result-modal__log { background: var(--color-surface2); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
      `}</style>
    </div>
  );
}
