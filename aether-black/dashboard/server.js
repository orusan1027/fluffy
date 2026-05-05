'use strict';
/**
 * dashboard/server.js — AETHER BLACK v2.0 ダッシュボードサーバー
 *
 * 起動: node dashboard/server.js  (aether-black/ 直下で実行)
 */

// root .env を最優先で読み込む（portal-agent/.env より上位）
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express        = require('express');
const cors           = require('cors');
const path           = require('path');
const fs             = require('fs');
const db             = require('../core/db');
const PipelineRunner = require('../pipeline/PipelineRunner');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 実行状態 ────────────────────────────────────────────────────────────────
let runState = {
  status:       'idle',   // idle | running | done | error
  logs:         [],
  lastRun:      null,
  currentPhase: null,
};
let activeRunner = null;
let sseClients   = [];

function addLog(entry) {
  const e = { ...entry, time: entry.time || new Date().toISOString() };
  runState.logs.push(e);
  const payload = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

// ── root .env 読み書き ──────────────────────────────────────────────────────
const ENV_PATH = path.join(__dirname, '..', '.env');

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    // .env が無ければ .env.example をコピーして作成
    const example = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(example)) fs.copyFileSync(example, ENV_PATH);
    else return {};
  }
  return Object.fromEntries(
    fs.readFileSync(ENV_PATH, 'utf8').split('\n').flatMap(line => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return [];
      const idx = l.indexOf('=');
      return idx > 0 ? [[l.slice(0, idx).trim(), l.slice(idx + 1).trim()]] : [];
    })
  );
}

function writeEnv(updates) {
  const current  = readEnv();
  const merged   = { ...current, ...updates };
  const contents = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, contents, 'utf8');
  Object.assign(process.env, updates);
}

// ════════════════════════════════════════════════════════════════════════════
// API: アセット管理
// ════════════════════════════════════════════════════════════════════════════
app.get   ('/api/assets',      (req, res) => res.json(db.listAssets()));
app.post  ('/api/assets',      (req, res) => res.json(db.createAsset(req.body)));
app.put   ('/api/assets/:id',  (req, res) => {
  const a = db.updateAsset(req.params.id, req.body);
  return a ? res.json(a) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/assets/:id',  (req, res) => {
  db.deleteAsset(req.params.id);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// API: 設定管理（root .env）
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/config', (req, res) => {
  const env = readEnv();
  // パスワード類はフロントに渡さない
  delete env.UNITY_PASSWORD;
  delete env.FAB_PASSWORD;
  res.json(env);
});

app.post('/api/config', (req, res) => {
  const ALLOWED = [
    'ASSET_NAME', 'UNITY_EMAIL', 'UNITY_PASSWORD',
    'FAB_EMAIL',  'FAB_PASSWORD',
    'SUPPORT_EMAIL', 'SUPPORT_URL', 'HEADLESS',
  ];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k, v]) => ALLOWED.includes(k) && v !== '')
  );
  writeEnv(updates);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// API: ステータス
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/status', (req, res) => res.json({
  status:       runState.status,
  lastRun:      runState.lastRun,
  currentPhase: runState.currentPhase,
}));

// ════════════════════════════════════════════════════════════════════════════
// API: パイプライン実行
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/run', (req, res) => {
  if (runState.status === 'running') {
    return res.status(409).json({ error: '既に実行中です' });
  }

  const {
    assetName    = process.env.ASSET_NAME || 'MyAsset',
    platforms    = ['unity'],
    startPhase   = 'publishing',
    imagesFolder = 'Assets/Images',
  } = req.body;

  runState.status       = 'running';
  runState.logs         = [];
  runState.lastRun      = new Date().toISOString();
  runState.currentPhase = startPhase;

  const config = {
    assetName,
    platforms,
    startPhase,
    imagesFolder,
    env: { ...process.env },  // root .env 読み込み済みの env を渡す
  };

  activeRunner = new PipelineRunner(config);

  activeRunner.on('log',   entry => addLog(entry));
  activeRunner.on('phase', phase => { runState.currentPhase = phase; });

  activeRunner.run()
    .then(() => { runState.status = 'done';  runState.currentPhase = null; })
    .catch(() => { runState.status = 'error'; runState.currentPhase = null; })
    .finally(() => { activeRunner = null; });

  res.json({ started: true });
});

app.post('/api/stop', (req, res) => {
  if (activeRunner) {
    activeRunner.stop();
    addLog({ type: 'sys', text: '─── 停止リクエストを受信しました ───' });
    runState.status = 'idle';
    activeRunner    = null;
  }
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// API: ログ配信（Server-Sent Events）
// ════════════════════════════════════════════════════════════════════════════
app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });
  // ページリロード後のクライアントに既存ログを送信
  for (const e of runState.logs) res.write(`data: ${JSON.stringify(e)}\n\n`);
  sseClients.push(res);
  req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});

// ════════════════════════════════════════════════════════════════════════════
// 起動
// ════════════════════════════════════════════════════════════════════════════
app.listen(PORT, '127.0.0.1', () => {
  console.log('\n  ╔════════════════════════════════════╗');
  console.log('  ║  AETHER BLACK v2.0 Dashboard       ║');
  console.log('  ╚════════════════════════════════════╝');
  console.log(`  → http://localhost:${PORT}\n`);
});
