import { createNoise2D, createNoise3D } from "simplex-noise";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const CHUNK_VOLUME = CHUNK_SIZE ** 3;

export const BlockType = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  SNOW: 7,
  COAL_ORE: 8,
  IRON_ORE: 9,
  PLANKS: 10,
  CRAFTING_TABLE: 11,
});

export const BLOCK_NAMES = Object.freeze({
  [BlockType.GRASS]: "Grass",
  [BlockType.DIRT]: "Dirt",
  [BlockType.STONE]: "Stone",
  [BlockType.WOOD]: "Wood",
  [BlockType.LEAVES]: "Leaves",
  [BlockType.SAND]: "Sand",
  [BlockType.SNOW]: "Snow",
  [BlockType.COAL_ORE]: "Coal Ore",
  [BlockType.IRON_ORE]: "Iron Ore",
  [BlockType.PLANKS]: "Planks",
  [BlockType.CRAFTING_TABLE]: "Crafting Table",
});

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
const TERRAIN_FREQUENCY = 0.035;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hash2D(x, z, seed = 0x51f15e) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function hash3D(x, y, z) {
  let value =
    Math.imul(x, 374761393) +
    Math.imul(y, 668265263) +
    Math.imul(z, 1442695041) +
    0x2c9277b5;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

function blockIndex(x, y, z) {
  return x * CHUNK_AREA + y * CHUNK_SIZE + z;
}

export class WorldGenerator {
  constructor(seed = 20240601) {
    const random = seededRandom(seed);
    this.noise2D = createNoise2D(random);
    this.noise3D = createNoise3D(random);
  }

  getTemperatureAt(worldX, worldZ) {
    return this.noise2D(worldX * 0.012 + 73, worldZ * 0.012 - 41);
  }

  getHeightAt(worldX, worldZ) {
    const broad = this.noise2D(worldX * TERRAIN_FREQUENCY, worldZ * TERRAIN_FREQUENCY);
    const detail = this.noise2D(worldX * 0.11, worldZ * 0.11) * 0.18;
    return Math.max(5, Math.min(WORLD_HEIGHT - 8, Math.floor(17 + broad * 9 + detail * 5)));
  }

  getBiomeAt(worldX, worldZ) {
    const temperature = this.getTemperatureAt(worldX, worldZ);
    if (temperature < -0.34) return "tundra";
    if (temperature > 0.34) return "desert";
    return "forest";
  }

  generateChunk(chunkX = 0, chunkY = 0, chunkZ = 0) {
    const blocks = new Uint8Array(CHUNK_VOLUME);
    const worldYStart = chunkY * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const worldX = chunkX * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        const worldZ = chunkZ * CHUNK_SIZE + z;
        const height = this.getHeightAt(worldX, worldZ);
        const biome = this.getBiomeAt(worldX, worldZ);
        const surface =
          biome === "tundra"
            ? BlockType.SNOW
            : biome === "desert"
              ? BlockType.SAND
              : BlockType.GRASS;
        for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
          const worldY = worldYStart + localY;
          if (worldY > height) continue;

          let type;
          if (worldY === height) {
            type = surface;
          } else if (surface === BlockType.SAND && worldY >= height - 3) {
            type = BlockType.SAND;
          } else if (worldY >= height - 3) {
            type = BlockType.DIRT;
          } else {
            const cave = this.noise3D(worldX * 0.075, worldY * 0.075, worldZ * 0.075);
            if (worldY > 3 && worldY < height - 3 && cave > 0.57) continue;

            const oreRoll = hash3D(worldX, worldY, worldZ) / 4294967296;
            if (worldY < 34 && oreRoll < 0.007) {
              type = BlockType.COAL_ORE;
            } else if (worldY < 24 && oreRoll < 0.0105) {
              type = BlockType.IRON_ORE;
            } else {
              type = BlockType.STONE;
            }
          }
          blocks[blockIndex(x, localY, z)] = type;
        }
      }
    }

    this.#placeTrees(blocks, chunkX, chunkY, chunkZ);
    return blocks;
  }

  #placeTrees(blocks, chunkX, chunkY, chunkZ) {
    const yStart = chunkY * CHUNK_SIZE;
    const yEnd = yStart + CHUNK_SIZE;
    for (let worldX = chunkX * CHUNK_SIZE - 2; worldX < (chunkX + 1) * CHUNK_SIZE + 2; worldX += 1) {
      for (let worldZ = chunkZ * CHUNK_SIZE - 2; worldZ < (chunkZ + 1) * CHUNK_SIZE + 2; worldZ += 1) {
        if (hash2D(worldX, worldZ) > 0.045 || this.getBiomeAt(worldX, worldZ) !== "forest") continue;

        const height = this.getHeightAt(worldX, worldZ);
        const localX = worldX - chunkX * CHUNK_SIZE;
        const localZ = worldZ - chunkZ * CHUNK_SIZE;
        const treeHeight = 4 + Math.floor(hash2D(worldX, worldZ, 0x7f4a7c15) * 3);
        const trunkStart = height + 1;
        const crownY = height + treeHeight;

        for (let worldY = trunkStart; worldY <= crownY; worldY += 1) {
          if (worldX < chunkX * CHUNK_SIZE || worldX >= (chunkX + 1) * CHUNK_SIZE) continue;
          if (worldZ < chunkZ * CHUNK_SIZE || worldZ >= (chunkZ + 1) * CHUNK_SIZE) continue;
          if (worldY < yStart || worldY >= yEnd) continue;
          blocks[blockIndex(localX, worldY - yStart, localZ)] = BlockType.WOOD;
        }

        for (let worldY = crownY - 1; worldY <= crownY + 2; worldY += 1) {
          if (worldY < yStart || worldY >= yEnd) continue;
          const radius = worldY === crownY + 2 ? 1 : 2;
          for (let leafX = worldX - radius; leafX <= worldX + radius; leafX += 1) {
            for (let leafZ = worldZ - radius; leafZ <= worldZ + radius; leafZ += 1) {
              if (Math.abs(leafX - worldX) === radius && Math.abs(leafZ - worldZ) === radius) continue;
              const localLeafX = leafX - chunkX * CHUNK_SIZE;
              const localLeafZ = leafZ - chunkZ * CHUNK_SIZE;
              if (
                localLeafX < 0 ||
                localLeafX >= CHUNK_SIZE ||
                localLeafZ < 0 ||
                localLeafZ >= CHUNK_SIZE
              ) {
                continue;
              }
              const index = blockIndex(localLeafX, worldY - yStart, localLeafZ);
              if (blocks[index] === BlockType.AIR) blocks[index] = BlockType.LEAVES;
            }
          }
        }
      }
    }
  }
}

export function getBlockIndex(x, y, z) {
  return blockIndex(x, y, z);
}
