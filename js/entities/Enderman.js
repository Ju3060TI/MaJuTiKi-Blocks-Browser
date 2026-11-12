import { Raycaster, Vector2, Vector3 } from "three";
import { Entity } from "./Entity.js";

const AGGRO_DISTANCE = 32;
const ATTACK_DISTANCE = 1.8;
const MOVE_SPEED = 2.1;

export class Enderman extends Entity {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, new Vector3(x, y, z), 40, { radius: 0.35, height: 2.9 });
    this.kind = "enderman";
    this.assets = assets;
    this.direction = Math.random() * Math.PI * 2;
    this.hostile = false;
    this.attackCooldown = 0;
    this.teleportCooldown = 0;
    this.drops = [{ item: "Ender Pearl", count: 1 }];
    this.headMesh = null;
    this.raycaster = new Raycaster();
    this.raycaster.far = AGGRO_DISTANCE;
    this.screenCenter = new Vector2(0, 0);
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player, playerPosition = player?.position, isDay = false } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.teleportCooldown = Math.max(0, this.teleportCooldown - delta);
    if (!this.hostile && this.#isPlayerLooking(player?.camera)) this.hostile = true;

    if (this.hostile && playerPosition) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      this.direction = Math.atan2(dx, dz);
      if (distance <= ATTACK_DISTANCE && this.attackCooldown === 0) {
        player?.takeDamage?.(7, this);
        this.attackCooldown = 1.4;
      } else if (distance <= AGGRO_DISTANCE) {
        if (this.teleportCooldown === 0 && distance > 5) {
          this.#teleportNear(playerPosition);
          this.teleportCooldown = 3 + Math.random() * 2;
        } else {
          this.moveHorizontal(
            Math.sin(this.direction) * MOVE_SPEED * delta,
            Math.cos(this.direction) * MOVE_SPEED * delta,
          );
        }
      }
    }
    super.update(delta);
  }

  #isPlayerLooking(camera) {
    if (!camera || !this.headMesh) return false;
    camera.updateMatrixWorld();
    this.mesh.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.screenCenter, camera);
    return this.raycaster.intersectObject(this.headMesh, false).length > 0;
  }

  #teleportNear(target) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 4 + Math.random() * 5;
      const x = target.x + Math.cos(angle) * distance;
      const z = target.z + Math.sin(angle) * distance;
      const y = this.world.generator.getHeightAt(Math.floor(x), Math.floor(z)) + 1;
      if (
        Math.abs(y - this.position.y) > 5 ||
        this.collidesAt(x, y, z)
      ) {
        continue;
      }
      this.position.set(x, y, z);
      this.velocity.y = 0;
      this.syncTransform();
      return;
    }
  }

  #buildModel() {
    const body = new Mesh(this.assets.endermanBody, this.assets.endermanMaterial);
    body.position.set(0, 1.15, 0);
    body.scale.set(0.75, 1.3, 0.7);
    this.addPart(body);

    this.headMesh = new Mesh(this.assets.endermanHead, this.assets.endermanMaterial);
    this.headMesh.position.set(0, 2.55, 0);
    this.headMesh.scale.set(0.82, 0.9, 0.82);
    this.addPart(this.headMesh);

    for (const x of [-0.12, 0.12]) {
      const eye = new Mesh(this.assets.endermanEye, this.assets.endermanEyes);
      eye.position.set(x, 2.58, 0.203);
      this.addPart(eye);
    }

    for (const x of [-0.24, 0.24]) {
      const limb = new Mesh(this.assets.endermanLimb, this.assets.endermanMaterial);
      limb.position.set(x, 0.5, 0);
      limb.scale.y = 1.35;
      this.addPart(limb);
      const arm = new Mesh(this.assets.endermanLimb, this.assets.endermanMaterial);
      arm.position.set(x * 1.5, 1.45, 0);
      arm.scale.y = 1.5;
      this.addPart(arm);
    }
  }
}
