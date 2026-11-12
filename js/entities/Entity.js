import { Box3, Group, Vector3 } from "three";
import { BlockType } from "../world/blocks.js";

const GRAVITY = 20;

export class Entity {
  constructor(scene, world, position, health = 1, bounds = { radius: 0.3, height: 1.8 }) {
    this.scene = scene;
    this.world = world;
    this.position = position.clone();
    this.velocity = new Vector3();
    this.health = health;
    this.boundingRadius = bounds.radius;
    this.boundingHeight = bounds.height;
    this.boundingBox = new Box3();
    this.mesh = new Group();
    this.group = this.mesh;
    this.alive = true;
    this.updateBounds();
    this.scene.add(this.mesh);
  }

  update(deltaTime) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    this.applyGravity(delta);
    this.syncTransform();
  }

  takeDamage(amount = 1) {
    if (!this.alive || amount <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    if (this.health === 0) this.die();
    return this.health === 0;
  }

  damage() {
    return this.takeDamage(1);
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.scene.remove(this.mesh);
  }

  dispose() {
    this.die();
  }

  addPart(mesh) {
    mesh.userData.entity = this;
    mesh.userData.animal = this;
    this.mesh.add(mesh);
    return mesh;
  }

  moveHorizontal(dx, dz) {
    let moved = false;
    const nextX = this.position.x + dx;
    if (!this.collidesAt(nextX, this.position.y, this.position.z)) {
      this.position.x = nextX;
      moved = true;
    }
    const nextZ = this.position.z + dz;
    if (!this.collidesAt(this.position.x, this.position.y, nextZ)) {
      this.position.z = nextZ;
      moved = true;
    }
    return moved;
  }

  applyGravity(delta) {
    this.velocity.y -= GRAVITY * delta;
    const nextY = this.position.y + this.velocity.y * delta;
    if (!this.collidesAt(this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
    } else if (this.velocity.y < 0) {
      this.position.y = this.findGround(nextY);
      this.velocity.y = 0;
    } else {
      this.velocity.y = 0;
    }
  }

  collidesAt(x, feetY, z) {
    const minX = Math.floor(x - this.boundingRadius);
    const maxX = Math.floor(x + this.boundingRadius);
    const minZ = Math.floor(z - this.boundingRadius);
    const maxZ = Math.floor(z + this.boundingRadius);
    const minY = Math.floor(feetY + 1e-4);
    const maxY = Math.floor(feetY + this.boundingHeight - 1e-4);
    for (let blockX = minX; blockX <= maxX; blockX += 1) {
      for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
        for (let blockY = minY; blockY <= maxY; blockY += 1) {
          if (blockY < 0 || this.world.getBlockAt(blockX, blockY, blockZ) !== BlockType.AIR) {
            return true;
          }
        }
      }
    }
    return feetY < 0;
  }

  findGround(candidateY) {
    const minX = Math.floor(this.position.x - this.boundingRadius);
    const maxX = Math.floor(this.position.x + this.boundingRadius);
    const minZ = Math.floor(this.position.z - this.boundingRadius);
    const maxZ = Math.floor(this.position.z + this.boundingRadius);
    let highest = 0;
    for (let blockX = minX; blockX <= maxX; blockX += 1) {
      for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
        for (
          let blockY = Math.max(0, Math.floor(candidateY));
          blockY <= Math.floor(this.position.y);
          blockY += 1
        ) {
          if (this.world.getBlockAt(blockX, blockY, blockZ) !== BlockType.AIR) {
            highest = Math.max(highest, blockY + 1);
          }
        }
      }
    }
    return highest;
  }

  syncTransform() {
    this.mesh.position.copy(this.position);
    if (Number.isFinite(this.direction)) this.mesh.rotation.y = this.direction;
    this.updateBounds();
  }

  updateBounds() {
    this.boundingBox.min.set(
      this.position.x - this.boundingRadius,
      this.position.y,
      this.position.z - this.boundingRadius,
    );
    this.boundingBox.max.set(
      this.position.x + this.boundingRadius,
      this.position.y + this.boundingHeight,
      this.position.z + this.boundingRadius,
    );
  }
}
