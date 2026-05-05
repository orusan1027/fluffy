'use strict';
/**
 * engines/creation/themes/themePrompts.js
 * テーマ別プロンプト定義。各テーマに複数のベースプロンプトと
 * 変奏バリエーションを持ち、100枚規模のバッチ生成で重複を回避する。
 */

const THEMES = {
  cyberpunk: {
    name: 'Cyberpunk City',
    prompts: [
      'futuristic cyberpunk megacity at night, neon signs reflecting on rain-soaked streets, ultra-detailed 8K photorealistic',
      'cyberpunk alley with holographic billboards, steam vents, moody atmosphere, cinematic 8K background art',
      'neo-tokyo aerial view, flying vehicles, glowing skyscrapers, purple and cyan neon, 8K ultra-wide',
      'cyberpunk marketplace, vendor stalls with glowing tech, crowded night scene, high detail 8K',
      'rooftop in cyberpunk city, city glow below, dramatic sky, rain, 8K photorealistic background',
    ],
    negativePrompt: 'people, characters, anime, text, watermark, blurry, low quality, cartoon',
    style: 'cinematic',
    keywords: ['cyberpunk', 'neon', 'futuristic', 'sci-fi', 'night'],
  },

  ancient_japan: {
    name: 'Ancient Japan',
    prompts: [
      'ancient Japanese mountain temple surrounded by cherry blossoms, misty valleys, golden hour, 8K photorealistic',
      'traditional Japanese garden, koi pond, stone lanterns, wisteria, peaceful morning light, 8K',
      'edo period Japanese street at dusk, wooden architecture, paper lanterns glowing, 8K background',
      'zen monastery on a cliff, autumn maple trees, waterfall, dramatic sky, 8K',
      'Japanese bamboo forest at dawn, light rays, moss-covered path, 8K cinematic background',
    ],
    negativePrompt: 'people, characters, text, watermark, modern elements, cars, neon',
    style: 'painterly',
    keywords: ['japan', 'traditional', 'temple', 'zen', 'feudal'],
  },

  deep_space: {
    name: 'Deep Space',
    prompts: [
      'breathtaking nebula with vibrant colors, star clusters, cosmic dust clouds, ultra-detailed 8K',
      'alien planet surface with two moons rising, dramatic landscape, atmospheric haze, 8K photorealistic',
      'space station orbiting a gas giant with rings, starfield, hard sci-fi aesthetic, 8K',
      'black hole with accretion disk, gravitational lensing, deep space, 8K scientifically inspired',
      'galaxy collision event, sweeping cosmic structures, millions of stars, 8K ultra-wide background',
    ],
    negativePrompt: 'people, text, watermark, cartoonish, pastel, low contrast',
    style: 'photorealistic',
    keywords: ['space', 'nebula', 'galaxy', 'cosmic', 'sci-fi'],
  },

  dark_fantasy: {
    name: 'Dark Fantasy',
    prompts: [
      'dark fantasy castle on a cliff above storm clouds, lightning, cinematic 8K background',
      'enchanted dark forest with bioluminescent fungi, twisted trees, mysterious fog, 8K',
      'ancient ruins of a dark elven city, crumbling towers, blood moon, 8K fantasy art',
      'dragon lair inside a volcanic cave, glowing magma, stalactites, 8K dramatic background',
      'necromancer tower on a desolate moor, dead trees, ravens, green magical glow, 8K',
    ],
    negativePrompt: 'people, characters, text, watermark, bright colors, cheerful, cute',
    style: 'painterly',
    keywords: ['fantasy', 'dark', 'gothic', 'mystical', 'medieval'],
  },

  underwater: {
    name: 'Underwater World',
    prompts: [
      'crystal clear tropical underwater scene, vibrant coral reef, light caustics from surface, 8K photorealistic',
      'deep ocean trench, bioluminescent sea creatures, pitch dark water, 8K cinematic',
      'ancient underwater ruins, coral-covered marble columns, schools of fish, sunrays, 8K',
      'giant kelp forest underwater, filtered sunlight, peaceful atmosphere, 8K background',
      'underwater volcanic vent with unique life forms, ethereal glow, deep sea, 8K',
    ],
    negativePrompt: 'people, text, watermark, surface elements, sky, buildings',
    style: 'photorealistic',
    keywords: ['underwater', 'ocean', 'marine', 'coral', 'aquatic'],
  },

  steampunk: {
    name: 'Steampunk',
    prompts: [
      'steampunk Victorian city at golden hour, copper airships, steam vents, gear-covered towers, 8K',
      'massive steampunk factory interior, clockwork machinery, warm amber lighting, 8K photorealistic',
      'steampunk harbor with iron battleships and balloon docks, industrial smog, 8K cinematic background',
      'steampunk underground city lit by tesla coils and gas lamps, 8K ultra-detailed',
      'aerial view of steampunk metropolis, canals, bridges, massive gears, 8K wide shot',
    ],
    negativePrompt: 'people, text, watermark, modern elements, digital screens, plastic',
    style: 'cinematic',
    keywords: ['steampunk', 'victorian', 'mechanical', 'industrial', 'brass'],
  },
};

function getTheme(key) { return THEMES[key] || null; }
function listThemes() {
  return Object.entries(THEMES).map(([key, t]) => ({ key, name: t.name }));
}

const VARIATIONS = [
  '',
  ', golden hour, warm lighting',
  ', blue hour, cool tones',
  ', overcast dramatic sky',
  ', sunrise, ethereal atmosphere',
  ', storm approaching, dark clouds',
  ', moonlit scene, silver light',
  ', foggy, mysterious atmosphere',
  ', wide angle shot, epic scale',
  ', close-up detail shot',
];

function buildPrompts(themeKey, count) {
  const theme = THEMES[themeKey];
  if (!theme) throw new Error(`Unknown theme: ${themeKey}`);

  return Array.from({ length: count }, (_, i) => ({
    positive: theme.prompts[i % theme.prompts.length] + VARIATIONS[i % VARIATIONS.length],
    negative: theme.negativePrompt,
    style:    theme.style,
    seed:     Math.floor(Math.random() * 2147483647),
    index:    i,
  }));
}

module.exports = { THEMES, getTheme, listThemes, buildPrompts };
