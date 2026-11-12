import {
  BoxGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  SRGBColorSpace,
} from "three";
import { Chunk } from "./Chunk.js";
import { ItemDrop } from "../entities/ItemDrop.js";
import { createBlockTextures } from "./TextureGenerator.js";
import { BLOCK_COUNT, BLOCKS } from "./blocks.js";
import {
  CHUNK_SIZE,
  WORLD_HEIGHT,
  getBlockIndex,
  WorldGenerator,
} from "./WorldGenerator.js";

const VERTICAL_CHUNKS = WORLD_HEIGHT / CHUNK_SIZE;
const MIN_RENDER_DISTANCE = 2;
const MAX_RENDER_DISTANCE = 10;
const LOD_PATCH_SIZE = 4;
const CHUNK_DIRECTIONS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const HORIZONTAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BLOCKS_BY_ID = Array(BLOCK_COUNT);
for (const block of Object.values(BLOCKS)) BLOCKS_BY_ID[block.id] = block;

function chunkKey(x, y, z) {
  return `${x},${y},${z}`;
}

function columnKey(x, z) {
  return `${x},${z}`;
}

function normalizeRenderDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) {
    throw new RangeError("Render distance must be a finite number.");
  }
  return Math.max(MIN_RENDER_DISTANCE, Math.min(MAX_RENDER_DISTANCE, Math.round(distance)));
}

function normalizeLodDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) {
    throw new RangeError("LOD distance must be a finite number.");
  }
  return Math.max(1, Math.min(5, Math.round(distance)));
}

