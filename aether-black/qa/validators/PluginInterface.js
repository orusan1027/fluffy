'use strict';
/**
 * qa/validators/PluginInterface.js — AI評価プラグインフック
 *
 * 将来的なアーティファクト検出AI・構図評価AIを差し込むインターフェース。
 * registerPlugin() で登録 → QAFilter が自動的に呼び出す。
 */

class QAPlugin {
  /** プラグイン識別名（サブクラスでオーバーライド） */
  get name() { return 'QAPlugin'; }

  /**
   * @param {string} filePath 評価対象の画像パス
   * @returns {Promise<{ pass: boolean, score: number, reason?: string }>}
   */
  async evaluate(_filePath) {
    throw new Error(`${this.name}: evaluate() を実装してください`);
  }
}

const _registry = [];

function registerPlugin(plugin) {
  if (!(plugin instanceof QAPlugin)) {
    throw new TypeError('QAPlugin クラスを継承してください');
  }
  _registry.push(plugin);
}

function listPlugins() {
  return _registry.map(p => p.name);
}

async function runAll(filePath) {
  const results = [];
  for (const plugin of _registry) {
    try {
      const r = await plugin.evaluate(filePath);
      results.push({ plugin: plugin.name, ...r });
    } catch (err) {
      results.push({ plugin: plugin.name, pass: false, score: 0, reason: err.message });
    }
  }
  return results;
}

module.exports = { QAPlugin, registerPlugin, listPlugins, runAll };
