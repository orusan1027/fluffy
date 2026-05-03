'use strict';
/**
 * lib/navigation.js — パッケージ一覧から下書きアセットの編集画面へ遷移
 *
 * ⚠️ セレクタの更新方法:
 *   npm run codegen を実行し、パッケージ一覧ページで実際の要素を確認する。
 *   publisher.unity.com/packages にアクセスして DevTools で要素を調査するのも有効。
 */

const PACKAGES_URL = 'https://publisher.unity.com/packages';

// ポータルのパッケージ一覧ページ用セレクタ
const SEL = {
  // "Draft" ステータスのフィルタ（タブ or ボタン）
  draftFilter: [
    '[role="tab"]:has-text("Draft")',
    'button:has-text("Draft")',
    'a:has-text("Drafts")',
    'li:has-text("Draft") a',
  ].join(', '),

  // 個々のパッケージ行
  packageRow: [
    '[data-testid="package-item"]',
    'tr.package-row',
    '.package-list-item',
    'li.package',
    'tbody tr',             // テーブル形式の場合
  ].join(', '),

  // パッケージ行内の「Edit」リンク / ボタン
  editButton: [
    'a:has-text("Edit")',
    'button:has-text("Edit")',
    '[data-testid="edit-button"]',
    'a[href*="/edit"]',
  ].join(', '),
};

/**
 * パッケージ一覧から assetName に一致する下書きを開く。
 * @param {import('playwright').Page} page
 * @param {string} assetName  .env の ASSET_NAME と同じ値
 */
async function openDraft(page, assetName) {
  await page.goto(PACKAGES_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  console.log(`  → URL: ${page.url()}`);

  // Draft フィルタを適用（タブが存在する場合）
  await _applyDraftFilter(page);

  // assetName に一致するパッケージ行を探す
  const targetRow = await _findPackageRow(page, assetName);

  // 編集画面へ遷移
  const editBtn = targetRow.locator(SEL.editButton).first();
  await editBtn.waitFor({ timeout: 10_000 });
  await editBtn.click();
  await page.waitForLoadState('networkidle', { timeout: 30_000 });
  console.log(`  → 編集画面に遷移: ${page.url()}`);
}

async function _applyDraftFilter(page) {
  try {
    const filter = page.locator(SEL.draftFilter).first();
    await filter.waitFor({ timeout: 5_000 });
    await filter.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log('  → Draft フィルタを適用');
  } catch {
    // フィルタが存在しないレイアウトもある（全パッケージ表示のまま続行）
    console.log('  → Draft フィルタなし（全パッケージから検索）');
  }
}

async function _findPackageRow(page, assetName) {
  // ページ読み込み完了後に行を取得
  await page.waitForSelector(SEL.packageRow, { timeout: 15_000 });

  const rows = page.locator(SEL.packageRow);
  const count = await rows.count();

  if (count === 0) {
    throw new Error(
      'パッケージ一覧が空です。ポータルにパッケージが存在するか確認してください。'
    );
  }

  // assetName を含む行をスキャン
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).textContent().catch(() => '');
    if (text.includes(assetName)) {
      console.log(`  → 「${assetName}」を発見（${i + 1} / ${count} 件目）`);
      return rows.nth(i);
    }
  }

  throw new Error(
    `アセット「${assetName}」が見つかりません。\n` +
    `  ・ASSET_NAME の値がポータルのパッケージ名と一致しているか確認してください。\n` +
    `  ・下書き（Draft）状態のパッケージが存在するか確認してください。`
  );
}

module.exports = { openDraft };
