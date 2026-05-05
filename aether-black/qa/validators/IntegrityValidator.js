'use strict';
/**
 * qa/validators/IntegrityValidator.js
 * ファイルシグネチャと終端マーカーでデータ破損を検知。
 * 外部ライブラリ不要。
 */
const fs   = require('fs');
const path = require('path');

const PNG_SIG  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const JPEG_SIG = Buffer.from([0xFF, 0xD8, 0xFF]);
const PNG_IEND = Buffer.from('IEND');
const JPEG_EOI = Buffer.from([0xFF, 0xD9]);

function validate(filePath) {
  let stat;
  try { stat = fs.statSync(filePath); } catch {
    return { ok: false, reason: 'ファイルが存在しません' };
  }
  if (stat.size < 512) return { ok: false, reason: `ファイルサイズが異常に小さい (${stat.size} bytes)` };

  const ext = path.extname(filePath).toLowerCase();
  const fd  = fs.openSync(filePath, 'r');

  try {
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);

    if (ext === '.png') {
      if (!header.subarray(0, 8).equals(PNG_SIG)) {
        return { ok: false, reason: 'PNG シグネチャ不正（ファイル破損）' };
      }
      const tail = Buffer.alloc(12);
      fs.readSync(fd, tail, 0, 12, stat.size - 12);
      if (!tail.includes(PNG_IEND)) {
        return { ok: false, reason: 'PNG IEND チャンク欠損（不完全なファイル）' };
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      if (!header.subarray(0, 3).equals(JPEG_SIG)) {
        return { ok: false, reason: 'JPEG シグネチャ不正（ファイル破損）' };
      }
      const tail = Buffer.alloc(2);
      fs.readSync(fd, tail, 0, 2, stat.size - 2);
      if (!tail.equals(JPEG_EOI)) {
        return { ok: false, reason: 'JPEG EOI マーカー欠損（切り詰められたファイル）' };
      }
    }

    return { ok: true, size: stat.size };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { validate };
