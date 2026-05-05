'use strict';
/**
 * dashboard/server.js — AETHER BLACK v3.0 ダッシュボードサーバー
 */

// ① .env があれば読む（旧環境との互換）
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const vault          = require('../core/vault');
const BudgetGate     = require('../engines/creation/BudgetGate');
const { listThemes } = require('../engines/creation/themes/themePrompts');
const db             = require('../core/db');
const PipelineRunner = require('../pipeline/PipelineRunner');

// ② 起動時に vault の全値を process.env へ注入（.env を上書きしない）
//    これにより、process.env.UNITY_EMAIL などを直接参照するモジュールも動く
(function injectVaultToEnv() {
  const stored = vault.getAll();
  for (const [k, v] of Object.entries(stored)) {
    if (!process.env[k]) process.env[k] = v;   // .env の値を優先
  }
  const keys = Object.keys(stored);
  if (keys.length > 0) {
    console.log(`  [Vault] ${keys.length} 件の認証情報をロードしました`);
  } else {
    console.log('  [Vault] 未設定 — ダッシュボードの金庫から認証情報を入力してください');
  }
})();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── SSE / Pipeline 状態 ─────────────────────────────────────────────────────
let runState = { status: 'idle', logs: [], lastRun: null, currentPhase: null };
let activeRunner = null;
let sseClients   = [];

function pushLog(entry) {
  const e = { ...entry, time: entry.time || new Date().toISOString() };
  runState.logs.push(e);
  const payload = `data: ${JSON.stringify(e)}\n\n`;
  sseClients.forEach(res => { try { res.write(payload); } catch {} });
}

// ═══════════════════════════════════════════════════════════════
// Vault API
// ═══════════════════════════════════════════════════════════════
const VAULT_ALLOWED = [
  'UNITY_EMAIL','UNITY_PASSWORD','FAB_EMAIL','FAB_PASSWORD',
  'OPENAI_API_KEY','STABILITY_API_KEY','SUPPORT_EMAIL','SUPPORT_URL',
  'HEADLESS','PORT','GENERATION_PROVIDER',
  'BUDGET_MONTHLY_LIMIT_USD','BUDGET_ALERT_USD',
  'IMAGES_PER_PACK','IMAGE_WIDTH','IMAGE_HEIGHT','QA_REQUIRE_EXACT_8K',
  'GENERATION_LOCKED',
];

app.get('/api/vault', (req, res) => res.json(vault.getSafe()));

app.post('/api/vault', (req, res) => {
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k, v]) => VAULT_ALLOWED.includes(k) && v !== ''),
  );
  vault.set(updates);
  // 保存と同時に process.env も更新
  Object.assign(process.env, updates);
  res.json({ ok: true, saved: Object.keys(updates) });
});

// 認証情報の設定状況を返す（値は含めない）
app.get('/api/vault/status', (req, res) => {
  const all = vault.getAll();
  const CHECK_KEYS = [
    'UNITY_EMAIL','UNITY_PASSWORD','FAB_EMAIL','FAB_PASSWORD',
    'STABILITY_API_KEY','OPENAI_API_KEY','SUPPORT_EMAIL','SUPPORT_URL',
  ];
  const status = {};
  for (const k of CHECK_KEYS) {
    status[k] = !!(all[k] && all[k].length > 0);
  }
  status.readyForUnity = status.UNITY_EMAIL && status.UNITY_PASSWORD;
  status.readyForFab   = status.FAB_EMAIL   && status.FAB_PASSWORD;
  status.generationLocked = (vault.get('GENERATION_LOCKED') !== 'false');
  res.json(status);
});

// ═══════════════════════════════════════════════════════════════
// Budget API
// ═══════════════════════════════════════════════════════════════
app.get('/api/budget', (req, res) => res.json(BudgetGate.status()));
app.post('/api/budget/reset', (req, res) => { BudgetGate.resetMonth(); res.json({ ok: true }); });

// ═══════════════════════════════════════════════════════════════
// Themes / Assets API
// ═══════════════════════════════════════════════════════════════
app.get('/api/themes', (req, res) => res.json(listThemes()));
app.get   ('/api/assets',     (req, res) => res.json(db.listAssets()));
app.post  ('/api/assets',     (req, res) => res.json(db.createAsset(req.body)));
app.put   ('/api/assets/:id', (req, res) => {
  const a = db.updateAsset(req.params.id, req.body);
  return a ? res.json(a) : res.status(404).json({ error: 'Not found' });
});
app.delete('/api/assets/:id', (req, res) => { db.deleteAsset(req.params.id); res.json({ ok: true }); });

// ═══════════════════════════════════════════════════════════════
// Status / Pipeline API
// ═══════════════════════════════════════════════════════════════
app.get('/api/status', (req, res) => res.json({
  status: runState.status, lastRun: runState.lastRun,
  currentPhase: runState.currentPhase, logCount: runState.logs.length,
}));

app.post('/api/run', (req, res) => {
  if (runState.status === 'running') return res.status(409).json({ error: '既に実行中です' });

  const {
    assetName    = 'MyAsset',
    platforms    = ['unity'],
    startPhase   = 'publishing',
    theme        = 'cyberpunk',
    imageCount   = 10,
    imagesFolder, provider,
  } = req.body;

  runState = {
    status: 'running', logs: [],
    lastRun: new Date().toISOString(), currentPhase: startPhase,
  };

  activeRunner = new PipelineRunner({
    assetName, platforms, startPhase, theme, imageCount, imagesFolder, provider,
  });
  activeRunner.on('log',   entry => pushLog(entry));
  activeRunner.on('phase', phase => { runState.currentPhase = phase; });
  activeRunner.run()
    .then(()    => { runState.status = 'done';  runState.currentPhase = null; })
    .catch(err  => {
      pushLog({ type: 'error', text: `Pipeline エラー: ${err.message}` });
      runState.status = 'error'; runState.currentPhase = null;
    })
    .finally(() => { activeRunner = null; });

  res.json({ started: true });
});

app.post('/api/stop', (req, res) => {
  if (activeRunner) {
    activeRunner.stop();
    pushLog({ type: 'sys', text: '─── 停止リクエスト受信 ───' });
    runState.status = 'idle';
    activeRunner = null;
  }
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// SSE / Screenshots
// ═══════════════════════════════════════════════════════════════
app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(': connected\n\n');
  for (const e of runState.logs) res.write(`data: ${JSON.stringify(e)}\n\n`);
  sseClients.push(res);
  req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});

app.get('/api/screenshots', (req, res) => {
  const dir = path.join(__dirname, '..', 'data', 'screenshots');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.png'))
    .sort().reverse().slice(0, 20)
    .map(f => ({ name: f, url: `/screenshots/${f}` }));
  res.json(files);
});
app.use('/screenshots', express.static(path.join(__dirname, '..', 'data', 'screenshots')));

// ═══════════════════════════════════════════════════════════════
// 起動
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, '127.0.0.1', () => {
  console.log('\n  ╔═══════════════════════════════════════════╗');
  console.log('  ║  AETHER BLACK v3.0 Dashboard              ║');
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log(`  → http://localhost:${PORT}\n`);
});
