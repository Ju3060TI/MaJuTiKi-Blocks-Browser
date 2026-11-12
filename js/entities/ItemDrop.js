import { Mesh } from "three";
import { BLOCKS } from "../world/blocks.js";

const DROP_SCALE = 0.25;
const PICKUP_DISTANCE = 0.5;
const MAGNET_DISTANCE = 2;
const GRAVITY = 18;
const SOLID_BLOCKS = new Map(
  Object.values(BLOCKS).map((block) => [block.id, block.isSolid]),
);

export class ItemDrop {
  constructor(scene, world, item, position, velocity = { x: 0, y: 1.5, z: 0 }) {
    this.scene = scene;
    this.world = world;
    this.item = item;
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.mesh = new Mesh(world.geometry, world.materials[item]);
    this.mesh.scale.setScalar(DROP_SCALE);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    this.#syncMesh();
  }

  update(deltaSeconds, player, inventory) {
    const delta = Math.min(deltaSeconds, 0.05);
    const target = {
      x: player.position.x,
      y: player.position.y + 0.9,
      z: player.position.z,
    };
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dz = target.z - this.position.z;
    const distance = Math.hypot(dx, dy, dz);

    if (distance <= MAGNET_DISTANCE) {
      const step = Math.min(1, delta * 8);
      this.position.x += dx * step;
      this.position.y += dy * step;
      this.position.z += dz * step;
      if (distance <= PICKUP_DISTANCE && inventory.addItem(this.item, 1)) {
        this.dispose();
        return true;
      }
    } else {
      this.velocity.y -= GRAVITY * delta;
      this.position.y += this.velocity.y * delta;
      this.#collideWithGround();
    }

    this.mesh.rotation.y += delta * 1.8;
    this.#syncMesh();
    return false;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }

  #collideWithGround() {
    const feetY = this.position.y - DROP_SCALE / 2;
    const blockY = Math.floor(feetY);
    const blockType = this.world.getBlockAt(
      Math.floor(this.position.x),
      blockY,
      Math.floor(this.position.z),
    );
    if (!SOLID_BLOCKS.get(blockType)) {
      return;
    }

    this.position.y = blockY + 1 + DROP_SCALE / 2;
    this.velocity.y = Math.abs(this.velocity.y) > 1 ? this.velocity.y * -0.28 : 0;
  }

  #syncMesh() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }
}
