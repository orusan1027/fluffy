'use strict';
/**
 * pipeline/PipelineRunner.js — パイプライン統括
 *
 * 3つのフェーズ（Generation → Packaging → Publishing）を
 * 設定に応じて順番に実行する。
 * EventEmitter でログを配信し、dashboard/server.js が SSE で受け取る。
 */

const EventEmitter = require('events');

// フェーズモジュールの遅延 require（使われないモジュールは読み込まない）
const PHASE_MODULES = {
  generation:       () => require('./phases/generation/AssetGenerator'),
  packaging_unity:  () => require('./phases/packaging/UnityPackager'),
  packaging_fab:    () => require('./phases/packaging/FabPackager'),
  publishing_unity: () => require('./phases/publishing/UnityPublisher'),
  publishing_fab:   () => require('./phases/publishing/FabPublisher'),
};

class PipelineRunner extends EventEmitter {
  /**
   * @param {{
   *   assetName:    string,
   *   platforms:    string[],   // ['unity'] | ['fab'] | ['unity','fab']
   *   startPhase:   string,     // 'generation' | 'packaging' | 'publishing'
   *   imagesFolder: string,
   *   env:          object,     // 継承した process.env
   * }} config
   */
  constructor(config) {
    super();
    this.config  = config;
    this.stopped = false;
  }

  async run() {
    const log = (type, text) =>
      this.emit('log', { type, text, time: new Date().toISOString() });

    log('sys', '═══ AETHER BLACK Pipeline START ═══');
    log('sys', `アセット       : ${this.config.assetName}`);
    log('sys', `プラットフォーム: ${this.config.platforms.join(', ')}`);
    log('sys', `開始フェーズ   : ${this.config.startPhase}`);

    const phases = this._buildPhaseList();

    for (const { label, key } of phases) {
      if (this.stopped) {
        log('sys', '─── 停止シグナルを受信しました ───');
        break;
      }

      log('sys', `\n──── ${label} 開始 ────`);
      this.emit('phase', key);

      try {
        const mod = PHASE_MODULES[key]();
        await mod.run(this.config, (entry) => {
          if (!this.stopped) this.emit('log', entry);
        });
        log('sys', `✓ ${label} 完了`);
      } catch (err) {
        log('err', `✗ ${label} エラー: ${err.message}`);
        throw err;
      }
    }

    log('sys', '\n═══ Pipeline 完了 ═══');
  }

  stop() { this.stopped = true; }

  /** 設定に基づいて実行するフェーズのリストを組み立てる */
  _buildPhaseList() {
    const { startPhase, platforms } = this.config;
    const order  = ['generation', 'packaging', 'publishing'];
    const start  = order.indexOf(startPhase);
    const active = order.slice(start >= 0 ? start : 2);
    const list   = [];

    for (const phase of active) {
      if (phase === 'generation') {
        list.push({ label: 'Phase 1: Generation（画像制作）', key: 'generation' });

      } else if (phase === 'packaging') {
        for (const p of platforms) {
          const label = `Phase 2: Packaging → ${p === 'fab' ? 'Fab.com' : 'Unity'}`;
          list.push({ label, key: `packaging_${p}` });
        }

      } else if (phase === 'publishing') {
        for (const p of platforms) {
          const label = `Phase 3: Publishing → ${p === 'fab' ? 'Fab.com' : 'Unity'}`;
          list.push({ label, key: `publishing_${p}` });
        }
      }
    }

    return list;
  }
}

module.exports = PipelineRunner;
