'use strict';
/**
 * lib/metadata.js — メタデータ入力
 * カテゴリ（2D > Textures & Materials）、価格（Free）、
 * サポートEメール・URLを入力して保存する。
 *
 * ⚠️ ポータルはセクションごとにページやタブが分かれている場合がある。
 *   実際の画面構成に応じて _navigateToSection() の呼び出しを調整すること。
 *
 * ⚠️ セレクタの更新方法:
 *   npm run codegen を実行し、編集画面で各フィールドを実際に操作して記録する。
 */

// ── セレクタ定義 ────────────────────────────────────────────────────────────
const SEL = {
  // ── カテゴリ ─────────────────────────────────────────────────────────────
  // カテゴリのドロップダウントリガー / select 要素
  categoryTrigger: [
    'select[name="category"]',
    '[data-testid="category-select"]',
    'button:has-text("Select category")',
    'button:has-text("Category")',
    '.category-selector button',
  ].join(', '),

  // 「2D」の選択肢
  option2D: [
    'option[value*="2D"]',
    '[role="option"]:has-text("2D")',
    'li:has-text("2D")',
  ].join(', '),

  // 「Textures & Materials」の選択肢（2D 選択後に現れるサブカテゴリ）
  optionTextures: [
    'option[value*="Texture"]',
    '[role="option"]:has-text("Textures")',
    'li:has-text("Textures")',
    '[role="option"]:has-text("Textures & Materials")',
  ].join(', '),

  // ── 価格 ──────────────────────────────────────────────────────────────────
  // "Free" ラジオボタン / チェックボックス / ボタン
  priceFreeRadio: [
    'input[type="radio"][value="free"]',
    'input[type="radio"][value="Free"]',
    'label:has-text("Free") input[type="radio"]',
    '[data-testid="price-free"]',
  ].join(', '),

  // "Free" セレクトオプション（<select> の場合）
  priceFreeOption: [
    'option[value="free"]',
    'option[value="Free"]',
    'option:has-text("Free")',
  ].join(', '),

  // 価格の <select> 要素
  priceSelect: 'select[name="price"], select[id*="price"]',

  // ── サポート情報 ─────────────────────────────────────────────────────────
  supportEmailInput: [
    'input[name="supportEmail"]',
    'input[name="support_email"]',
    'input[id*="support-email"]',
    'input[placeholder*="support email" i]',
    'input[placeholder*="email" i]',
  ].join(', '),

  supportUrlInput: [
    'input[name="supportUrl"]',
    'input[name="support_url"]',
    'input[id*="support-url"]',
    'input[placeholder*="support url" i]',
    'input[placeholder*="URL" i]',
  ].join(', '),

  // ── 保存ボタン ────────────────────────────────────────────────────────────
  saveButton: [
    'button:has-text("Save")',
    'button[type="submit"]:has-text("Save")',
    '[data-testid="save-button"]',
  ].join(', '),

  // ── セクションナビゲーション（左サイドバーの各ステップ）───────────────────
  // ポータルによってはタブ / リンクで切り替える
  sectionDetails:   'a:has-text("Details"),  nav li:has-text("Details"),  [role="tab"]:has-text("Details")',
  sectionPricing:   'a:has-text("Pricing"),   nav li:has-text("Pricing"),  [role="tab"]:has-text("Pricing")',
  sectionPublisher: 'a:has-text("Publisher"), nav li:has-text("Publisher"),[role="tab"]:has-text("Publisher")',
};

/**
 * カテゴリ・価格・サポート情報を入力して保存する。
 * @param {import('playwright').Page} page
 * @param {{ supportEmail: string, supportUrl: string }} opts
 */
async function fillMeta(page, { supportEmail, supportUrl }) {
  // ── Details セクション: カテゴリ ────────────────────────────────────────
  await _navigateSection(page, SEL.sectionDetails, 'Details');
  await _selectCategory(page);
  await _saveSection(page, 'Details');

  // ── Pricing セクション: 価格 ─────────────────────────────────────────────
  await _navigateSection(page, SEL.sectionPricing, 'Pricing');
  await _setFreePrice(page);
  await _saveSection(page, 'Pricing');

  // ── Publisher / Support セクション: サポート情報 ────────────────────────
  await _navigateSection(page, SEL.sectionPublisher, 'Publisher/Support');
  await _fillSupport(page, supportEmail, supportUrl);
  await _saveSection(page, 'Publisher/Support');
}

