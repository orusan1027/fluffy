'use strict';
/**
 * Phase 3: Publishing — Fab.com (Epic Games)
 *
 * 現在はプレースホルダー。
 * Playwright を使って Fab.com のダッシュボードに自動ログイン・提出する
 * エージェントをここに実装予定。
 *
 * 拡張方法:
 *   portal-agent/lib/ の auth.js / metadata.js / submission.js を
 *   Fab.com 用に書き換えたモジュールをここに追加する。
 */

async function run(config, emit) {
  emit({ type: 'sys',  text: '[ Phase 3: Fab.com Publisher ]' });
  emit({ type: 'warn', text: '⚠ Fab.com 自動提出モジュールは近日対応予定です。' });
  emit({ type: 'warn', text: '  現在は手動で https://www.fab.com/sell から提出してください。' });
  emit({ type: 'out',  text: `  アセット: ${config.assetName}` });

  // TODO: Playwright で Fab.com に自動ログイン・提出
  // const { chromium } = require('playwright');
  // const browser = await chromium.launch({ headless: config.env.HEADLESS === 'true' });
  // ...
}

module.exports = { run };
