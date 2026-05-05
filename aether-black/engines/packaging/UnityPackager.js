'use strict';
/**
 * engines/packaging/UnityPackager.js
 *
 * .unitypackage (= gzipped POSIX tar) を Node.js のみで生成。
 * 構造: <guid>/asset  <guid>/asset.meta  <guid>/pathname
 *
 * 生成される内部パス: Assets/AETHER_BLACK/<PackageName>/Textures/<filename>
 */
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const zlib   = require('zlib');

function guid() { return crypto.randomBytes(16).toString('hex'); }

function metaYaml(g, textureType = 2) {
  return [
    'fileFormatVersion: 2',
    `guid: ${g}`,
    'TextureImporter:',
    '  fileIDToRecycleName: {}',
    '  serializedVersion: 9',
    `  textureType: ${textureType}`,
    '  textureShape: 1',
    '  maxTextureSize: 8192',
    '  textureSettings:',
    '    filterMode: 1',
    '    aniso: 1',
    '  npotScale: 0',
    '  compressionQuality: 50',
    '  spriteMode: 0',
    '  alphaUsage: 1',
    '  alphaIsTransparency: 0',
    '  textureFormat: -1',
    '  textureCompression: 1',
  ].join('\n') + '\n';
}

function tarEntry(name, content) {
  const contentBuf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const header     = Buffer.alloc(512);

  // name (100 bytes)
  header.write(name.slice(0, 99), 0, 'utf8');
  // mode, uid, gid
  header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
  // size (octal, 12 bytes)
  header.write(contentBuf.length.toString(8).padStart(11, '0') + '\0', 124);
  // mtime (octal, 12 bytes)
  header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136);
  // checksum placeholder
  header.write('        ', 148);
  // type flag: regular file
  header[156] = 0x30;
  // ustar magic
  header.write('ustar\0', 257); header.write('00', 263);

  // checksum
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);

  const padded = Buffer.alloc(Math.ceil(contentBuf.length / 512) * 512);
  contentBuf.copy(padded);
  return Buffer.concat([header, padded]);
}

async function pack({ assetName, imagePaths, outputDir, metadata, emit }) {
  const log    = emit ? (t, tp) => emit({ type: tp || 'out', text: t }) : () => {};
  const pkgId  = assetName.replace(/[^a-zA-Z0-9_]/g, '_');
  const outPath = path.join(outputDir, `${pkgId}.unitypackage`);
  fs.mkdirSync(outputDir, { recursive: true });

  log(`  .unitypackage 生成中 (${imagePaths.length} 枚)...`);
  const chunks = [];

  for (const imgPath of imagePaths) {
    const g        = guid();
    const imgName  = path.basename(imgPath);
    const unityPath = `Assets/AETHER_BLACK/${pkgId}/Textures/${imgName}`;

    chunks.push(tarEntry(`${g}/asset`,      fs.readFileSync(imgPath)));
    chunks.push(tarEntry(`${g}/asset.meta`, metaYaml(g)));
    chunks.push(tarEntry(`${g}/pathname`,   unityPath));
  }

  // README as TextAsset
  if (metadata) {
    const g = guid();
    chunks.push(tarEntry(`${g}/asset`,      metadata.unity.longDescription));
    chunks.push(tarEntry(`${g}/asset.meta`, metaYaml(g, 114)));
    chunks.push(tarEntry(`${g}/pathname`,   `Assets/AETHER_BLACK/${pkgId}/README.txt`));
  }

  // EOF blocks
  chunks.push(Buffer.alloc(1024));

  const tarBuf  = Buffer.concat(chunks);
  const gzipped = zlib.gzipSync(tarBuf, { level: 6 });
  fs.writeFileSync(outPath, gzipped);

  const sizeMB = (gzipped.length / 1024 / 1024).toFixed(1);
  log(`  ✓ ${path.basename(outPath)} (${sizeMB}MB)`);
  return outPath;
}

module.exports = { pack };
