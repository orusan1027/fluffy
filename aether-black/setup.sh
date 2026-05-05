#!/usr/bin/env bash
# AETHER BLACK — ワンクリック初期セットアップ
# 使い方: bash setup.sh
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  AETHER BLACK v3.0  —  初期セットアップ   ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── Node.js バージョン確認 ──────────────────────────────────────────────────
echo -e "${BOLD}[1/4] Node.js バージョン確認...${NC}"
NODE_VER=$(node --version 2>/dev/null || echo "not found")
if [ "$NODE_VER" = "not found" ]; then
  echo -e "${RED}  ✗ Node.js が見つかりません。https://nodejs.org からインストールしてください。${NC}"
  exit 1
fi
echo -e "  ✓ Node.js ${NODE_VER}"

# ── メイン依存パッケージ ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/4] 依存パッケージをインストール中...${NC}"
npm install
echo -e "${GREEN}  ✓ npm install 完了${NC}"

# ── Portal Agent 依存パッケージ ─────────────────────────────────────────────
if [ -f "portal-agent/package.json" ]; then
  echo ""
  echo -e "${BOLD}[3/4] Portal Agent の依存パッケージをインストール中...${NC}"
  npm --prefix portal-agent install
  echo -e "${GREEN}  ✓ portal-agent npm install 完了${NC}"
else
  echo ""
  echo -e "${BOLD}[3/4] Portal Agent: スキップ（package.json なし）${NC}"
fi

# ── Playwright Chromium ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/4] Playwright Chromium ブラウザをインストール中...${NC}"
echo -e "${YELLOW}  ※ 約 100-300MB のダウンロードが発生します${NC}"
npx playwright install chromium
echo -e "${GREEN}  ✓ Chromium インストール完了${NC}"

# ── 完了 ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  セットアップ完了！                        ║${NC}"
echo -e "${GREEN}${BOLD}║                                           ║${NC}"
echo -e "${GREEN}${BOLD}║  起動: npm start                          ║${NC}"
echo -e "${GREEN}${BOLD}║  URL:  http://localhost:3000              ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""
