import { Mesh, Vector3 } from "three";
import { Entity } from "./Entity.js";

const FUSE_SECONDS = 1.5;
const IGNITION_DISTANCE = 2;
const EXPLOSION_RADIUS = 4;
const BLOCK_RADIUS = 3;
const EXPLOSION_DAMAGE = 14;

export class Creeper extends Entity {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, new Vector3(x, y, z), 10, { radius: 0.32, height: 1.8 });
    this.kind = "creeper";
    this.isTameable = true;
    this.assets = assets;
    this.direction = Math.random() * Math.PI * 2;
    this.walkSpeed = 0.8;
    this.fuseRemaining = null;
    this.flashTimer = 0;
    this.exploded = false;
    this.material = this.assets.creeperMaterial.clone();
    this.material.color.setHex(0x55a844);
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player, playerPosition = player?.position } = {}) {
    if (!this.alive || this.exploded) return;
    const delta = Math.min(deltaTime, 0.05);
    if (playerPosition) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= IGNITION_DISTANCE && Math.abs(playerPosition.y - this.position.y) < 2) {
        if (this.fuseRemaining === null) this.fuseRemaining = FUSE_SECONDS;
        this.fuseRemaining -= delta;
        this.#updateFuse(delta);
        if (this.fuseRemaining <= 0) {
          this.#explode(player);
          return;
        }
      } else if (this.fuseRemaining === null) {
        this.direction = Math.atan2(dx, dz);
        if (distance <= 14) {
          this.moveHorizontal(
            Math.sin(this.direction) * this.walkSpeed * delta,
            Math.cos(this.direction) * this.walkSpeed * delta,
          );
        }
      }
    }
    super.update(delta);
  }

  die() {
    if (!this.alive) return;
    super.die();
    this.material.dispose();
  }

  #updateFuse(delta) {
    this.flashTimer += delta;
    if (this.flashTimer >= 0.1) {
      this.flashTimer = 0;
      const flash = Math.ceil(this.fuseRemaining * 10) % 2 === 0;
      this.material.color.setHex(flash ? 0xffffff : 0x55a844);
      this.material.emissive.setHex(flash ? 0xffffff : 0x000000);
      this.material.emissiveIntensity = flash ? 0.8 : 0;
      const swell = 1 + (1 - Math.max(0, this.fuseRemaining) / FUSE_SECONDS) * 0.45;
      this.mesh.scale.setScalar(swell);
    }
  }

  #explode(player) {
    this.exploded = true;
    const dx = player.position.x - this.position.x;
    const dy = player.position.y + 0.9 - (this.position.y + 0.8);
    const dz = player.position.z - this.position.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance <= EXPLOSION_RADIUS) {
      const damage = Math.ceil(EXPLOSION_DAMAGE * (1 - distance / (EXPLOSION_RADIUS * 1.5)));
      player.takeDamage?.(Math.max(1, damage), this);
    }

    const centerX = Math.floor(this.position.x);
    const centerY = Math.floor(this.position.y + 0.5);
    const centerZ = Math.floor(this.position.z);
    for (let x = centerX - BLOCK_RADIUS; x <= centerX + BLOCK_RADIUS; x += 1) {
      for (let y = centerY - BLOCK_RADIUS; y <= centerY + BLOCK_RADIUS; y += 1) {
        for (let z = centerZ - BLOCK_RADIUS; z <= centerZ + BLOCK_RADIUS; z += 1) {
          if (Math.hypot(x - centerX, y - centerY, z - centerZ) > BLOCK_RADIUS) continue;
          if (this.world.getBlockAt(x, y, z) !== 0) this.world.breakBlock(x, y, z);
        }
      }
    }
    this.die();
  }

  #buildModel() {
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
  }
}
