'use strict';
/**
 * lib/submission.js — 提出メッセージ入力・法的同意・Submit
 *
 * ポータルの Submit フロー（最終ステップ）を自動化する。
 *
 * 鉄則:
 *   - キーワードにタイトル記載単語を入れない
 *   - パッケージ名に [ ] などの記号を含めない
 *   → これらはポータル側の入力フォームで入力する手前の段階で守ること。
 *     このスクリプトは「すでにメタデータが正しく入力済み」の状態を前提とする。
 *
 * ⚠️ セレクタの更新方法:
 *   npm run codegen を実行し、Submit タブで実際の要素を記録して差し替える。
 */

// ── セレクタ定義 ────────────────────────────────────────────────────────────
const SEL = {
  // Submit セクションへのナビゲーション
  submitSection: [
    'a:has-text("Submit")',
    'nav li:has-text("Submit")',
    '[role="tab"]:has-text("Submit")',
    'button:has-text("Submit for review")',
  ].join(', '),

  // 審査員へのメッセージ（Submission Message）テキストエリア
  messageArea: [
    'textarea[name*="message"]',
    'textarea[name*="submission"]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="reviewer" i]',
    '[data-testid="submission-message"]',
    'textarea',  // フォールバック: ページ内に textarea が1つしかない場合
  ].join(', '),

  // 「自動公開」への同意チェックボックス
  // Unity ポータル表示文例: "I agree to automatically publish..."
  autoPublishCheckbox: [
    'input[name*="autoPublish"]',
    'input[name*="auto_publish"]',
    '[data-testid="auto-publish-checkbox"]',
    'label:has-text("automatically") input[type="checkbox"]',
    'label:has-text("auto-publish") input[type="checkbox"]',
  ].join(', '),

  // 「権利の所有」への同意チェックボックス
  // Unity ポータル表示文例: "I confirm that I own the rights..."
  rightsCheckbox: [
    'input[name*="rights"]',
    'input[name*="ownership"]',
    '[data-testid="rights-checkbox"]',
    'label:has-text("rights") input[type="checkbox"]',
    'label:has-text("own") input[type="checkbox"]',
  ].join(', '),

  // 最終 Submit ボタン
  submitButton: [
    'button:has-text("Submit for Review")',
    'button:has-text("Submit For Review")',
    'button:has-text("Submit")',
    '[data-testid="submit-button"]',
    'input[type="submit"][value*="Submit"]',
  ].join(', '),

  // 確認ダイアログの「確定」ボタン（モーダルが出る場合）
  confirmButton: [
    '[role="dialog"] button:has-text("Submit")',
    '[role="dialog"] button:has-text("Confirm")',
    '[role="dialog"] button:has-text("Yes")',
    '.modal button:has-text("Submit")',
  ].join(', '),

  // 提出成功メッセージ（完了確認用）
  successIndicator: [
    '[data-testid="success-message"]',
    '.success-banner',
    ':has-text("successfully submitted")',
    ':has-text("Under Review")',
    ':has-text("submitted for review")',
  ].join(', '),
};

/**
 * 提出メッセージを入力し、法的同意チェックボックスをオンにして Submit する。
 * @param {import('playwright').Page} page
 * @param {string} submissionMessage  審査員へのメッセージ
 */
async function submitPkg(page, submissionMessage) {
  // ── Submit セクションへ移動 ─────────────────────────────────────────────
  await _navigateToSubmitSection(page);

  // ── 提出メッセージ入力 ──────────────────────────────────────────────────
  await _fillSubmissionMessage(page, submissionMessage);

  // ── 法的同意チェックボックス ────────────────────────────────────────────
  await _checkConsent(page, SEL.autoPublishCheckbox, '自動公開への同意');
  await _checkConsent(page, SEL.rightsCheckbox,       '権利所有の確認');

  // ── Submit ボタンをクリック ─────────────────────────────────────────────
  await _clickSubmit(page);

  // ── 確認ダイアログへの対応 ─────────────────────────────────────────────
  await _handleConfirmDialog(page);

  // ── 提出完了の確認 ────────────────────────────────────────────────────
  await _verifySuccess(page);
}

