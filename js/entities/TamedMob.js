import { Mesh, Vector3 } from "three";
import { Entity } from "./Entity.js";

const FOLLOW_DISTANCE = 2.5;
const ATTACK_DISTANCE = 1.4;
const ATTACK_RANGE = 24;
const FOLLOW_SPEED = 2.8;
const ATTACK_DAMAGE = 3;
const HOSTILE_KINDS = new Set([
  "zombie",
  "skeleton",
  "spider",
  "creeper",
  "enderman",
  "herobrine",
]);

export class TamedMob extends Entity {
  constructor(scene, world, position, owner, assets, kind = "tamed-zombie") {
    super(scene, world, position.clone(), 10, { radius: 0.32, height: 1.8 });
    this.kind = kind;
    this.owner = owner;
    this.assets = assets;
    this.attackCooldown = 0;
    this.material = (
      kind === "friendly-creeper"
        ? assets.friendlyCreeperMaterial
        : assets.tamedMobMaterial
    ).clone();
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player = this.owner, entities = [], disableCombat = false } = {}) {
    if (!this.alive || !player?.position) return;
    const delta = Math.min(deltaTime, 0.05);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    const ownerPosition = player.position;
    const target = disableCombat ? null : this.#getThreat(player, entities);

    if (target) {
      const dx = target.position.x - this.position.x;
      const dz = target.position.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      this.direction = Math.atan2(dx, dz);
      if (distance > ATTACK_DISTANCE) {
        this.moveHorizontal(
          Math.sin(this.direction) * FOLLOW_SPEED * delta,
          Math.cos(this.direction) * FOLLOW_SPEED * delta,
        );
      } else if (this.attackCooldown === 0) {
        target.takeDamage(ATTACK_DAMAGE, this);
        this.attackCooldown = 0.9;
      }
    } else {
      const dx = ownerPosition.x - this.position.x;
      const dz = ownerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > FOLLOW_DISTANCE) {
        this.direction = Math.atan2(dx, dz);
        const step = Math.min(FOLLOW_SPEED * delta, distance - FOLLOW_DISTANCE);
        this.moveHorizontal(
          Math.sin(this.direction) * step,
          Math.cos(this.direction) * step,
        );
      }
    }

    super.update(delta);
  }

  die() {
    if (!this.alive) return;
    super.die();
    this.material.dispose();
  }

  #getThreat(player, entities) {
    const attacker = player.lastAttacker;
    if (
      attacker?.alive &&
      attacker !== this &&
      attacker.owner !== player &&
      Math.hypot(
        attacker.position.x - this.position.x,
        attacker.position.z - this.position.z,
      ) <= ATTACK_RANGE
    ) {
      return attacker;
    }

    return entities
      .filter((entity) =>
        entity.alive &&
        HOSTILE_KINDS.has(entity.kind) &&
        Math.hypot(
          entity.position.x - player.position.x,
          entity.position.z - player.position.z,
        ) <= 5
      )
      .sort((left, right) =>
        Math.hypot(
          left.position.x - this.position.x,
          left.position.z - this.position.z,
        ) - Math.hypot(
          right.position.x - this.position.x,
          right.position.z - this.position.z,
        )
      )[0] ?? null;
  }

  #buildModel() {
    if (this.kind === "friendly-creeper") {
      const body = new Mesh(this.assets.creeperBody, this.material);
      body.position.set(0, 0.95, 0);
      this.addPart(body);
      const head = new Mesh(this.assets.creeperHead, this.material);
      head.position.set(0, 1.62, 0);
      this.addPart(head);
      for (const x of [-0.2, 0.2]) {
        for (const z of [-0.18, 0.18]) {
          const leg = new Mesh(this.assets.creeperLeg, this.material);
          leg.position.set(x, 0.2, z);
          this.addPart(leg);
        }
      }
    } else {
      const body = new Mesh(this.assets.zombieBody, this.material);
      body.position.set(0, 0.95, 0);
      this.addPart(body);
      const head = new Mesh(this.assets.zombieHead, this.material);
      head.position.set(0, 1.62, 0);
      this.addPart(head);
      for (const x of [-0.22, 0.22]) {
        const limb = new Mesh(this.assets.zombieLimb, this.material);
        limb.position.set(x, 0.35, 0);
        this.addPart(limb);
      }
    }

    const collar = new Mesh(this.assets.tamedCollar, this.assets.tamedCollarMaterial);
    collar.position.set(0, 1.31, 0);
    this.addPart(collar);
  }
}
