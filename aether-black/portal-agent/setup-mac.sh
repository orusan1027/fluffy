#!/bin/bash
# ════════════════════════════════════════════════════════════════════════
#  AETHER BLACK — Mac セットアップスクリプト（初心者向け）
#
#  【このスクリプトでできること】
#    ① 必要なモジュールを自動インストール
#    ② AetherBlack.app を自動生成
#    ③ デスクトップに自動コピー
#    ④ アプリを今すぐ起動
#
#  【実行方法】ターミナルに以下を貼り付けて Enter を押すだけ:
#    bash ~/Desktop/aether-black/portal-agent/setup-mac.sh
# ════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── 色付きメッセージ ────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}✓${NC}  $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
error() { echo -e "${RED}✗${NC}  $1"; }
step()  { echo ""; echo -e "  ${YELLOW}▶ $1${NC}"; }

DESKTOP="$HOME/Desktop"
DIR="$( cd "$( dirname "$0" )" && pwd )"
APP_NAME="AetherBlack.app"
APP_OUT="$DESKTOP/$APP_NAME"
PORT=3000

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   AETHER BLACK  セットアップ（Mac用）         ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: macOS の確認 ─────────────────────────────────────────────
step "Step 1/5: macOS の確認"
if [[ "$OSTYPE" != "darwin"* ]]; then
  error "このスクリプトは macOS 専用です。"
  exit 1
fi
info "macOS を確認しました"

# ── Step 2: Node.js の確認 ───────────────────────────────────────────
step "Step 2/5: Node.js の確認"

# nvm / Homebrew / 標準インストールのすべてのパスを検索
NODE_PATH=""
for p in \
  "$(command -v node 2>/dev/null || echo '')" \
  "/opt/homebrew/bin/node" \
  "/usr/local/bin/node" \
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node/" 2>/dev/null | sort -V | tail -1 || echo '')/bin/node"; do
  if [[ -n "$p" && -x "$p" ]]; then NODE_PATH="$p"; break; fi
done

if [[ -z "$NODE_PATH" ]]; then
  error "Node.js が見つかりません。"
  echo ""
  echo "  【解決方法】"
  echo "  ① ブラウザで https://nodejs.org を開く"
  echo "  ② 「LTS」と書かれたボタンをクリックしてダウンロード"
  echo "  ③ ダウンロードしたファイルをダブルクリックしてインストール"
  echo "  ④ ターミナルを一度閉じて再起動"
  echo "  ⑤ もう一度このスクリプトを実行"
  echo ""
  exit 1
fi
NODE_VER=$("$NODE_PATH" --version 2>/dev/null || echo "不明")
info "Node.js を発見: $NODE_PATH ($NODE_VER)"

# ── Step 3: npm install ──────────────────────────────────────────────
step "Step 3/5: 必要なモジュールをインストール"
cd "$DIR"

if [[ ! -d "node_modules/express" ]]; then
  echo "  インストール中... (初回のみ30秒ほどかかります)"
  npm install --omit=dev --silent
  info "インストール完了"
else
  info "モジュールは既にインストール済み（スキップ）"
fi

# ── Step 4: AetherBlack.app を生成 ───────────────────────────────────
step "Step 4/5: AetherBlack.app を生成"

if ! command -v osacompile &>/dev/null; then
  error "osacompile が見つかりません。macOS の標準ツールが必要です。"
  exit 1
fi

# 古い .app を削除してクリーンに作り直す
rm -rf "$APP_OUT"

SCRIPT_TMP=$(mktemp /tmp/AetherBlack_XXXXXX.applescript)
cat > "$SCRIPT_TMP" << APPLESCRIPT
on run
    set dirPath  to "$DIR"
    set nodeBin  to "$NODE_PATH"
    set portNum  to "$PORT"
    set logFile  to "/tmp/aether-black-server.log"

    -- サーバーが既に起動中か確認
    set isRunning to false
    try
        set chk to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
        if (chk as integer) > 0 then set isRunning to true
    end try

    if not isRunning then
        -- node_modules がなければ npm install
        try
            do shell script "test -d " & quoted form of (dirPath & "/node_modules/express")
        on error
            do shell script "cd " & quoted form of dirPath & " && npm install --omit=dev > " & quoted form of logFile & " 2>&1"
        end try

        -- バックグラウンドでサーバーを起動
        do shell script "cd " & quoted form of dirPath & " && " & quoted form of nodeBin & " server.js >> " & quoted form of logFile & " 2>&1 &"

        -- 最大 6 秒待つ
        repeat 6 times
            delay 1
            try
                set chk2 to do shell script "lsof -i :" & portNum & " -sTCP:LISTEN 2>/dev/null | wc -l | tr -d ' '"
                if (chk2 as integer) > 0 then exit repeat
            end try
        end repeat
    end if

    -- ブラウザで開く
    do shell script "open http://localhost:" & portNum
end run
APPLESCRIPT

osacompile -o "$APP_OUT" "$SCRIPT_TMP"
rm -f "$SCRIPT_TMP"

if [[ ! -d "$APP_OUT" ]]; then
  error "アプリの生成に失敗しました。"
  exit 1
fi

info "AetherBlack.app をデスクトップに作成しました"

# ── Step 5: 完了 & 起動確認 ─────────────────────────────────────────
step "Step 5/5: セットアップ完了！"

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║  ✓  セットアップが完了しました！                 ║"
echo "  ╠══════════════════════════════════════════════════╣"
echo "  ║                                                  ║"
echo "  ║  【今後の起動方法】                              ║"
echo "  ║  デスクトップの AetherBlack.app を              ║"
echo "  ║  ダブルクリックするだけ！                        ║"
echo "  ║                                                  ║"
echo "  ║  デスクトップのパス:                            ║"
echo "  ║  $APP_OUT"
echo "  ║                                                  ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

# アプリを今すぐ起動するか確認
read -r -p "  今すぐ AetherBlack.app を起動しますか？ [Y/n]: " REPLY
if [[ "${REPLY:-Y}" =~ ^[Yy]$ ]]; then
  open "$APP_OUT"
  echo ""
  info "起動しました！ブラウザが自動で開きます。"
  info "もし開かない場合は http://localhost:$PORT を手動で開いてください。"
fi

echo ""
