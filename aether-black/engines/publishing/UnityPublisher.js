'use strict';
/**
 * engines/publishing/UnityPublisher.js
 * Playwright による Unity Publisher Portal 完全自動化。
 * - login.unity.com / id.unity.com 両方に対応（地域化パス /ja/ /en/ 等を許容）
 * - 却下（Rejected）検知 → 自動下書き復元
 * - メタデータ入力 → 審査提出 → 成功確認
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const vault = require('../../core/vault');

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'screenshots');

function resolveChromeExe() {
  const bundled = chromium.executablePath();
  if (fs.existsSync(bundled)) return bundled;
  const fallback = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  if (fs.existsSync(fallback)) return fallback;
  return bundled;
}

// Unity のログインドメインにマッチする正規表現
// 対応URL例:
//   https://id.unity.com/en/conversations/new
//   https://login.unity.com/ja/sign-in
//   https://login.unity.com/en/sign-in
//   https://auth.unity.com/...
const UNITY_LOGIN_URL_RE = /(login|id|auth)\.unity\.com/;

const SEL = {
  emailInput:      'input[id*="email"], input[name="email"], input[type="email"]',
  nextBtn:         'button:has-text("Next"), button:has-text("次へ"), button:has-text("Continue"), button:has-text("続ける"), input[type="submit"]',
  passInput:       'input[id*="password"], input[name="password"], input[type="password"]',
  signInBtn:       'button[type="submit"], button:has-text("Sign in"), button:has-text("ログイン"), button:has-text("Sign In")',
  submitForReview: 'button:has-text("Submit for review"), button:has-text("審査に提出"), button:has-text("Submit For Review")',
  confirmBtn:      'button:has-text("Confirm"), button:has-text("確認"), button:has-text("Submit")',
  successEl:       '[class*="success"], [class*="submitted"], h1:has-text("Under Review"), h2:has-text("Under Review")',
  msgTextarea:     'textarea[name*="message"], textarea[placeholder*="message"], textarea[placeholder*="notes"], textarea',
  autoPublish:     'input[type="checkbox"][name*="auto"], input[type="checkbox"][id*="auto"]',
  rightsCheck:     'input[type="checkbox"][name*="right"], input[type="checkbox"][id*="right"]',
  revertDraft:     'button:has-text("Revert to Draft"), button:has-text("下書きに戻す"), a:has-text("Revert")',
};

/**
 * 不正なURL文字列から最初の有効なURLを抽出する。
 * 例: "[https://www.fab.com/][https://www.fab.cc]" → "https://www.fab.com"
 */
