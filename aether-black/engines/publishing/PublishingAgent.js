'use strict';
/**
 * engines/publishing/PublishingAgent.js — 申請オーケストレーター
 */
const UnityPublisher = require('./UnityPublisher');
const FabPublisher   = require('./FabPublisher');

class PublishingAgent {
  constructor({ emit } = {}) {
    this._emit = emit || (() => {});
  }

  _log(text, type = 'out') { this._emit({ type, text, time: new Date().toISOString() }); }

  async publish({ assetName, metadata, packages, platforms = ['unity'] }) {
    this._log('━━━ Publishing Agent ━━━', 'sys');
    const results = {};

    if (platforms.includes('unity')) {
      try {
        this._log('  Unity Publisher Portal に提出中...');
        results.unity = await UnityPublisher.submit({ assetName, metadata, emit: this._emit });
      } catch (err) {
        this._log(`  ✗ Unity 提出失敗: ${err.message}`, 'error');
        results.unityError = err.message;
      }
    }

    if (platforms.includes('fab')) {
      try {
        this._log('  Fab.com に提出中...');
        results.fab = await FabPublisher.submit({
          assetName, metadata, zipPath: packages?.fab, emit: this._emit,
        });
      } catch (err) {
        this._log(`  ✗ Fab 提出失敗: ${err.message}`, 'error');
        results.fabError = err.message;
      }
    }

    return results;
  }
}

module.exports = PublishingAgent;
