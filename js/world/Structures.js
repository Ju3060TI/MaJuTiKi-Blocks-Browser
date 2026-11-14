import { BLOCKS, BlockType } from "./blocks.js";

const VILLAGE_CHANCE = 0.05;
const DUNGEON_CHANCE = 0.012;
const HOUSE = { x: 6, z: 5, size: 5 };
const FARM = { x: 1, z: 5, width: 4, depth: 5 };
const PATH = { x: 8, startZ: 10, endZ: 15 };
const FLAT_AREA = { minX: 1, maxX: 10, minZ: 5, maxZ: 15 };

function hash2D(x, z, seed) {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function getHeightCell(heightMap, x, z, chunkSize) {
  const value = Array.isArray(heightMap[x]) ? heightMap[x][z] : heightMap[x * chunkSize + z];
  if (typeof value === "number") {
    return { height: value, surface: BlockType.GRASS, waterLevel: -1 };
  }
  return value;
}

export function generateVillage(
  chunkX,
  chunkZ,
  blocksData,
  heightMap,
  context = {},
) {
  const chunkY = context.chunkY ?? 0;
  const chunkSize = context.chunkSize ?? 16;
  const worldHeight = context.worldHeight ?? 48;
  const seed = context.seed ?? 20240601;
  const getBlockIndex = context.getBlockIndex ??
    ((x, y, z) => x * chunkSize * chunkSize + y * chunkSize + z);
  if (hash2D(chunkX, chunkZ, seed ^ 0x4f1bbcdc) >= VILLAGE_CHANCE) return false;

  const cells = [];
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (let x = FLAT_AREA.minX; x <= FLAT_AREA.maxX; x += 1) {
    for (let z = FLAT_AREA.minZ; z <= FLAT_AREA.maxZ; z += 1) {
      const cell = getHeightCell(heightMap, x, z, chunkSize);
      if (
        !cell ||
        cell.surface !== BlockType.GRASS ||
        cell.waterLevel > cell.height
      ) {
        return false;
      }
      cells.push({ x, z, cell });
      minHeight = Math.min(minHeight, cell.height);
      maxHeight = Math.max(maxHeight, cell.height);
    }
  }
  if (maxHeight - minHeight > 2) return false;

  const baseY = Math.round(
    cells.reduce((sum, { cell }) => sum + cell.height, 0) / cells.length,
  );
  if (baseY + 7 >= worldHeight) return false;

  const writeBlock = (x, y, z, type) => {
    const localY = y - chunkY * chunkSize;
    if (
      x < 0 ||
      x >= chunkSize ||
      z < 0 ||
      z >= chunkSize ||
      localY < 0 ||
      localY >= chunkSize
    ) {
      return;
    }
    blocksData[getBlockIndex(x, localY, z)] = type;
  };

  for (const { x, z, cell } of cells) {
    if (cell.height > baseY) {
      for (let y = baseY + 1; y <= cell.height; y += 1) {
        writeBlock(x, y, z, BLOCKS.AIR.id);
      }
    } else if (cell.height < baseY) {
      for (let y = cell.height + 1; y < baseY; y += 1) {
        writeBlock(x, y, z, BLOCKS.DIRT.id);
      }
    }
    writeBlock(x, baseY, z, BLOCKS.GRASS.id);
    for (let y = baseY + 1; y <= baseY + 7; y += 1) {
      writeBlock(x, y, z, BLOCKS.AIR.id);
    }
  }
  for (let z = PATH.startZ; z <= PATH.endZ; z += 1) {
    writeBlock(PATH.x, baseY, z, BLOCKS.DIRT.id);
  }

  for (let x = HOUSE.x; x < HOUSE.x + HOUSE.size; x += 1) {
    for (let z = HOUSE.z; z < HOUSE.z + HOUSE.size; z += 1) {
      writeBlock(x, baseY + 1, z, BLOCKS.OAK_PLANKS.id);
      for (let y = baseY + 2; y <= baseY + 4; y += 1) {
        const isWall = x === HOUSE.x || x === HOUSE.x + HOUSE.size - 1 ||
          z === HOUSE.z || z === HOUSE.z + HOUSE.size - 1;
        if (!isWall) continue;

        const isDoor = x === 8 && z === HOUSE.z + HOUSE.size - 1;
        if (isDoor) continue;

        const isCorner =
          (x === HOUSE.x || x === HOUSE.x + HOUSE.size - 1) &&
          (z === HOUSE.z || z === HOUSE.z + HOUSE.size - 1);
        const isWindow =
          y === baseY + 3 &&
          ((z === HOUSE.z + HOUSE.size - 1 && (x === 7 || x === 9)) ||
            (x === HOUSE.x && z === 7) ||
            (x === HOUSE.x + HOUSE.size - 1 && z === 7));
        writeBlock(
          x,
          y,
          z,
          isWindow
            ? BLOCKS.GLASS.id
            : isCorner
              ? BLOCKS.COBBLESTONE.id
              : BLOCKS.OAK_PLANKS.id,
        );
      }
    }
  }

  for (let x = HOUSE.x; x < HOUSE.x + HOUSE.size; x += 1) {
    for (let z = HOUSE.z; z < HOUSE.z + HOUSE.size; z += 1) {
      const isEdge =
        x === HOUSE.x ||
        x === HOUSE.x + HOUSE.size - 1 ||
        z === HOUSE.z ||
        z === HOUSE.z + HOUSE.size - 1;
      writeBlock(x, baseY + 5, z, isEdge ? BLOCKS.COBBLESTONE.id : BLOCKS.OAK_PLANKS.id);
    }
  }
  writeBlock(8, baseY + 2, HOUSE.z + HOUSE.size - 1, BLOCKS.DOOR.id);
  writeBlock(8, baseY + 3, HOUSE.z + HOUSE.size - 1, BLOCKS.DOOR.id);

  for (let x = FARM.x; x < FARM.x + FARM.width; x += 1) {
    for (let z = FARM.z; z < FARM.z + FARM.depth; z += 1) {
      writeBlock(x, baseY, z, BLOCKS.FARMLAND.id);
    }
  }
  writeBlock(2, baseY, 7, BLOCKS.WATER.id);
  for (const [x, z] of [[1, 6], [3, 6], [1, 8], [3, 8], [4, 7]]) {
    writeBlock(x, baseY + 1, z, BLOCKS.TALL_GRASS.id);
  }

  return true;
}

export function generateDungeon(
  chunkX,
  chunkZ,
  blocksData,
  heightMap,
  context = {},
) {
  const chunkY = context.chunkY ?? 0;
  const chunkSize = context.chunkSize ?? 16;
  const seed = context.seed ?? 20240601;
  const getBlockIndex = context.getBlockIndex ??
    ((x, y, z) => x * chunkSize * chunkSize + y * chunkSize + z);

  if (
    chunkY !== 0 ||
    hash2D(chunkX, chunkZ, seed ^ 0x31a7d915) >= DUNGEON_CHANCE
  ) {
    return false;
  }

  const room = { minX: 4, maxX: 11, minZ: 4, maxZ: 11, width: 8, depth: 8 };
  let minSurfaceHeight = Infinity;
  for (let x = room.minX; x <= room.maxX; x += 1) {
    for (let z = room.minZ; z <= room.maxZ; z += 1) {
      const cell = getHeightCell(heightMap, x, z, chunkSize);
      if (!cell) return false;
      minSurfaceHeight = Math.min(minSurfaceHeight, cell.height);
    }
  }

  const floorY = Math.min(chunkSize - 5, minSurfaceHeight - 6);
  const ceilingY = floorY + 4;
  if (floorY < 5 || ceilingY >= chunkSize) return false;

  const writeBlock = (x, y, z, type) => {
    if (x < 0 || x >= chunkSize || z < 0 || z >= chunkSize) return;
    blocksData[getBlockIndex(x, y, z)] = type;
  };

  for (let x = room.minX; x <= room.maxX; x += 1) {
    for (let z = room.minZ; z <= room.maxZ; z += 1) {
      writeBlock(x, floorY, z, BLOCKS.MOSSY_COBBLESTONE.id);
      for (let y = floorY + 1; y < ceilingY; y += 1) {
        const isWall =
          x === room.minX || x === room.maxX ||
          z === room.minZ || z === room.maxZ;
        writeBlock(x, y, z, isWall ? BLOCKS.MOSSY_COBBLESTONE.id : BLOCKS.AIR.id);
      }
      writeBlock(x, ceilingY, z, BLOCKS.MOSSY_COBBLESTONE.id);
    }
  }

  writeBlock(5, floorY + 1, 5, BLOCKS.CHEST.id);
  writeBlock(8, floorY + 1, 8, BLOCKS.GLOWSTONE.id);
  return true;
}
