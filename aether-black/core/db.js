'use strict';
/**
 * core/db.js — アセットメタデータ管理（JSON ファイルDB）
 * SQLite 不要、ネイティブ依存ゼロ。data/assets.json に永続化。
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'assets.json');

function _load() {
  if (!fs.existsSync(DATA_FILE)) return { assets: [] };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { assets: [] }; }
}

function _save(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/** 全アセット取得 */
function listAssets() {
  return _load().assets;
}

/** ID でアセット取得 */
function getAsset(id) {
  return _load().assets.find(a => a.id === id) ?? null;
}

/** アセット新規作成 */
function createAsset(fields) {
  const data  = _load();
  const now   = new Date().toISOString();
  const asset = {
    id:           randomUUID(),
    name:         fields.name         || 'Untitled',
    title:        fields.title        || '',
    description:  fields.description  || '',
    category:     fields.category     || '2D > Textures & Materials',
    price:        fields.price        ?? 0,
    tags:         fields.tags         || [],
    imagesFolder: fields.imagesFolder || 'Assets/Images',
    platforms:    fields.platforms    || ['unity'],
    status:       'draft',  // draft | packaged | submitted | published
    createdAt:    now,
    updatedAt:    now,
  };
  data.assets.push(asset);
  _save(data);
  return asset;
}

/** アセット更新 */
function updateAsset(id, fields) {
  const data = _load();
  const idx  = data.assets.findIndex(a => a.id === id);
  if (idx < 0) return null;
  data.assets[idx] = {
    ...data.assets[idx],
    ...fields,
    id:        data.assets[idx].id,   // IDは変更不可
    updatedAt: new Date().toISOString(),
  };
  _save(data);
  return data.assets[idx];
}

/** アセット削除 */
function deleteAsset(id) {
  const data   = _load();
  const before = data.assets.length;
  data.assets  = data.assets.filter(a => a.id !== id);
  if (data.assets.length < before) { _save(data); return true; }
  return false;
}

module.exports = { listAssets, getAsset, createAsset, updateAsset, deleteAsset };