function sanitizeUrl(raw) {
  if (!raw) return '';
  const match = raw.match(/https?:\/\/[^\s\[\]"'<>]+/);
  return match ? match[0].replace(/\/$/, '') : raw.trim();
}

async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const f = path.join(SCREENSHOT_DIR, `unity-${Date.now()}-${name}.png`);
  await page.screenshot({ path: f, fullPage: false }).catch(() => {});
  return f;
}

/**
 * Unity ログイン処理
 * publisher.unity.com へアクセスし、login.unity.com (または id.unity.com) で認証する。
 * 地域化パス（/ja/ /en/ 等）を問わず対応。
 */
async function performLogin(page, email, password, log) {
  log('  → publisher.unity.com へアクセス...');
  await page.goto('https://publisher.unity.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const currentUrl = page.url();
  log(`  → リダイレクト先URL: ${currentUrl}`);

  // ── 既にポータルにいる場合（セッション有効）────────────────────────────
  if (currentUrl.includes('publisher.unity.com') && !UNITY_LOGIN_URL_RE.test(currentUrl)) {
    log('  → 既存セッションで認証済み（ログインスキップ）');
    return;
  }

  // ── ログインページが表示されていない場合は明示的にリダイレクトを待つ ───
  if (!UNITY_LOGIN_URL_RE.test(currentUrl)) {
    try {
      await page.waitForURL(UNITY_LOGIN_URL_RE, { timeout: 10000 });
      log(`  → ログインページ検出: ${page.url()}`);
    } catch {
      // リダイレクトが来なくてもページにフォームがあれば続行
      log(`  → ログインURL待機タイムアウト（現URL: ${page.url()}）— フォームを直接検索`);
    }
  }

  await shot(page, '00-login-page');

  // ── Step A: メールアドレス入力 ─────────────────────────────────────────
  log('  → メールアドレスを入力...');
  try {
    await page.waitForSelector(SEL.emailInput, { timeout: 15000 });
  } catch {
    throw new Error(
      `ログインフォームが見つかりません。\n  現在のURL: ${page.url()}\n` +
      `  スクリーンショット: ${SCREENSHOT_DIR}/unity-*-00-login-page.png`
    );
  }
  await page.fill(SEL.emailInput, email);
  log(`  → Email入力完了: ${email}`);

  // Next / Continue ボタンをクリック
  const nextBtn = page.locator(SEL.nextBtn).first();
  await nextBtn.waitFor({ timeout: 10000 });
  await nextBtn.click();

  // ── Step B: パスワード入力 ─────────────────────────────────────────────
  log('  → パスワードフィールドを待機...');
  try {
    await page.waitForSelector(SEL.passInput, { timeout: 15000 });
  } catch {
    // パスワードが同一ページに既にある場合もある
    const hasPass = await page.locator(SEL.passInput).isVisible().catch(() => false);
    if (!hasPass) {
      await shot(page, '00b-no-password');
      throw new Error(
        `パスワードフィールドが表示されません。\n  現在のURL: ${page.url()}\n` +
        `  2FAや追加確認が必要な可能性があります。HEADLESS=false で実行してください。`
      );
    }
  }
  await page.fill(SEL.passInput, password);
  log('  → パスワード入力完了');

  // Sign In ボタンをクリック → ポータルへのリダイレクトを待機
  const signInBtn = page.locator(SEL.signInBtn).last();
  await signInBtn.waitFor({ timeout: 10000 });

  await Promise.all([
    page.waitForURL(/publisher\.unity\.com/, { timeout: 40000 }),
    signInBtn.click(),
  ]).catch(async (err) => {
    // 2FA などで publisher.unity.com に戻れない場合
    await shot(page, '00c-signin-blocked');
    throw new Error(
      `ログイン後のリダイレクトがタイムアウトしました。\n  現在のURL: ${page.url()}\n` +
      `  2FAが有効な場合は HEADLESS=false に設定して手動で認証してください。\n  原因: ${err.message}`
    );
  });

  log(`  → ログイン完了。URL: ${page.url()}`);
}

async function submit({ assetName, metadata, emit }) {
  const log = (text, type = 'out') => emit({ type, text, time: new Date().toISOString() });

  const email    = vault.get('UNITY_EMAIL');
  const password = vault.get('UNITY_PASSWORD');
  if (!email || !password) throw new Error('UNITY_EMAIL / UNITY_PASSWORD が Vault に未設定です');

  const supportEmail = vault.get('SUPPORT_EMAIL') || email;
  const supportUrl   = sanitizeUrl(vault.get('SUPPORT_URL') || 'https://unity.com/support');
  const headless     = vault.get('HEADLESS') !== 'false';

  log('[ Unity Publisher — Playwright ]', 'sys');
  log(`ヘッドレス: ${headless} | アセット: ${assetName}`);
  log(`サポートURL: ${supportUrl}`);

  const browser = await chromium.launch({ executablePath: resolveChromeExe(), headless, slowMo: headless ? 0 : 60 });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page    = await ctx.newPage();

  // ブラウザコンソールエラーをログへ転送
  page.on('console', msg => {
    if (msg.type() === 'error') log(`  [browser] ${msg.text()}`, 'warn');
  });

  try {
    // ── Step 1: Login ──────────────────────────────────────────────
    log('  [1/5] Unity ID ログイン...');
    await performLogin(page, email, password, log);
    await shot(page, '01-login');
    log('  ✓ ログイン完了');

    // ── Step 2: Check Rejected & Navigate to Draft ────────────────
    log('  [2/5] ポータル確認（Rejected 検知）...');
    await page.goto('https://publisher.unity.com/packages', { waitUntil: 'networkidle', timeout: 30000 });

    const rejTab = page.locator('button:has-text("Rejected"), a:has-text("Rejected")').first();
    if (await rejTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejTab.click();
      await page.waitForTimeout(1000);
      const rejItem = page.locator(`text="${assetName}"`).first();
      if (await rejItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        log(`  ⚠ "${assetName}" が Rejected されています。下書きに復元します...`, 'warn');
        await rejItem.click();
        await page.waitForTimeout(1000);
        const revertBtn = page.locator(SEL.revertDraft).first();
        if (await revertBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await revertBtn.click();
          await page.waitForTimeout(2000);
          log('  ✓ 下書き復元完了');
        }
        await page.goto('https://publisher.unity.com/packages', { waitUntil: 'networkidle', timeout: 30000 });
      }
    }

    const draftTab = page.locator('button:has-text("Draft"), a:has-text("Draft"), button:has-text("Drafts")').first();
    if (await draftTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await draftTab.click();
      await page.waitForTimeout(1000);
    }

    const assetLink = page.locator(`a:has-text("${assetName}"), [class*="name"]:has-text("${assetName}")`).first();
    if (!await assetLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      throw new Error(
        `Draft アセット "${assetName}" が Publisher Portal に見つかりません。\n` +
        `  ポータルで下書きアセットが作成されているか確認してください。\n  URL: https://publisher.unity.com/packages`
      );
    }
    await assetLink.click();
    await page.waitForLoadState('networkidle', { timeout: 20000 });
    await shot(page, '02-draft');
    log('  ✓ Draft アセット発見');

    // ── Step 3: Fill Metadata ──────────────────────────────────────
    log('  [3/5] メタデータ入力...');
    const fillField = async (sel, value) => {
      if (!value) return;
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await el.fill(value);
      }
    };
    await fillField('input[name*="support_email"], input[placeholder*="support email" i]', supportEmail);
    await fillField('input[name*="support_url"],   input[placeholder*="url" i], input[placeholder*="website" i]', supportUrl);
    await shot(page, '03-metadata');
    log('  ✓ メタデータ入力完了');

    // ── Step 4: Submit ─────────────────────────────────────────────
    log('  [4/5] 審査提出...');
    const submitBtn = page.locator(SEL.submitForReview).first();
    if (!await submitBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      throw new Error(
        '"Submit for review" ボタンが見つかりません。\n' +
        '  メタデータの必須項目（画像・説明・価格）が未入力の可能性があります。\n' +
        '  HEADLESS=false にして手動で確認してください。'
      );
    }

    const msgArea = page.locator(SEL.msgTextarea).first();
    if (await msgArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      const msg = metadata?.unity?.submissionMsg?.slice(0, 500) ||
        `${assetName} — High-resolution 8K background texture pack. ` +
        `Demo scene included at Assets/AETHER_BLACK/${assetName}/Scenes/Demo.unity.`;
      await msgArea.fill(msg);
    }

    for (const sel of [SEL.autoPublish, SEL.rightsCheck]) {
      const cb = page.locator(sel).first();
      if (await cb.isVisible({ timeout: 2000 }).catch(() => false) && !await cb.isChecked()) {
        await cb.check();
      }
    }

    await submitBtn.click();
    await page.waitForTimeout(2000);

    const confirmBtn = page.locator(SEL.confirmBtn).first();
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) await confirmBtn.click();
    await page.waitForTimeout(2000);
    await shot(page, '04-submitted');

    // ── Step 5: Verify ─────────────────────────────────────────────
    log('  [5/5] 提出確認...');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    const success = await page.locator(SEL.successEl).isVisible({ timeout: 15000 }).catch(() => false);
    if (success) {
      log('  ✓ 審査提出完了！ステータス: Under Review');
    } else {
      log(`  ⚠ 成功インジケーター未検出（URL: ${page.url()}）`, 'warn');
      log('  ⚠ スクリーンショットで結果を確認してください', 'warn');
    }

    log('✓ Unity Publisher 完了');
    return { success: true };
  } catch (err) {
    await shot(page, 'error');
    throw err;
  } finally {
    await browser.close();
  }
}

module.exports = { submit };
