import { BoxGeometry, InstancedMesh, Object3D } from "three";
import { BLOCK_COUNT, BLOCKS } from "./blocks.js";
import { CHUNK_SIZE, getBlockIndex } from "./WorldGenerator.js";

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
    const worldXStart = this.chunkX * CHUNK_SIZE;
    const worldYStart = this.chunkY * CHUNK_SIZE;
    const worldZStart = this.chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        for (let z = 0; z < CHUNK_SIZE; z += 1) {
          const type = this.getBlock(x, y, z);
          if (type === BLOCKS.AIR.id) continue;

          if (this.#hasAirNeighbor(x, y, z, worldXStart, worldYStart, worldZStart)) {
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
  }

  disposeMeshes() {
    for (const mesh of this.meshes) {
      this.world.scene.remove(mesh);
      mesh.dispose();
    }
    this.meshes.length = 0;
  }

  dispose() {
    this.disposeMeshes();
    this.doorGeometry?.dispose();
    this.doorGeometry = null;
    this.blocks = null;
  }

  #hasAirNeighbor(x, y, z, worldXStart, worldYStart, worldZStart) {
    const west =
      x > 0
        ? this.getBlock(x - 1, y, z)
        : this.world.getBlockAt(worldXStart - 1, worldYStart + y, worldZStart + z);
    if (west === BLOCKS.AIR.id) return true;

    const east =
      x < CHUNK_SIZE - 1
        ? this.getBlock(x + 1, y, z)
        : this.world.getBlockAt(worldXStart + CHUNK_SIZE, worldYStart + y, worldZStart + z);
    if (east === BLOCKS.AIR.id) return true;

    const below =
      y > 0
        ? this.getBlock(x, y - 1, z)
        : this.world.getBlockAt(worldXStart + x, worldYStart - 1, worldZStart + z);
    if (below === BLOCKS.AIR.id) return true;

    const above =
      y < CHUNK_SIZE - 1
        ? this.getBlock(x, y + 1, z)
        : this.world.getBlockAt(worldXStart + x, worldYStart + CHUNK_SIZE, worldZStart + z);
    if (above === BLOCKS.AIR.id) return true;

    const north =
      z > 0
        ? this.getBlock(x, y, z - 1)
        : this.world.getBlockAt(worldXStart + x, worldYStart + y, worldZStart - 1);
    if (north === BLOCKS.AIR.id) return true;

    const south =
      z < CHUNK_SIZE - 1
        ? this.getBlock(x, y, z + 1)
        : this.world.getBlockAt(worldXStart + x, worldYStart + y, worldZStart + CHUNK_SIZE);
    return south === BLOCKS.AIR.id;
  }
}
