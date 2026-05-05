'use strict';
/**
 * qa/validators/ResolutionValidator.js
 * 外部ライブラリ不要のバイナリヘッダー解析で画像解像度を検証。
 * PNG: IHDR チャンク (offset 16-23)
 * JPEG: SOF マーカー (0xC0/C1/C2) をスキャン
 */
const fs   = require('fs');
const path = require('path');

const MIN_8K = { w: 7680, h: 4320 };

function parsePNG(buf) {
  if (buf.length < 24) return null;
  if (buf[1] !== 0x50 || buf[2] !== 0x4E || buf[3] !== 0x47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function parseJPEG(buf) {
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xFF) break;
    const marker = buf[i + 1];
    const segLen = buf.readUInt16BE(i + 2);
    if (marker >= 0xC0 && marker <= 0xC3 && marker !== 0xC4) {
      if (i + 8 < buf.length) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
    }
    i += 2 + segLen;
  }
  return null;
}

function getDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png')               return parsePNG(buf);
  if (ext === '.jpg' || ext === '.jpeg') return parseJPEG(buf);
  return null;
}

function is8K(dims) {
  if (!dims) return false;
  // 縦横どちらでも8K以上を許容
  return (dims.width >= MIN_8K.w && dims.height >= MIN_8K.h) ||
         (dims.width >= MIN_8K.h && dims.height >= MIN_8K.w);
}

function describeResolution(dims) {
  if (!dims) return '不明';
  if (dims.width >= 7680) return '8K';
  if (dims.width >= 3840) return '4K';
  if (dims.width >= 1920) return 'FHD';
  return `${dims.width}×${dims.height}`;
}

module.exports = { getDimensions, is8K, MIN_8K, describeResolution };
