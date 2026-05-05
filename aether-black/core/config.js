'use strict';
/**
 * core/config.js — 一元設定ローダー
 * 優先順位: process.env > vault > DEFAULTS
 */
const vault = require('./vault');

const DEFAULTS = {
  PORT:                       '3000',
  HEADLESS:                   'true',
  GENERATION_PROVIDER:        'stability',
  BUDGET_MONTHLY_LIMIT_USD:   '50',
  BUDGET_ALERT_USD:           '40',
  IMAGES_PER_PACK:            '50',
  IMAGE_WIDTH:                '7680',
  IMAGE_HEIGHT:               '4320',
  QA_REQUIRE_EXACT_8K:        'false',
};

const config = new Proxy({}, {
  get(_, key) {
    return vault.get(key) ?? DEFAULTS[key] ?? null;
  },
  set(_, key, value) {
    vault.set({ [key]: String(value) });
    return true;
  },
});

module.exports = config;
