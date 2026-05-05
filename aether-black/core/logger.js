'use strict';
/**
 * core/logger.js — 構造化ロガー（SSE連動）
 */
const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'data', 'logs');
const ICONS   = { info: '✓', warn: '⚠', error: '✗', sys: '·', out: ' ' };

let _emitFn  = null;
let _session = [];

function setEmitter(fn) { _emitFn = fn; }

function write(level, text, meta = {}) {
  const entry = { level, text, time: new Date().toISOString(), ...meta };
  _session.push(entry);
  if (_emitFn) _emitFn(entry);
  process.stdout.write(`[${entry.time.slice(11, 19)}] ${ICONS[level] || ' '} ${text}\n`);
}

const logger = {
  setEmitter,
  info:  (t, m) => write('info',  t, m),
  warn:  (t, m) => write('warn',  t, m),
  error: (t, m) => write('error', t, m),
  sys:   (t, m) => write('sys',   t, m),
  out:   (t, m) => write('out',   t, m),
  flush(name) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `${name}-${Date.now()}.jsonl`);
    fs.writeFileSync(file, _session.map(e => JSON.stringify(e)).join('\n'), 'utf8');
    _session = [];
    return file;
  },
};

module.exports = logger;
