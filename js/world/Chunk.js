import { InstancedMesh, Object3D } from "three";
import { CHUNK_SIZE, getBlockIndex, BlockType } from "./WorldGenerator.js";

export class Chunk {
  constructor(world, chunkX, chunkY, chunkZ, blocks) {
    this.world = world;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.blocks = blocks;
    this.meshes = [];
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
      return BlockType.AIR;
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
    const positions = Array.from({ length: Object.keys(BlockType).length }, () => []);
    const worldXStart = this.chunkX * CHUNK_SIZE;
    const worldYStart = this.chunkY * CHUNK_SIZE;
    const worldZStart = this.chunkZ * CHUNK_SIZE;

    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        for (let z = 0; z < CHUNK_SIZE; z += 1) {
          const type = this.getBlock(x, y, z);
          if (type === BlockType.AIR) continue;

          if (this.#hasAirNeighbor(x, y, z, worldXStart, worldYStart, worldZStart)) {
            positions[type].push([x + worldXStart, y + worldYStart, z + worldZStart]);
          }
        }
      }
    }

    const transform = new Object3D();
    for (let type = BlockType.GRASS; type <= BlockType.CRAFTING_TABLE; type += 1) {
      const instances = positions[type];
      if (instances.length === 0) continue;
      const mesh = new InstancedMesh(this.world.geometry, this.world.materials[type], instances.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.chunk = this;
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
    this.blocks = null;
  }

  #hasAirNeighbor(x, y, z, worldXStart, worldYStart, worldZStart) {
    const west =
      x > 0
        ? this.getBlock(x - 1, y, z)
        : this.world.getBlockAt(worldXStart - 1, worldYStart + y, worldZStart + z);
    if (west === BlockType.AIR) return true;

    const east =
      x < CHUNK_SIZE - 1
        ? this.getBlock(x + 1, y, z)
        : this.world.getBlockAt(worldXStart + CHUNK_SIZE, worldYStart + y, worldZStart + z);
    if (east === BlockType.AIR) return true;

    const below =
      y > 0
        ? this.getBlock(x, y - 1, z)
        : this.world.getBlockAt(worldXStart + x, worldYStart - 1, worldZStart + z);
    if (below === BlockType.AIR) return true;

    const above =
      y < CHUNK_SIZE - 1
        ? this.getBlock(x, y + 1, z)
        : this.world.getBlockAt(worldXStart + x, worldYStart + CHUNK_SIZE, worldZStart + z);
    if (above === BlockType.AIR) return true;

    const north =
      z > 0
        ? this.getBlock(x, y, z - 1)
        : this.world.getBlockAt(worldXStart + x, worldYStart + y, worldZStart - 1);
    if (north === BlockType.AIR) return true;

    const south =
      z < CHUNK_SIZE - 1
        ? this.getBlock(x, y, z + 1)
        : this.world.getBlockAt(worldXStart + x, worldYStart + y, worldZStart + CHUNK_SIZE);
    return south === BlockType.AIR;
  }
}
