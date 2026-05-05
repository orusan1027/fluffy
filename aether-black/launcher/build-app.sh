#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  AETHER BLACK v2.0 — AetherBlack.app ビルドスクリプト
#
#  setup-mac.sh から呼び出されるか、単独で実行可能。
#  デスクトップに AetherBlack.app を生成する。
# ════════════════════════════════════════════════════════════════

set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}✓${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; }

LAUNCHER_DIR="$( cd "$( dirname "$0" )" && pwd )"
AB_DIR="$( cd "$LAUNCHER_DIR/.." && pwd )"
DESKTOP="$HOME/Desktop"
APP_OUT="$DESKTOP/AetherBlack.app"
PORT=3000

# Node.js を検索
NODE_PATH=""
for p in \
  "$(command -v node 2>/dev/null || true)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1 || true)/bin/node"; do
  [[ -n "$p" && -x "$p" ]] && { NODE_PATH="$p"; break; }
done

if [[ -z "$NODE_PATH" ]]; then
  err "Node.js が見つかりません。"; exit 1
fi

if ! command -v osacompile &>/dev/null; then
  err "osacompile が見つかりません（macOS 専用です）。"; exit 1
fi

rm -rf "$APP_OUT"
SCRIPT_TMP=$(mktemp /tmp/AetherBlack_XXXXXX.applescript)

cat > "$SCRIPT_TMP" << APPLESCRIPT
on run
    set abDir   to "$AB_DIR"
    set nodeBin to "$NODE_PATH"
    set portNum to "$PORT"
    set logFile to "/tmp/aether-black-server.log"

    -- すでに起動中か確認
    set isRunning to false
    try
        set chk to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
        if (chk as integer) > 0 then set isRunning to true
    end try

    if not isRunning then
        -- node_modules 確認
        try
            do shell script "test -d " & quoted form of (abDir & "/node_modules/express")
        on error
            do shell script "cd " & quoted form of abDir & " && npm install --omit=dev >> " & quoted form of logFile & " 2>&1"
        end try

        -- サーバー起動
        do shell script "cd " & quoted form of abDir & " && " & quoted form of nodeBin & " dashboard/server.js >> " & quoted form of logFile & " 2>&1 &"

        -- 起動待機（最大10秒）
        repeat 10 times
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

if [[ -d "$APP_OUT" ]]; then
  info "AetherBlack.app → $APP_OUT"
else
  err "アプリ生成失敗"; exit 1
fi
