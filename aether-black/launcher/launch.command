#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  AETHER BLACK v2.0 — ダブルクリック起動スクリプト
#  このファイルをダブルクリックするだけでサーバーが起動します
# ════════════════════════════════════════════════════════════════

# このスクリプトがある launcher/ の1階層上が aether-black/
LAUNCHER_DIR="$( cd "$( dirname "$0" )" && pwd )"
AB_DIR="$( cd "$LAUNCHER_DIR/.." && pwd )"
PORT=3000
LOG_FILE="/tmp/aether-black-server.log"

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
  osascript -e 'display dialog "Node.js が見つかりません。\nhttps://nodejs.org から LTS をインストール後、再度お試しください。" buttons {"OK"} default button "OK" with icon stop'
  exit 1
fi

# すでにサーバーが起動中か確認
IS_RUNNING=$(lsof -i :$PORT -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' ')
if [[ "$IS_RUNNING" -gt 0 ]]; then
  open "http://localhost:$PORT"
  exit 0
fi

# node_modules がなければインストール
cd "$AB_DIR"
if [[ ! -d "node_modules/express" ]]; then
  osascript -e 'display notification "初回セットアップ中... 少々お待ちください" with title "AETHER BLACK"'
  npm install --omit=dev --silent >> "$LOG_FILE" 2>&1
fi

# サーバーをバックグラウンドで起動
"$NODE_PATH" dashboard/server.js >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# 起動を最大10秒待機
for i in $(seq 1 10); do
  sleep 1
  CHECK=$(lsof -i :$PORT -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$CHECK" -gt 0 ]]; then
    open "http://localhost:$PORT"
    exit 0
  fi
done

# 起動失敗
osascript -e "display dialog \"サーバーの起動に失敗しました。\nログ: $LOG_FILE\" buttons {\"OK\"} default button \"OK\" with icon stop"
exit 1
