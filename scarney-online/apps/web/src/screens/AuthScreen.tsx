import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

type Tab = 'login' | 'signup';

export default function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (location.state as { tab?: Tab } | null)?.tab ?? 'login';

  const [tab, setTab] = useState<Tab>(initialTab);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPassword2, setSignupPassword2] = useState('');

  const { login, signup, loading, error, clearError } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginEmail, loginPassword);
      navigate('/lobby');
    } catch { /* error shown by store */ }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupPassword2) {
      return; // handled by browser validation
    }
    try {
      await signup(signupUsername, signupEmail, signupPassword);
      navigate('/lobby');
    } catch { /* error shown by store */ }
  };

  return (
    <div className="screen screen-center">
      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }} className="animate-fadeIn">
        {/* Back */}
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => navigate('/')}>
          ← 戻る
        </button>

        {/* Tabs */}
        <div className="flex gap-2" style={{ marginBottom: 24 }}>
          {(['login', 'signup'] as Tab[]).map(t => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1 }}
              onClick={() => { setTab(t); clearError(); }}
            >
              {t === 'login' ? 'ログイン' : '新規登録'}
            </button>
          ))}
        </div>

        <div className="panel">
          {error && (
            <div className="form-error" style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="form-group">
                <label className="input-label">メールアドレス</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label className="input-label">パスワード</label>
                <input
                  className="input"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? <span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%' }} /> : 'ログイン'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div className="form-group">
                <label className="input-label">ユーザー名</label>
                <input
                  className="input"
                  type="text"
                  required
                  minLength={2}
                  maxLength={20}
                  value={signupUsername}
                  onChange={e => setSignupUsername(e.target.value)}
                  placeholder="pokerpro"
                />
              </div>
              <div className="form-group">
                <label className="input-label">メールアドレス</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label className="input-label">パスワード</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  placeholder="8文字以上"
                />
              </div>
              <div className="form-group">
                <label className="input-label">パスワード確認</label>
                <input
                  className="input"
                  type="password"
                  required
                  value={signupPassword2}
                  onChange={e => setSignupPassword2(e.target.value)}
                  placeholder="もう一度入力"
                />
                {signupPassword2 && signupPassword !== signupPassword2 && (
                  <span className="form-error">パスワードが一致しません</span>
                )}
              </div>
              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={loading || (!!signupPassword2 && signupPassword !== signupPassword2)}
              >
                {loading ? <span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #000', borderTopColor: 'transparent', borderRadius: '50%' }} /> : '登録する'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
