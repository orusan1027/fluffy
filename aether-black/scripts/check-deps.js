'use strict';
/**
 * scripts/check-deps.js
 * npm start の prestart フックとして実行される。
 * node_modules が存在しない場合、または必須モジュールが欠落している場合に
 * npm install を自動実行してから起動を続行する。
 */
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT    = path.join(__dirname, '..');
const MODULES = path.join(ROOT, 'node_modules');

const REQUIRED = ['express', 'cors', 'dotenv', 'playwright'];

function isMissing() {
  if (!fs.existsSync(MODULES)) return true;
  for (const pkg of REQUIRED) {
    if (!fs.existsSync(path.join(MODULES, pkg))) return true;
  }
  return false;
}

if (isMissing()) {
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║  依存パッケージが未インストールです。          ║');
  console.log('  ║  npm install を自動実行します... (初回のみ)   ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');

  try {
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    console.log('\n  ✓ npm install 完了\n');
  } catch (err) {
    console.error('\n  ✗ npm install 失敗:', err.message);
    console.error('    手動で以下を実行してください: cd aether-black && npm install');
    process.exit(1);
  }

  // Chromium ブラウザも確認
  const { chromium } = require(path.join(MODULES, 'playwright'));
  const chromiumExe = chromium.executablePath();
  if (!fs.existsSync(chromiumExe)) {
    console.log('  Playwright Chromium をインストール中...');
    try {
      execSync('npx playwright install chromium', { cwd: ROOT, stdio: 'inherit' });
      console.log('  ✓ Chromium インストール完了\n');
    } catch {
      console.log('  ⚠ Chromium の自動インストールに失敗しました。');
      console.log('    手動で実行: npm run install:browsers\n');
    }
  }
} else {
  // Chromium チェック（インストール済みの場合も確認）
  try {
    const { chromium } = require('playwright');
    const chromiumExe = chromium.executablePath();
    const FALLBACK_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    if (!fs.existsSync(chromiumExe) && !fs.existsSync(FALLBACK_CHROME)) {
      console.log('  ⚠ Playwright Chromium が未インストールです。');
      console.log('    Publishing 機能を使う前に: npm run install:browsers\n');
    }
  } catch { /* playwright 自体がない場合は isMissing() で検出済み */ }
}
