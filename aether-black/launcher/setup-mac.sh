#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  AETHER BLACK v3.0 — Mac セットアップスクリプト
#
#  【実行方法】ターミナルに以下を貼り付けて Enter:
#    bash ~/Desktop/fluffy/aether-black/launcher/setup-mac.sh
#
#  【このスクリプトでできること】
#    ① Node.js の確認
#    ② npm install（aether-black/ ルートで実行）
#    ③ Playwright Chromium のインストール
#    ④ AetherBlack.app をデスクトップに生成
#    ⑤ 今すぐ起動するか確認
# ════════════════════════════════════════════════════════════════

set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; exit 1; }
step() { echo ""; echo -e "  ${YELLOW}▶ $1${NC}"; }

LAUNCHER_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AB_DIR="$( cd "$LAUNCHER_DIR/.." && pwd )"
APP_OUT="$HOME/Desktop/AetherBlack.app"
PORT=3000

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   AETHER BLACK v3.0  Mac セットアップ         ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""
echo "  プロジェクト: $AB_DIR"
echo ""

# ── Step 1: macOS 確認 ───────────────────────────────────────────────
step "Step 1/5: macOS を確認"
[[ "$OSTYPE" == "darwin"* ]] || err "このスクリプトは macOS 専用です。"
info "macOS 確認 OK"

# ── Step 2: Node.js 確認 ─────────────────────────────────────────────
step "Step 2/5: Node.js を確認"
NODE_PATH=""
for p in \
  "$(command -v node 2>/dev/null || true)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1 2>/dev/null || true)/bin/node"; do
  [[ -n "$p" && -x "$p" ]] && { NODE_PATH="$p"; break; }
done

if [[ -z "$NODE_PATH" ]]; then
  err "Node.js が見つかりません。https://nodejs.org から LTS をインストール後、再実行してください。"
fi
info "Node.js: $NODE_PATH ($("$NODE_PATH" --version))"

# ── Step 3: npm install ──────────────────────────────────────────────
step "Step 3/5: npm install（aether-black/ ルート）"
cd "$AB_DIR"
if [[ ! -d "node_modules/express" ]]; then
  echo "  インストール中... (30秒ほどかかります)"
  npm install --silent
fi
info "モジュール インストール済み"

# ── Step 4: Playwright Chromium ──────────────────────────────────────
step "Step 4/5: Playwright Chromium ブラウザ確認"
CHROME_PATH=$(node -e "try{const {chromium}=require('playwright');console.log(chromium.executablePath())}catch(e){}" 2>/dev/null || true)
if [[ -z "$CHROME_PATH" || ! -f "$CHROME_PATH" ]]; then
  echo "  Chromium をダウンロード中... (100〜300MB, 初回のみ)"
  npx playwright install chromium 2>&1 | tail -3
  info "Chromium インストール完了"
else
  info "Chromium 確認済み: $CHROME_PATH"
fi

# ── Step 5: AetherBlack.app 生成 ─────────────────────────────────────
step "Step 5/5: AetherBlack.app をデスクトップに生成"
bash "$LAUNCHER_DIR/build-app.sh"

# ── 完了 ─────────────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║  ✓ セットアップ完了！                               ║"
echo "  ╠══════════════════════════════════════════════════════╣"
echo "  ║  今後の起動方法:                                    ║"
echo "  ║  デスクトップの AetherBlack.app を                  ║"
echo "  ║  右クリック → 「開く」(初回のみ) → 以降ダブルクリック ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo ""

read -r -p "  今すぐ起動しますか？ [Y/n]: " REPLY
if [[ "${REPLY:-Y}" =~ ^[Yy]$ ]]; then
  open "$APP_OUT"
  sleep 3
  open "http://localhost:$PORT"
  echo ""
  info "起動しました！ブラウザが自動で開きます"
  info "開かない場合は手動で → http://localhost:$PORT"
fi
echo ""
