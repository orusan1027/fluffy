'use strict';
/**
 * lib/auth.js — Unity ID ログイン
 *
 * Unity のログインフローは id.unity.com を経由する。
 * メールアドレス入力 → Next → パスワード入力 → Sign in の2ステップ構成。
 *
 * ⚠️ セレクタの更新方法:
 *   npx playwright codegen https://publisher.unity.com
 *   上記コマンドを実行し、実際にログインした際に記録されるセレクタに差し替える。
 */

const PORTAL_URL = 'https://publisher.unity.com';

// Unity ID ログインページのセレクタ（2024-2025年時点）
const SEL = {
  // メールアドレス入力欄
  emailInput: [
    'input#conversations_create_session_form_email',
    'input[name="email"]',
    'input[type="email"]',
  ].join(', '),

  // 「Next」ボタン（メール入力後）
  nextButton: [
    'input[value="Next"]',
    'button:has-text("Next")',
    'button[type="submit"]',
  ].join(', '),

  // パスワード入力欄
  passwordInput: [
    'input#conversations_create_session_form_password',
    'input[name="password"]',
    'input[type="password"]',
  ].join(', '),

  // 「Sign in」ボタン
  signInButton: [
    'input[value="Sign in"]',
    'button:has-text("Sign in")',
    'button[type="submit"]',
  ].join(', '),
};

/**
 * publisher.unity.com にアクセスし、Unity ID でログインする。
 * 既にセッションが有効な場合はスキップする。
 * @param {import('playwright').Page} page
 */
async function login(page) {
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // id.unity.com へリダイレクトされるか確認
  let redirected = false;
  try {
    await page.waitForURL(/id\.unity\.com/, { timeout: 8_000 });
    redirected = true;
  } catch {
    // リダイレクトなし → 既にポータルにいるかチェック
  }

  if (!redirected) {
    if (page.url().includes('publisher.unity.com')) {
      console.log('  → 既存セッションで認証済み（ログインスキップ）');
      return;
    }
    throw new Error(
      `予期しないURLです: ${page.url()}\n` +
      '  ポータルまたはログインページへのアクセスに失敗しました。'
    );
  }

  console.log('  → Unity ID 認証ページを検出、認証を開始します');
  await _performLogin(page);

  // ポータルへのリダイレクト完了を待つ
  await page.waitForURL(/publisher\.unity\.com/, { timeout: 30_000 });
  console.log('  → ログイン完了');
}

async function _performLogin(page) {
  // ── Step 1: メールアドレス ─────────────────────────────────────────
  await page.waitForSelector(SEL.emailInput, { timeout: 15_000 });
  await page.fill(SEL.emailInput, process.env.UNITY_EMAIL);

  // 「Next」ボタン: 複数ある場合は最後のものをクリック（ページによって位置が異なる）
  await page.locator(SEL.nextButton).last().click();

  // ── Step 2: パスワード ────────────────────────────────────────────
  await page.waitForSelector(SEL.passwordInput, { timeout: 15_000 });
  await page.fill(SEL.passwordInput, process.env.UNITY_PASSWORD);
  await page.locator(SEL.signInButton).last().click();

  // 2FA が有効な場合、ここで手動操作が必要になる可能性がある
  // その場合は HEADLESS=false で実行し、コード入力後に自動で続行される
}

module.exports = { login };
