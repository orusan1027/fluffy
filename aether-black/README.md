# AETHER BLACK

Unity Asset Store への自動出品システム。

---

## Step 1 — Pro Demo Scene Builder v2

**ファイル:** `unity/Editor/AetherBlackSceneBuilder.cs`

Unity Asset Store の審査を確実にパスするため、プロ仕様の Demo シーンを自動生成する Editor スクリプト。

### インストール

`unity/Editor/` フォルダごと、Unity プロジェクトの `Assets/` 以下の任意の場所にコピーする。
Unity が `Editor/` フォルダを自動検出し、Editor 専用アセンブリとしてコンパイルする。

```
YourUnityProject/
  Assets/
    AetherBlack/          ← ここにコピー
      Editor/
        AetherBlackSceneBuilder.cs
```

### 使い方

1. Unity プロジェクトを開く
2. メニューバーから **AETHER BLACK > Build Demo Scene** を選択
3. **Asset Name** にパッケージ名を入力（例: `FantasyBackgrounds8K`）
4. **Source Images Folder** に画像フォルダのパスを入力（デフォルト: `Assets/Images`）
5. **▶ Build Demo Scene** をクリック

### 生成されるフォルダ構造

```
Assets/
  AETHER_BLACK/
    <AssetName>/
      Textures/          ← 将来のTexture配置用（規約準拠）
      Materials/         ← 自動生成マテリアル（.mat）
      Scenes/
        Demo.unity        ← 提出用 Demo シーン
```

### シーンの内容（プロ仕様）

| オブジェクト | 内容 |
|---|---|
| Quad × N | 各画像をアスペクト比維持で表示。X 軸に 2 ずつオフセット配置（重なり防止） |
| `_Background` | 全 Quad の背後に置く暗い背景板（審査員の目線を画像に集中させる） |
| `DemoTitle` | アセット名を 3D テキストで表示（審査員が即座に内容を把握） |
| `KeyLight` | 暖色の主光源（Directional, 40°/-30°） |
| `FillLight` | 寒色の補助光源（Directional, 20°/150°） |
| `Main Camera` | ソリッドカラー背景、全 Quad を収める距離に自動調整 |

### Validation（提出前チェック）

**✔ Validate Package** ボタンで以下を自動チェック:

1. `.unity` シーンファイルが 1 つ以上存在するか
2. `AETHER_BLACK` フォルダ内の全マテリアルのテクスチャ参照が外れていないか

### Submission Message（審査員へのメッセージ自動生成）

**✉ Generate & Copy Submission Message** ボタンで以下の文章を生成・クリップボードにコピー:

> This package includes a pre-configured Demo Scene located at Assets/AETHER_BLACK/[AssetName]/Scenes/Demo.unity. All textures are applied to high-quality Quads for immediate preview. The scene contains a title label, professional lighting, and a dark background optimized for showcasing high-resolution texture assets.

### 守るべき鉄則（組み込み済み）

- Texture Type は `Default`（Sprite への自動変換を防止）
- X 軸方向に `2` ずつオフセット（重なり防止）
- `sharedMaterial` を使用（インスタンス化による警告を回避）
- マテリアルをアセットとして保存してからシーンに参照（GUID 参照の整合性を保証）

### 動作要件

- Unity 2020.3 LTS 以降
- Built-in Render Pipeline または Universal Render Pipeline (URP)

---

## 今後の開発ステップ

| ステップ | 内容 | 状態 |
|---|---|---|
| Step 1 | Unity Pro Demo シーン自動生成 + Validation + Submission Message | ✅ 完了 |
| Step 2 | Asset Store Tools によるコマンドラインアップロード | 🔜 予定 |
| Step 3 | Playwright による Publisher Portal 自動操作 | 🔜 予定 |
