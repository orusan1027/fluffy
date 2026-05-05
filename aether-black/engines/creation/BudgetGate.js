'use strict';
/**
 * engines/creation/BudgetGate.js — 予算安全弁
 *
 * 月間支出が BUDGET_MONTHLY_LIMIT_USD を超過する場合は実行を物理的に遮断する。
 * data/budget.json に支出履歴を永続化。
 */
const fs     = require('fs');
const path   = require('path');
const config = require('../../core/config');

const BUDGET_FILE = path.join(__dirname, '..', '..', 'data', 'budget.json');

// USD per image by provider
const COST_TABLE = {
  stability_sd3_ultra: 0.065,
  openai_dalle3:       0.040,
  mock:                0.000,
};

function currentMonth() { return new Date().toISOString().slice(0, 7); }

function load() {
  if (!fs.existsSync(BUDGET_FILE)) {
    return { month: currentMonth(), monthlySpend: 0, totalSpend: 0, history: [] };
  }
  const data = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
  if (data.month !== currentMonth()) {
    data.history.push({ month: data.month, spend: data.monthlySpend });
    data.monthlySpend = 0;
    data.month = currentMonth();
  }
  return data;
}

function save(data) {
  fs.mkdirSync(path.dirname(BUDGET_FILE), { recursive: true });
  fs.writeFileSync(BUDGET_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const BudgetGate = {
  /** 現在の予算状況を返す */
  status() {
    const data  = load();
    const limit = parseFloat(config.BUDGET_MONTHLY_LIMIT_USD) || 50;
    const alert = parseFloat(config.BUDGET_ALERT_USD) || 40;
    return {
      month:          data.month,
      monthlySpend:   data.monthlySpend,
      totalSpend:     data.totalSpend,
      monthlyLimit:   limit,
      alertThreshold: alert,
      remaining:      +(limit - data.monthlySpend).toFixed(4),
      isOverBudget:   data.monthlySpend >= limit,
      isNearLimit:    data.monthlySpend >= alert,
      history:        data.history.slice(-6),
    };
  },

  /**
   * 実行前チェック。超過する場合は Error をスロー（物理遮断）。
   * @returns {number} estimatedCost
   */
  check(providerId, imageCount) {
    const costPer = COST_TABLE[providerId] ?? 0.065;
    const estimate = +(costPer * imageCount).toFixed(4);
    const data     = load();
    const limit    = parseFloat(config.BUDGET_MONTHLY_LIMIT_USD) || 50;

    if (data.monthlySpend + estimate > limit) {
      throw new Error(
        `💰 [予算安全弁] 実行を遮断しました\n` +
        `  今月の支出: $${data.monthlySpend.toFixed(2)} / 上限 $${limit.toFixed(2)}\n` +
        `  この操作の推定コスト: $${estimate.toFixed(2)}\n` +
        `  → ダッシュボードで月間上限を引き上げるか、枚数を減らしてください。`,
      );
    }
    return estimate;
  },

  /** 生成完了後に実際のコストを記録 */
  record(providerId, imageCount) {
    const costPer = COST_TABLE[providerId] ?? 0.065;
    const spent   = +(costPer * imageCount).toFixed(4);
    const data    = load();
    data.monthlySpend = +(data.monthlySpend + spent).toFixed(4);
    data.totalSpend   = +(data.totalSpend   + spent).toFixed(4);
    data.history.push({
      time: new Date().toISOString(), provider: providerId,
      count: imageCount, cost: spent,
    });
    save(data);
    return spent;
  },

  resetMonth() {
    save({ month: currentMonth(), monthlySpend: 0, totalSpend: load().totalSpend, history: load().history });
  },
};

module.exports = BudgetGate;
