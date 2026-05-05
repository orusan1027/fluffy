'use strict';
/**
 * Phase 1: Generation — 画像アセット生成
 *
 * 現在はプレースホルダー。
 * 将来的に DALL·E / Stable Diffusion / Midjourney API 等を組み込む。
 *
 * 拡張方法:
 *   1. AI API クライアントを追加
 *   2. config.assetName / config.imageCount などのパラメータを受け取る
 *   3. 生成した画像を config.imagesFolder に保存
 *   4. emit({ type:'out', text:'... 生成完了' }) でログを配信
 */

async function run(config, emit) {
  emit({ type: 'sys',  text: '[ Phase 1: Generation ]' });
  emit({ type: 'warn', text: '⚠ AI画像生成モジュールは現在準備中です。' });
  emit({ type: 'warn', text: '  既存の画像フォルダをそのまま使用して次フェーズへ進みます。' });
  emit({ type: 'out',  text: `  画像フォルダ: ${config.imagesFolder || 'Assets/Images'}` });

  // TODO: ここに AI 生成ロジックを追加
  // 例:
  //   const images = await generateImages(config.assetName, 10);
  //   for (const img of images) {
  //     await saveImage(img, config.imagesFolder);
  //     emit({ type:'out', text: `  生成完了: ${img.name}` });
  //   }
}

module.exports = { run };
