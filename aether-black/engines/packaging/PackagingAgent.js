'use strict';
/**
 * engines/packaging/PackagingAgent.js — パッケージングオーケストレーター
 */
const path            = require('path');
const fs              = require('fs');
const MetadataBuilder = require('./MetadataBuilder');
const UnityPackager   = require('./UnityPackager');
const FabPackager     = require('./FabPackager');

class PackagingAgent {
  constructor({ emit } = {}) {
    this._emit = emit || (() => {});
  }

  _log(text, type = 'out') { this._emit({ type, text, time: new Date().toISOString() }); }

  async pack({ assetName, theme, imagePaths, outputDir, platforms = ['unity'] }) {
    this._log('━━━ Packaging Agent ━━━', 'sys');
    this._log(`アセット: ${assetName} | 画像: ${imagePaths.length}枚 | プラットフォーム: ${platforms.join(', ')}`);

    const metadata = MetadataBuilder.build({ assetName, theme, imageCount: imagePaths.length });
    const emit     = e => this._emit(e);
    const results  = { metadata };

    if (platforms.includes('unity')) {
      try {
        const pkgPath    = await UnityPackager.pack({ assetName, imagePaths, outputDir, metadata, emit });
        results.unity    = pkgPath;
        results.unityMB  = +(fs.statSync(pkgPath).size / 1024 / 1024).toFixed(1);
      } catch (err) {
        this._log(`✗ Unity パッケージ生成失敗: ${err.message}`, 'error');
        results.unityError = err.message;
      }
    }

    if (platforms.includes('fab')) {
      try {
        const zipPath  = await FabPackager.pack({ assetName, imagePaths, outputDir, metadata, emit });
        results.fab    = zipPath;
        results.fabMB  = +(fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
      } catch (err) {
        this._log(`✗ Fab ZIP 生成失敗: ${err.message}`, 'error');
        results.fabError = err.message;
      }
    }

    this._log(`✓ パッケージング完了 | Unity: ${results.unity ? results.unityMB+'MB' : 'N/A'} | Fab: ${results.fab ? results.fabMB+'MB' : 'N/A'}`);
    return results;
  }
}

module.exports = PackagingAgent;
