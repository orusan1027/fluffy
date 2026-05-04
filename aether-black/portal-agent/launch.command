#!/bin/bash
# ════════════════════════════════════════════════════════
#  AETHER BLACK — ワンクリック起動スクリプト
#  このファイルをダブルクリックするだけでダッシュボードが開きます。
#
#  初回セットアップ（1回だけ実行）:
#    chmod +x launch.command
#  ════════════════════════════════════════════════════════

# このスクリプトが置かれているディレクトリを取得
DIR="$( cd "$( dirname "$0" )" && pwd )"
PORT=3000
LOG_FILE="/tmp/aether-black-server.log"

# ── Node.js の確認 ─────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript -e 'display alert "Node.js が見つかりません" message "https://nodejs.org からインストールしてください。" as critical'
  else
    echo "❌ Node.js が見つかりません。https://nodejs.org からインストールしてください。"
  fi
  exit 1
fi

# ── 依存モジュールの確認・インストール ─────────────────────────────────
if [ ! -d "$DIR/node_modules" ] || [ ! -d "$DIR/node_modules/express" ]; then
  echo "📦 初回セットアップ: npm install を実行しています..."
  cd "$DIR" && npm install
  echo "✓ インストール完了"
fi

# ── 既にサーバーが起動中か確認 ────────────────────────────────────────
if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✓ サーバーは既に起動中 (http://localhost:$PORT)"
else
  echo "🚀 AETHER BLACK Dashboard を起動中..."
  cd "$DIR"
  node server.js > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo "   PID: $SERVER_PID"

  # サーバーの起動を最大 5 秒待つ
  for i in 1 2 3 4 5; do
    sleep 1
    if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "✓ サーバー起動完了 ($i秒)"
      break
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "❌ サーバーの起動に失敗しました。ログ: $LOG_FILE"
      cat "$LOG_FILE"
      exit 1
    fi
  done
fi

# ── ブラウザで開く ────────────────────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "http://localhost:$PORT"
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:$PORT"
fi

echo ""
echo "════════════════════════════════════════"
echo "  AETHER BLACK Dashboard"
echo "  http://localhost:$PORT"
echo "════════════════════════════════════════"
echo "  サーバーログ: $LOG_FILE"
echo "  このウィンドウを閉じてもサーバーは動作します"
echo "════════════════════════════════════════"
