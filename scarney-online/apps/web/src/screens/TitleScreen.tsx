import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

export default function TitleScreen() {
  const navigate = useNavigate();
  const { accessToken, logout } = useAuthStore();

  return (
    <div className="screen screen-center" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a3a2a 0%, var(--color-bg) 70%)' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, width: '100%', padding: '0 20px' }}>
        {/* Logo */}
        <div className="animate-fadeIn" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, letterSpacing: '.3em', color: 'var(--color-muted)', fontFamily: 'var(--font-label)', textTransform: 'uppercase', marginBottom: 4 }}>
            Online Multiplayer
          </div>
          <h1
            className="font-title animate-glow"
            style={{
              fontSize: 'clamp(56px, 15vw, 96px)',
              lineHeight: 1,
              color: 'var(--color-primary)',
              textShadow: '0 0 40px rgba(245,158,11,.6)',
              letterSpacing: '.05em',
            }}
          >
            SCARNEY
          </h1>
          <div style={{ fontSize: 18, letterSpacing: '.2em', color: 'var(--color-muted)', fontFamily: 'var(--font-label)' }}>
            POKER
          </div>
        </div>

        {/* Description */}
        <p className="animate-fadeIn" style={{ color: 'var(--color-muted)', marginBottom: 40, fontSize: 14, animationDelay: '.1s' }}>
          Hi/Loスプリットポット方式のオリジナルポーカー
        </p>

        {/* Buttons */}
        <div className="animate-fadeIn flex flex-col gap-3" style={{ animationDelay: '.2s' }}>
          {accessToken ? (
            <>
              <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/lobby')}>
                ロビーへ
              </button>
              <button className="btn btn-ghost btn-full" onClick={() => logout().then(() => {})}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/auth', { state: { tab: 'login' } })}>
                ログイン
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => navigate('/auth', { state: { tab: 'signup' } })}>
                新規登録
              </button>
            </>
          )}
        </div>

        {/* Rules summary */}
        <div className="panel animate-fadeIn" style={{ marginTop: 48, textAlign: 'left', animationDelay: '.3s', fontSize: 13 }}>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '.1em', color: 'var(--color-primary)', marginBottom: 12 }}>
            ゲームルール
          </div>
          <ul style={{ color: 'var(--color-muted)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>各プレイヤーに <strong style={{ color: 'var(--color-text)' }}>7枚</strong> のホールカードを配布</li>
            <li>通常の5枚コミュニティカード（トップボード）に加え、ボトムボードにも捨て牌が積まれる</li>
            <li>ショーダウンでは Hi（最強役）と Lo（数字の合計が最小）でポットを山分け</li>
            <li>全てを獲得できれば <strong style={{ color: 'var(--color-primary)' }}>スクープ</strong>！</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
