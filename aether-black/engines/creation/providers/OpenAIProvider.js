'use strict';
/**
 * engines/creation/providers/OpenAIProvider.js
 * OpenAI DALL-E 3 — HD品質 (1792×1024, DALL-E 3の最大解像度)
 * ※ DALL-E 3は8Kネイティブ非対応のため、最高品質HDを使用
 */
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const vault = require('../../../core/vault');

const PROVIDER_ID = 'openai_dalle3';

async function generate({ positive, negative, seed, outputPath }) {
  const apiKey = vault.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY が Vault に設定されていません');

  const prompt = negative ? `${positive}. Do NOT include: ${negative}` : positive;
  const body   = JSON.stringify({
    model:           'dall-e-3',
    prompt,
    n:               1,
    size:            '1792x1024',
    quality:         'hd',
    response_format: 'b64_json',
  });

  const b64 = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path:     '/v1/images/generations',
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`OpenAI [${res.statusCode}]: ${data.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(data).data[0].b64_json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
  return outputPath;
}

module.exports = { generate, PROVIDER_ID };
