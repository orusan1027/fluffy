'use strict';
/**
 * AETHER BLACK — Portal Agent
 * エントリーポイント。.env を読み込み、全フローを順番に実行する。
 *
 * 使い方:
 *   1. cp .env.example .env && [エディタで .env を編集]
 *   2. npm install && npm run install:browsers
 *   3. npm run submit          # ブラウザUIあり（デバッグ推奨）
 *      npm run submit:headless # ヘッドレス（自動実行用）
 */

require('dotenv').config();

const { chromium }    = require('playwright');
const path            = require('path');
const fs              = require('fs');
const { login }       = require('./lib/auth');
const { openDraft }   = require('./lib/navigation');
const { fillMeta }    = require('./lib/metadata');
const { submitPkg }   = require('./lib/submission');

// ── 必須 env vars の検証 ────────────────────────────────────────────────────
const REQUIRED = ['UNITY_EMAIL', 'UNITY_PASSWORD', 'ASSET_NAME', 'SUPPORT_EMAIL', 'SUPPORT_URL'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[✗] .env に "${key}" が設定されていません。.env.example を参照してください。`);
    process.exit(1);
  }
}

// Submission Message: .env に指定がなければ ASSET_NAME から自動生成
const SUBMISSION_MESSAGE = process.env.SUBMISSION_MESSAGE ||
  `This package includes a pre-configured Demo Scene located at ` +
  `Assets/AETHER_BLACK/${process.env.ASSET_NAME}/Scenes/Demo.unity. ` +
  `All textures are applied to high-quality Quads for immediate preview. ` +
  `The scene contains a title label, professional lighting, and a dark background ` +
  `optimized for showcasing high-resolution texture assets.`;

// ── スクリーンショット保存ディレクトリ ──────────────────────────────────────
const SS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

async function screenshot(page, label) {
  const file = path.join(SS_DIR, `${Date.now()}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  [📸] ${path.basename(file)}`);
}

// ── メイン ──────────────────────────────────────────────────────────────────
async function main() {
  const headless = process.env.HEADLESS === 'true';

  console.log('╔══════════════════════════════════════╗');
  console.log('║   AETHER BLACK  —  Portal Agent      ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`アセット名 : ${process.env.ASSET_NAME}`);
  console.log(`モード     : ${headless ? 'ヘッドレス' : 'ブラウザUI表示（デバッグ）'}`);
  console.log('');

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 80, // 動作を肉眼で確認できる速度
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // ブラウザのコンソールエラーをターミナルへ転送（デバッグ補助）
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`  [browser error] ${msg.text()}`);
  });

  try {
    // ── STEP 1: ログイン ───────────────────────────────────────────────
    console.log('[1/5] Unity ID でログイン中...');
    await login(page);
    await screenshot(page, '01-logged-in');

    // ── STEP 2: 下書きアセットの編集画面へ ────────────────────────────
    console.log(`[2/5] 下書きアセット「${process.env.ASSET_NAME}」を開く...`);
    await openDraft(page, process.env.ASSET_NAME);
    await screenshot(page, '02-asset-opened');

    // ── STEP 3: メタデータ入力（カテゴリ・価格・サポート情報）──────────
    console.log('[3/5] メタデータを入力...');
    await fillMeta(page, {
      supportEmail: process.env.SUPPORT_EMAIL,
      supportUrl:   process.env.SUPPORT_URL,
    });
    await screenshot(page, '03-metadata-filled');

    // ── STEP 4 & 5: 提出メッセージ + 法的同意 + Submit ────────────────
    console.log('[4/5] 提出メッセージと法的同意を入力...');
    await submitPkg(page, SUBMISSION_MESSAGE);
    await screenshot(page, '05-submitted');

    console.log('');
    console.log('[✓] パッケージの提出が完了しました！');
    console.log(`    スクリーンショット保存先: ${SS_DIR}`);

  } catch (err) {
    console.error('');
    console.error(`[✗] エラー: ${err.message}`);
    await screenshot(page, 'ERROR');
    console.error(`    エラー時スクリーンショット: ${SS_DIR}`);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

main();
