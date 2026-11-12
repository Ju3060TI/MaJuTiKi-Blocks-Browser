import {
  BoxGeometry,
  MeshLambertMaterial,
} from "three";
import { Chunk } from "./Chunk.js";
import { createBlockTextures } from "./TextureGenerator.js";
import {
  BlockType,
  CHUNK_SIZE,
  WORLD_HEIGHT,
  getBlockIndex,
  WorldGenerator,
} from "./WorldGenerator.js";

const VIEW_RADIUS = 2;
const VERTICAL_CHUNKS = WORLD_HEIGHT / CHUNK_SIZE;
const CHUNK_DIRECTIONS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function chunkKey(x, y, z) {
  return `${x},${y},${z}`;
}

function normalizeMaterials(texture, count = 6) {
  return Array.from({ length: count }, () => new MeshLambertMaterial({ map: texture }));
}

export class World {
  constructor(scene, worldGenerator = new WorldGenerator()) {
    this.scene = scene;
    this.generator = worldGenerator;
    this.chunks = new Map();
    this.blockEdits = new Map();
    this.geometry = new BoxGeometry(1, 1, 1);
    this.materials = this.#createMaterials();
    this.centerChunkX = Number.NaN;
    this.centerChunkZ = Number.NaN;
    this.update({ x: 0, z: 0 });
  }

  getBlockAt(x, y, z) {
    const worldX = Math.floor(x);
    const worldY = Math.floor(y);
    const worldZ = Math.floor(z);
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return BlockType.AIR;

    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkY = Math.floor(worldY / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(chunkX, chunkY, chunkZ));
    if (!chunk) return BlockType.AIR;

    return chunk.getBlock(
      worldX - chunkX * CHUNK_SIZE,
      worldY - chunkY * CHUNK_SIZE,
      worldZ - chunkZ * CHUNK_SIZE,
    );
  }

  getMeshes() {
    const meshes = [];
    for (const chunk of this.chunks.values()) meshes.push(...chunk.meshes);
    return meshes;
  }

  setBlockAt(x, y, z, type) {
    const worldX = Math.floor(x);
    const worldY = Math.floor(y);
    const worldZ = Math.floor(z);
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return false;
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkY = Math.floor(worldY / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(chunkX, chunkY, chunkZ));
    if (!chunk) return false;

    chunk.setBlock(
      worldX - chunkX * CHUNK_SIZE,
      worldY - chunkY * CHUNK_SIZE,
      worldZ - chunkZ * CHUNK_SIZE,
      type,
    );
    const key = chunkKey(chunkX, chunkY, chunkZ);
    let edits = this.blockEdits.get(key);
    if (!edits) {
      edits = new Map();
      this.blockEdits.set(key, edits);
    }
    edits.set(
      getBlockIndex(
        worldX - chunkX * CHUNK_SIZE,
        worldY - chunkY * CHUNK_SIZE,
        worldZ - chunkZ * CHUNK_SIZE,
      ),
      type,
    );
    this.#rebuildAround(worldX, worldY, worldZ);
    return true;
  }

  breakBlock(x, y, z) {
    const type = this.getBlockAt(x, y, z);
    if (type === BlockType.AIR || !this.setBlockAt(x, y, z, BlockType.AIR)) return BlockType.AIR;
    return type;
  }

  getSpawnPoint() {
    const center = Math.floor(CHUNK_SIZE / 2);
    for (let radius = 0; radius < CHUNK_SIZE; radius += 1) {
      for (let x = Math.max(0, center - radius); x <= Math.min(CHUNK_SIZE - 1, center + radius); x += 1) {
        for (let z = Math.max(0, center - radius); z <= Math.min(CHUNK_SIZE - 1, center + radius); z += 1) {
          const worldX = x + 0.5;
          const worldZ = z + 0.5;
          const groundY = this.generator.getHeightAt(x, z);
          if (
            this.getBlockAt(x, groundY, z) === BlockType.GRASS &&
            this.getBlockAt(x, groundY + 1, z) === BlockType.AIR &&
            this.getBlockAt(x, groundY + 2, z) === BlockType.AIR
          ) {
            return { x: worldX, y: groundY + 1, z: worldZ };
          }
        }
      }
    }

    const groundY = this.generator.getHeightAt(center, center);
    return { x: center + 0.5, y: groundY + 1, z: center + 0.5 };
  }

