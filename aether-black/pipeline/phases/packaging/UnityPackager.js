'use strict';
/**
 * Phase 2: Packaging — Unity .unitypackage 化
 *
 * 現在はプレースホルダー。
 * 将来的に Unity Hub CLI / Asset Store Tools CLI を使って
 * コマンドラインから .unitypackage を自動生成する。
 *
 * 手動での対応方法（現在）:
 *   Unity Hub でプロジェクトを開く
 *   → メニュー: AETHER BLACK > Build Demo Scene
 *   → Asset Store Tools でパッケージをエクスポート
 *
 * 拡張方法:
 *   Unity の -executeMethod オプションを使い、
 *   AetherBlackSceneBuilder.BuildFromCLI() を呼び出す
 */

async function run(config, emit) {
  emit({ type: 'sys',  text: '[ Phase 2: Unity Packaging ]' });
  emit({ type: 'warn', text: '⚠ Unityパッケージング自動化は現在準備中です。' });
  emit({ type: 'warn', text: '  以下の手順を手動で実施してください:' });
  emit({ type: 'out',  text: '  1. Unity Hub でプロジェクトを開く' });
  emit({ type: 'out',  text: '  2. メニュー: AETHER BLACK > Build Demo Scene' });
  emit({ type: 'out',  text: '  3. Asset Store Tools でパッケージをエクスポート' });
  emit({ type: 'out',  text: `  対象アセット: ${config.assetName}` });

  // TODO: Unity CLI 連携
  // const unityPath = '/Applications/Unity/Hub/Editor/.../Unity';
  // await spawn(unityPath, [
  //   '-batchmode', '-quit',
  //   '-projectPath', config.projectPath,
  //   '-executeMethod', 'AetherBlack.AetherBlackSceneBuilder.BuildFromCLI',
  // ]);
}

module.exports = { run };
