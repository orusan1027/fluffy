#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  AETHER BLACK v2.0 — Mac セットアップスクリプト
#
#  【実行方法】ターミナルに以下を貼り付けて Enter:
#    bash ~/Desktop/fluffy/aether-black/launcher/setup-mac.sh
#
#  【このスクリプトでできること】
#    ① Node.js の確認
#    ② npm install（aether-black/ ルートで実行）
#    ③ AetherBlack.app をデスクトップに生成
#    ④ 今すぐ起動するか確認
# ════════════════════════════════════════════════════════════════

set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}✓${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; }
step() { echo ""; echo -e "  ${YELLOW}▶ $1${NC}"; }

# このスクリプトがある aether-black/ の2階層上がリポジトリルート
LAUNCHER_DIR="$( cd "$( dirname "$0" )" && pwd )"
AB_DIR="$( cd "$LAUNCHER_DIR/.." && pwd )"   # aether-black/
DESKTOP="$HOME/Desktop"
APP_OUT="$DESKTOP/AetherBlack.app"
PORT=3000

echo ""
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║   AETHER BLACK v2.0  Mac セットアップ         ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo ""

# ── Step 1: macOS 確認 ───────────────────────────────────────────────
step "Step 1/4: macOS を確認"
if [[ "$OSTYPE" != "darwin"* ]]; then
  err "このスクリプトは macOS 専用です。"; exit 1; fi
info "macOS 確認 OK"

# ── Step 2: Node.js 確認 ─────────────────────────────────────────────
step "Step 2/4: Node.js を確認"
NODE_PATH=""
for p in \
  "$(command -v node 2>/dev/null || true)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1 || true)/bin/node"; do
  [[ -n "$p" && -x "$p" ]] && { NODE_PATH="$p"; break; }
done

if [[ -z "$NODE_PATH" ]]; then
  err "Node.js が見つかりません。"
  echo "  https://nodejs.org を開いて「LTS」をインストール後、再実行してください。"
  exit 1
fi
info "Node.js: $NODE_PATH ($("$NODE_PATH" --version))"

# ── Step 3: npm install ──────────────────────────────────────────────
step "Step 3/4: npm install（aether-black/ ルート）"
cd "$AB_DIR"
if [[ ! -d "node_modules/express" ]]; then
  echo "  初回インストール中... (30秒ほどかかります)"
  npm install --omit=dev --silent
fi
info "モジュール インストール済み"

# ── Step 4: AetherBlack.app 生成 ─────────────────────────────────────
step "Step 4/4: AetherBlack.app をデスクトップに生成"

if ! command -v osacompile &>/dev/null; then
  err "osacompile が見つかりません。macOS 標準ツールが必要です。"; exit 1; fi

rm -rf "$APP_OUT"
SCRIPT_TMP=$(mktemp /tmp/AetherBlack_XXXXXX.applescript)

cat > "$SCRIPT_TMP" << APPLESCRIPT
on run
    set abDir   to "$AB_DIR"
    set nodeBin to "$NODE_PATH"
    set portNum to "$PORT"
    set logFile to "/tmp/aether-black-server.log"

    set isRunning to false
    try
        set chk to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
        if (chk as integer) > 0 then set isRunning to true
    end try

    if not isRunning then
        try
            do shell script "test -d " & quoted form of (abDir & "/node_modules/express")
        on error
            do shell script "cd " & quoted form of abDir & " && npm install --omit=dev > " & quoted form of logFile & " 2>&1"
        end try

        do shell script "cd " & quoted form of abDir & " && " & quoted form of nodeBin & " dashboard/server.js >> " & quoted form of logFile & " 2>&1 &"

        repeat 6 times
            delay 1
            try
                set chk2 to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
                if (chk2 as integer) > 0 then exit repeat
            end try
        end repeat
    end if

    do shell script "open http://localhost:" & portNum
end run
APPLESCRIPT

osacompile -o "$APP_OUT" "$SCRIPT_TMP"
rm -f "$SCRIPT_TMP"
[[ -d "$APP_OUT" ]] || { err "アプリ生成失敗"; exit 1; }
info "AetherBlack.app → デスクトップに生成完了"

# ── 完了 ─────────────────────────────────────────────────────────────
echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║  ✓ セットアップ完了！                            ║"
echo "  ╠═══════════════════════════════════════════════════╣"
echo "  ║  今後の起動方法:                                 ║"
echo "  ║  デスクトップの AetherBlack.app を               ║"
echo "  ║  右クリック → 「開く」でダブルクリック起動OK     ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo ""

read -r -p "  今すぐ起動しますか？ [Y/n]: " REPLY
if [[ "${REPLY:-Y}" =~ ^[Yy]$ ]]; then
  open "$APP_OUT"
  echo ""
  info "起動しました！ブラウザが自動で開きます"
  info "開かない場合は http://localhost:$PORT を手動で開いてください"
fi
echo ""
