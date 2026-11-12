import { Mesh, Vector3 } from "three";
import { BlockType } from "../world/blocks.js";
import { Entity } from "./Entity.js";

const CHASE_DISTANCE = 16;
const ATTACK_DISTANCE = 1;
const MOVE_SPEED = 1.5;

export class Zombie extends Entity {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, new Vector3(x, y, z), 5, { radius: 0.3, height: 1.8 });
    this.kind = "zombie";
    this.isTameable = true;
    this.assets = assets;
    this.direction = Math.random() * Math.PI * 2;
    this.attackCooldown = 0;
    this.sunBurnTimer = 1;
    this.state = "idle";
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player, playerPosition = player?.position, isDay = false } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);

    if (isDay && this.#isExposedToSunlight()) {
      this.sunBurnTimer -= delta;
      if (this.sunBurnTimer <= 0) {
        this.takeDamage(1);
        this.sunBurnTimer = 1;
        if (!this.alive) return;
      }
    } else {
      this.sunBurnTimer = 1;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    if (playerPosition) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= CHASE_DISTANCE) {
        this.state = "chase";
        this.direction = Math.atan2(dx, dz);
        if (distance > ATTACK_DISTANCE) {
          this.moveHorizontal(
            Math.sin(this.direction) * MOVE_SPEED * delta,
            Math.cos(this.direction) * MOVE_SPEED * delta,
          );
        } else if (
          this.attackCooldown === 0 &&
          Math.abs(playerPosition.y - this.position.y) < 1.5
        ) {
          player?.takeDamage?.(1, this);
          this.attackCooldown = 1.2;
        }
      } else {
        this.state = "idle";
      }
    }

    super.update(delta);
  }

  #isExposedToSunlight() {
    return this.world.getBlockAt(
      Math.floor(this.position.x),
      Math.floor(this.position.y + this.boundingHeight + 0.1),
      Math.floor(this.position.z),
    ) === BlockType.AIR;
  }

  #buildModel() {
    const parts = [
      [this.assets.zombieBody, this.assets.zombieMaterial, 0, 0.95, 0],
      [this.assets.zombieHead, this.assets.zombieMaterial, 0, 1.62, 0],
      [this.assets.zombieLimb, this.assets.zombieMaterial, -0.22, 0.35, 0],
      [this.assets.zombieLimb, this.assets.zombieMaterial, 0.22, 0.35, 0],
    ];
    for (const [geometry, material, x, y, z] of parts) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.addPart(mesh);
    }
  }
}
