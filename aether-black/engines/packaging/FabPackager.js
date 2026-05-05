'use strict';
/**
 * engines/packaging/FabPackager.js
 * Fab.com 提出用 ZIP アーカイブを生成。
 * 構造: Textures/<img>.png, README.md, metadata.json
 */
const fs      = require('fs');
const path    = require('path');
const zlib    = require('zlib');
const crypto  = require('crypto');

// ── 軽量 ZIP ライター（外部依存なし） ────────────────────────────────────
// ZIP local file header + data descriptor + central directory + EOCD
function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUInt16LE(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function writeUInt32LE(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }

function localFileHeader(name, data, crc, compressed) {
  const nameBuf = Buffer.from(name, 'utf8');
  return Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x03, 0x04]),  // signature
    writeUInt16LE(20),          // version needed
    writeUInt16LE(0),           // flags
    writeUInt16LE(8),           // deflate
    writeUInt16LE(0),           // mod time
    writeUInt16LE(0),           // mod date
    writeUInt32LE(crc),
    writeUInt32LE(compressed.length),
    writeUInt32LE(data.length),
    writeUInt16LE(nameBuf.length),
    writeUInt16LE(0),           // extra
    nameBuf,
    compressed,
  ]);
}

function centralDirEntry(name, crc, compLen, uncompLen, localOffset) {
  const nameBuf = Buffer.from(name, 'utf8');
  return Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x01, 0x02]),
    writeUInt16LE(20), writeUInt16LE(20), writeUInt16LE(0),
    writeUInt16LE(8), writeUInt16LE(0), writeUInt16LE(0),
    writeUInt32LE(crc),
    writeUInt32LE(compLen),
    writeUInt32LE(uncompLen),
    writeUInt16LE(nameBuf.length),
    writeUInt16LE(0), writeUInt16LE(0), writeUInt16LE(0), writeUInt16LE(0),
    writeUInt32LE(0),
    writeUInt32LE(localOffset),
    nameBuf,
  ]);
}

function buildZip(entries) {
  const localParts   = [];
  const centralParts = [];
  let   offset       = 0;

  for (const { name, data } of entries) {
    const crc        = crc32(data);
    const compressed = zlib.deflateRawSync(data, { level: 6 });
    const local      = localFileHeader(name, data, crc, compressed);
    localParts.push(local);
    centralParts.push(centralDirEntry(name, crc, compressed.length, data.length, offset));
    offset += local.length;
  }

  const centralDir    = Buffer.concat(centralParts);
  const centralOffset = offset;

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x05, 0x06]),
    writeUInt16LE(0), writeUInt16LE(0),
    writeUInt16LE(entries.length), writeUInt16LE(entries.length),
    writeUInt32LE(centralDir.length),
    writeUInt32LE(centralOffset),
    writeUInt16LE(0),
  ]);

  return Buffer.concat([...localParts, centralDir, eocd]);
}
// ────────────────────────────────────────────────────────────────────────────

async function pack({ assetName, imagePaths, outputDir, metadata, emit }) {
  const log    = emit ? (t, tp) => emit({ type: tp || 'out', text: t }) : () => {};
  const pkgId  = assetName.replace(/[^a-zA-Z0-9_]/g, '_');
  const outPath = path.join(outputDir, `${pkgId}_fab.zip`);
  fs.mkdirSync(outputDir, { recursive: true });

  log(`  Fab.com ZIP 生成中 (${imagePaths.length} 枚)...`);

  const entries = [];

  for (const imgPath of imagePaths) {
    entries.push({
      name: `Textures/${path.basename(imgPath)}`,
      data: fs.readFileSync(imgPath),
    });
  }

  const readme = metadata?.fab?.longDescription || `# ${assetName}\n\nHigh-resolution 8K background pack.`;
  entries.push({ name: 'README.md',      data: Buffer.from(readme, 'utf8') });
  entries.push({ name: 'metadata.json',  data: Buffer.from(JSON.stringify({
    name:        assetName,
    version:     metadata?.version || '1.0',
    category:    metadata?.fab?.category || 'Environments',
    tags:        metadata?.fab?.tags || [],
    description: metadata?.fab?.shortDescription || '',
  }, null, 2), 'utf8') });

  const zipBuf = buildZip(entries);
  fs.writeFileSync(outPath, zipBuf);

  const sizeMB = (zipBuf.length / 1024 / 1024).toFixed(1);
  log(`  ✓ ${path.basename(outPath)} (${sizeMB}MB)`);
  return outPath;
}

module.exports = { pack };
