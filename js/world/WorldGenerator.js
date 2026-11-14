import { createNoise2D, createNoise3D } from "simplex-noise";
import { BLOCK_COUNT, BLOCKS, BLOCK_NAMES, BlockType } from "./blocks.js";
import {
  OVERWORLD_BIOMES,
  getBiomeSurfaceForWeights,
  getBiomeWeightsFromClimate,
} from "./BiomeRegistry.js";
import { generateDungeon } from "./Structures.js";
import { generateVillage } from "./Structures.js";

export { BLOCK_COUNT, BLOCKS, BLOCK_NAMES, BlockType };

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const CHUNK_VOLUME = CHUNK_SIZE ** 3;
export const SEA_LEVEL = 14;
export const LAVA_LEVEL = 4;

const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
const GRAVEL_VEIN_MARGIN = 10;
const WORLD_OPTIONS_KEY = "majutiki-world-settings";

function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getStoredWorldSeed() {
  try {
    const savedOptions = JSON.parse(localStorage.getItem(WORLD_OPTIONS_KEY) ?? "{}");
    return typeof savedOptions.worldSeed === "string" ? savedOptions.worldSeed : undefined;
  } catch (error) {
    console.error("Could not load the saved world seed:", error);
    return undefined;
  }
}

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

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class WorldGenerator {
  constructor(seed) {
    const configuredSeed = seed ??
      (typeof window === "undefined" ? undefined : window.gameSettings?.worldSeed) ??
      (typeof localStorage === "undefined" ? undefined : getStoredWorldSeed()) ??
      20240601;
    this.setSeed(configuredSeed);
    this.onGameSettingsChange = (event) => {
      if (event.detail?.worldSeed !== undefined) {
        this.setSeed(event.detail.worldSeed);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("gamesettingschange", this.onGameSettingsChange);
    }
  }

  setSeed(seed) {
    const numericSeed = typeof seed === "number"
      ? seed >>> 0
      : hashSeed(String(seed));
    if (this.seed === numericSeed) return;
    this.seed = numericSeed;
    const random = seededRandom(numericSeed);
    this.temperature = createNoise2D(random);
    this.moisture = createNoise2D(random);
    this.biomeWarp = createNoise2D(random);
    this.biomePatches = createNoise2D(random);
    this.continentalness = createNoise2D(random);
    this.erosion = createNoise2D(random);
    this.peaks = createNoise2D(random);
    this.rivers = createNoise2D(random);
    this.caves = createNoise3D(random);
    this.oilPockets = createNoise3D(random);
  }

  getTemperatureAt(worldX, worldZ) {
    const warp = this.biomeWarp(worldX * 0.0015 + 13, worldZ * 0.0015 - 29);
    return this.temperature((worldX + warp * 28) * 0.0015 + 73, (worldZ - warp * 28) * 0.0015 - 41);
  }

  getMoistureAt(worldX, worldZ) {
    const warp = this.biomeWarp(worldX * 0.0013 - 37, worldZ * 0.0013 + 11);
    return this.moisture((worldX - warp * 24) * 0.0015 + 17, (worldZ + warp * 24) * 0.0015 - 59);
  }

  getContinentalnessAt(worldX, worldZ) {
    return this.continentalness(worldX * 0.0028, worldZ * 0.0028) * 0.78 +
      this.continentalness(worldX * 0.0075 + 23, worldZ * 0.0075 - 17) * 0.22;
  }

  getErosionAt(worldX, worldZ) {
    return this.erosion(worldX * 0.012 + 31, worldZ * 0.012 - 17);
  }

  getPeaksAt(worldX, worldZ) {
    return this.peaks(worldX * 0.026 - 47, worldZ * 0.026 + 29);
  }

  getRiverStrengthAt(worldX, worldZ) {
    const distance = Math.abs(this.rivers(worldX * 0.016 + 101, worldZ * 0.016 - 83));
    return 1 - smoothstep(0.018, 0.075, distance);
  }

  #getBaseHeightAt(worldX, worldZ) {
    const continent = this.getContinentalnessAt(worldX, worldZ);
    const erosion = this.getErosionAt(worldX, worldZ);
    const peaks = this.getPeaksAt(worldX, worldZ);
    const land = smoothstep(-0.35, 0.3, continent);
    const ruggedness = 1 - smoothstep(-0.2, 0.65, erosion);
    const mountainStrength = Math.max(0, (peaks - 0.1) / 0.9);
    const base = SEA_LEVEL - 4 + continent * 12 + land * 3;
    const hills = erosion * (1.5 + ruggedness * 3);
    const mountains = land * ruggedness * mountainStrength * mountainStrength * 28;
    const naturalHeight = base + hills + mountains;
    const weights = this.getBiomeWeightsAt(worldX, worldZ);
    const swampHeight = SEA_LEVEL - 2 + this.erosion(worldX * 0.004, worldZ * 0.004) * 0.5;
    const cherryGroveHeight = SEA_LEVEL + 2 + this.getPeaksAt(worldX, worldZ) * 4;
    const naturalWeight = 1 - weights.swamp - weights.cherry_grove;
    return naturalHeight * naturalWeight +
      swampHeight * weights.swamp +
      cherryGroveHeight * weights.cherry_grove;
  }

  getHeightAt(worldX, worldZ) {
    const swampBlend = this.getBiomeWeightsAt(worldX, worldZ).swamp;
    const riverCut = this.getRiverStrengthAt(worldX, worldZ) * 4.5 * (1 - swampBlend);
    const height = Math.floor(this.#getBaseHeightAt(worldX, worldZ) - riverCut);
    return Math.max(3, Math.min(WORLD_HEIGHT - 8, height));
  }

  getWaterLevelAt(worldX, worldZ) {
    const swampBlend = this.getBiomeWeightsAt(worldX, worldZ).swamp;
    if (swampBlend > 0.55) return SEA_LEVEL;
    const baseHeight = this.#getBaseHeightAt(worldX, worldZ);
    const riverStrength = this.getRiverStrengthAt(worldX, worldZ);
    if (riverStrength > 0.45 && baseHeight > SEA_LEVEL) {
      return Math.min(WORLD_HEIGHT - 8, Math.floor(baseHeight - 1));
    }
    return this.getHeightAt(worldX, worldZ) < SEA_LEVEL ? SEA_LEVEL : -1;
  }

  getBiomeAt(worldX, worldZ) {
    const weights = this.getBiomeWeightsAt(worldX, worldZ);
    return Object.entries(weights).reduce(
      (dominant, [biome, weight]) => weight > dominant.weight ? { biome, weight } : dominant,
      { biome: "forest", weight: -1 },
    ).biome;
  }

  getBiomeWeightsAt(worldX, worldZ) {
    const temperature = (this.getTemperatureAt(worldX, worldZ) + 1) / 2;
    const humidity = (this.getMoistureAt(worldX, worldZ) + 1) / 2;
    return getBiomeWeightsFromClimate(
      temperature,
      humidity,
      OVERWORLD_BIOMES,
    );
  }

  getSurfaceBlockAt(worldX, worldZ) {
    const weights = this.getBiomeWeightsAt(worldX, worldZ);
    const patchNoise = (this.biomePatches(worldX * 0.12 + 19, worldZ * 0.12 - 43) + 1) / 2;
    return getBiomeSurfaceForWeights(weights, OVERWORLD_BIOMES, patchNoise);
  }

  generateChunk(chunkX = 0, chunkY = 0, chunkZ = 0) {
    const blocks = new Uint8Array(CHUNK_VOLUME);
    const worldYStart = chunkY * CHUNK_SIZE;
    const heightMap = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const worldX = chunkX * CHUNK_SIZE + x;
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        const worldZ = chunkZ * CHUNK_SIZE + z;
        const height = this.getHeightAt(worldX, worldZ);
        const waterLevel = this.getWaterLevelAt(worldX, worldZ);
        const fluidType = BlockType.WATER;
        const surface = this.getSurfaceBlockAt(worldX, worldZ);
        heightMap[x * CHUNK_SIZE + z] = { height, surface, waterLevel };
        for (let localY = 0; localY < CHUNK_SIZE; localY += 1) {
          const worldY = worldYStart + localY;
          if (worldY > height) {
            if (worldY <= waterLevel) blocks[blockIndex(x, localY, z)] = fluidType;
            continue;
          }

          let type;
          if (worldY === height) {
            type = surface;
          } else if (surface === BlockType.SAND && worldY >= height - 3) {
            type = BlockType.SAND;
          } else if (worldY >= height - 3) {
            type = BlockType.DIRT;
          } else {
            const cave = this.caves(worldX * 0.075, worldY * 0.075, worldZ * 0.075);
            if (worldY > 2 && worldY < height - 3 && cave > 0.56) {
              if (worldY <= LAVA_LEVEL) {
                type = BlockType.LAVA;
              } else if (
                worldY < 20 &&
                this.oilPockets(worldX * 0.065, worldY * 0.065, worldZ * 0.065) > 0.58
              ) {
                type = BlockType.OIL;
              } else {
                continue;
              }
            } else {
              const oreRoll = hash3D(worldX, worldY, worldZ) / 4294967296;
              if (worldY < 34 && oreRoll < 0.008) {
                type = BlockType.COAL_ORE;
              } else if (worldY < 26 && oreRoll < 0.012) {
                type = BlockType.IRON_ORE;
              } else if (worldY < 22 && oreRoll < 0.014) {
                type = BlockType.GOLD_ORE;
              } else if (worldY < 30 && oreRoll < 0.016) {
                type = BlockType.LAPIS_ORE;
              } else if (worldY < 15 && oreRoll < 0.019) {
                type = BlockType.REDSTONE_ORE;
              } else if (worldY < 15 && oreRoll < 0.021) {
                type = BlockType.DIAMOND_ORE;
              } else {
                type = BlockType.STONE;
              }
            }
          }
          blocks[blockIndex(x, localY, z)] = type;
        }
      }
    }

    this.#placeGravelVeins(blocks, chunkX, chunkY, chunkZ);
    this.#placeTrees(blocks, chunkX, chunkY, chunkZ);
    this.#placeBiomePlants(blocks, chunkX, chunkY, chunkZ);
    generateDungeon(chunkX, chunkZ, blocks, heightMap, {
      chunkY,
      chunkSize: CHUNK_SIZE,
      seed: this.seed,
      getBlockIndex: blockIndex,
    });
    generateVillage(chunkX, chunkZ, blocks, heightMap, {
      chunkY,
      chunkSize: CHUNK_SIZE,
      worldHeight: WORLD_HEIGHT,
      seed: this.seed,
      getBlockIndex: blockIndex,
    });
    return blocks;
  }

  #placeGravelVeins(blocks, chunkX, chunkY, chunkZ) {
    const worldXStart = chunkX * CHUNK_SIZE;
    const worldYStart = chunkY * CHUNK_SIZE;
    const worldZStart = chunkZ * CHUNK_SIZE;
    const worldXEnd = worldXStart + CHUNK_SIZE;
    const worldYEnd = worldYStart + CHUNK_SIZE;
    const worldZEnd = worldZStart + CHUNK_SIZE;
    const veins = [];

    for (
      let startX = worldXStart - GRAVEL_VEIN_MARGIN;
      startX < worldXEnd + GRAVEL_VEIN_MARGIN;
      startX += 1
    ) {
      for (
        let startZ = worldZStart - GRAVEL_VEIN_MARGIN;
        startZ < worldZEnd + GRAVEL_VEIN_MARGIN;
        startZ += 1
      ) {
        const height = this.getHeightAt(startX, startZ);
        const riverStrength = this.getRiverStrengthAt(startX, startZ);
        const waterLevel = this.getWaterLevelAt(startX, startZ);
        const nearWater =
          waterLevel > height ||
          riverStrength > 0.4 ||
          this.getHeightAt(startX + 1, startZ) < SEA_LEVEL ||
          this.getHeightAt(startX - 1, startZ) < SEA_LEVEL ||
          this.getHeightAt(startX, startZ + 1) < SEA_LEVEL ||
          this.getHeightAt(startX, startZ - 1) < SEA_LEVEL;
        const chance = nearWater ? 0.012 : 0.0015;
        if (hash2D(startX, startZ, 0x6a7e1) >= chance) continue;

        const random = seededRandom(hash3D(startX, 37, startZ));
        const vein = [];
        const occupied = new Set();
        const firstY = height - 1 - Math.floor(random() * 3);
        vein.push({ x: startX, y: firstY, z: startZ });
        occupied.add(`${startX},${firstY},${startZ}`);
        const veinSize = 4 + Math.floor(random() * 7);
        let attempts = 0;

        while (vein.length < veinSize && attempts < veinSize * 16) {
          attempts += 1;
          const anchor = vein[Math.floor(random() * vein.length)];
          const direction = Math.floor(random() * 4);
          const x = anchor.x + (direction === 0 ? 1 : direction === 1 ? -1 : 0);
          const z = anchor.z + (direction === 2 ? 1 : direction === 3 ? -1 : 0);
          const surfaceY = this.getHeightAt(x, z);
          const anchorDepth = this.getHeightAt(anchor.x, anchor.z) - anchor.y;
          const depth = Math.max(
            1,
            Math.min(3, anchorDepth + Math.floor(random() * 3) - 1),
          );
          const y = surfaceY - depth;
          const key = `${x},${y},${z}`;
          if (occupied.has(key)) continue;
          occupied.add(key);
          vein.push({ x, y, z });
        }
        veins.push(vein);
      }
    }

    for (const vein of veins) {
      for (const { x, y, z } of vein) {
        if (
          x < worldXStart ||
          x >= worldXEnd ||
          y < worldYStart ||
          y >= worldYEnd ||
          z < worldZStart ||
          z >= worldZEnd
        ) {
          continue;
        }
        const localX = x - worldXStart;
        const localY = y - worldYStart;
        const localZ = z - worldZStart;
        const index = blockIndex(localX, localY, localZ);
        const existing = blocks[index];
        if (
          existing === BlockType.DIRT ||
          existing === BlockType.SAND ||
          existing === BlockType.STONE
        ) {
          blocks[index] = BlockType.GRAVEL;
        }
      }
    }
  }

  #placeTrees(blocks, chunkX, chunkY, chunkZ) {
    const yStart = chunkY * CHUNK_SIZE;
    const yEnd = yStart + CHUNK_SIZE;
    for (let worldX = chunkX * CHUNK_SIZE - 2; worldX < (chunkX + 1) * CHUNK_SIZE + 2; worldX += 1) {
      for (let worldZ = chunkZ * CHUNK_SIZE - 2; worldZ < (chunkZ + 1) * CHUNK_SIZE + 2; worldZ += 1) {
        const biome = this.getBiomeAt(worldX, worldZ);
        const isSavanna = biome === "savanna";
        const isCherryGrove = biome === "cherry_grove";
        const isSwamp = biome === "swamp";
        if (
          (!isSavanna && !isCherryGrove && !isSwamp && biome !== "forest") ||
          hash2D(worldX, worldZ, 0x7f4a7c15) >
            (isSavanna ? 0.012 : isCherryGrove ? 0.032 : isSwamp ? 0.008 : 0.045) ||
          (!isSwamp && this.getWaterLevelAt(worldX, worldZ) > this.getHeightAt(worldX, worldZ))
        ) {
          continue;
        }

        const height = this.getHeightAt(worldX, worldZ);
        const localX = worldX - chunkX * CHUNK_SIZE;
        const localZ = worldZ - chunkZ * CHUNK_SIZE;
        const treeHeight = isSavanna || isCherryGrove
          ? 5 + Math.floor(hash2D(worldX, worldZ, 0x31a7) * 4)
          : 4 + Math.floor(hash2D(worldX, worldZ, 0x7f4a7c15) * 3);
        const trunkStart = height + 1;
        const crownY = height + treeHeight;
        const trunkBlock = isSavanna
          ? BlockType.ACACIA_LOG
          : isCherryGrove
            ? BlockType.CHERRY_LOG
            : isSwamp
              ? BlockType.OAK_LOG
              : BlockType.WOOD;

        for (let worldY = trunkStart; worldY <= crownY; worldY += 1) {
          if (worldX < chunkX * CHUNK_SIZE || worldX >= (chunkX + 1) * CHUNK_SIZE) continue;
          if (worldZ < chunkZ * CHUNK_SIZE || worldZ >= (chunkZ + 1) * CHUNK_SIZE) continue;
          if (worldY < yStart || worldY >= yEnd) continue;
          blocks[blockIndex(localX, worldY - yStart, localZ)] = trunkBlock;
        }

        if (isSwamp) {
          this.#placeDeadBranches(blocks, worldX, worldZ, crownY, chunkX, chunkY, chunkZ);
        } else if (isSavanna) {
          const direction = hash2D(worldX, worldZ, 0x52f1) > 0.5 ? 1 : -1;
          for (let step = 1; step <= 2; step += 1) {
            const branchX = worldX + direction * step;
            const branchY = crownY - 2 + step;
            const branchLocalX = branchX - chunkX * CHUNK_SIZE;
            if (
              branchLocalX >= 0 &&
              branchLocalX < CHUNK_SIZE &&
              localZ >= 0 &&
              localZ < CHUNK_SIZE &&
              branchY >= yStart &&
              branchY < yEnd
            ) {
              blocks[blockIndex(branchLocalX, branchY - yStart, localZ)] = trunkBlock;
            }
          }
          this.#placeAcaciaCanopy(
            blocks,
            worldX,
            worldZ,
            crownY,
            chunkX,
            chunkY,
            chunkZ,
          );
        } else if (isCherryGrove) {
          this.#placeOakCanopy(
            blocks,
            worldX,
            worldZ,
            crownY,
            chunkX,
            chunkY,
            chunkZ,
            BlockType.CHERRY_LEAVES,
          );
        } else {
          this.#placeOakCanopy(
            blocks,
            worldX,
            worldZ,
            crownY,
            chunkX,
            chunkY,
            chunkZ,
          );
        }
      }
    }
  }

  #placeDeadBranches(blocks, worldX, worldZ, crownY, chunkX, chunkY, chunkZ) {
    const yStart = chunkY * CHUNK_SIZE;
    const yEnd = yStart + CHUNK_SIZE;
    const branches = [
      { dx: hash2D(worldX, worldZ, 0x4211) > 0.5 ? 1 : -1, dz: 0, y: crownY - 1 },
      { dx: 0, dz: hash2D(worldX, worldZ, 0x4212) > 0.5 ? 1 : -1, y: crownY - 2 },
    ];
    for (const { dx, dz, y } of branches) {
      for (let step = 1; step <= 2; step += 1) {
        const branchX = worldX + dx * step;
        const branchZ = worldZ + dz * step;
        const branchY = y + (step === 2 ? 1 : 0);
        const localX = branchX - chunkX * CHUNK_SIZE;
        const localZ = branchZ - chunkZ * CHUNK_SIZE;
        if (
          localX < 0 ||
          localX >= CHUNK_SIZE ||
          localZ < 0 ||
          localZ >= CHUNK_SIZE ||
          branchY < yStart ||
          branchY >= yEnd
        ) {
          continue;
        }
        blocks[blockIndex(localX, branchY - yStart, localZ)] = BlockType.OAK_LOG;
      }
    }
  }

  #placeOakCanopy(
    blocks,
    worldX,
    worldZ,
    crownY,
    chunkX,
    chunkY,
    chunkZ,
    leafBlock = BlockType.LEAVES,
  ) {
    const yStart = chunkY * CHUNK_SIZE;
    const yEnd = yStart + CHUNK_SIZE;
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
          if (blocks[index] === BlockType.AIR) blocks[index] = leafBlock;
        }
      }
    }
  }

  #placeAcaciaCanopy(blocks, worldX, worldZ, crownY, chunkX, chunkY, chunkZ) {
    const yStart = chunkY * CHUNK_SIZE;
    const yEnd = yStart + CHUNK_SIZE;
    for (let worldY = crownY - 1; worldY <= crownY + 1; worldY += 1) {
      if (worldY < yStart || worldY >= yEnd) continue;
      const radius = worldY === crownY ? 3 : 2;
      for (let leafX = worldX - radius; leafX <= worldX + radius; leafX += 1) {
        for (let leafZ = worldZ - radius; leafZ <= worldZ + radius; leafZ += 1) {
          if (Math.abs(leafX - worldX) + Math.abs(leafZ - worldZ) > radius + 1) continue;
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
          if (blocks[index] === BlockType.AIR) blocks[index] = BlockType.ACACIA_LEAVES;
        }
      }
    }
  }

  #placeBiomePlants(blocks, chunkX, chunkY, chunkZ) {
    const worldYStart = chunkY * CHUNK_SIZE;
    const worldYEnd = worldYStart + CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        const biome = this.getBiomeAt(worldX, worldZ);
        const height = this.getHeightAt(worldX, worldZ);
        const waterLevel = this.getWaterLevelAt(worldX, worldZ);
        const surface = this.getSurfaceBlockAt(worldX, worldZ);
        const plantY = (
          biome === "swamp" && waterLevel > height
            ? waterLevel
            : height
        ) + 1;
        if (
          plantY < worldYStart ||
          plantY >= worldYEnd ||
          blocks[blockIndex(x, plantY - worldYStart, z)] !== BlockType.AIR
        ) {
          continue;
        }

        const roll = hash2D(worldX, worldZ, 0x7521);
        let plant = null;
        if (biome === "savanna" && roll < 0.2) {
          plant = BlockType.DRY_GRASS;
        } else if (
          biome === "cherry_grove" &&
          hash2D(worldX, worldZ, 0x2d931) < 0.12
        ) {
          plant = BlockType.CHERRY_PETALS;
        } else if (
          (surface === BlockType.GRASS ||
            surface === BlockType.SWAMP_GRASS ||
            surface === BlockType.CHERRY_GRASS ||
            surface === BlockType.SAVANNA_GRASS) &&
          roll < 0.2
        ) {
          plant = BlockType.TALL_GRASS;
        } else if (
          biome === "swamp" &&
          waterLevel > height &&
          roll < 0.11
        ) {
          plant = BlockType.TALL_GRASS;
        } else if (
          biome === "forest" &&
          hash2D(worldX, worldZ, 0x4ad8) < 0.025
        ) {
          plant = hash2D(worldX, worldZ, 0x19b7) < 0.5
            ? BlockType.DANDELION
            : BlockType.POPPY;
        }
        if (plant !== null) {
          blocks[blockIndex(x, plantY - worldYStart, z)] = plant;
        }
      }
    }
  }
}

export function getBlockIndex(x, y, z) {
  return blockIndex(x, y, z);
}
