import {
  ClampToEdgeWrapping,
  NearestFilter,
  SRGBColorSpace,
  TextureLoader,
} from "three";
import {
  BLOCK_TEXTURE_ATLAS,
  TEXTURE_ATLAS_GRID_SIZE,
} from "./blocks.js";

const ATLAS_SIZE = 512;
const PIXEL_INSET = 0.5 / ATLAS_SIZE;

export function getAtlasUvs(textureName, localUvs) {
  const tile = BLOCK_TEXTURE_ATLAS[textureName];
  if (!tile) throw new Error(`Missing atlas tile for "${textureName}".`);

  const left = tile.x / TEXTURE_ATLAS_GRID_SIZE + PIXEL_INSET;
  const right = (tile.x + tile.width) / TEXTURE_ATLAS_GRID_SIZE - PIXEL_INSET;
  const bottom = 1 - (tile.y + tile.height) / TEXTURE_ATLAS_GRID_SIZE + PIXEL_INSET;
  const top = 1 - tile.y / TEXTURE_ATLAS_GRID_SIZE - PIXEL_INSET;

  return localUvs.map(([u, v]) => [
    left + u * (right - left),
    bottom + v * (top - bottom),
  ]);
}

export class TextureAtlas {
  constructor(url = new URL("../../assets/atlas.png", import.meta.url).href) {
    this.texture = new TextureLoader().load(url);
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.wrapS = ClampToEdgeWrapping;
    this.texture.wrapT = ClampToEdgeWrapping;
  }

  getUvs(textureName, localUvs) {
    return getAtlasUvs(textureName, localUvs);
  }
}
