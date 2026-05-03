// AETHER BLACK — Pro Demo Scene Builder (Step 1 v2)
// Unityプロジェクト内の Assets/ 以下 Editor/ フォルダに配置して使用。

using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace AetherBlack
{
    public class AetherBlackSceneBuilder : EditorWindow
    {
        private string  _assetName    = "MyAssetPack";
        private string  _sourceFolder = "Assets/Images";
        private Vector2 _scrollPos;
        private string  _validationReport = "";
        private string  _submissionMsg    = "";

        // ── 出力パス（Asset Name から自動導出）────────────────────────────────
        private string OutputRoot   => $"Assets/AETHER_BLACK/{_assetName}";
        private string TexturesDir  => $"{OutputRoot}/Textures";
        private string MaterialsDir => $"{OutputRoot}/Materials";
        private string ScenesDir    => $"{OutputRoot}/Scenes";
        private string OutputScene  => $"{ScenesDir}/Demo.unity";

        // ─────────────────────────────────────────────────────────────────────
        [MenuItem("AETHER BLACK/Build Demo Scene")]
        public static void ShowWindow()
        {
            var w = GetWindow<AetherBlackSceneBuilder>("AETHER BLACK");
            w.minSize = new Vector2(480f, 430f);
            w.Show();
        }

        private void OnGUI()
        {
            _scrollPos = EditorGUILayout.BeginScrollView(_scrollPos);

            GUILayout.Space(10f);
            EditorGUILayout.LabelField("AETHER BLACK  //  Pro Demo Scene Builder", EditorStyles.boldLabel);
            GUILayout.Space(10f);

            // ── Build ─────────────────────────────────────────────────────────
            EditorGUILayout.LabelField("■ Build", EditorStyles.miniLabel);
            _assetName    = EditorGUILayout.TextField(
                new GUIContent("Asset Name", "パッケージ名（フォルダ名・タイトル表示に使用）"), _assetName);
            _sourceFolder = EditorGUILayout.TextField(
                new GUIContent("Source Images Folder", "PNG/JPGが入ったフォルダ（プロジェクト相対パス）"), _sourceFolder);

            GUILayout.Space(4f);
            EditorGUILayout.HelpBox($"出力先: {OutputScene}", MessageType.None);
            GUILayout.Space(6f);

            if (GUILayout.Button("▶  Build Demo Scene", GUILayout.Height(34f)))
                BuildScene();

            GUILayout.Space(18f);

            // ── Validation ────────────────────────────────────────────────────
            EditorGUILayout.LabelField("■ Validation", EditorStyles.miniLabel);
            if (GUILayout.Button("✔  Validate Package", GUILayout.Height(28f)))
                ValidatePackage();

            if (!string.IsNullOrEmpty(_validationReport))
            {
                bool ok = !_validationReport.Contains("[ERROR]");
                EditorGUILayout.HelpBox(_validationReport, ok ? MessageType.Info : MessageType.Error);
            }

            GUILayout.Space(18f);

            // ── Submission Message ────────────────────────────────────────────
            EditorGUILayout.LabelField("■ Submission Message (審査員へのメッセージ)", EditorStyles.miniLabel);
            if (GUILayout.Button("✉  Generate & Copy Submission Message", GUILayout.Height(28f)))
                GenerateSubmissionMessage();

            if (!string.IsNullOrEmpty(_submissionMsg))
            {
                EditorGUILayout.TextArea(_submissionMsg, GUILayout.MinHeight(72f));
                EditorGUILayout.HelpBox("クリップボードにコピーしました。ポータル申請画面に貼り付けてください。", MessageType.Info);
            }

            EditorGUILayout.EndScrollView();
        }

        // ══════════════════════════════════════════════════════════════════════
        // BUILD
        // ══════════════════════════════════════════════════════════════════════

        private void BuildScene()
        {
            if (string.IsNullOrWhiteSpace(_assetName))
            {
                EditorUtility.DisplayDialog("AETHER BLACK", "Asset Name を入力してください。", "OK");
                return;
            }

            string projectRoot    = Directory.GetParent(Application.dataPath).FullName + Path.DirectorySeparatorChar;
            string absoluteSource = Path.Combine(projectRoot, _sourceFolder.Replace('/', Path.DirectorySeparatorChar));

            if (!Directory.Exists(absoluteSource))
            {
                Debug.LogError($"[AetherBlack] Source folder not found: {_sourceFolder}");
                EditorUtility.DisplayDialog("AETHER BLACK", $"フォルダが存在しません:\n{_sourceFolder}", "OK");
                return;
            }

            AssetDatabase.Refresh();

            // 画像収集
            var ext   = new HashSet<string>(System.StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg" };
            var paths = new List<string>();
            foreach (string f in Directory.GetFiles(absoluteSource, "*.*", SearchOption.AllDirectories))
            {
                if (!ext.Contains(Path.GetExtension(f))) continue;
                string rel = f.StartsWith(projectRoot)
                    ? f.Substring(projectRoot.Length).Replace('\\', '/')
                    : f.Replace('\\', '/');
                paths.Add(rel);
            }

            if (paths.Count == 0)
            {
                EditorUtility.DisplayDialog("AETHER BLACK", $"画像が見つかりません:\n{_sourceFolder}", "OK");
                return;
            }

            // 規約準拠フォルダ構造を作成
            CreateDir(TexturesDir, projectRoot);
            CreateDir(MaterialsDir, projectRoot);
            CreateDir(ScenesDir, projectRoot);
            AssetDatabase.Refresh();

            // 新規空シーン
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 各画像を Quad に配置
            var placed = new List<GameObject>();
            for (int i = 0; i < paths.Count; i++)
            {
                GameObject quad = BuildImageQuad(paths[i], i);
                if (quad != null) placed.Add(quad);
            }

            float centerX    = placed.Count > 0 ? (placed.Count - 1) * 2.0f / 2f : 0f;
            float totalWidth = placed.Count > 0 ? (placed.Count - 1) * 2.0f + 2f : 2f;

            // シーン装飾
            PlaceBackground(centerX, totalWidth);
            PlaceTitle(_assetName, centerX);
            SetupLighting();
            PlaceCamera(centerX, totalWidth);

            // 保存
            AssetDatabase.SaveAssets();
            EditorSceneManager.SaveScene(scene, OutputScene);
            AssetDatabase.Refresh();

            string msg = $"Demoシーン生成完了！\n\n配置テクスチャ: {placed.Count} 件\n保存先: {OutputScene}";
            Debug.Log("[AetherBlack] " + msg);
            EditorUtility.DisplayDialog("AETHER BLACK — 完了", msg, "OK");
        }

        // 1枚の画像を Quad に変換して返す
        private GameObject BuildImageQuad(string assetPath, int index)
        {
            string imageName = Path.GetFileNameWithoutExtension(assetPath);

            // Texture Type を強制的に Default へ
            var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
            if (importer == null)
            {
                Debug.LogWarning($"[AetherBlack] TextureImporter not found: {assetPath}");
                return null;
            }

            if (importer.textureType != TextureImporterType.Default)
            {
                importer.textureType = TextureImporterType.Default;
                importer.SaveAndReimport();
            }
            else
            {
                AssetDatabase.ImportAsset(assetPath, ImportAssetOptions.ForceUpdate);
            }

            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(assetPath);
            if (texture == null)
            {
                Debug.LogError($"[AetherBlack] テクスチャのロードに失敗: {assetPath}");
                return null;
            }

            // マテリアル作成（Built-in / URP 両対応）
            var shader = Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                Debug.LogError("[AetherBlack] シェーダーが見つかりません。");
                return null;
            }

            var mat = new Material(shader);
            mat.SetTexture("_MainTex", texture);

            string matPath = $"{MaterialsDir}/{imageName}.mat";
            AssetDatabase.CreateAsset(mat, matPath);

            // Quad 生成
            var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            quad.name = imageName;
            quad.GetComponent<MeshRenderer>().sharedMaterial =
                AssetDatabase.LoadAssetAtPath<Material>(matPath);

            // X軸に 2 ずつオフセット — 重なり防止の鉄則
            quad.transform.position = new Vector3(index * 2.0f, 0f, 0f);

            // アスペクト比に合わせてスケール
            if (texture.height > 0)
            {
                float aspect = (float)texture.width / texture.height;
                quad.transform.localScale = new Vector3(aspect, 1f, 1f);
            }

            return quad;
        }

        // 全 Quad の背後に暗い背景板を配置
        private void PlaceBackground(float centerX, float totalWidth)
        {
            var bg = GameObject.CreatePrimitive(PrimitiveType.Quad);
            bg.name = "_Background";
            Object.DestroyImmediate(bg.GetComponent<Collider>());

            // Unlit/Color を優先（URP の場合は Standard にフォールバック）
            var shader = Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
            var mat    = new Material(shader);
            mat.color  = new Color(0.04f, 0.04f, 0.06f);

            string bgMatPath = $"{MaterialsDir}/_Background.mat";
            AssetDatabase.CreateAsset(mat, bgMatPath);
            bg.GetComponent<MeshRenderer>().sharedMaterial =
                AssetDatabase.LoadAssetAtPath<Material>(bgMatPath);

            // カメラ(Z=-n) → Quad(Z=0) → 背景(Z=1) の奥行き順
            bg.transform.position   = new Vector3(centerX, 0f, 1f);
            bg.transform.localScale = new Vector3(totalWidth + 4f, 6f, 1f);
        }

        // アセット名を 3D テキストで表示（TextMesh — 追加パッケージ不要）
        private void PlaceTitle(string assetName, float centerX)
        {
            var go = new GameObject("DemoTitle");
            var tm = go.AddComponent<TextMesh>();
            tm.text      = assetName;
            tm.fontSize  = 48;
            tm.fontStyle = FontStyle.Bold;
            tm.color     = Color.white;
            tm.anchor    = TextAnchor.MiddleCenter;
            tm.alignment = TextAlignment.Center;

            // Quad の上部（Y=1.4）、背景板より手前（Z=-0.1）
            go.transform.position   = new Vector3(centerX, 1.4f, -0.1f);
            go.transform.localScale = Vector3.one * 0.07f;
        }

        // プロ仕様のライティング設定
        private void SetupLighting()
        {
            // キーライト: 暖色・上前右から
            var key = new GameObject("KeyLight");
            var kl  = key.AddComponent<Light>();
            kl.type      = LightType.Directional;
            kl.intensity = 1.2f;
            kl.color     = new Color(1f, 0.96f, 0.88f);
            key.transform.rotation = Quaternion.Euler(40f, -30f, 0f);

            // フィルライト: 寒色・左から補助
            var fill = new GameObject("FillLight");
            var fl   = fill.AddComponent<Light>();
            fl.type      = LightType.Directional;
            fl.intensity = 0.4f;
            fl.color     = new Color(0.72f, 0.86f, 1f);
            fill.transform.rotation = Quaternion.Euler(20f, 150f, 0f);

            // 環境光: 暗く締めてテクスチャを際立たせる
            RenderSettings.ambientMode  = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.08f, 0.08f, 0.10f);
            RenderSettings.skybox       = null;
        }

        // カメラ: 全 Quad が収まる距離に自動調整
        private void PlaceCamera(float centerX, float totalWidth)
        {
            var go  = new GameObject("Main Camera");
            var cam = go.AddComponent<Camera>();
            go.AddComponent<AudioListener>();
            cam.tag             = "MainCamera";
            cam.clearFlags      = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.04f, 0.04f, 0.06f);

            float dist = Mathf.Max(10f, totalWidth * 0.75f);
            go.transform.position = new Vector3(centerX, 0f, -dist);
            go.transform.LookAt(new Vector3(centerX, 0f, 0f));
        }

        // ══════════════════════════════════════════════════════════════════════
        // VALIDATION
        // ══════════════════════════════════════════════════════════════════════

        private void ValidatePackage()
        {
            var sb   = new StringBuilder();
            bool pass = true;

            // チェック1: .unity シーンファイルが 1 つ以上存在するか
            string[] scenes = Directory.GetFiles(Application.dataPath, "*.unity", SearchOption.AllDirectories);
            if (scenes.Length == 0)
            {
                sb.AppendLine("[ERROR] .unityシーンファイルが見つかりません。先に Build を実行してください。");
                pass = false;
            }
            else
            {
                sb.AppendLine($"[OK] シーン {scenes.Length} 件 確認済み。");
            }

            // チェック2: AETHER_BLACK フォルダ内マテリアルのテクスチャ参照が外れていないか
            string matRoot = Path.Combine(Application.dataPath, "AETHER_BLACK");
            if (Directory.Exists(matRoot))
            {
                string[] mats  = Directory.GetFiles(matRoot, "*.mat", SearchOption.AllDirectories);
                int      broke = 0;
                foreach (string mf in mats)
                {
                    string rel = "Assets" + mf.Replace(Application.dataPath, "").Replace('\\', '/');
                    var m = AssetDatabase.LoadAssetAtPath<Material>(rel);
                    if (m != null && m.GetTexture("_MainTex") == null)
                    {
                        sb.AppendLine($"[ERROR] テクスチャ参照なし: {Path.GetFileName(mf)}");
                        broke++;
                        pass = false;
                    }
                }
                if (broke == 0 && mats.Length > 0)
                    sb.AppendLine($"[OK] マテリアル {mats.Length} 件のテクスチャ参照 確認済み。");
                else if (mats.Length == 0)
                    sb.AppendLine("[WARN] AETHER_BLACK にマテリアルが見つかりません。");
            }
            else
            {
                sb.AppendLine("[WARN] AETHER_BLACK フォルダがありません。Build を先に実行してください。");
                pass = false;
            }

            _validationReport = (pass ? "すべてのチェックが通過しました。\n\n" : "修正が必要な項目があります。\n\n")
                              + sb.ToString().Trim();
            Debug.Log("[AetherBlack] Validation:\n" + _validationReport);
            Repaint();
        }

        // ══════════════════════════════════════════════════════════════════════
        // SUBMISSION MESSAGE
        // ══════════════════════════════════════════════════════════════════════

        private void GenerateSubmissionMessage()
        {
            _submissionMsg =
                $"This package includes a pre-configured Demo Scene located at " +
                $"Assets/AETHER_BLACK/{_assetName}/Scenes/Demo.unity. " +
                $"All textures are applied to high-quality Quads for immediate preview. " +
                $"The scene contains a title label, professional lighting, and a dark background " +
                $"optimized for showcasing high-resolution texture assets.";

            GUIUtility.systemCopyBuffer = _submissionMsg;
            Debug.Log("[AetherBlack] Submission message copied to clipboard.");
            Repaint();
        }

        // ══════════════════════════════════════════════════════════════════════
        // UTILS
        // ══════════════════════════════════════════════════════════════════════

        private static void CreateDir(string projectRelPath, string projectRoot)
        {
            Directory.CreateDirectory(Path.Combine(
                projectRoot.TrimEnd(Path.DirectorySeparatorChar),
                projectRelPath.Replace('/', Path.DirectorySeparatorChar)));
        }
    }
}
