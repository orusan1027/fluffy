'use strict';
/**
 * Phase 2: Packaging — Fab.com 形式
 *
 * 現在はプレースホルダー。
 * Fab.com の要求するフォーマット（ZIP構成、メタデータ等）に
 * アセットを変換・整理する処理を実装予定。
 */

async function run(config, emit) {
  emit({ type: 'sys',  text: '[ Phase 2: Fab.com Packaging ]' });
  emit({ type: 'warn', text: '⚠ Fab.com パッケージングモジュールは準備中です。' });
  emit({ type: 'out',  text: `  アセット: ${config.assetName}` });

  // TODO: Fab.com フォーマット変換ロジック
}

module.exports = { run };