  update(position) {
    const nextCenterX = Math.floor(position.x / CHUNK_SIZE);
    const nextCenterZ = Math.floor(position.z / CHUNK_SIZE);
    if (nextCenterX === this.centerChunkX && nextCenterZ === this.centerChunkZ) return;
    this.centerChunkX = nextCenterX;
    this.centerChunkZ = nextCenterZ;

    const wanted = new Set();
    for (let x = nextCenterX - VIEW_RADIUS; x <= nextCenterX + VIEW_RADIUS; x += 1) {
      for (let z = nextCenterZ - VIEW_RADIUS; z <= nextCenterZ + VIEW_RADIUS; z += 1) {
        for (let y = 0; y < VERTICAL_CHUNKS; y += 1) wanted.add(chunkKey(x, y, z));
      }
    }

    const affected = new Set();
    for (const [key, chunk] of this.chunks) {
      if (wanted.has(key)) continue;
      affected.add(key);
      chunk.dispose();
      this.chunks.delete(key);
      for (const [dx, dy, dz] of CHUNK_DIRECTIONS) {
        const neighbor = this.chunks.get(chunkKey(chunk.chunkX + dx, chunk.chunkY + dy, chunk.chunkZ + dz));
        if (neighbor) affected.add(chunkKey(neighbor.chunkX, neighbor.chunkY, neighbor.chunkZ));
      }
    }

    for (const key of wanted) {
      if (this.chunks.has(key)) continue;
      const [chunkX, chunkY, chunkZ] = key.split(",").map(Number);
      const blocks = this.generator.generateChunk(chunkX, chunkY, chunkZ);
      for (const [index, type] of this.blockEdits.get(key) ?? []) blocks[index] = type;
      const chunk = new Chunk(this, chunkX, chunkY, chunkZ, blocks);
      this.chunks.set(key, chunk);
      affected.add(key);
      for (const [dx, dy, dz] of CHUNK_DIRECTIONS) {
        const neighbor = this.chunks.get(chunkKey(chunkX + dx, chunkY + dy, chunkZ + dz));
        if (neighbor) affected.add(chunkKey(neighbor.chunkX, neighbor.chunkY, neighbor.chunkZ));
      }
    }

    for (const key of affected) {
      this.chunks.get(key)?.rebuild();
    }
  }

  dispose() {
    for (const chunk of this.chunks.values()) chunk.dispose();
    this.chunks.clear();
    this.geometry.dispose();
    for (const materials of this.materials) {
      if (!materials) continue;
      for (const material of Array.isArray(materials) ? materials : [materials]) material.dispose();
    }
    for (const texture of Object.values(this.textures)) texture.dispose();
  }

  #rebuildAround(x, y, z) {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    const localX = x - chunkX * CHUNK_SIZE;
    const localY = y - chunkY * CHUNK_SIZE;
    const localZ = z - chunkZ * CHUNK_SIZE;
    const targets = new Set([chunkKey(chunkX, chunkY, chunkZ)]);
    if (localX === 0) targets.add(chunkKey(chunkX - 1, chunkY, chunkZ));
    if (localX === CHUNK_SIZE - 1) targets.add(chunkKey(chunkX + 1, chunkY, chunkZ));
    if (localY === 0) targets.add(chunkKey(chunkX, chunkY - 1, chunkZ));
    if (localY === CHUNK_SIZE - 1) targets.add(chunkKey(chunkX, chunkY + 1, chunkZ));
    if (localZ === 0) targets.add(chunkKey(chunkX, chunkY, chunkZ - 1));
    if (localZ === CHUNK_SIZE - 1) targets.add(chunkKey(chunkX, chunkY, chunkZ + 1));
    for (const key of targets) this.chunks.get(key)?.rebuild();
  }

  #createMaterials() {
    this.textures = createBlockTextures();
    const single = (texture) => new MeshLambertMaterial({ map: texture });
    const materials = Array(Object.keys(BlockType).length).fill(null);
    materials[BlockType.GRASS] = [
      single(this.textures.grassSide),
      single(this.textures.grassSide),
      single(this.textures.grassTop),
      single(this.textures.dirt),
      single(this.textures.grassSide),
      single(this.textures.grassSide),
    ];
    materials[BlockType.WOOD] = [
      single(this.textures.wood),
      single(this.textures.wood),
      single(this.textures.woodTop),
      single(this.textures.woodTop),
      single(this.textures.wood),
      single(this.textures.wood),
    ];
    materials[BlockType.CRAFTING_TABLE] = [
      single(this.textures.wood),
      single(this.textures.wood),
      single(this.textures.planks),
      single(this.textures.woodTop),
      single(this.textures.wood),
      single(this.textures.wood),
    ];
    materials[BlockType.DIRT] = normalizeMaterials(this.textures.dirt);
    materials[BlockType.STONE] = normalizeMaterials(this.textures.stone);
    materials[BlockType.LEAVES] = normalizeMaterials(this.textures.leaves);
    materials[BlockType.SAND] = normalizeMaterials(this.textures.sand);
    materials[BlockType.SNOW] = normalizeMaterials(this.textures.snow);
    materials[BlockType.COAL_ORE] = normalizeMaterials(this.textures.coalOre);
    materials[BlockType.IRON_ORE] = normalizeMaterials(this.textures.ironOre);
    materials[BlockType.PLANKS] = normalizeMaterials(this.textures.planks);
    return materials;
  }
}
