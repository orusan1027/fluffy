import { useState } from 'react';
import type { PersonalGameState, ActionType } from '@scarney/shared';

interface Props {
  gameState: PersonalGameState;
  onAction: (type: ActionType, amount?: number) => void;
}

export default function ActionPanel({ gameState, onAction }: Props) {
  const [raiseAmount, setRaiseAmount] = useState<number>(0);

  const myState = gameState.players.find(p => p.userId === gameState.myUserId);
  if (!myState) return null;

  const { currentBet, minRaise, bigBlind } = gameState;
  const myBet = myState.betThisRound;
  const myStack = myState.stack;
  const callAmount = Math.min(currentBet - myBet, myStack);
  const canCheck = currentBet === myBet;
  const canCall = !canCheck && callAmount > 0;
  const canBet = currentBet === 0 && myStack > 0;
  const canRaise = currentBet > 0 && myStack > callAmount;

  const minBet = bigBlind;
  const minR = minRaise;
  const maxBet = myStack;

  const initRaise = () => {
    const def = canBet ? minBet : minR;
    setRaiseAmount(Math.min(def, maxBet));
  };

  return (
    <div className="action-panel">
      <div className="action-panel__buttons">
        {/* Fold */}
        <button
          className="btn btn-danger"
          onClick={() => onAction('fold')}
        >
          フォールド
        </button>

        {/* Check / Call */}
        {canCheck ? (
          <button className="btn btn-secondary" onClick={() => onAction('check')}>
            チェック
          </button>
        ) : canCall ? (
          <button className="btn btn-primary" onClick={() => onAction('call')}>
            コール {callAmount.toLocaleString()}
          </button>
        ) : null}

        {/* All-in */}
        <button
          className="btn btn-secondary"
          onClick={() => onAction('all_in')}
        >
          オールイン {myStack.toLocaleString()}
        </button>

        {/* Bet / Raise */}
        {(canBet || canRaise) && (
          <button
            className="btn btn-primary"
            onClick={() => {
              initRaise();
            }}
          >
            {canBet ? 'ベット' : 'レイズ'}
          </button>
        )}
      </div>

      {/* Raise slider */}
      {raiseAmount > 0 && (
        <div className="action-panel__raise animate-fadeIn">
          <div className="action-panel__raise-row">
            <span className="text-muted font-label">
              {canBet ? 'BET' : 'RAISE'}: {raiseAmount.toLocaleString()}
            </span>
            <div className="action-panel__raise-presets">
              {[0.33, 0.5, 0.75, 1].map(f => {
                const pot = gameState.pot.total;
                const v = Math.round(pot * f / bigBlind) * bigBlind;
                const clamped = Math.max(canBet ? minBet : minR, Math.min(v, maxBet));
                return (
                  <button
                    key={f}
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRaiseAmount(clamped)}
                  >
                    {Math.round(f * 100)}%pot
                  </button>
                );
              })}
            </div>
          </div>
          <input
            type="range"
            min={canBet ? minBet : minR}
            max={maxBet}
            step={bigBlind}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            className="action-panel__slider"
          />
          <div className="action-panel__raise-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setRaiseAmount(0)}>
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onAction(canBet ? 'bet' : 'raise', raiseAmount);
                setRaiseAmount(0);
              }}
            >
              {canBet ? 'ベット' : 'レイズ'} {raiseAmount.toLocaleString()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
