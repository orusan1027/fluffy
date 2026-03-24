import type { PublicPlayerState, PersonalGameState } from '@scarney/shared';
import CardView from './CardView.js';
import { useCountdown } from '../hooks/useCountdown.js';

interface Props {
  player: PublicPlayerState;
  gameState: PersonalGameState;
  myUserId: string;
  isActive: boolean;
  onSit?: (seatIndex: number) => void;
  empty?: false;
}

interface EmptySeatProps {
  seatIndex: number;
  empty: true;
  onSit?: (seatIndex: number) => void;
}

export default function PlayerSeat(props: Props | EmptySeatProps) {
  if (props.empty) {
    return (
      <div className="player-seat player-seat--empty" onClick={() => props.onSit?.(props.seatIndex)}>
        <span className="player-seat__empty-label">空席</span>
      </div>
    );
  }

  const { player, gameState, myUserId, isActive } = props as Props;
  const isMe = player.userId === myUserId;

  const idleDeadline = isActive
    ? gameState.lastActionAt + 30_000
    : 0;

  const { remaining, pct } = useCountdown(idleDeadline, 30);

  const statusLabel: Record<string, string> = {
    active: '',
    folded: 'フォールド',
    all_in: 'オールイン',
    disconnected: '切断中',
    sitting_out: '離席中',
  };

  return (
    <div
      className={[
        'player-seat',
        isActive && 'player-seat--active',
        isMe && 'player-seat--me',
        player.status === 'folded' && 'player-seat--folded',
        player.status === 'all_in' && 'player-seat--allin',
      ].filter(Boolean).join(' ')}
    >
      {/* Timer ring */}
      {isActive && (
        <svg className="player-seat__timer" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="2" />
          <circle
            cx="18" cy="18" r="16"
            fill="none"
            stroke={pct > .3 ? '#f59e0b' : '#ef4444'}
            strokeWidth="2"
            strokeDasharray={`${100 * pct} 100`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            style={{ transition: 'stroke-dasharray .25s linear' }}
          />
        </svg>
      )}

      <span className="player-seat__avatar">{player.avatarEmoji}</span>

      <div className="player-seat__info">
        <div className="player-seat__name">
          {player.username}
          {player.isDealer && <span className="player-seat__badge dealer">D</span>}
          {player.isSB && <span className="player-seat__badge sb">SB</span>}
          {player.isBB && <span className="player-seat__badge bb">BB</span>}
        </div>
        <div className="player-seat__stack">
          ¥{player.stack.toLocaleString()}
        </div>
        {player.betThisRound > 0 && (
          <div className="player-seat__bet animate-chipFly">
            bet: {player.betThisRound.toLocaleString()}
          </div>
        )}
        {statusLabel[player.status] && (
          <div className="player-seat__status">{statusLabel[player.status]}</div>
        )}
        {isActive && (
          <div className="player-seat__countdown">{remaining}s</div>
        )}
      </div>

      {/* Hole cards (face-down if not me) */}
      <div className="player-seat__cards">
        {isMe
          ? gameState.myHoleCards.map((c, i) => (
              <CardView key={c.id} card={c} size="sm" animateDelay={i * 100} />
            ))
          : Array.from({ length: player.holeCardCount }).map((_, i) => (
              <CardView key={i} size="sm" faceDown animateDelay={i * 100} />
            ))
        }
      </div>
    </div>
  );
}
