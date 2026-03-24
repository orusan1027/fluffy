# SCARNEY POKER — オンラインマルチプレイヤー

Hi/Lo スプリットポット方式のオリジナルポーカー「SCARNEY」のオンライン対戦版です。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| モノレポ管理 | pnpm workspaces |
| フロントエンド | React 18 + TypeScript + Vite + Zustand + Socket.IO Client |
| バックエンド | Node.js + Express + Socket.IO + Prisma ORM |
| データベース | PostgreSQL (開発は SQLite 可) |
| 共通型/ロジック | `packages/shared` (TypeScript) |
| 認証 | JWT (アクセストークン) + HttpOnly Cookie (リフレッシュトークン) |

---

## ディレクトリ構成

```
scarney-online/
├── apps/
│   ├── server/          # Express + Socket.IO サーバー
│   │   └── src/
│   │       ├── config.ts
│   │       ├── db/
│   │       ├── game/          # GameEngine, Deck, BotPlayer, PotManager, TimerManager
│   │       ├── middleware/
│   │       ├── routes/        # authRoutes, rankingRoutes
│   │       ├── services/      # authService, rankingService
│   │       └── socket/        # socketServer, GameRoomManager, handlers
│   └── web/             # React フロントエンド
│       └── src/
│           ├── components/    # CardView, PlayerSeat, ActionPanel, ChatBox, ResultModal
│           ├── hooks/         # useCountdown, useSocketEvents
│           ├── lib/           # socket.ts, api.ts
│           ├── screens/       # TitleScreen, AuthScreen, LobbyScreen, GameScreen
│           ├── store/         # authStore, lobbyStore, gameStore, chatStore (Zustand)
│           └── styles/
├── packages/
│   └── shared/          # 共通型定義・定数・手役評価ロジック
│       └── src/
│           ├── constants/     # game.ts, socket.ts
│           ├── types/         # auth, game, lobby, ranking, socket
│           └── utils/         # handEvaluator.ts
└── prisma/
    └── schema.prisma    # User, Game, Hand, Action, ChatMessage, RankingEntry, RefreshToken
```

---

## セットアップ

### 1. 依存関係インストール

```bash
cd scarney-online
pnpm install
```

### 2. 環境変数設定

```bash
cp .env.example .env
# .env を編集して DATABASE_URL, JWT_SECRET 等を設定
```

### 3. DB マイグレーション

```bash
pnpm db:push        # 開発用 (スキーマ同期)
# または
pnpm db:migrate     # マイグレーション履歴管理
pnpm db:generate    # Prisma Client 生成
```

### 4. 開発サーバー起動

```bash
pnpm dev
# サーバー: http://localhost:3001
# クライアント: http://localhost:5173
```

---

## ゲームルール

### 基本

- 各プレイヤーに **7枚** のホールカードを配布
- 通常の 5枚コミュニティカード（**トップボード**）に加え、ホールカードの一部は自動的に**ボトムボード**（捨て牌）へ移動
- ショーダウンでは **Hi（最強の役）** と **Lo（数字の合計が最小）** でポットを山分け
- Hi と Lo を両方獲得すれば **スクープ**！

### アクション

| アクション | 説明 |
|---|---|
| フォールド | 降りる |
| チェック | パス（ベットなしの場合） |
| コール | 現在のベットに追いつく |
| ベット | 新規ベット |
| レイズ | 既存ベットを上乗せ |
| オールイン | 全チップを投入 |

### ゲームモード

- **トーナメント**: 通常のブラインド構造
- **ボムポット**: 全員が強制的にポストし、ポットが大きくなった状態からスタート

---

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/auth/signup` | 新規登録 |
| POST | `/api/auth/login` | ログイン |
| POST | `/api/auth/refresh` | トークンリフレッシュ |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/ranking` | ランキング取得 |

## Socket.IO イベント

### クライアント → サーバー

| イベント | ペイロード |
|---|---|
| `auth:login` | `{ token }` |
| `lobby:list` | — |
| `room:create` | `RoomSettings` |
| `room:join` | `roomId` |
| `room:leave` | `roomId` |
| `room:seat` | `{ roomId, seatIndex }` |
| `room:unseat` | `roomId` |
| `room:start` | `roomId` |
| `game:action` | `{ roomId, action }` |
| `chat:message` | `{ roomId, text }` |

### サーバー → クライアント

| イベント | ペイロード |
|---|---|
| `game:state` | `PersonalGameState` |
| `game:result` | `HandResult` |
| `lobby:update` | `RoomSummary[]` |
| `room:update` | `Room` |
| `chat:message` | `{ userId, username, text, at }` |

---

## 環境変数 (.env)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/scarney
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```