// ── カテゴリ選択: 2D > Textures & Materials ────────────────────────────────
async function _selectCategory(page) {
  console.log('  → カテゴリ選択: 2D > Textures & Materials');

  const trigger = page.locator(SEL.categoryTrigger).first();

  // <select> の場合と カスタムドロップダウンの場合で分岐
  const tagName = await trigger.evaluate(el => el.tagName.toLowerCase()).catch(() => '');

  if (tagName === 'select') {
    // ネイティブ select: option の value で直接選択
    await trigger.selectOption({ label: '2D' }).catch(() => null);
    // サブカテゴリ select が現れるまで待機
    await page.waitForTimeout(500);
    const subSelect = page.locator(SEL.categoryTrigger).nth(1);
    if (await subSelect.count() > 0) {
      await subSelect.selectOption({ label: 'Textures & Materials' }).catch(() =>
        subSelect.selectOption({ label: 'Textures' })
      );
    }
  } else {
    // カスタムドロップダウン: クリックしてオプション選択
    await trigger.waitFor({ timeout: 10_000 });
    await trigger.click();
    await page.locator(SEL.option2D).first().waitFor({ timeout: 8_000 });
    await page.locator(SEL.option2D).first().click();
    await page.waitForTimeout(400);
    await page.locator(SEL.optionTextures).first().waitFor({ timeout: 8_000 });
    await page.locator(SEL.optionTextures).first().click();
  }

  console.log('  → カテゴリ設定完了');
}

// ── 価格: Free ─────────────────────────────────────────────────────────────
async function _setFreePrice(page) {
  console.log('  → 価格: Free に設定');

  // ラジオボタンが存在する場合
  const radio = page.locator(SEL.priceFreeRadio).first();
  if (await radio.isVisible({ timeout: 4_000 }).catch(() => false)) {
    if (!(await radio.isChecked())) await radio.click();
    console.log('  → Free ラジオボタンを選択');
    return;
  }

  // <select> が存在する場合
  const sel = page.locator(SEL.priceSelect).first();
  if (await sel.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await sel.selectOption({ label: 'Free' });
    console.log('  → Free を選択（select要素）');
    return;
  }

  console.log('  [WARN] 価格フィールドが見つかりません。ポータルの画面を手動で確認してください。');
}

// ── サポート情報 ────────────────────────────────────────────────────────────
async function _fillSupport(page, email, url) {
  console.log(`  → サポートEメール: ${email}`);
  const emailInput = page.locator(SEL.supportEmailInput).first();
  await emailInput.waitFor({ timeout: 10_000 });
  await emailInput.fill(email);

  console.log(`  → サポートURL: ${url}`);
  const urlInput = page.locator(SEL.supportUrlInput).first();
  await urlInput.waitFor({ timeout: 10_000 });
  await urlInput.fill(url);
}

// ── セクション保存 ──────────────────────────────────────────────────────────
async function _saveSection(page, sectionName) {
  const btn = page.locator(SEL.saveButton).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log(`  → ${sectionName}: 保存完了`);
  } else {
    console.log(`  [INFO] ${sectionName}: 保存ボタンなし（自動保存または不要）`);
  }
}

// ── セクションナビゲーション ────────────────────────────────────────────────
async function _navigateSection(page, selector, label) {
  try {
    const nav = page.locator(selector).first();
    await nav.waitFor({ timeout: 5_000 });
    await nav.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    console.log(`  → セクション「${label}」へ移動`);
  } catch {
    // サイドバーナビがない場合（単一ページ構成）はスキップ
    console.log(`  [INFO] セクション「${label}」ナビなし（現在のページで継続）`);
  }
}

module.exports = { fillMeta };
