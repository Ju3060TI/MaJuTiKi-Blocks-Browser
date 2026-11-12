import { Mesh, Vector3 } from "three";
import { Entity } from "./Entity.js";

const CHASE_DISTANCE = 32;
const ATTACK_DISTANCE = 1.7;
const MOVE_SPEED = 2.2;
const TELEPORT_INTERVAL_MIN = 4;
const TELEPORT_INTERVAL_MAX = 7;
const TELEPORT_DISTANCE_MIN = 4;
const TELEPORT_DISTANCE_MAX = 8;

export class Herobrine extends Entity {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, new Vector3(x, y, z), 100, { radius: 0.36, height: 1.9 });
    this.kind = "herobrine";
    this.assets = assets;
    this.direction = Math.random() * Math.PI * 2;
    this.attackDamage = 8;
    this.attackCooldown = 0;
    this.teleportTimer = this.#nextTeleportInterval();
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player, playerPosition = player?.position, entities = [] } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.teleportTimer -= delta;

    const targets = [];
    if (playerPosition && player?.takeDamage) {
      targets.push({ entity: player, position: playerPosition });
    }
    for (const entity of entities) {
      if (entity.alive && entity.kind === "villager") {
        targets.push({ entity, position: entity.position });
      }
    }
    targets.sort((left, right) =>
      this.#distanceTo(left.position) - this.#distanceTo(right.position)
    );
    const target = targets[0];

    if (target) {
      const distance = this.#distanceTo(target.position);
      this.direction = Math.atan2(
        target.position.x - this.position.x,
        target.position.z - this.position.z,
      );
      if (distance <= ATTACK_DISTANCE && this.attackCooldown === 0) {
        target.entity.takeDamage(this.attackDamage, this);
        this.attackCooldown = 1.2;
      } else if (distance <= CHASE_DISTANCE) {
        this.moveHorizontal(
          Math.sin(this.direction) * MOVE_SPEED * delta,
          Math.cos(this.direction) * MOVE_SPEED * delta,
        );
      }
    }

    if (this.teleportTimer <= 0) {
      this.#teleport();
      this.teleportTimer = this.#nextTeleportInterval();
    }

    super.update(delta);
  }

  #distanceTo(position) {
    return Math.hypot(
      position.x - this.position.x,
      position.z - this.position.z,
    );
  }

  #nextTeleportInterval() {
    return TELEPORT_INTERVAL_MIN +
      Math.random() * (TELEPORT_INTERVAL_MAX - TELEPORT_INTERVAL_MIN);
  }

  #teleport() {
    const angle = Math.random() * Math.PI * 2;
    const distance = TELEPORT_DISTANCE_MIN +
      Math.random() * (TELEPORT_DISTANCE_MAX - TELEPORT_DISTANCE_MIN);
    const x = this.position.x + Math.sin(angle) * distance;
    const z = this.position.z + Math.cos(angle) * distance;
    const groundY = this.world.generator.getHeightAt(Math.floor(x), Math.floor(z)) + 1;
    if (
      Math.abs(groundY - this.position.y) > 4 ||
      this.collidesAt(x, groundY, z)
    ) {
      return;
    }
    this.position.set(x, groundY, z);
    this.velocity.y = 0;
    this.syncTransform();
  }

  #buildModel() {
    const body = new Mesh(this.assets.herobrineBody, this.assets.herobrineRobe);
    body.position.set(0, 0.9, 0);
    this.addPart(body);

    const head = new Mesh(this.assets.herobrineHead, this.assets.herobrineSkin);
    head.position.set(0, 1.62, 0);
    this.addPart(head);

    for (const x of [-0.11, 0.11]) {
      const eye = new Mesh(this.assets.herobrineEye, this.assets.herobrineEyes);
      eye.position.set(x, 1.66, 0.244);
      this.addPart(eye);
    }

    for (const x of [-0.38, 0.38]) {
      const arm = new Mesh(this.assets.herobrineLimb, this.assets.herobrineRobe);
      arm.position.set(x, 0.7, 0);
      this.addPart(arm);

      const leg = new Mesh(this.assets.herobrineLimb, this.assets.herobrinePants);
      leg.position.set(x * 0.55, 0.12, 0);
      this.addPart(leg);
    }
  }
}
