import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
} from "three";
import { BLOCK_COUNT, BLOCKS } from "./blocks.js";
import { getAtlasUvs } from "./TextureAtlas.js";
import { CHUNK_SIZE, getBlockIndex } from "./WorldGenerator.js";

const BLOCKS_BY_ID = Array(BLOCK_COUNT);
for (const block of Object.values(BLOCKS)) BLOCKS_BY_ID[block.id] = block;
const FLUID_BLOCK_IDS = new Set(
  Object.values(BLOCKS).filter((block) => block.isFluid).map((block) => block.id),
);
const TRANSPARENT_BLOCKS = Object.values(BLOCKS).filter(
  (block) => block.materialOptions.transparent && !block.isFluid,
);
const TRANSPARENT_BLOCK_IDS = new Set(TRANSPARENT_BLOCKS.map((block) => block.id));
const FLUID_BLOCKS = Object.values(BLOCKS).filter((block) => block.isFluid);
const LEAF_BLOCK_IDS = new Set(
  Object.values(BLOCKS)
    .filter((block) => block.name.endsWith("Leaves"))
    .map((block) => block.id),
);
const OPAQUE_BLOCKS = Object.values(BLOCKS).filter(
  (block) =>
    block.id !== BLOCKS.AIR.id &&
    block.id !== BLOCKS.DOOR.id &&
    !block.isFluid &&
    !block.isCross &&
    !block.materialOptions.transparent,
);

const FACE_DIRECTIONS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const FACE_CORNERS = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
];
const FACE_UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const CROSS_UVS = [[0, 1], [1, 1], [1, 0], [0, 0]];
const FACE_OPPOSITES = [1, 0, 3, 2, 5, 4];
const FACE_U_DIRECTIONS = [5, 4, 0, 0, 0, 1];
const FACE_V_DIRECTIONS = [2, 2, 5, 4, 2, 2];
const FACE_BRIGHTNESS = [0.8, 0.8, 1, 0.6, 0.8, 0.8];

export class Chunk {
  constructor(world, chunkX, chunkY, chunkZ, blocks) {
    this.world = world;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.blocks = blocks;
    this.fluidLevels = new Uint8Array(blocks.length);
    for (let index = 0; index < blocks.length; index += 1) {
      if (FLUID_BLOCK_IDS.has(blocks[index])) this.fluidLevels[index] = 7;
    }
    this.meshes = [];
    this.doorGeometry = null;
  }

  distanceTo(position) {
    const centerX = this.chunkX + 0.5;
    const centerZ = this.chunkZ + 0.5;
    const playerChunkX = position.x / CHUNK_SIZE;
    const playerChunkZ = position.z / CHUNK_SIZE;
    return Math.hypot(centerX - playerChunkX, centerZ - playerChunkZ);
  }

  getBlock(localX, localY, localZ) {
    if (
      localX < 0 ||
      localX >= CHUNK_SIZE ||
      localY < 0 ||
      localY >= CHUNK_SIZE ||
      localZ < 0 ||
      localZ >= CHUNK_SIZE
    ) {
      return BLOCKS.AIR.id;
    }
    return this.blocks[getBlockIndex(localX, localY, localZ)];
  }

  getFluidLevel(localX, localY, localZ) {
    if (
      localX < 0 ||
      localX >= CHUNK_SIZE ||
      localY < 0 ||
      localY >= CHUNK_SIZE ||
      localZ < 0 ||
      localZ >= CHUNK_SIZE
    ) {
      return 0;
    }
    return this.fluidLevels[getBlockIndex(localX, localY, localZ)];
  }

  setBlock(localX, localY, localZ, type, fluidLevel = 7) {
    if (
      localX < 0 ||
      localX >= CHUNK_SIZE ||
      localY < 0 ||
      localY >= CHUNK_SIZE ||
      localZ < 0 ||
      localZ >= CHUNK_SIZE
    ) {
      return false;
    }
    const isFluid = FLUID_BLOCK_IDS.has(type);
    if (isFluid && (!Number.isInteger(fluidLevel) || fluidLevel < 0 || fluidLevel > 7)) {
      throw new RangeError("Fluid level must be an integer from 0 to 7.");
    }
    const index = getBlockIndex(localX, localY, localZ);
    this.blocks[index] = type;
    this.fluidLevels[index] = isFluid ? fluidLevel : 0;
    return true;
  }

