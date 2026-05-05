'use strict';
/**
 * core/vault.js — AES-256-GCM 暗号認証金庫
 *
 * 認証情報を data/vault/credentials.enc に暗号化保存。
 * マスターキーはマシン固有情報から導出（VAULT_KEY 環境変数で上書き可）。
 * env > vault の優先順位で値を返す。
 */
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const VAULT_FILE = path.join(__dirname, '..', 'data', 'vault', 'credentials.enc');
const ALGO       = 'aes-256-gcm';
const SALT       = 'aether-black-vault-v1';

const SENSITIVE = new Set([
  'UNITY_PASSWORD', 'FAB_PASSWORD', 'OPENAI_API_KEY', 'STABILITY_API_KEY',
]);

function masterKey() {
  const seed = process.env.VAULT_KEY ||
    `${os.hostname()}-${os.userInfo().username}-${os.platform()}-aether`;
  return crypto.scryptSync(seed, SALT, 32);
}

function encrypt(plaintext) {
  const iv  = crypto.randomBytes(12);
  const key = masterKey();
  const c   = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(ciphertext) {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const key = masterKey();
  const d   = crypto.createDecipheriv(ALGO, key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

function load() {
  if (!fs.existsSync(VAULT_FILE)) return {};
  try {
    return JSON.parse(decrypt(fs.readFileSync(VAULT_FILE, 'utf8').trim()));
  } catch {
    return {};
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(VAULT_FILE), { recursive: true });
  fs.writeFileSync(VAULT_FILE, encrypt(JSON.stringify(data)), { mode: 0o600 });
}

const vault = {
  /** 値取得: env > vault > null */
  get(key) {
    if (process.env[key]) return process.env[key];
    return load()[key] ?? null;
  },

  /** 複数キーを一括取得 */
  getAll() {
    const stored = load();
    const result = { ...stored };
    for (const k of Object.keys(result)) {
      if (process.env[k]) result[k] = process.env[k];
    }
    return result;
  },

  /** 機密をマスクしたセーフビュー */
  getSafe() {
    const all = this.getAll();
    const out = { ...all };
    for (const k of SENSITIVE) {
      if (out[k]) out[k] = '••••••••';
    }
    return out;
  },

  /** 値を保存（process.env も更新） */
  set(updates) {
    const current = load();
    save({ ...current, ...updates });
    Object.assign(process.env, updates);
  },

  /** キーを削除 */
  delete(key) {
    const d = load();
    delete d[key];
    save(d);
    delete process.env[key];
  },

  /** Vault が存在するか */
  exists() { return fs.existsSync(VAULT_FILE); },
};

module.exports = vault;
