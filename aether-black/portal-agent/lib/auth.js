'use strict';
/**
 * lib/auth.js — Unity ID ログイン
 *
 * Unity のログインフローは以下のいずれかを経由する（地域・時期により変動）:
 *   - https://login.unity.com/ja/sign-in  （現行・日本語環境）
 *   - https://login.unity.com/en/sign-in  （英語環境）
 *   - https://id.unity.com/en/conversations/new  （旧フロー）
 *
 * publisher.unity.com へアクセスして自然なリダイレクトに従うことで
 * どのパターンにも対応する。
 *
 * ⚠️ セレクタの更新方法:
 *   npx playwright codegen https://publisher.unity.com
 */

const PORTAL_URL = 'https://publisher.unity.com';

// Unity のログインドメインにマッチ（地域化パス /ja/ /en/ 等を許容）
const UNITY_LOGIN_URL_RE = /(login|id|auth)\.unity\.com/;

const SEL = {
  emailInput: [
    'input[id*="email"]',
    'input[name="email"]',
    'input[type="email"]',
  ].join(', '),

  nextButton: [
    'button:has-text("Next")',
    'button:has-text("次へ")',
    'button:has-text("Continue")',
    'button:has-text("続ける")',
    'input[type="submit"]',
  ].join(', '),

  passwordInput: [
    'input[id*="password"]',
    'input[name="password"]',
    'input[type="password"]',
  ].join(', '),

  signInButton: [
    'button:has-text("Sign in")',
    'button:has-text("Sign In")',
    'button:has-text("ログイン")',
    'button[type="submit"]',
  ].join(', '),
};

/**
 * publisher.unity.com にアクセスし、Unity ID でログインする。
 * login.unity.com（現行）/ id.unity.com（旧）どちらのフローにも対応。
 * 既にセッションが有効な場合はスキップ。
 * @param {import('playwright').Page} page
 */
async function login(page) {
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const currentUrl = page.url();

  // ── 既にポータルにいる場合（セッション有効）──────────────────────────
  if (currentUrl.includes('publisher.unity.com') && !UNITY_LOGIN_URL_RE.test(currentUrl)) {
    console.log('  → 既存セッションで認証済み（ログインスキップ）');
    return;
  }

  // ── ログインページへのリダイレクトを待機 ─────────────────────────────
  if (!UNITY_LOGIN_URL_RE.test(currentUrl)) {
    try {
      await page.waitForURL(UNITY_LOGIN_URL_RE, { timeout: 10_000 });
    } catch {
      console.log(`  → ログインURL待機タイムアウト（現URL: ${page.url()}）— フォームを直接検索`);
    }
  }

  console.log(`  → ログインページ確認: ${page.url()}`);
  await _performLogin(page);

  // ── ポータルへのリダイレクト完了を待つ ───────────────────────────────
  await page.waitForURL(/publisher\.unity\.com/, { timeout: 40_000 }).catch(async (err) => {
    throw new Error(
      `ログイン後のリダイレクトがタイムアウトしました。\n  現在のURL: ${page.url()}\n` +
      `  2FAが有効な場合は HEADLESS=false で実行してください。\n  原因: ${err.message}`
    );
  });

  console.log(`  → ログイン完了: ${page.url()}`);
}

async function _performLogin(page) {
  // ── Step 1: メールアドレス ─────────────────────────────────────────
  try {
    await page.waitForSelector(SEL.emailInput, { timeout: 15_000 });
  } catch {
    throw new Error(
      `メールアドレス入力欄が見つかりません。\n  現在のURL: ${page.url()}\n` +
      `  Unity のログインページが変更された可能性があります。`
    );
  }
  await page.locator(SEL.emailInput).first().fill(process.env.UNITY_EMAIL);
  console.log(`  → Email入力: ${process.env.UNITY_EMAIL}`);

  const nextBtn = page.locator(SEL.nextButton).first();
  await nextBtn.waitFor({ timeout: 8_000 });
  await nextBtn.click();

  // ── Step 2: パスワード ────────────────────────────────────────────
  try {
    await page.waitForSelector(SEL.passwordInput, { timeout: 15_000 });
  } catch {
    throw new Error(
      `パスワード入力欄が見つかりません。\n  現在のURL: ${page.url()}\n` +
      `  メールアドレスが正しいか確認してください。`
    );
  }
  await page.locator(SEL.passwordInput).first().fill(process.env.UNITY_PASSWORD);
  console.log('  → パスワード入力完了');

  // Sign In をクリック（最後のボタンを優先してサブミット）
  const signInBtn = page.locator(SEL.signInButton).last();
  await signInBtn.waitFor({ timeout: 8_000 });
  await signInBtn.click();
  console.log('  → Sign In クリック済み — リダイレクト待機中...');
}

module.exports = { login };
