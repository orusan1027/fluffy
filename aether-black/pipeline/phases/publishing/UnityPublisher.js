'use strict';
/**
 * Phase 3: Publishing — Unity Publisher Portal
 *
 * 既存の portal-agent/submit.js をサブプロセスとして呼び出す。
 * 認証情報は親プロセス（server.js）が root .env から読み込み、
 * spawn の env オプションで引き渡すため、
 * portal-agent/ 側に .env ファイルが不要。
 */

const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const SUBMIT_SCRIPT = path.join(__dirname, '..', '..', '..', 'portal-agent', 'submit.js');

async function run(config, emit) {
  emit({ type: 'sys', text: '[ Phase 3: Unity Publisher Portal ]' });

  if (!fs.existsSync(SUBMIT_SCRIPT)) {
    throw new Error(`submit.js が見つかりません: ${SUBMIT_SCRIPT}`);
  }

  // config.env は server.js が process.env から渡したもの（root .env 読み込み済み）
  const env = {
    ...config.env,
    ASSET_NAME:    config.assetName,
    IMAGES_FOLDER: config.imagesFolder,
  };

  emit({ type: 'out', text: `  スクリプト: ${SUBMIT_SCRIPT}` });
  emit({ type: 'out', text: `  アセット  : ${config.assetName}` });
  emit({ type: 'out', text: `  モード    : ${env.HEADLESS === 'true' ? 'ヘッドレス' : 'ブラウザあり'}` });

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [SUBMIT_SCRIPT], {
      cwd: path.dirname(SUBMIT_SCRIPT),
      env,
    });

    proc.stdout.on('data', d => emit({ type: 'out', text: d.toString().trimEnd() }));
    proc.stderr.on('data', d => emit({ type: 'err', text: d.toString().trimEnd() }));
    proc.on('close', code => {
      code === 0 ? resolve() : reject(new Error(`Unity Publisher が終了しました (code: ${code})`));
    });
  });
}

module.exports = { run };