export class World {
  constructor(
    scene,
    worldGenerator = new WorldGenerator(),
    savedBlockEdits = [],
    savedChestInventories = [],
  ) {
    this.scene = scene;
    this.generator = worldGenerator;
    this.chunks = new Map();
    this.lodMeshes = new Map();
    this.blockEdits = new Map(
      savedBlockEdits.map(([key, entries]) => [key, new Map(entries)]),
    );
    this.chestInventories = new Map(
      savedChestInventories.map(([key, slots]) => [
        key,
        slots.map((stack) => stack ? { ...stack, enchantments: [...(stack.enchantments ?? [])] } : null),
      ]),
    );
    this.itemDrops = [];
    this.geometry = new BoxGeometry(1, 1, 1);
    this.lodMaterial = new MeshLambertMaterial({ color: 0xffffff });
    this.materials = this.#createMaterials();
    this.lodColors = this.#createLodColors();
    this.waterTextures = new Set(this.textures.blockTextures[BLOCKS.WATER.id]);
    this.waterAnimationOffset = 0;
    this.miningMaterials = this.textures.crackStages.map((texture) =>
      Array.from(
        { length: 6 },
        () =>
          new MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
          }),
      ),
    );
    this.miningOverlay = new Mesh(new BoxGeometry(1.012, 1.012, 1.012), this.miningMaterials[0]);
    this.miningOverlay.visible = false;
    this.miningOverlay.renderOrder = 2;
    this.scene.add(this.miningOverlay);
    this.miningOverlayKey = null;
    this.miningOverlayStage = 0;
    this.centerChunkX = Number.NaN;
    this.centerChunkZ = Number.NaN;
    this.lastPosition = { x: 0, z: 0 };
    const settings = typeof window === "undefined"
      ? {}
      : window.gameSettings ?? window.settings ?? {};
    this.renderDistance = normalizeRenderDistance(
      settings.renderDistance ?? 4,
    );
    this.lodDistance = normalizeLodDistance(settings.lodDistance ?? 2);
    this.onGameSettingsChange = (event) => {
      if (event.detail?.renderDistance !== undefined) {
        this.setRenderDistance(event.detail.renderDistance);
      }
      if (event.detail?.lodDistance !== undefined) {
        this.setLodDistance(event.detail.lodDistance);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("gamesettingschange", this.onGameSettingsChange);
    }
    this.update({ x: 0, z: 0 });
  }

  setRenderDistance(distance) {
    const nextDistance = normalizeRenderDistance(distance);
    if (nextDistance === this.renderDistance) return;
    this.renderDistance = nextDistance;
    if (typeof window !== "undefined") {
      window.gameSettings ??= window.settings ?? {};
      window.gameSettings.renderDistance = nextDistance;
      window.settings = window.gameSettings;
    }
    this.centerChunkX = Number.NaN;
    this.centerChunkZ = Number.NaN;
    this.update(this.lastPosition);
  }

  setLodDistance(distance) {
    const nextDistance = normalizeLodDistance(distance);
    if (nextDistance === this.lodDistance) return;
    this.lodDistance = nextDistance;
    if (typeof window !== "undefined") {
      window.gameSettings ??= window.settings ?? {};
      window.gameSettings.lodDistance = nextDistance;
      window.settings = window.gameSettings;
    }
    this.#updateDetailVisibility();
  }

  getBlockAt(x, y, z) {
    const worldX = Math.floor(x);
    const worldY = Math.floor(y);
    const worldZ = Math.floor(z);
    if (worldY < 0 || worldY >= WORLD_HEIGHT) return BLOCKS.AIR.id;

    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkY = Math.floor(worldY / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(chunkX, chunkY, chunkZ));
    if (!chunk) return BLOCKS.AIR.id;

    return chunk.getBlock(
      worldX - chunkX * CHUNK_SIZE,
      worldY - chunkY * CHUNK_SIZE,
      worldZ - chunkZ * CHUNK_SIZE,
    );
  }

  isSolidAt(x, y, z) {
    return BLOCKS_BY_ID[this.getBlockAt(x, y, z)]?.isSolid ?? false;
  }

  getMeshes() {
    const meshes = [];
    for (const chunk of this.chunks.values()) {
      for (const mesh of chunk.meshes) {
        if (mesh.visible) meshes.push(mesh);
      }
    }
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
    this.#rebuildLodForColumn(chunkX, chunkZ);
    this.#updateDetailVisibility();
    return true;
  }

  getChestInventoryAt(position) {
    const key = chunkKey(
      Math.floor(position.x),
      Math.floor(position.y),
      Math.floor(position.z),
    );
    const slots = this.chestInventories.get(key);
    return slots
      ? slots.map((stack) => stack ? { ...stack, enchantments: [...(stack.enchantments ?? [])] } : null)
      : Array.from({ length: 27 }, () => null);
  }

  setChestInventoryAt(position, slots) {
    if (!Array.isArray(slots) || slots.length !== 27) {
      throw new TypeError("A chest inventory must contain exactly 27 slots.");
    }
    const normalized = slots.map((stack) => {
      if (stack === null) return null;
      if (
        !stack ||
        !(Number.isInteger(stack.item) || typeof stack.item === "string") ||
        !Number.isInteger(stack.count) ||
        stack.count < 1 ||
        stack.count > 64 ||
        (stack.enchantments !== undefined &&
          (!Array.isArray(stack.enchantments) ||
            !stack.enchantments.every((value) => typeof value === "string"))) ||
        (stack.durability !== undefined &&
          (!Number.isFinite(stack.durability) || stack.durability < 0)) ||
        (stack.maxDurability !== undefined &&
          (!Number.isFinite(stack.maxDurability) || stack.maxDurability < 1))
      ) {
        throw new TypeError("Chest inventory contains an invalid item stack.");
      }
      return {
        item: stack.item,
        count: stack.count,
        ...(stack.durability !== undefined ? { durability: stack.durability } : {}),
        ...(stack.maxDurability !== undefined ? { maxDurability: stack.maxDurability } : {}),
        ...(stack.enchantments?.length ? { enchantments: [...stack.enchantments] } : {}),
      };
    });
    const key = chunkKey(
      Math.floor(position.x),
      Math.floor(position.y),
      Math.floor(position.z),
    );
    this.chestInventories.set(key, normalized);
  }

  breakBlock(x, y, z) {
    const type = this.getBlockAt(x, y, z);
    if (
      type === BLOCKS.AIR.id ||
      !this.setBlockAt(x, y, z, BLOCKS.AIR.id)
    ) {
      return BLOCKS.AIR.id;
    }
    this.#flowFluidInto(Math.floor(x), Math.floor(y), Math.floor(z));
    return type;
  }

  spawnItemDrop(type, position, velocity) {
    if (!this.materials[type]) return null;
    const drop = new ItemDrop(this.scene, this, type, position, velocity);
    this.itemDrops.push(drop);
    return drop;
  }

  updateItemDrops(deltaSeconds, player, inventory) {
    for (let index = this.itemDrops.length - 1; index >= 0; index -= 1) {
      if (this.itemDrops[index].update(deltaSeconds, player, inventory)) {
        this.itemDrops.splice(index, 1);
      }
    }
  }

  #flowFluidInto(x, y, z) {
    if (this.getBlockAt(x, y, z) !== BLOCKS.AIR.id) return;

    if (this.getBlockAt(x, y + 1, z) === BLOCKS.WATER.id) {
      const bottomY = this.#flowWaterDown(x, y, z);
      this.#spreadWaterHorizontally(x, bottomY, z, 4);
      return;
    }

    if (this.getBlockAt(x, y - 1, z) === BLOCKS.WATER.id) return;
    if (this.isSolidAt(x, y - 1, z)) {
      const hasSideWater = HORIZONTAL_DIRECTIONS.some(([dx, dz]) =>
        this.getBlockAt(x + dx, y, z + dz) === BLOCKS.WATER.id,
      );
      if (hasSideWater) {
        this.setBlockAt(x, y, z, BLOCKS.WATER.id);
        this.#spreadWaterHorizontally(x, y, z, 3);
      }
      return;
    }

    const adjacentLava = [
      [x, y + 1, z],
      [x - 1, y, z],
      [x + 1, y, z],
      [x, y, z - 1],
      [x, y, z + 1],
      [x, y - 1, z],
    ];
    for (const [neighborX, neighborY, neighborZ] of adjacentLava) {
      if (this.getBlockAt(neighborX, neighborY, neighborZ) !== BLOCKS.LAVA.id) continue;
      this.setBlockAt(x, y, z, BLOCKS.LAVA.id);
      return;
    }
  }

  #flowWaterDown(x, y, z) {
    let currentY = y;
    while (
      currentY >= 0 &&
      this.getBlockAt(x, currentY, z) === BLOCKS.AIR.id
    ) {
      this.setBlockAt(x, currentY, z, BLOCKS.WATER.id);
      if (!this.isSolidAt(x, currentY - 1, z)) {
        currentY -= 1;
        continue;
      }
      break;
    }
    return Math.max(0, currentY);
  }

  #spreadWaterHorizontally(x, y, z, maxDistance) {
    const queue = [{ x, z, distance: 0 }];
    const visited = new Set([`${x},${z}`]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current.distance >= maxDistance) continue;
      for (const [dx, dz] of HORIZONTAL_DIRECTIONS) {
        const nextX = current.x + dx;
        const nextZ = current.z + dz;
        const key = `${nextX},${nextZ}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (
          this.getBlockAt(nextX, y, nextZ) !== BLOCKS.AIR.id ||
          !this.isSolidAt(nextX, y - 1, nextZ)
        ) {
          continue;
        }
        this.setBlockAt(nextX, y, nextZ, BLOCKS.WATER.id);
        queue.push({ x: nextX, z: nextZ, distance: current.distance + 1 });
      }
    }
  }

  saveToStorage(storageKey = "majutiki-world-save") {
    localStorage.setItem(storageKey, JSON.stringify({
      seed: this.generator.seed,
      blockEdits: [...this.blockEdits].map(([key, edits]) => [key, [...edits]]),
      chestInventories: [...this.chestInventories],
    }));
  }

  setMiningProgress(x, y, z, progress) {
    const blockX = Math.floor(x);
    const blockY = Math.floor(y);
    const blockZ = Math.floor(z);
    if (this.getBlockAt(blockX, blockY, blockZ) === BLOCKS.AIR.id || progress <= 0) {
      this.clearMiningProgress();
      return;
    }

    const stage = Math.min(10, Math.ceil(progress * 10));
    const key = chunkKey(blockX, blockY, blockZ);
    if (key !== this.miningOverlayKey || stage !== this.miningOverlayStage) {
      this.miningOverlay.material = this.miningMaterials[stage - 1];
      this.miningOverlayKey = key;
      this.miningOverlayStage = stage;
    }
    this.miningOverlay.position.set(blockX + 0.5, blockY + 0.5, blockZ + 0.5);
    this.miningOverlay.visible = true;
  }

  clearMiningProgress() {
    this.miningOverlay.visible = false;
    this.miningOverlayKey = null;
    this.miningOverlayStage = 0;
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
            this.getBlockAt(x, groundY, z) === BLOCKS.GRASS.id &&
            this.getBlockAt(x, groundY + 1, z) === BLOCKS.AIR.id &&
            this.getBlockAt(x, groundY + 2, z) === BLOCKS.AIR.id
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
    this.#animateWater();
    this.lastPosition = { x: position.x, z: position.z };
    const nextCenterX = Math.floor(position.x / CHUNK_SIZE);
    const nextCenterZ = Math.floor(position.z / CHUNK_SIZE);
    if (nextCenterX === this.centerChunkX && nextCenterZ === this.centerChunkZ) {
      this.#updateDetailVisibility();
      return;
    }
    this.centerChunkX = nextCenterX;
    this.centerChunkZ = nextCenterZ;

    const wanted = new Set();
    const wantedColumns = new Set();
    for (let x = nextCenterX - this.renderDistance; x <= nextCenterX + this.renderDistance; x += 1) {
      for (let z = nextCenterZ - this.renderDistance; z <= nextCenterZ + this.renderDistance; z += 1) {
        wantedColumns.add(columnKey(x, z));
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

    for (const key of this.lodMeshes.keys()) {
      if (!wantedColumns.has(key)) this.#disposeLodMesh(key);
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
    for (const key of wantedColumns) {
      if (this.lodMeshes.has(key)) continue;
      const [chunkX, chunkZ] = key.split(",").map(Number);
      this.#rebuildLodForColumn(chunkX, chunkZ);
    }
    this.#updateDetailVisibility();
  }

  dispose() {
    if (typeof window !== "undefined") {
      window.removeEventListener("gamesettingschange", this.onGameSettingsChange);
    }
    for (const drop of this.itemDrops) drop.dispose();
    this.itemDrops.length = 0;
    for (const chunk of this.chunks.values()) chunk.dispose();
    this.chunks.clear();
    for (const key of this.lodMeshes.keys()) this.#disposeLodMesh(key);
    this.lodMeshes.clear();
    this.scene.remove(this.miningOverlay);
    this.miningOverlay.geometry.dispose();
    for (const materials of this.miningMaterials) {
      for (const material of materials) material.dispose();
    }
    this.geometry.dispose();
    this.lodMaterial.dispose();
    for (const materials of this.materials) {
      if (!materials) continue;
      for (const material of Array.isArray(materials) ? materials : [materials]) material.dispose();
    }
    const textures = new Set();
    const collectTextures = (value) => {
      if (Array.isArray(value)) {
        for (const nested of value) collectTextures(nested);
      } else if (value) {
        textures.add(value);
      }
    };
    for (const texture of Object.values(this.textures)) collectTextures(texture);
    for (const texture of textures) texture.dispose();
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

  #rebuildLodForColumn(chunkX, chunkZ) {
    const key = columnKey(chunkX, chunkZ);
    this.#disposeLodMesh(key);

    const patches = [];
    const worldXStart = chunkX * CHUNK_SIZE;
    const worldZStart = chunkZ * CHUNK_SIZE;
    for (let localX = 0; localX < CHUNK_SIZE; localX += LOD_PATCH_SIZE) {
      for (let localZ = 0; localZ < CHUNK_SIZE; localZ += LOD_PATCH_SIZE) {
        let topY = -1;
        const topTypes = [];
        for (let x = localX; x < localX + LOD_PATCH_SIZE; x += 1) {
          for (let z = localZ; z < localZ + LOD_PATCH_SIZE; z += 1) {
            for (let y = WORLD_HEIGHT - 1; y >= 0; y -= 1) {
              const type = this.getBlockAt(worldXStart + x, y, worldZStart + z);
              if (type !== BLOCKS.AIR.id) {
                topY = Math.max(topY, y);
                topTypes.push(type);
                break;
              }
            }
          }
        }
        if (topY >= 0) {
          const color = new Color(0, 0, 0);
          for (const type of topTypes) {
            color.add(this.lodColors[type] ?? this.lodFallbackColor);
          }
          color.multiplyScalar(1 / topTypes.length);
          patches.push({ localX, localZ, topY, color });
        }
      }
    }

    if (patches.length === 0) {
      this.lodMeshes.set(key, null);
      return;
    }

    const mesh = new InstancedMesh(this.geometry, this.lodMaterial, patches.length);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.lod = true;
    const transform = new Object3D();
    for (let index = 0; index < patches.length; index += 1) {
      const { localX, localZ, topY, color } = patches[index];
      const height = topY + 1;
      transform.position.set(
        worldXStart + localX + LOD_PATCH_SIZE / 2,
        height / 2,
        worldZStart + localZ + LOD_PATCH_SIZE / 2,
      );
      transform.scale.set(LOD_PATCH_SIZE, height, LOD_PATCH_SIZE);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.visible = false;
    this.scene.add(mesh);
    this.lodMeshes.set(key, mesh);
  }

  #disposeLodMesh(key) {
    const mesh = this.lodMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    this.lodMeshes.delete(key);
  }

  #updateDetailVisibility() {
    for (const chunk of this.chunks.values()) {
      const useLod = chunk.distanceTo(this.lastPosition) >= this.lodDistance;
      for (const mesh of chunk.meshes) mesh.visible = !useLod;
    }

    for (const [key, mesh] of this.lodMeshes) {
      if (!mesh) continue;
      const [chunkX, chunkZ] = key.split(",").map(Number);
      const chunk = this.chunks.get(chunkKey(chunkX, 0, chunkZ));
      mesh.visible = chunk ? chunk.distanceTo(this.lastPosition) >= this.lodDistance : false;
    }
  }

  #createMaterials() {
    this.textures = createBlockTextures();
    const materials = Array(BLOCK_COUNT).fill(null);
    for (const block of Object.values(BLOCKS)) {
      if (block.id === BLOCKS.AIR.id) continue;
      const faceTextures = this.textures.blockTextures[block.id];
      if (!faceTextures) throw new Error(`Missing face textures for ${block.name}.`);
      const materialOptions = block.id === BLOCKS.WATER.id
        ? { ...block.materialOptions, transparent: true, opacity: 0.7, depthWrite: false }
        : block.isCross
          ? {
            ...block.materialOptions,
            transparent: true,
            alphaTest: 0.5,
            side: DoubleSide,
          }
          : block.materialOptions;
      materials[block.id] = faceTextures.map(
        (map) => new MeshLambertMaterial({ map, ...materialOptions }),
      );
    }
    return materials;
  }

  #createLodColors() {
    this.lodFallbackColor = new Color(0x718c50);
    const colors = Array(BLOCK_COUNT).fill(null);
    for (const block of Object.values(BLOCKS)) {
      if (block.id === BLOCKS.AIR.id) continue;
      const texture = this.textures.blockTextures[block.id]?.[2];
      const pixels = texture?.image?.data;
      if (!pixels) {
        colors[block.id] = this.lodFallbackColor;
        continue;
      }

      let red = 0;
      let green = 0;
      let blue = 0;
      let totalAlpha = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255;
        red += pixels[index] * alpha;
        green += pixels[index + 1] * alpha;
        blue += pixels[index + 2] * alpha;
        totalAlpha += alpha;
      }
      colors[block.id] = totalAlpha > 0
        ? new Color().setRGB(
          red / totalAlpha / 255,
          green / totalAlpha / 255,
          blue / totalAlpha / 255,
          SRGBColorSpace,
        )
        : this.lodFallbackColor;
    }
    return colors;
  }

  #animateWater() {
    this.waterAnimationOffset = ((performance.now() / 1000) * 0.035) % 1;
    for (const texture of this.waterTextures) texture.offset.y = this.waterAnimationOffset;
  }
}
