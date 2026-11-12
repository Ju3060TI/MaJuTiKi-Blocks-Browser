import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  Object3D,
} from "three";
import { BLOCK_COUNT, BLOCKS } from "./blocks.js";
import { CHUNK_SIZE, getBlockIndex } from "./WorldGenerator.js";

const BLOCKS_BY_ID = Array(BLOCK_COUNT);
for (const block of Object.values(BLOCKS)) BLOCKS_BY_ID[block.id] = block;
const TRANSPARENT_BLOCKS = Object.values(BLOCKS).filter(
  (block) => block.materialOptions.transparent,
);
const TRANSPARENT_BLOCK_IDS = new Set(TRANSPARENT_BLOCKS.map((block) => block.id));

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

export class Chunk {
  constructor(world, chunkX, chunkY, chunkZ, blocks) {
    this.world = world;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.blocks = blocks;
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

  setBlock(localX, localY, localZ, type) {
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
    this.blocks[getBlockIndex(localX, localY, localZ)] = type;
    return true;
  }

  rebuild() {
    this.disposeMeshes();
    const positions = Array.from({ length: BLOCK_COUNT }, () => []);
    const transparentFaces = new Map(
      TRANSPARENT_BLOCKS.map((block) => [
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

          if (TRANSPARENT_BLOCK_IDS.has(type)) {
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
          } else if (this.#hasVisibleNeighbor(x, y, z, worldXStart, worldYStart, worldZStart)) {
            positions[type].push([x + worldXStart, y + worldYStart, z + worldZStart]);
          }
        }
      }
    }

    const transform = new Object3D();
    for (const block of Object.values(BLOCKS)) {
      if (block.id === BLOCKS.AIR.id) continue;
      const instances = positions[block.id];
      if (instances.length === 0) continue;
      const geometry = block.id === BLOCKS.DOOR.id
        ? (this.doorGeometry ??= new BoxGeometry(1, 1, 0.12))
        : this.world.geometry;
      const mesh = new InstancedMesh(
        geometry,
        this.world.materials[block.id],
        instances.length,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.chunk = this;
      mesh.userData.blockType = block.id;
      for (let index = 0; index < instances.length; index += 1) {
        const [x, y, z] = instances[index];
        transform.position.set(x + 0.5, y + 0.5, z + 0.5);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.world.scene.add(mesh);
      this.meshes.push(mesh);
    }

    for (const block of TRANSPARENT_BLOCKS) {
      const faces = transparentFaces.get(block.id);
      if (faces.every((quads) => quads.length === 0)) continue;

      const geometry = this.#createTransparentGeometry(faces);
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

    const currentTransparent = currentBlock?.materialOptions.transparent === true;
    const neighborTransparent = neighborBlock.materialOptions.transparent === true;
    if (currentTransparent && neighborTransparent) return false;
    if (!neighborBlock.isSolid) return true;
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

  #collectTransparentFaces(type, x, y, z, worldXStart, worldYStart, worldZStart, faces) {
    const aboveType = this.#getNeighborType(x, y, z, 2, worldXStart, worldYStart, worldZStart);
    const isWater = type === BLOCKS.WATER.id;
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

      const sideTop = isWater && aboveType !== BLOCKS.WATER.id ? 0.9 : 1;
      const corners = FACE_CORNERS[faceIndex].map(([cornerX, cornerY, cornerZ]) => {
        let localY = cornerY;
        if (isWater && (faceIndex === 2 || (faceIndex !== 3 && cornerY === 1))) {
          localY = faceIndex === 2 ? 0.9 : sideTop;
        }
        return [
          blockX + cornerX,
          blockY + localY,
          blockZ + cornerZ,
        ];
      });
      faces[faceIndex].push(corners);
    }
  }

  #createTransparentGeometry(faces) {
    const geometry = new BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
      const groupStart = indices.length;
      for (const corners of faces[faceIndex]) {
        const vertexStart = positions.length / 3;
        for (let cornerIndex = 0; cornerIndex < corners.length; cornerIndex += 1) {
          positions.push(...corners[cornerIndex]);
          uvs.push(...FACE_UVS[cornerIndex]);
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
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}
