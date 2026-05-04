#!/bin/bash
# ════════════════════════════════════════════════════════
#  AETHER BLACK — AetherBlack.app 生成スクリプト
#
#  初回のみ実行してください:
#    bash build-app.sh
#
#  生成された AetherBlack.app を /Applications にコピーすると
#  Launchpad からも起動できます。
#
#  ※ macOS 専用（osacompile が必要）
# ════════════════════════════════════════════════════════

DIR="$( cd "$( dirname "$0" )" && pwd )"
APP_OUT="$DIR/AetherBlack.app"
PORT=3000

# macOS 確認
if ! command -v osacompile &>/dev/null; then
  echo "❌ osacompile が見つかりません。macOS でのみ実行できます。"
  exit 1
fi

# Node.js のパスを確定（nvm / Homebrew / 標準パスの順で探す）
NODE_PATH=""
for p in \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1)/bin/node" \
  "$(brew --prefix 2>/dev/null)/bin/node" \
  "/usr/local/bin/node" \
  "/opt/homebrew/bin/node" \
  "$(which node 2>/dev/null)"; do
  if [ -x "$p" ]; then NODE_PATH="$p"; break; fi
done

if [ -z "$NODE_PATH" ]; then
  echo "❌ Node.js が見つかりません。https://nodejs.org からインストールしてください。"
  exit 1
fi

echo "✓ Node.js: $NODE_PATH"
echo "✓ 出力先:  $APP_OUT"
echo ""
echo "🔨 AetherBlack.app を生成中..."

# AppleScript ソースを一時ファイルに書き出す
SCRIPT_TMP=$(mktemp /tmp/AetherBlack_XXXXXX.applescript)

cat > "$SCRIPT_TMP" << APPLESCRIPT
on run
    set dirPath    to "$DIR"
    set serverJS   to dirPath & "/server.js"
    set nodeBin    to "$NODE_PATH"
    set portNum    to "$PORT"
    set logFile    to "/tmp/aether-black-server.log"

    -- 既にサーバーが起動中か確認
    set running to false
    try
        set chk to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
        if (chk as integer) > 0 then set running to true
    end try

    if not running then
        -- 依存モジュール確認
        set nmPath to dirPath & "/node_modules/express"
        try
            do shell script "test -d " & quoted form of nmPath
        on error
            do shell script "cd " & quoted form of dirPath & " && npm install > " & quoted form of logFile & " 2>&1"
        end try

        -- バックグラウンドでサーバーを起動
        do shell script "cd " & quoted form of dirPath & " && " & quoted form of nodeBin & " server.js >> " & quoted form of logFile & " 2>&1 &"

        -- 起動を最大 5 秒待つ
        set ready to false
        repeat 5 times
            delay 1
            try
                set chk2 to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
                if (chk2 as integer) > 0 then
                    set ready to true
                    exit repeat
                end if
            end try
        end repeat

        if not ready then
            display alert "起動失敗" message "サーバーの起動に失敗しました。ログを確認してください: " & logFile as critical
            return
        end if
    end if

    -- ブラウザで開く
    do shell script "open http://localhost:" & portNum
end run
APPLESCRIPT

# .app をコンパイル
osacompile -o "$APP_OUT" "$SCRIPT_TMP"
rm -f "$SCRIPT_TMP"

if [ ! -d "$APP_OUT" ]; then
  echo "❌ .app の生成に失敗しました。"
  exit 1
fi

# 実行権限を付与
chmod +x "$APP_OUT/Contents/MacOS/applet" 2>/dev/null || true

echo ""
echo "✓ AetherBlack.app を生成しました！"
echo ""
echo "━━━ 使い方 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  【今すぐ起動】"
echo "  open \"$APP_OUT\""
echo ""
echo "  【Applications に登録】（Launchpad から起動可能）"
echo "  cp -r \"$APP_OUT\" /Applications/"
echo ""
echo "  【ダブルクリック起動】"
echo "  Finder で AetherBlack.app をダブルクリック"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
