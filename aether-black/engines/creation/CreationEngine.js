'use strict';
/**
 * engines/creation/CreationEngine.js — 生成エンジン本体
 *
 * 1. BudgetGate で予算チェック（超過なら即遮断）
 * 2. プロバイダー（Stability / OpenAI）で画像をバッチ生成
 * 3. 生成完了後に実コストを記録
 */
const path       = require('path');
const fs         = require('fs');
const BudgetGate = require('./BudgetGate');
const { buildPrompts } = require('./themes/themePrompts');
const config     = require('../../core/config');

const PROVIDERS = {
  stability: require('./providers/StabilityProvider'),
  openai:    require('./providers/OpenAIProvider'),
};

class CreationEngine {
  constructor({ emit, outputBase } = {}) {
    this._emit       = emit || (() => {});
    this._outputBase = outputBase || path.join(__dirname, '..', '..', 'data', 'generated');
    this._stopped    = false;
  }

  stop() { this._stopped = true; }

  _log(text, type = 'out') { this._emit({ type, text, time: new Date().toISOString() }); }

  /**
   * @param {{ theme, count, assetName, provider }} opts
   * @returns {{ outputDir, images, cost }}
   */
  async generate({ theme, count, assetName, provider: providerKey }) {
    const provKey  = providerKey || config.GENERATION_PROVIDER || 'stability';
    const provider = PROVIDERS[provKey] || PROVIDERS.stability;

    this._log(`━━━ Creation Engine [${provKey}] ━━━`, 'sys');
    this._log(`テーマ: ${theme} | 枚数: ${count} | アセット: ${assetName}`);

    // ── 予算安全弁 ──────────────────────────────────────────────────
    let estimate;
    try {
      estimate = BudgetGate.check(provider.PROVIDER_ID, count);
      const st = BudgetGate.status();
      this._log(`💰 推定コスト: $${estimate.toFixed(2)} | 残高: $${st.remaining.toFixed(2)} / $${st.monthlyLimit}`);
    } catch (err) {
      this._log(err.message, 'error');
      throw err;
    }

    const outDir = path.join(this._outputBase, assetName);
    fs.mkdirSync(outDir, { recursive: true });

    const prompts = buildPrompts(theme, count);
    const W = parseInt(config.IMAGE_WIDTH)  || 7680;
    const H = parseInt(config.IMAGE_HEIGHT) || 4320;

    const images      = [];
    let successCount  = 0;

    for (let i = 0; i < prompts.length; i++) {
      if (this._stopped) { this._log('  停止シグナルを受信', 'warn'); break; }

      const p          = prompts[i];
      const outputPath = path.join(outDir, `img_${String(i + 1).padStart(3, '0')}.png`);

      this._log(`  [${i + 1}/${count}] 生成中... seed=${p.seed}`);
      try {
        await provider.generate({ ...p, outputPath, width: W, height: H });
        images.push(outputPath);
        successCount++;
        const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
        this._log(`  ✓ ${path.basename(outputPath)} (${sizeMB}MB)`);
      } catch (err) {
        this._log(`  ✗ [${i + 1}] 生成失敗: ${err.message}`, 'error');
      }

      if (i < prompts.length - 1) await new Promise(r => setTimeout(r, 500));
    }

    const actualCost = BudgetGate.record(provider.PROVIDER_ID, successCount);
    const st         = BudgetGate.status();
    this._log(`💰 実コスト: $${actualCost.toFixed(2)} | 今月累計: $${st.monthlySpend.toFixed(2)}`);
    this._log(`✓ 生成完了: ${successCount}/${count} 枚`);

    return { outputDir: outDir, images, cost: actualCost };
  }
}

module.exports = CreationEngine;
