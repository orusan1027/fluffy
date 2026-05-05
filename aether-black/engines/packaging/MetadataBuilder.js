'use strict';
/**
 * engines/packaging/MetadataBuilder.js
 * Unity / Fab.com 両プラットフォーム向けメタデータを自動生成。
 * Unity審査ルール: キーワードにタイトルの単語を含めない / 最大5個
 */
const { THEMES } = require('../creation/themes/themePrompts');

const CATEGORY_MAP = {
  cyberpunk:     { unity: '2D/Textures & Materials', fab: 'Environments/Sci-Fi' },
  ancient_japan: { unity: '2D/Textures & Materials', fab: 'Environments/Nature' },
  deep_space:    { unity: '2D/Textures & Materials', fab: 'Environments/Sci-Fi' },
  dark_fantasy:  { unity: '2D/Textures & Materials', fab: 'Environments/Fantasy' },
  underwater:    { unity: '2D/Textures & Materials', fab: 'Environments/Nature' },
  steampunk:     { unity: '2D/Textures & Materials', fab: 'Environments/Steampunk' },
};

function build({ assetName, theme, imageCount, version = '1.0' }) {
  const themeData  = THEMES[theme] || {};
  const categories = CATEGORY_MAP[theme] || { unity: '2D/Textures & Materials', fab: 'Environments' };
  const rawKeywords = themeData.keywords || [];

  // Unity: キーワードにタイトル単語を含めない
  const titleWords = new Set(assetName.toLowerCase().split(/[\s_\-]+/));
  const safeKeywords = rawKeywords
    .filter(k => !titleWords.has(k.toLowerCase()))
    .slice(0, 5);

  const themeName = themeData.name || theme;
  const shortDesc = `${imageCount} high-resolution 8K backgrounds — ${themeName}. Ready-to-use for games, VR, and film.`;
  const longDesc  = [
    `# ${assetName}`,
    '',
    shortDesc,
    '',
    '## Contents',
    `- ${imageCount} PNG images at 7680×4320 (8K UHD)`,
    '- Organized folder structure for easy import',
    '- Compatible with Unity 2020.3+ (Built-in RP & URP)',
    '',
    '## Use Cases',
    '- 2D game scrolling backgrounds',
    '- Visual novel environment art',
    '- VR skyboxes and environments',
    '- Mobile, PC, and console games',
    '',
    '## Technical Specifications',
    '- Resolution: 7680×4320 (8K Ultra HD)',
    '- Format: PNG (lossless, no compression artifacts)',
    `- Style: ${themeName}`,
    '- No characters, no text overlays — pure environment art',
    '',
    '## License',
    'Standard Unity Asset Store / Fab.com Asset License',
  ].join('\n');

  const submissionMsg = [
    `Asset Name: ${assetName}`,
    `Version: ${version}`,
    `Contents: ${imageCount} PNG images at 7680×4320 (8K)`,
    `Category: ${categories.unity}`,
    `Keywords: ${safeKeywords.join(', ')}`,
    '',
    'All images are original AI-generated artwork.',
    'No characters, faces, or copyrighted elements.',
    'Tested for integrity: valid PNG headers, IEND markers verified.',
  ].join('\n');

  return {
    assetName, version, theme, imageCount,
    unity: {
      category:        categories.unity,
      keywords:        safeKeywords,
      shortDescription: shortDesc,
      longDescription:  longDesc,
      submissionMsg,
      price:           'Free',
    },
    fab: {
      category:        categories.fab,
      tags:            rawKeywords,
      shortDescription: shortDesc,
      longDescription:  longDesc,
    },
  };
}

module.exports = { build };