  rebuild() {
    this.disposeMeshes();
    const opaqueBlocks = Object.values(BLOCKS).filter((block) =>
      OPAQUE_BLOCKS.includes(block) ||
      (!this.world.fancyLeaves && LEAF_BLOCK_IDS.has(block.id)),
    );
    const transparentBlocks = TRANSPARENT_BLOCKS.filter(
      (block) => this.world.fancyLeaves || !LEAF_BLOCK_IDS.has(block.id),
    );
    const fluidFaces = new Map(
      FLUID_BLOCKS.map((block) => [
        block.id,
        Array.from({ length: FACE_DIRECTIONS.length }, () => []),
      ]),
    );
    const opaqueFaces = new Map(
      opaqueBlocks.map((block) => [
        block.id,
        Array.from({ length: FACE_DIRECTIONS.length }, () => []),
      ]),
    );
    const doorPositions = [];
    const crossPositions = new Map(
      Object.values(BLOCKS)
        .filter((block) => block.isCross)
        .map((block) => [block.id, []]),
    );
    const transparentFaces = new Map(
      transparentBlocks.map((block) => [
        block.id,
        Array.from({ length: 6 }, () => []),
      ]),
    );
    const worldXStart = this.chunkX * CHUNK_SIZE;
    const worldYStart = this.chunkY * CHUNK_SIZE;
    const worldZStart = this.chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        for (let z = 0; z < CHUNK_SIZE; z += 1) {
          const type = this.getBlock(x, y, z);
          if (type === BLOCKS.AIR.id) continue;

          if (BLOCKS_BY_ID[type].isCross) {
            crossPositions.get(type).push([
              x + worldXStart,
              y + worldYStart,
              z + worldZStart,
            ]);
          } else if (BLOCKS_BY_ID[type].isFluid) {
            this.#collectFluidFaces(
              type,
              x,
              y,
              z,
              worldXStart,
              worldYStart,
              worldZStart,
              fluidFaces.get(type),
            );
          } else if (
            TRANSPARENT_BLOCK_IDS.has(type) &&
            (this.world.fancyLeaves || !LEAF_BLOCK_IDS.has(type))
          ) {
            this.#collectTransparentFaces(
              type,
              x,
              y,
              z,
              worldXStart,
              worldYStart,
              worldZStart,
              transparentFaces.get(type),
            );
          } else if (type === BLOCKS.DOOR.id) {
            if (this.#hasVisibleNeighbor(x, y, z, worldXStart, worldYStart, worldZStart)) {
              doorPositions.push([x + worldXStart, y + worldYStart, z + worldZStart]);
            }
          } else {
            this.#collectOpaqueFaces(
              type,
              x,
              y,
              z,
              worldXStart,
              worldYStart,
              worldZStart,
              opaqueFaces.get(type),
            );
          }
        }
      }
    }

    const transform = new Object3D();
    for (const block of opaqueBlocks) {
      const faces = opaqueFaces.get(block.id);
      if (faces.every((quads) => quads.length === 0)) continue;

      const geometry = this.#createFaceGeometry(faces);
      const mesh = new Mesh(geometry, this.world.materials[block.id]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.chunk = this;
      mesh.userData.blockType = block.id;
      mesh.userData.ownsGeometry = true;
      this.world.scene.add(mesh);
      this.meshes.push(mesh);
    }

    if (doorPositions.length > 0) {
      if (!this.doorGeometry) {
        this.doorGeometry = new BoxGeometry(1, 1, 0.12);
        this.doorGeometry.setAttribute(
          "color",
          new Float32BufferAttribute(
            new Float32Array(this.doorGeometry.attributes.position.count * 3).fill(1),
            3,
          ),
        );
        const doorUvs = this.doorGeometry.attributes.uv;
        for (let index = 0; index < doorUvs.count; index += 1) {
          const faceIndex = Math.floor(index / 4);
          const uv = this.#getAtlasUvs(BLOCKS.DOOR.id, faceIndex, [
            [doorUvs.getX(index), doorUvs.getY(index)],
          ])[0];
          doorUvs.setXY(index, uv[0], uv[1]);
        }
        doorUvs.needsUpdate = true;
      }
      const mesh = new InstancedMesh(
        this.doorGeometry,
        this.world.materials[BLOCKS.DOOR.id],
        doorPositions.length,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.chunk = this;
      mesh.userData.blockType = BLOCKS.DOOR.id;
      for (let index = 0; index < doorPositions.length; index += 1) {
        const [x, y, z] = doorPositions[index];
        transform.position.set(x + 0.5, y + 0.5, z + 0.5);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.world.scene.add(mesh);
      this.meshes.push(mesh);
    }

    for (const block of FLUID_BLOCKS) {
      const faces = fluidFaces.get(block.id);
      if (faces.every((quads) => quads.length === 0)) continue;

      const geometry = this.#createFaceGeometry(faces);
      const mesh = new Mesh(geometry, this.world.materials[block.id]);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.chunk = this;
      mesh.userData.blockType = block.id;
      mesh.userData.ownsGeometry = true;
      this.world.scene.add(mesh);
      this.meshes.push(mesh);
    }

    for (const block of Object.values(BLOCKS)) {
      if (!block.isCross) continue;
      const instances = crossPositions.get(block.id);
      if (instances.length === 0) continue;
      const geometry = this.#createCrossGeometry(instances, block);
      const material = this.world.materials[block.id][2];
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.chunk = this;
      mesh.userData.blockType = block.id;
      mesh.userData.ownsGeometry = true;
      this.world.scene.add(mesh);
      this.meshes.push(mesh);
    }

    for (const block of transparentBlocks) {
      const faces = transparentFaces.get(block.id);
      if (faces.every((quads) => quads.length === 0)) continue;

      const geometry = this.#createFaceGeometry(faces);
      const mesh = new Mesh(geometry, this.world.materials[block.id]);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.chunk = this;
      mesh.userData.blockType = block.id;
      mesh.userData.ownsGeometry = true;
      this.world.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  disposeMeshes() {
    for (const mesh of this.meshes) {
      this.world.scene.remove(mesh);
      if (mesh.userData.ownsGeometry) mesh.geometry.dispose();
      mesh.dispose?.();
    }
    this.meshes.length = 0;
  }

  dispose() {
    this.disposeMeshes();
    this.doorGeometry?.dispose();
    this.doorGeometry = null;
    this.blocks = null;
    this.fluidLevels = null;
  }

  #getNeighborType(x, y, z, faceIndex, worldXStart, worldYStart, worldZStart) {
    const [dx, dy, dz] = FACE_DIRECTIONS[faceIndex];
    const neighborX = x + dx;
    const neighborY = y + dy;
    const neighborZ = z + dz;
    if (
      neighborX >= 0 &&
      neighborX < CHUNK_SIZE &&
      neighborY >= 0 &&
      neighborY < CHUNK_SIZE &&
      neighborZ >= 0 &&
      neighborZ < CHUNK_SIZE
    ) {
      return this.getBlock(neighborX, neighborY, neighborZ);
    }
    return this.world.getBlockAt(
      worldXStart + neighborX,
      worldYStart + neighborY,
      worldZStart + neighborZ,
    );
  }

  #isFaceVisible(type, neighborType) {
    const currentBlock = BLOCKS_BY_ID[type];
    const neighborBlock = BLOCKS_BY_ID[neighborType];
    if (!neighborBlock) return true;
    if (currentBlock?.isCross || neighborBlock.isCross) return true;

    const currentTransparent =
      currentBlock?.materialOptions.transparent === true &&
      (this.world.fancyLeaves || !LEAF_BLOCK_IDS.has(type));
    const neighborTransparent =
      neighborBlock.materialOptions.transparent === true &&
      (this.world.fancyLeaves || !LEAF_BLOCK_IDS.has(neighborType));
    if (neighborType === BLOCKS.AIR.id) return true;
    if (currentTransparent && neighborTransparent) return false;
    return neighborTransparent;
  }

  #hasVisibleNeighbor(x, y, z, worldXStart, worldYStart, worldZStart) {
    return FACE_DIRECTIONS.some((_, faceIndex) =>
      this.#isFaceVisible(
        this.getBlock(x, y, z),
        this.#getNeighborType(x, y, z, faceIndex, worldXStart, worldYStart, worldZStart),
      ),
    );
  }

  #collectOpaqueFaces(type, x, y, z, worldXStart, worldYStart, worldZStart, faces) {
    const blockX = x + worldXStart;
    const blockY = y + worldYStart;
    const blockZ = z + worldZStart;

    for (let faceIndex = 0; faceIndex < FACE_DIRECTIONS.length; faceIndex += 1) {
      const neighborType = this.#getNeighborType(
        x,
        y,
        z,
        faceIndex,
        worldXStart,
        worldYStart,
        worldZStart,
      );
      if (!this.#isFaceVisible(type, neighborType)) continue;

      const corners = FACE_CORNERS[faceIndex].map(([cornerX, cornerY, cornerZ]) => [
        blockX + cornerX,
        blockY + cornerY,
        blockZ + cornerZ,
      ]);
      faces[faceIndex].push({
        corners,
        uvs: this.#getAtlasUvs(type, faceIndex, FACE_UVS),
        colors: FACE_CORNERS[faceIndex].map((_, cornerIndex) =>
          this.#getVertexShade(blockX, blockY, blockZ, faceIndex, cornerIndex),
        ),
      });
    }
  }

  #collectTransparentFaces(type, x, y, z, worldXStart, worldYStart, worldZStart, faces) {
    const blockX = x + worldXStart;
    const blockY = y + worldYStart;
    const blockZ = z + worldZStart;

    for (let faceIndex = 0; faceIndex < FACE_DIRECTIONS.length; faceIndex += 1) {
      const neighborType = this.#getNeighborType(
        x,
        y,
        z,
        faceIndex,
        worldXStart,
        worldYStart,
        worldZStart,
      );
      if (!this.#isFaceVisible(type, neighborType)) continue;

      const corners = FACE_CORNERS[faceIndex].map(([cornerX, cornerY, cornerZ]) => [
        blockX + cornerX,
        blockY + cornerY,
        blockZ + cornerZ,
      ]);
      const uvs = type === BLOCKS.GLASS.id
        ? this.#getConnectedGlassUvs(
          x,
          y,
          z,
          faceIndex,
          worldXStart,
          worldYStart,
          worldZStart,
        )
        : FACE_UVS;
      faces[faceIndex].push({
        corners,
        uvs: this.#getAtlasUvs(type, faceIndex, uvs),
        colors: FACE_CORNERS[faceIndex].map((_, cornerIndex) =>
          this.#getVertexShade(blockX, blockY, blockZ, faceIndex, cornerIndex),
        ),
      });
    }
  }

  #collectFluidFaces(type, x, y, z, worldXStart, worldYStart, worldZStart, faces) {
    const blockX = x + worldXStart;
    const blockY = y + worldYStart;
    const blockZ = z + worldZStart;
    const fluidLevel = this.getFluidLevel(x, y, z);
    const fluidHeight = 0.125 + (fluidLevel / 7) * 0.775;
    const aboveType = this.#getNeighborType(x, y, z, 2, worldXStart, worldYStart, worldZStart);
    const sideHeight = aboveType === type ? 1 : fluidHeight;

    for (let faceIndex = 0; faceIndex < FACE_DIRECTIONS.length; faceIndex += 1) {
      const neighborType = this.#getNeighborType(
        x,
        y,
        z,
        faceIndex,
        worldXStart,
        worldYStart,
        worldZStart,
      );
      const sameFluidNeighbor = neighborType === type;
      if (sameFluidNeighbor && (faceIndex === 2 || faceIndex === 3)) continue;
      if (!sameFluidNeighbor && !this.#isFaceVisible(type, neighborType)) continue;

      let lowerSideHeight = 0;
      if (sameFluidNeighbor) {
        const [dx, dy, dz] = FACE_DIRECTIONS[faceIndex];
        const neighborAboveType = this.world.getBlockAt(
          blockX + dx,
          blockY + dy + 1,
          blockZ + dz,
        );
        const neighborLevel = this.world.getFluidLevelAt(
          blockX + dx,
          blockY + dy,
          blockZ + dz,
        );
        lowerSideHeight = neighborAboveType === type
          ? 1
          : 0.125 + (neighborLevel / 7) * 0.775;
        if (lowerSideHeight >= sideHeight) continue;
      }

      const corners = FACE_CORNERS[faceIndex].map(([cornerX, cornerY, cornerZ]) => [
        blockX + cornerX,
        blockY + (faceIndex === 2
          ? fluidHeight
          : faceIndex !== 3 && cornerY === 1
            ? sideHeight
            : faceIndex !== 3 && sameFluidNeighbor
              ? lowerSideHeight
              : cornerY),
        blockZ + cornerZ,
      ]);
      faces[faceIndex].push({
        corners,
        uvs: this.#getAtlasUvs(type, faceIndex, FACE_UVS),
        colors: FACE_CORNERS[faceIndex].map((_, cornerIndex) =>
          this.#getVertexShade(blockX, blockY, blockZ, faceIndex, cornerIndex),
        ),
      });
    }
  }

  #getConnectedGlassUvs(x, y, z, faceIndex, worldXStart, worldYStart, worldZStart) {
    const negativeU = this.#getNeighborType(
      x,
      y,
      z,
      FACE_OPPOSITES[FACE_U_DIRECTIONS[faceIndex]],
      worldXStart,
      worldYStart,
      worldZStart,
    ) === BLOCKS.GLASS.id;
    const positiveU = this.#getNeighborType(
      x,
      y,
      z,
      FACE_U_DIRECTIONS[faceIndex],
      worldXStart,
      worldYStart,
      worldZStart,
    ) === BLOCKS.GLASS.id;
    const negativeV = this.#getNeighborType(
      x,
      y,
      z,
      FACE_OPPOSITES[FACE_V_DIRECTIONS[faceIndex]],
      worldXStart,
      worldYStart,
      worldZStart,
    ) === BLOCKS.GLASS.id;
    const positiveV = this.#getNeighborType(
      x,
      y,
      z,
      FACE_V_DIRECTIONS[faceIndex],
      worldXStart,
      worldYStart,
      worldZStart,
    ) === BLOCKS.GLASS.id;
    const inset = 1.5 / 32;

    return FACE_UVS.map(([u, v]) => [
      u === 0 && negativeU ? inset : u === 1 && positiveU ? 1 - inset : u,
      v === 0 && negativeV ? inset : v === 1 && positiveV ? 1 - inset : v,
    ]);
  }

  #getAtlasUvs(type, faceIndex, localUvs) {
    const block = BLOCKS_BY_ID[type];
    const textureName = Array.isArray(block.textures)
      ? block.textures[faceIndex] ?? block.textures[0]
      : block.textures;
    return getAtlasUvs(textureName, localUvs);
  }

  #createFaceGeometry(faces) {
    const geometry = new BufferGeometry();
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];

    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      const groupStart = indices.length;
      for (const { corners, uvs: faceUvs, colors: faceColors } of faces[faceIndex]) {
        const vertexStart = positions.length / 3;
        for (let cornerIndex = 0; cornerIndex < corners.length; cornerIndex += 1) {
          positions.push(...corners[cornerIndex]);
          uvs.push(...faceUvs[cornerIndex]);
          const shade = faceColors?.[cornerIndex] ?? 1;
          colors.push(shade, shade, shade);
        }
        indices.push(
          vertexStart,
          vertexStart + 1,
          vertexStart + 2,
          vertexStart,
          vertexStart + 2,
          vertexStart + 3,
        );
      }
      if (indices.length > groupStart) {
        geometry.addGroup(groupStart, indices.length - groupStart, faceIndex);
      }
    }

    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  #createCrossGeometry(blockPositions, block) {
    const geometry = new BufferGeometry();
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    const planes = [
      [[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]],
      [[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]],
    ];
    const crossUvs = this.#getAtlasUvs(block.id, 2, CROSS_UVS);

    for (const [x, y, z] of blockPositions) {
      for (const plane of planes) {
        const vertexStart = positions.length / 3;
        for (let index = 0; index < plane.length; index += 1) {
          const [offsetX, offsetY, offsetZ] = plane[index];
          positions.push(x + offsetX, y + offsetY, z + offsetZ);
          uvs.push(...crossUvs[index]);
          colors.push(1, 1, 1);
        }
        indices.push(
          vertexStart,
          vertexStart + 1,
          vertexStart + 2,
          vertexStart,
          vertexStart + 2,
          vertexStart + 3,
        );
      }
    }

    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }

  #getVertexShade(blockX, blockY, blockZ, faceIndex, cornerIndex) {
    const faceBrightness = FACE_BRIGHTNESS[faceIndex] ?? 0.8;
    if (!this.world.smoothLighting) return faceBrightness;
    const faceNormal = FACE_DIRECTIONS[faceIndex];
    const corner = FACE_CORNERS[faceIndex][cornerIndex];
    const tangentAxes = [0, 1, 2].filter((axis) => faceNormal[axis] === 0);
    const offsets = tangentAxes.map((axis) => {
      const offset = [0, 0, 0];
      offset[axis] = corner[axis] === 0 ? -1 : 1;
      return offset;
    });
    const isOccluder = (x, y, z) => {
      const block = BLOCKS_BY_ID[this.world.getBlockAt(x, y, z)];
      return Boolean(
        block?.isSolid &&
        !block.isCross &&
        (!block.materialOptions.transparent ||
          (!this.world.fancyLeaves && LEAF_BLOCK_IDS.has(block.id))),
      );
    };
    const sideOccluders = offsets.map(([dx, dy, dz]) =>
      isOccluder(blockX + dx, blockY + dy, blockZ + dz),
    );
    const diagonalOccluder = isOccluder(
      blockX + offsets[0][0] + offsets[1][0],
      blockY + offsets[0][1] + offsets[1][1],
      blockZ + offsets[0][2] + offsets[1][2],
    );
    const occlusion = sideOccluders[0] && sideOccluders[1]
      ? 0.42
      : 1 - (Number(sideOccluders[0]) + Number(sideOccluders[1]) +
        Number(diagonalOccluder) * 0.65) * 0.14;
    return faceBrightness * Math.max(0.58, occlusion);
  }
}
