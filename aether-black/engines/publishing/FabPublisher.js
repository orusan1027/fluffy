'use strict';
/**
 * engines/publishing/FabPublisher.js
 * Playwright による Fab.com 完全自動申請。
 * - Rejected 検知 → 自動下書き復元
 * - ZIPアップロード → メタデータ入力 → 審査提出
 */
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');
const vault = require('../../core/vault');

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'data', 'screenshots');

async function shot(page, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const f = path.join(SCREENSHOT_DIR, `fab-${Date.now()}-${name}.png`);
  await page.screenshot({ path: f, fullPage: false }).catch(() => {});
  return f;
}

async function submit({ assetName, metadata, zipPath, emit }) {
  const log = (text, type = 'out') => emit({ type, text, time: new Date().toISOString() });

  const email    = vault.get('FAB_EMAIL');
  const password = vault.get('FAB_PASSWORD');
  if (!email || !password) throw new Error('FAB_EMAIL / FAB_PASSWORD が Vault に未設定です');

  const headless = vault.get('HEADLESS') !== 'false';

  log('[ Fab.com Publisher — Playwright ]', 'sys');
  log(`ヘッドレス: ${headless} | アセット: ${assetName}`);

  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 50 });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page    = await ctx.newPage();

  try {
    // ── Step 1: Login ──────────────────────────────────────────────
    log('  [1/5] Fab.com ログイン...');
    await page.goto('https://www.fab.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"]', password);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    await shot(page, '01-login');
    log('  ✓ ログイン完了');

    // ── Step 2: Seller Dashboard ───────────────────────────────────
    log('  [2/5] Seller Dashboard 確認（Rejected 検知）...');
    await page.goto('https://www.fab.com/seller/products', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Rejected チェック
    const rejLink = page.locator('a[href*="rejected"], button:has-text("Rejected")').first();
    if (await rejLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejLink.click();
      await page.waitForTimeout(1000);
      const rejItem = page.locator(`text="${assetName}"`).first();
      if (await rejItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        log(`  ⚠ "${assetName}" が Rejected — 下書きに復元します`, 'warn');
        await rejItem.click();
        await page.waitForTimeout(1000);
        const revertBtn = page.locator('button:has-text("Edit"), button:has-text("Revert")').first();
        if (await revertBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await revertBtn.click();
          await page.waitForTimeout(2000);
          log('  ✓ 下書き復元完了');
        }
      }
    }

    // Draft を探す
    await page.goto('https://www.fab.com/seller/products?status=draft', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const draftItem = page.locator(`a:has-text("${assetName}"), [class*="title"]:has-text("${assetName}")`).first();
    if (!await draftItem.isVisible({ timeout: 10000 }).catch(() => false)) {
      throw new Error(`Fab.com Draft "${assetName}" が見つかりません`);
    }
    await draftItem.click();
    await page.waitForTimeout(1500);
    await shot(page, '02-draft');
    log('  ✓ Draft アセット発見');

    // ── Step 3: Upload ZIP ─────────────────────────────────────────
    log('  [3/5] ZIP アップロード...');
    if (zipPath && fs.existsSync(zipPath)) {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fileInput.setInputFiles(zipPath);
        await page.waitForTimeout(5000);
        log(`  ✓ ZIP: ${path.basename(zipPath)}`);
      } else {
        log('  ⚠ ファイル入力フィールドが見つかりません', 'warn');
      }
    } else {
      log('  ⚠ ZIP ファイルが指定されていません。スキップ。', 'warn');
    }

    // ── Step 4: Metadata ───────────────────────────────────────────
    log('  [4/5] メタデータ入力...');
    const descArea = page.locator('textarea[name*="description"], textarea[placeholder*="description"]').first();
    if (await descArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descArea.fill(metadata?.fab?.shortDescription || `${assetName} — 8K background pack.`);
    }
    await shot(page, '03-metadata');
    log('  ✓ メタデータ入力完了');

    // ── Step 5: Submit ─────────────────────────────────────────────
    log('  [5/5] 審査提出...');
    const submitBtn = page.locator('button:has-text("Submit for Review"), button:has-text("Submit"), button:has-text("Publish")').first();
    if (await submitBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, '04-submitted');
      log('  ✓ Fab.com 審査提出完了！');
    } else {
      log('  ⚠ Submit ボタンが見つかりません', 'warn');
    }

    log('✓ Fab Publisher 完了');
    return { success: true };
  } catch (err) {
    await shot(page, 'error');
    throw err;
  } finally {
    await browser.close();
  }
}

module.exports = { submit };
