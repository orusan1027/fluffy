'use strict';
/**
 * pipeline/PipelineRunner.js — v3.0 統合パイプラインオーケストレーター
 *
 * フェーズ構成:
 *   generation  → CreationEngine + BudgetGate + QAFilter
 *   packaging   → PackagingAgent (Unity .unitypackage + Fab ZIP)
 *   publishing  → PublishingAgent (Playwright 完全自動化)
 */
const { EventEmitter } = require('events');
const path             = require('path');
const fs               = require('fs');

const CreationEngine   = require('../engines/creation/CreationEngine');
const QAFilter         = require('../qa/QAFilter');
const PackagingAgent   = require('../engines/packaging/PackagingAgent');
const PublishingAgent  = require('../engines/publishing/PublishingAgent');

const DATA_DIR = path.join(__dirname, '..', 'data');

class PipelineRunner extends EventEmitter {
  constructor(config) {
    super();
    this._config  = config;
    this._stopped = false;
    this._engine  = null;
  }

  stop() {
    this._stopped = true;
    if (this._engine) this._engine.stop();
  }

  _emit(entry) {
    const e = { ...entry, time: entry.time || new Date().toISOString() };
    this.emit('log', e);
  }

  _log(text, type = 'out') { this._emit({ type, text }); }

  _checkStopped() {
    if (this._stopped) throw new Error('Pipeline: 停止シグナルを受信しました');
  }

  async run() {
    const {
      assetName,
      platforms    = ['unity'],
      startPhase   = 'publishing',
      theme        = 'cyberpunk',
      imageCount   = 10,
      imagesFolder,
      provider,
    } = this._config;

    const PACKAGES_DIR = path.join(DATA_DIR, 'packages', assetName);
    const emitFn       = e => this._emit(e);

    this._log('═══ AETHER BLACK v3.0 Pipeline START ═══', 'sys');
    this._log(`アセット: ${assetName} | フェーズ: ${startPhase} | プラットフォーム: ${platforms.join('+')}`, 'sys');

    // ═══════════════════════════════════════════════════════════════
    // Phase 1: Generation
    // ═══════════════════════════════════════════════════════════════
    let imagePaths = [];

    if (startPhase === 'generation') {
      this._checkStopped();
      this.emit('phase', 'generation');
      this._log('━━━ Phase 1: Creation Engine ━━━', 'sys');

      const engine    = new CreationEngine({ emit: emitFn, outputBase: path.join(DATA_DIR, 'generated') });
      this._engine    = engine;
      const genResult = await engine.generate({ theme, count: imageCount, assetName, provider });
      imagePaths      = genResult.images;
      this._engine    = null;

      this._checkStopped();
      this.emit('phase', 'qa');
      const qa       = new QAFilter({ emit: emitFn });
      const qaResult = await qa.validate(imagePaths);
      imagePaths     = qaResult.passed;

      if (imagePaths.length === 0) {
        throw new Error('QA フィルター: 合格した画像が0枚です。生成パラメーターを確認してください。');
      }

    } else {
      const folder = imagesFolder || path.join(DATA_DIR, 'generated', assetName);
      if (fs.existsSync(folder)) {
        const EXTS = new Set(['.png', '.jpg', '.jpeg']);
        imagePaths = fs.readdirSync(folder)
          .filter(f => EXTS.has(path.extname(f).toLowerCase()))
          .map(f => path.join(folder, f));
        this._log(`  既存画像: ${folder} (${imagePaths.length} 枚)`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Phase 2: Packaging
    // ═══════════════════════════════════════════════════════════════
    let packages = {};

    if (startPhase === 'generation' || startPhase === 'packaging') {
      this._checkStopped();
      this.emit('phase', 'packaging');
      this._log('━━━ Phase 2: Packaging Agent ━━━', 'sys');

      if (imagePaths.length === 0) {
        this._log('  ⚠ 画像が0枚のためパッケージングをスキップ', 'warn');
      } else {
        const packager = new PackagingAgent({ emit: emitFn });
        packages       = await packager.pack({ assetName, theme, imagePaths, outputDir: PACKAGES_DIR, platforms });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // Phase 3: Publishing
    // ═══════════════════════════════════════════════════════════════
    this._checkStopped();
    this.emit('phase', 'publishing');
    this._log('━━━ Phase 3: Publishing Agent ━━━', 'sys');

    if (!packages.unity && platforms.includes('unity')) {
      const f = path.join(PACKAGES_DIR, `${assetName.replace(/[^a-zA-Z0-9_]/g, '_')}.unitypackage`);
      if (fs.existsSync(f)) packages.unity = f;
    }
    if (!packages.fab && platforms.includes('fab')) {
      const f = path.join(PACKAGES_DIR, `${assetName.replace(/[^a-zA-Z0-9_]/g, '_')}_fab.zip`);
      if (fs.existsSync(f)) packages.fab = f;
    }

    const publisher = new PublishingAgent({ emit: emitFn });
    await publisher.publish({ assetName, metadata: packages.metadata || {}, packages, platforms });

    this._log('═══ パイプライン完了 ═══', 'sys');
  }
}

module.exports = PipelineRunner;