// ── Submit セクションへのナビゲーション ────────────────────────────────────
async function _navigateToSubmitSection(page) {
  try {
    const nav = page.locator(SEL.submitSection).first();
    await nav.waitFor({ timeout: 5_000 });
    await nav.click();
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    console.log(`  → Submit セクションへ移動: ${page.url()}`);
  } catch {
    console.log('  [INFO] Submit セクションのナビゲーションをスキップ（現在のページで継続）');
  }
}

// ── 提出メッセージ入力 ──────────────────────────────────────────────────────
async function _fillSubmissionMessage(page, message) {
  console.log('  → 審査員へのメッセージを入力...');

  const area = page.locator(SEL.messageArea).first();
  await area.waitFor({ timeout: 15_000 });

  // 既存テキストをクリアして入力
  await area.click();
  await area.selectText();
  await area.fill(message);

  console.log('  → メッセージ入力完了');
  console.log(`  → 内容: "${message.substring(0, 60)}..."`);
}

// ── チェックボックスをオンにする ────────────────────────────────────────────
async function _checkConsent(page, selector, label) {
  const checkbox = page.locator(selector).first();

  if (!(await checkbox.isVisible({ timeout: 5_000 }).catch(() => false))) {
    console.log(`  [WARN] 「${label}」チェックボックスが見つかりません。`);
    return;
  }

  const isChecked = await checkbox.isChecked().catch(() => false);
  if (!isChecked) {
    await checkbox.click();
    // クリック後にチェック状態を確認
    await page.waitForTimeout(300);
    const nowChecked = await checkbox.isChecked().catch(() => false);
    if (!nowChecked) {
      // ラベルをクリックする代替手段
      const label_ = page.locator(`label:has(${selector}), label[for="${await checkbox.getAttribute('id') ?? ''}"]`).first();
      if (await label_.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await label_.click();
      }
    }
    console.log(`  → 「${label}」: チェック完了`);
  } else {
    console.log(`  → 「${label}」: 既にチェック済み`);
  }
}

// ── Submit ボタンのクリック ─────────────────────────────────────────────────
async function _clickSubmit(page) {
  console.log('  → Submit ボタンをクリック...');

  const btn = page.locator(SEL.submitButton).first();
  await btn.waitFor({ timeout: 10_000 });

  // ボタンが無効化されている場合は警告（同意チェックが不足している可能性）
  const isDisabled = await btn.isDisabled().catch(() => false);
  if (isDisabled) {
    throw new Error(
      'Submit ボタンが無効状態です。\n' +
      '  ・法的同意チェックボックスがすべてオンになっているか確認してください。\n' +
      '  ・メタデータに未入力項目が残っていないか確認してください。'
    );
  }

  await btn.click();
  console.log('  → Submit ボタンをクリックしました');
}

// ── 確認ダイアログへの対応 ─────────────────────────────────────────────────
async function _handleConfirmDialog(page) {
  try {
    const confirm = page.locator(SEL.confirmButton).first();
    await confirm.waitFor({ timeout: 5_000 });
    await confirm.click();
    console.log('  → 確認ダイアログを承認');
  } catch {
    // ダイアログなしは正常（一部ポータルではダイアログが出ない）
  }
}

// ── 提出完了の確認 ──────────────────────────────────────────────────────────
async function _verifySuccess(page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // 成功インジケーターを確認（任意）
  try {
    await page.locator(SEL.successIndicator).first().waitFor({ timeout: 8_000 });
    console.log('  → 提出成功メッセージを確認');
  } catch {
    // メッセージが見つからなくてもURLやステータス変化で完了とみなす
    console.log(`  [INFO] 提出後URL: ${page.url()}`);
    console.log('  → 提出処理完了（成功確認メッセージは自動検出できませんでした）');
  }
}

module.exports = { submitPkg };
