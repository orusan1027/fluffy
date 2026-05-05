'use strict';
/**
 * engines/creation/providers/StabilityProvider.js
 * Stability AI — SD3 Ultra (8K対応, 最高品質モデル)
 */
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const vault  = require('../../../core/vault');

const PROVIDER_ID = 'stability_sd3_ultra';

async function generate({ positive, negative, seed, outputPath, width = 7680, height = 4320 }) {
  const apiKey = vault.get('STABILITY_API_KEY');
  if (!apiKey) throw new Error('STABILITY_API_KEY が Vault に設定されていません');

  const body = JSON.stringify({
    prompt:          positive,
    negative_prompt: negative || '',
    model:           'sd3-ultra',
    output_format:   'png',
    width,
    height,
    seed:            seed || 0,
    cfg_scale:       7,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.stability.ai',
      path:     '/v2beta/stable-image/generate/sd3',
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Accept':         'image/*',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          return reject(new Error(`Stability AI [${res.statusCode}]: ${buf.toString().slice(0, 200)}`));
        }
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buf);
        resolve(outputPath);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { generate, PROVIDER_ID };
