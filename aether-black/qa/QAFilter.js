'use strict';
/**
 * qa/QAFilter.js — QAオーケストレーター
 * 整合性 → 解像度 → プラグイン の順で検証。
 */
const path = require('path');
const { validate }           = require('./validators/IntegrityValidator');
const { getDimensions, is8K, describeResolution } = require('./validators/ResolutionValidator');
const { runAll }             = require('./validators/PluginInterface');
const config                 = require('../core/config');

class QAFilter {
  constructor({ emit } = {}) {
    this._emit = emit || (() => {});
  }

  _log(text, type = 'out') { this._emit({ type, text, time: new Date().toISOString() }); }

  /**
   * @param {string[]} imagePaths
   * @returns {{ passed: string[], failed: Array<{path, issues}> }}
   */
  async validate(imagePaths) {
    const requireExact8K = config.QA_REQUIRE_EXACT_8K === 'true';

    this._log('━━━ QA Filter ━━━', 'sys');
    this._log(`検証対象: ${imagePaths.length} 枚 | 8K厳格モード: ${requireExact8K}`);

    const passed = [];
    const failed = [];

    for (const fp of imagePaths) {
      const name   = path.basename(fp);
      const issues = [];

      // 1. 整合性チェック
      const integ = validate(fp);
      if (!integ.ok) {
        issues.push(`[整合性] ${integ.reason}`);
      }

      // 2. 解像度チェック
      if (integ.ok) {
        const dims = getDimensions(fp);
        if (!dims) {
          issues.push('[解像度] ヘッダー読み取り失敗');
        } else {
          const tag = describeResolution(dims);
          if (requireExact8K && !is8K(dims)) {
            issues.push(`[解像度] ${tag} — 8K (7680×4320) 未満`);
          } else {
            const sizeMB = (integ.size / 1024 / 1024).toFixed(1);
            this._log(`  ✓ ${name} — ${tag} (${dims.width}×${dims.height}) ${sizeMB}MB`);
          }
        }
      }

      // 3. プラグイン評価
      const pluginResults = await runAll(fp);
      for (const r of pluginResults) {
        if (!r.pass) issues.push(`[${r.plugin}] ${r.reason || 'score=' + r.score}`);
      }

      if (issues.length > 0) {
        this._log(`  ✗ ${name}: ${issues.join(' / ')}`, 'warn');
        failed.push({ path: fp, issues });
      } else {
        passed.push(fp);
      }
    }

    this._log(`✓ QA完了: ${passed.length} 合格 / ${failed.length} 不合格`);
    return { passed, failed };
  }
}

module.exports = QAFilter;
