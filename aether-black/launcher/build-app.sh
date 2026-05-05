#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  AETHER BLACK v3.0 — AetherBlack.app ビルドスクリプト
#
#  改善点:
#  - AppleScript にパスをハードコードしない
#  - .app バンドル内の shell スクリプトが起動時に自己位置からパスを解決
#  - Node.js パスも実行時に再探索するため、移動・NVM 変更に対応
# ════════════════════════════════════════════════════════════════

set -euo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}✓${NC}  $1"; }
err()  { echo -e "${RED}✗${NC}  $1"; exit 1; }

LAUNCHER_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AB_DIR="$( cd "$LAUNCHER_DIR/.." && pwd )"
DESKTOP="$HOME/Desktop"
APP_OUT="$DESKTOP/AetherBlack.app"
PORT=3000

# ── osacompile 確認 ─────────────────────────────────────────────
if ! command -v osacompile &>/dev/null; then
  err "osacompile が見つかりません（macOS 専用です）。"
fi

# ── 既存アプリ削除 ───────────────────────────────────────────────
rm -rf "$APP_OUT"

# ── バンドル構造を手動作成 ───────────────────────────────────────
# AppleScript ではなく実行可能シェルスクリプトをバンドルする方式。
# これにより絶対パスのハードコードを完全に回避できる。

MACOS_DIR="$APP_OUT/Contents/MacOS"
RES_DIR="$APP_OUT/Contents/Resources"
mkdir -p "$MACOS_DIR" "$RES_DIR"

# プロジェクトパスをリソースに保存（後で手動変更も可）
echo "$AB_DIR" > "$RES_DIR/project-path.txt"
echo "$PORT"   > "$RES_DIR/port.txt"

# Info.plist
cat > "$APP_OUT/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>             <string>AetherBlack</string>
  <key>CFBundleDisplayName</key>      <string>AETHER BLACK</string>
  <key>CFBundleIdentifier</key>       <string>com.aetherblack.dashboard</string>
  <key>CFBundleVersion</key>          <string>3.0.0</string>
  <key>CFBundleExecutable</key>       <string>AetherBlack</string>
  <key>CFBundleIconFile</key>         <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>   <string>11.0</string>
  <key>LSUIElement</key>              <false/>
</dict>
</plist>
PLIST

# メイン実行スクリプト（起動時にパスを動的解決）
cat > "$MACOS_DIR/AetherBlack" << 'LAUNCHER'
#!/usr/bin/env bash
# 実行時に自己位置からプロジェクトパスを解決する
SELF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RES_DIR="$SELF_DIR/../Resources"
LOG_FILE="/tmp/aether-black-server.log"

# プロジェクトパスをリソースから読む
AB_DIR=""
if [[ -f "$RES_DIR/project-path.txt" ]]; then
  AB_DIR="$(cat "$RES_DIR/project-path.txt")"
fi

PORT=3000
if [[ -f "$RES_DIR/port.txt" ]]; then
  PORT="$(cat "$RES_DIR/port.txt")"
fi

# プロジェクトディレクトリの存在確認
if [[ -z "$AB_DIR" || ! -f "$AB_DIR/dashboard/server.js" ]]; then
  osascript -e "display dialog \"プロジェクトが見つかりません。\n\n期待パス: $AB_DIR\n\nAetherBlack フォルダを移動した場合は\nlauncher/build-app.sh を再実行してください。\" buttons {\"OK\"} default button \"OK\" with icon stop"
  exit 1
fi

# Node.js を実行時に探索（NVM・Homebrew・標準パス）
NODE_PATH=""
for p in \
  "$(command -v node 2>/dev/null || true)" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1 2>/dev/null || true)/bin/node"; do
  [[ -n "$p" && -x "$p" ]] && { NODE_PATH="$p"; break; }
done

if [[ -z "$NODE_PATH" ]]; then
  osascript -e 'display dialog "Node.js が見つかりません。\nhttps://nodejs.org からインストール後、再度起動してください。" buttons {"OK"} default button "OK" with icon stop'
  exit 1
fi

# すでにサーバーが起動中か確認
IS_RUNNING=$(lsof -i :"$PORT" -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' ')
if [[ "$IS_RUNNING" -gt 0 ]]; then
  open "http://localhost:$PORT"
  exit 0
fi

# node_modules 確認 → 未インストールなら自動インストール
if [[ ! -d "$AB_DIR/node_modules/express" ]]; then
  osascript -e 'display notification "初回セットアップ中... (npm install)" with title "AETHER BLACK"'
  cd "$AB_DIR" && npm install --omit=dev >> "$LOG_FILE" 2>&1
fi

# サーバー起動
cd "$AB_DIR"
"$NODE_PATH" dashboard/server.js >> "$LOG_FILE" 2>&1 &

# 起動を最大15秒待機
for i in $(seq 1 15); do
  sleep 1
  CHECK=$(lsof -i :"$PORT" -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$CHECK" -gt 0 ]]; then
    open "http://localhost:$PORT"
    exit 0
  fi
done

# 起動失敗 — ログを表示
LAST_LINES=$(tail -20 "$LOG_FILE" 2>/dev/null || echo "(ログなし)")
osascript -e "display dialog \"サーバーの起動に失敗しました。\n\nエラー内容:\n$LAST_LINES\n\nログ全文: $LOG_FILE\" buttons {\"OK\"} default button \"OK\" with icon stop"
exit 1
LAUNCHER

chmod +x "$MACOS_DIR/AetherBlack"

# ── 完了 ────────────────────────────────────────────────────────
if [[ -d "$APP_OUT" ]]; then
  info "AetherBlack.app → $APP_OUT"
  info "プロジェクトパス: $AB_DIR"
  echo ""
  echo "  ※ プロジェクトを移動した場合は再度このスクリプトを実行してください。"
  echo "     bash launcher/build-app.sh"
else
  err "アプリ生成失敗"
fi
