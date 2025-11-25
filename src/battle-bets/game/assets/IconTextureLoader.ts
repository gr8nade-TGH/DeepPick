/**
 * Icon Texture Loader - Load Figma-designed SVG icons as PixiJS textures
 * Handles defense orbs, attack nodes, and other game icons
 */

import * as PIXI from 'pixi.js';

/**
 * Cache for loaded textures to avoid reloading
 */
const textureCache = new Map<string, PIXI.Texture>();

/**
 * Load defense orb texture with team color
 * Creates a colored version of the SVG by replacing the fill color
 */
export async function loadDefenseOrbTexture(teamColor: string): Promise<PIXI.Texture> {
  const cacheKey = `defense-orb-${teamColor}`;
  
  // Return cached texture if available
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  try {
    // Load the base SVG
    const response = await fetch('/icons/defense-orbs/defense-orb.svg');
    let svgText = await response.text();

    // Replace the fill color with team color
    svgText = svgText.replace('#FDB927', teamColor);

    // Convert SVG to data URL
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    // Load as PixiJS texture
    const texture = await PIXI.Texture.from(url);
    
    // Cache the texture
    textureCache.set(cacheKey, texture);

    // Clean up blob URL
    URL.revokeObjectURL(url);

    console.log(`✅ [IconTextureLoader] Loaded defense orb texture: ${teamColor}`);
    return texture;
  } catch (error) {
    console.error(`❌ [IconTextureLoader] Failed to load defense orb texture:`, error);
    
    // Fallback: return a simple colored circle texture
    const graphics = new PIXI.Graphics();
    graphics.circle(0, 0, 16);
    graphics.fill({ color: parseInt(teamColor.replace('#', '0x')) });
    
    const fallbackTexture = PIXI.Texture.from(graphics);
    textureCache.set(cacheKey, fallbackTexture);
    return fallbackTexture;
  }
}

/**
 * Load attack node texture with team color
 */
export async function loadAttackNodeTexture(teamColor: string): Promise<PIXI.Texture> {
  const cacheKey = `attack-node-${teamColor}`;
  
  // Return cached texture if available
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  try {
    // Load the base SVG
    const response = await fetch('/icons/attack-nodes/attack-node.svg');
    let svgText = await response.text();

    // Replace the fill color with team color
    svgText = svgText.replace('#FDB927', teamColor);

    // Convert SVG to data URL
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    // Load as PixiJS texture
    const texture = await PIXI.Texture.from(url);
    
    // Cache the texture
    textureCache.set(cacheKey, texture);

    // Clean up blob URL
    URL.revokeObjectURL(url);

    console.log(`✅ [IconTextureLoader] Loaded attack node texture: ${teamColor}`);
    return texture;
  } catch (error) {
    console.error(`❌ [IconTextureLoader] Failed to load attack node texture:`, error);
    
    // Fallback: return a simple colored hexagon texture
    const graphics = new PIXI.Graphics();
    graphics.poly([
      { x: 0, y: -16 },
      { x: 14, y: -8 },
      { x: 14, y: 8 },
      { x: 0, y: 16 },
      { x: -14, y: 8 },
      { x: -14, y: -8 },
    ]);
    graphics.fill({ color: parseInt(teamColor.replace('#', '0x')) });
    
    const fallbackTexture = PIXI.Texture.from(graphics);
    textureCache.set(cacheKey, fallbackTexture);
    return fallbackTexture;
  }
}

/**
 * Preload all icon textures for common team colors
 */
export async function preloadIconTextures(teamColors: string[]): Promise<void> {
  console.log(`🎨 [IconTextureLoader] Preloading textures for ${teamColors.length} teams...`);
  
  const promises: Promise<PIXI.Texture>[] = [];
  
  for (const color of teamColors) {
    promises.push(loadDefenseOrbTexture(color));
    promises.push(loadAttackNodeTexture(color));
  }
  
  await Promise.all(promises);
  
  console.log(`✅ [IconTextureLoader] Preloaded ${promises.length} textures`);
}

/**
 * Clear texture cache (useful for hot reloading)
 */
export function clearTextureCache(): void {
  textureCache.clear();
  console.log(`🗑️ [IconTextureLoader] Texture cache cleared`);
}

