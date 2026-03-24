import type { HandResult } from '@scarney/shared';
import CardView from './CardView.js';

interface Props {
  result: HandResult;
  onClose: () => void;
}

export default function ResultModal({ result, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-fadeIn" onClick={e => e.stopPropagation()}>
        <h2 className="modal__title font-title">ハンド #{result.handNumber} 結果</h2>

        <div className="result-modal__winners">
          {result.winners.map((w, i) => (
            <div key={i} className="result-winner">
              <span className="result-winner__avatar">{w.avatarEmoji}</span>
              <div className="result-winner__info">
                <div className="result-winner__name">{w.username}</div>
                <div className="result-winner__amount text-primary">
                  +{w.amount.toLocaleString()}
                </div>
                {w.handLabel && (
                  <div className="result-winner__hand text-muted">{w.handLabel}</div>
                )}
                <div className="result-winner__type">
                  {w.type === 'hi' ? 'Hi勝ち' : w.type === 'lo' ? 'Lo勝ち' : 'スクープ'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="result-modal__players">
          {result.playerInfos.map(p => (
            <div key={p.userId} className="result-player">
              <span>{p.avatarEmoji} {p.username}</span>
              <div className="result-player__cards">
                {p.holeCards.map(c => (
                  <CardView key={c.id} card={c} size="sm" />
                ))}
              </div>
              {p.hiHand && (
                <span className="text-muted" style={{ fontSize: 12 }}>{p.hiHand.label}</span>
              )}
              <span className="chip-badge">残: {p.finalStack.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {result.winLog.length > 0 && (
          <div className="result-modal__log">
            {result.winLog.map((line, i) => (
              <div key={i} className="text-muted" style={{ fontSize: 12 }}>{line}</div>
            ))}
          </div>
        )}

        <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={onClose}>
          続ける
        </button>
      </div>
    </div>
  );
}
