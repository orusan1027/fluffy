'use strict';
/**
 * engines/publishing/UnityPublisher.js
 * Playwright による Unity Publisher Portal 完全自動化。
 * - 却下（Rejected）検知 → 自動下書き復元
 * - メタデータ入力 → 審査提出 → 成功確認
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const vault = require('../../core/vault');

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'screenshots');

const SEL = {
  emailInput:   '#conversations_create_session_form_email, input[name="email"], input[type="email"]',
  passInput:    '#conversations_create_session_form_password, input[name="password"], input[type="password"]',
  nextBtn:      'button:has-text("Next"), button:has-text("次へ"), input[type="submit"]',
  signInBtn:    'button[type="submit"], button:has-text("Sign in"), button:has-text("ログイン")',
  submitForReview: 'button:has-text("Submit for review"), button:has-text("審査に提出")',
  confirmBtn:   'button:has-text("Confirm"), button:has-text("確認"), button:has-text("Submit")',
  successEl:    '[class*="success"], [class*="submitted"], h1:has-text("Under Review"), h2:has-text("Under Review")',
  msgTextarea:  'textarea[name*="message"], textarea[placeholder*="message"], textarea[placeholder*="notes"]',
  autoPublish:  'input[type="checkbox"][name*="auto"], input[type="checkbox"][id*="auto"]',
  rightsCheck:  'input[type="checkbox"][name*="right"], input[type="checkbox"][id*="right"]',
  revertDraft:  'button:has-text("Revert to Draft"), button:has-text("下書きに戻す"), a:has-text("Revert")',
};

async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const f = path.join(SCREENSHOT_DIR, `unity-${Date.now()}-${name}.png`);
  await page.screenshot({ path: f, fullPage: false }).catch(() => {});
  return f;
}

async function submit({ assetName, metadata, emit }) {
  const log = (text, type = 'out') => emit({ type, text, time: new Date().toISOString() });

  const email    = vault.get('UNITY_EMAIL');
  const password = vault.get('UNITY_PASSWORD');
  if (!email || !password) throw new Error('UNITY_EMAIL / UNITY_PASSWORD が Vault に未設定です');

  const supportEmail = vault.get('SUPPORT_EMAIL') || '';
  const supportUrl   = vault.get('SUPPORT_URL')   || '';
  const headless     = vault.get('HEADLESS') !== 'false';

  log('[ Unity Publisher — Playwright ]', 'sys');
  log(`ヘッドレス: ${headless} | アセット: ${assetName}`);

  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 50 });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await ctx.newPage();

  try {
    // ── Step 1: Login ──────────────────────────────────────────────
    log('  [1/5] Unity ID ログイン...');
    await page.goto('https://id.unity.com/en/conversations/new', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(SEL.emailInput, { timeout: 15000 });
    await page.fill(SEL.emailInput, email);
    await page.click('button:has-text("Next"), button:has-text("次へ"), button[type="submit"]');
    await page.waitForTimeout(1500);
    await page.waitForSelector(SEL.passInput, { timeout: 10000 });
    await page.fill(SEL.passInput, password);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.click(SEL.signInBtn),
    ]);
    await shot(page, '01-login');
    log('  ✓ ログイン完了');

    // ── Step 2: Check Rejected & Navigate to Draft ────────────────
    log('  [2/5] ポータル確認（Rejected 検知）...');
    await page.goto('https://publisher.unity.com/packages', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Rejected チェック
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
        await page.goto('https://publisher.unity.com/packages', { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }

    // Draft フィルター適用
    const draftTab = page.locator('button:has-text("Draft"), a:has-text("Draft")').first();
    if (await draftTab.isVisible({ timeout: 5000 }).catch(() => false)) await draftTab.click();
    await page.waitForTimeout(1000);

    const assetLink = page.locator(`a:has-text("${assetName}"), [class*="name"]:has-text("${assetName}")`).first();
    if (!await assetLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      throw new Error(`Draft アセット "${assetName}" が Publisher Portal に見つかりません`);
    }
    await assetLink.click();
    await page.waitForTimeout(1500);
    await shot(page, '02-draft');
    log('  ✓ Draft アセット発見');

    // ── Step 3: Fill Metadata ──────────────────────────────────────
    log('  [3/5] メタデータ入力...');
    const fillField = async (sel, value) => {
      const el = page.locator(sel).first();
      if (value && await el.isVisible({ timeout: 2000 }).catch(() => false)) await el.fill(value);
    };
    await fillField('input[name*="support_email"], input[placeholder*="support email"]', supportEmail);
    await fillField('input[name*="support_url"],   input[placeholder*="url"]',           supportUrl);
    await shot(page, '03-metadata');
    log('  ✓ メタデータ入力完了');

    // ── Step 4: Submit ─────────────────────────────────────────────
    log('  [4/5] 審査提出...');
    const submitBtn = page.locator(SEL.submitForReview).first();
    if (!await submitBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      throw new Error('"Submit for review" ボタンが見つかりません');
    }

    const msgArea = page.locator(SEL.msgTextarea).first();
    if (await msgArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await msgArea.fill(metadata?.unity?.submissionMsg?.slice(0, 500) || `${assetName} — 8K background pack submission.`);
    }

    for (const sel of [SEL.autoPublish, SEL.rightsCheck]) {
      const cb = page.locator(sel).first();
      if (await cb.isVisible({ timeout: 2000 }).catch(() => false) && !await cb.isChecked()) await cb.check();
    }

    await submitBtn.click();
    await page.waitForTimeout(1500);

    const confirmBtn = page.locator(SEL.confirmBtn).first();
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) await confirmBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, '04-submitted');

    // ── Step 5: Verify ─────────────────────────────────────────────
    log('  [5/5] 提出確認...');
    const success = await page.locator(SEL.successEl).isVisible({ timeout: 15000 }).catch(() => false);
    if (success) {
      log('  ✓ 審査提出完了！ステータス: Under Review');
    } else {
      log('  ⚠ 成功インジケーター未検出（スクリーンショット確認を）', 'warn');
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
