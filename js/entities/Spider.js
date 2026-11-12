import { Mesh, Vector3 } from "three";
import { Entity } from "./Entity.js";

const MOVE_SPEED = 2.4;
const ATTACK_DISTANCE = 1.4;
const CHASE_DISTANCE = 18;

export class Spider extends Entity {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, new Vector3(x, y, z), 8, { radius: 0.55, height: 0.8 });
    this.kind = "spider";
    this.assets = assets;
    this.direction = Math.random() * Math.PI * 2;
    this.hostile = false;
    this.attackCooldown = 0;
    this.jumpCooldown = 0;
    this.climbing = false;
    this.drops = [
      { item: "String", count: 2 },
      { item: "Spider Eye", count: 1 },
    ];
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player, playerPosition = player?.position, isDay = false } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);
    this.climbing = false;

    if (playerPosition && (this.hostile || !isDay)) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      this.direction = Math.atan2(dx, dz);
      if (distance <= ATTACK_DISTANCE && this.attackCooldown === 0) {
        player?.takeDamage?.(3, this);
        this.attackCooldown = 1;
      } else if (distance <= CHASE_DISTANCE) {
        if (distance <= 5 && this.jumpCooldown === 0 && this.position.y <= playerPosition.y + 0.5) {
          this.velocity.y = 5.5;
          this.jumpCooldown = 1.8;
        }
        const moved = this.moveHorizontal(
          Math.sin(this.direction) * MOVE_SPEED * delta,
          Math.cos(this.direction) * MOVE_SPEED * delta,
        );
        if (!moved && this.#touchingWall()) this.climbing = true;
      }
    } else {
      this.#wander(delta);
    }

    super.update(delta);
  }

  provoke() {
    this.hostile = true;
  }

  applyGravity(delta) {
    if (this.climbing && this.hostile) {
      this.velocity.y = 0;
      this.position.y += 2.4 * delta;
      return;
    }
    super.applyGravity(delta);
  }

  #touchingWall() {
    const x = this.position.x;
    const z = this.position.z;
    const y = Math.floor(this.position.y + 0.35);
    return [
      [Math.floor(x - 0.62), Math.floor(z)],
      [Math.floor(x + 0.62), Math.floor(z)],
      [Math.floor(x), Math.floor(z - 0.62)],
      [Math.floor(x), Math.floor(z + 0.62)],
    ].some(([blockX, blockZ]) =>
      this.world.getBlockAt(blockX, y, blockZ) !== 0
    );
  }

  #wander(delta) {
    this.actionTimer = (this.actionTimer ?? 1) - delta;
    if (this.actionTimer <= 0) {
      this.actionTimer = 1 + Math.random() * 3;
      this.direction += (Math.random() - 0.5) * 2;
    }
    this.moveHorizontal(
      Math.sin(this.direction) * 0.5 * delta,
      Math.cos(this.direction) * 0.5 * delta,
    );
  }

  #buildModel() {
    const body = new Mesh(this.assets.spiderBody, this.assets.spiderMaterial);
    body.position.set(0, 0.34, 0);
    this.addPart(body);
    const head = new Mesh(this.assets.spiderHead, this.assets.spiderMaterial);
    head.position.set(0, 0.42, 0.53);
    this.addPart(head);
    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index += 1) {
        const leg = new Mesh(this.assets.spiderLeg, this.assets.spiderMaterial);
        leg.position.set(side * 0.4, 0.32, (index - 1.5) * 0.28);
        leg.rotation.z = side * 0.65;
        leg.rotation.x = (index < 2 ? -1 : 1) * 0.25;
        this.addPart(leg);
      }
    }
    for (const x of [-0.12, 0.12]) {
      const eye = new Mesh(this.assets.spiderEye, this.assets.spiderEyes);
      eye.position.set(x, 0.5, 0.79);
      this.addPart(eye);
    }
  }
}
