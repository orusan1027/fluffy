using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace AetherBlack
{
    public class AetherBlackSceneBuilder : EditorWindow
    {
        private string _sourceFolder = "Assets/Images";
        private string _outputScene  = "Assets/Demo/DemoScene.unity";

        [MenuItem("AETHER BLACK/Build Demo Scene")]
        public static void ShowWindow()
        {
            var window = GetWindow<AetherBlackSceneBuilder>("AETHER BLACK — Scene Builder");
            window.minSize = new Vector2(420f, 160f);
            window.Show();
        }

        private void OnGUI()
        {
            GUILayout.Space(10f);
            EditorGUILayout.LabelField("AETHER BLACK  //  Demo Scene Builder", EditorStyles.boldLabel);
            GUILayout.Space(6f);

            _sourceFolder = EditorGUILayout.TextField(
                new GUIContent("Source Images Folder", "PNG/JPGを再帰検索するプロジェクト相対パス"),
                _sourceFolder);

            _outputScene = EditorGUILayout.TextField(
                new GUIContent("Output Scene Path", "生成する .unity シーンの保存先"),
                _outputScene);

            GUILayout.Space(10f);

            if (GUILayout.Button("Build", GUILayout.Height(30f)))
                BuildScene();
        }

        private void BuildScene()
        {
            string projectRoot = Directory.GetParent(Application.dataPath).FullName + Path.DirectorySeparatorChar;
            string absoluteSource = Path.Combine(projectRoot, _sourceFolder.Replace('/', Path.DirectorySeparatorChar));

            if (!Directory.Exists(absoluteSource))
            {
                Debug.LogError($"[AetherBlack] Source folder not found: {_sourceFolder}");
                EditorUtility.DisplayDialog("AETHER BLACK", $"Source folder does not exist:\n{_sourceFolder}", "OK");
                return;
            }

            AssetDatabase.Refresh();

            var extensions = new HashSet<string>(System.StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg" };
            string[] allFiles = Directory.GetFiles(absoluteSource, "*.*", SearchOption.AllDirectories);

            var imagePaths = new List<string>();
            foreach (string file in allFiles)
            {
                if (extensions.Contains(Path.GetExtension(file)))
                {
                    string projRel = file.StartsWith(projectRoot)
                        ? file.Substring(projectRoot.Length).Replace('\\', '/')
                        : file.Replace('\\', '/');
                    imagePaths.Add(projRel);
                }
            }

            if (imagePaths.Count == 0)
            {
                Debug.LogWarning("[AetherBlack] No images found in: " + _sourceFolder);
                EditorUtility.DisplayDialog("AETHER BLACK", "No PNG/JPG images found in:\n" + _sourceFolder, "OK");
                return;
            }

            string outputDir = Path.GetDirectoryName(_outputScene);
            string matDir    = outputDir + "/Materials";
            Directory.CreateDirectory(Path.Combine(projectRoot.TrimEnd(Path.DirectorySeparatorChar), outputDir.Replace('/', Path.DirectorySeparatorChar)));
            Directory.CreateDirectory(Path.Combine(projectRoot.TrimEnd(Path.DirectorySeparatorChar), matDir.Replace('/', Path.DirectorySeparatorChar)));
            AssetDatabase.Refresh();

            Scene demoScene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var placedObjects = new List<GameObject>();

            for (int i = 0; i < imagePaths.Count; i++)
            {
                string assetPath = imagePaths[i];
                string imageName = Path.GetFileNameWithoutExtension(assetPath);

                var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
                if (importer == null)
                {
                    Debug.LogWarning($"[AetherBlack] TextureImporter not found: {assetPath}");
                    continue;
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
                    Debug.LogError($"[AetherBlack] Failed to load texture: {assetPath}");
                    continue;
                }

                var shader = Shader.Find("Standard");
                if (shader == null) shader = Shader.Find("Universal Render Pipeline/Lit");
                if (shader == null)
                {
                    Debug.LogError("[AetherBlack] No supported shader found (Standard or URP Lit).");
                    continue;
                }

                var material = new Material(shader);
                material.SetTexture("_MainTex", texture);

                string matAssetPath = $"{matDir}/{imageName}.mat";
                AssetDatabase.CreateAsset(material, matAssetPath);

                GameObject quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
                quad.name = imageName;

                var renderer = quad.GetComponent<MeshRenderer>();
                renderer.sharedMaterial = AssetDatabase.LoadAssetAtPath<Material>(matAssetPath);

                // X軸方向に2ずつオフセット — 重なりを防ぐ鉄則
                quad.transform.position = new Vector3(i * 2.0f, 0f, 0f);

                if (texture.height > 0)
                {
                    float aspect = (float)texture.width / texture.height;
                    quad.transform.localScale = new Vector3(aspect, 1f, 1f);
                }

                placedObjects.Add(quad);
            }

            float centerX = placedObjects.Count > 0 ? (placedObjects.Count - 1) * 2.0f / 2f : 0f;

            var cameraGO = new GameObject("Main Camera");
            var cam = cameraGO.AddComponent<Camera>();
            cameraGO.AddComponent<AudioListener>();
            cam.tag = "MainCamera";
            cameraGO.transform.position = new Vector3(centerX, 0f, -10f);
            cameraGO.transform.LookAt(new Vector3(centerX, 0f, 0f));

            var lightGO = new GameObject("Directional Light");
            var light = lightGO.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1f;
            lightGO.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            AssetDatabase.SaveAssets();
            EditorSceneManager.SaveScene(demoScene, _outputScene);
            AssetDatabase.Refresh();

            string msg = $"Demo scene built successfully!\n\n{placedObjects.Count} image(s) placed.\nScene: {_outputScene}";
            Debug.Log("[AetherBlack] " + msg);
            EditorUtility.DisplayDialog("AETHER BLACK — Done", msg, "OK");
        }
    }
}
