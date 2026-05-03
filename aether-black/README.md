# AETHER BLACK

Unity Asset Store への自動出品システム。

---

## Step 1 — Demo Scene Builder

**ファイル:** `unity/Editor/AetherBlackSceneBuilder.cs`

Unity 内で画像アセットを自動配置し、Demoシーンを生成・保存する Editor スクリプト。

### インストール

`unity/Editor/` フォルダごと、Unityプロジェクトの `Assets/` 以下の任意の場所にコピーする。
Unity が `Editor/` フォルダを自動検出し、Editor専用アセンブリとしてコンパイルする。

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
3. **Source Images Folder** に画像が入ったフォルダのパスを入力（デフォルト: `Assets/Images`）
4. **Output Scene Path** に出力先シーンのパスを入力（デフォルト: `Assets/Demo/DemoScene.unity`）
5. **Build** ボタンをクリック

### 処理内容

- 指定フォルダ内の PNG / JPG / JPEG を再帰検索
- 各画像の Texture Type を **Default** に設定（Sprite への自動変換を防止）
- 画像ごとに Standard マテリアルを自動生成し `Assets/Demo/Materials/` に保存
- Quad オブジェクトに各マテリアルを適用
- **X 軸方向に 2 ずつオフセット**して配置（重なり防止）
- 全 Quad を映す Main Camera と Directional Light を自動追加
- シーンを指定パスに保存

### 動作要件

- Unity 2020.3 LTS 以降
- Built-in Render Pipeline または Universal Render Pipeline (URP)
  - Built-in: Standard シェーダーを使用
  - URP: `Universal Render Pipeline/Lit` シェーダーに自動フォールバック

---

## 今後の開発ステップ

| ステップ | 内容 | 状態 |
|---|---|---|
| Step 1 | Unity Demo シーン自動生成 | ✅ 完了 |
| Step 2 | Asset Store Tools によるコマンドラインアップロード | 🔜 予定 |
| Step 3 | Playwright による Publisher Portal 自動操作 | 🔜 予定 |
