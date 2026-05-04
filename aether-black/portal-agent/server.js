'use strict';
/**
 * AETHER BLACK — Dashboard Server
 * http://localhost:3000 で管理画面を提供する。
 *
 * 起動: node server.js
 */

require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const path           = require('path');
const fs             = require('fs');
const { spawn }      = require('child_process');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

// ── 実行状態 ────────────────────────────────────────────────────────────────
let runState = {
  status:  'idle',   // idle | running | done | error
  logs:    [],
  lastRun: null,
};
let activeProcess = null;
let sseClients    = [];

// ── ログをブロードキャスト（SSE + メモリ） ──────────────────────────────────
function addLog(type, text) {
  const entry = { type, text: text.trimEnd(), time: new Date().toISOString() };
  runState.logs.push(entry);
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

// ── .env 読み書き ───────────────────────────────────────────────────────────
const ENV_PATH = path.join(__dirname, '.env');

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    fs.readFileSync(ENV_PATH, 'utf8')
      .split('\n')
      .map(l => {
        // コメント行と空行を除外
        if (!l.trim() || l.trim().startsWith('#')) return null;
        const idx = l.indexOf('=');
        return idx > 0 ? [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] : null;
      })
      .filter(Boolean)
  );
}

function writeEnvFile(updates) {
  const current  = readEnvFile();
  const merged   = { ...current, ...updates };
  const contents = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, contents, 'utf8');
  Object.assign(process.env, updates); // 現プロセスの env にも即反映
}

// ── GET /api/status ─────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ status: runState.status, lastRun: runState.lastRun });
});

// ── GET /api/config（パスワードは送らない）──────────────────────────────────
app.get('/api/config', (req, res) => {
  const env = readEnvFile();
  delete env.UNITY_PASSWORD;
  res.json(env);
});

// ── POST /api/config ────────────────────────────────────────────────────────
app.post('/api/config', (req, res) => {
  const ALLOWED = ['ASSET_NAME', 'UNITY_EMAIL', 'UNITY_PASSWORD',
                   'SUPPORT_EMAIL', 'SUPPORT_URL', 'SUBMISSION_MESSAGE', 'HEADLESS'];
  const updates = Object.fromEntries(
    Object.entries(req.body)
      .filter(([k, v]) => ALLOWED.includes(k) && v !== '')
  );
  writeEnvFile(updates);
  res.json({ ok: true });
});

// ── POST /api/run ───────────────────────────────────────────────────────────
app.post('/api/run', (req, res) => {
  if (runState.status === 'running') {
    return res.status(409).json({ error: '既に実行中です' });
  }

  runState.status  = 'running';
  runState.logs    = [];
  runState.lastRun = new Date().toISOString();

  // submit.js は自身で dotenv.config() するため、最新 .env を自動読み込みする
  activeProcess = spawn('node', ['submit.js'], {
    cwd: __dirname,
    env: { ...process.env },
  });

  activeProcess.stdout.on('data', d => addLog('out', d.toString()));
  activeProcess.stderr.on('data', d => addLog('err', d.toString()));
  activeProcess.on('close', code => {
    runState.status = code === 0 ? 'done' : 'error';
    addLog('sys', `─── プロセス終了 (exit code: ${code}) ───`);
    activeProcess = null;
  });

  res.json({ started: true });
});

// ── POST /api/stop ──────────────────────────────────────────────────────────
app.post('/api/stop', (req, res) => {
  if (activeProcess) {
    activeProcess.kill('SIGTERM');
    addLog('sys', '─── 強制停止されました ───');
    runState.status = 'idle';
    activeProcess   = null;
  }
  res.json({ ok: true });
});

// ── GET /api/logs/stream （Server-Sent Events）──────────────────────────────
app.get('/api/logs/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
  });

  // 既存ログを一括送信（ページリロード後の再接続に対応）
  for (const entry of runState.logs) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  sseClients.push(res);
  req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
});

// ── 起動 ────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\nAETHER BLACK Dashboard 起動完了`);
  console.log(`→ http://localhost:${PORT}\n`);
});
