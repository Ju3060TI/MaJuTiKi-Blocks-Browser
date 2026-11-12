import { Mesh, Vector3 } from "three";
import { BlockType, ITEMS } from "../world/blocks.js";
import { Entity } from "./Entity.js";

const KEEP_DISTANCE = 8;
const RETREAT_DISTANCE = 5;
const SHOOT_DISTANCE = 20;
const MOVE_SPEED = 1.25;
const ARROW_SPEED = 12;

export class Skeleton extends Entity {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, new Vector3(x, y, z), 4, { radius: 0.3, height: 1.8 });
    this.kind = "skeleton";
    this.drops = [{ item: ITEMS.BONE, count: 1 }];
    this.assets = assets;
    this.direction = Math.random() * Math.PI * 2;
    this.shootCooldown = 1 + Math.random();
    this.arrows = [];
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { player, playerPosition = player?.position } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);

    if (playerPosition) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > KEEP_DISTANCE) {
        this.direction = Math.atan2(dx, dz);
        if (distance > KEEP_DISTANCE + 1) {
          this.moveHorizontal(
            Math.sin(this.direction) * MOVE_SPEED * delta,
            Math.cos(this.direction) * MOVE_SPEED * delta,
          );
        }
      } else if (distance < RETREAT_DISTANCE) {
        this.direction = Math.atan2(-dx, -dz);
        this.moveHorizontal(
          Math.sin(this.direction) * MOVE_SPEED * delta,
          Math.cos(this.direction) * MOVE_SPEED * delta,
        );
      }

      if (distance <= SHOOT_DISTANCE && this.shootCooldown === 0) {
        this.#shootArrow(playerPosition);
        this.shootCooldown = 2;
      }
    }

    this.#updateArrows(delta, player);
    super.update(delta);
  }

  die() {
    if (!this.alive) return;
    for (const arrow of this.arrows) this.scene.remove(arrow.mesh);
    this.arrows.length = 0;
    super.die();
  }

  #shootArrow(playerPosition) {
    const start = new Vector3(this.position.x, this.position.y + 1.45, this.position.z);
    const target = new Vector3(playerPosition.x, playerPosition.y + 0.9, playerPosition.z);
    const velocity = target.sub(start).normalize().multiplyScalar(ARROW_SPEED);
    const mesh = new Mesh(this.assets.arrowGeometry, this.assets.arrowMaterial);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), velocity.clone().normalize());
    this.scene.add(mesh);
    this.arrows.push({ mesh, position: start, velocity, age: 0 });
  }

  #updateArrows(delta, player) {
    const playerPosition = player?.position;
    for (let index = this.arrows.length - 1; index >= 0; index -= 1) {
      const arrow = this.arrows[index];
      arrow.age += delta;
      arrow.velocity.y -= 2.5 * delta;
      arrow.position.addScaledVector(arrow.velocity, delta);
      arrow.mesh.position.copy(arrow.position);
      arrow.mesh.quaternion.setFromUnitVectors(
        new Vector3(0, 0, 1),
        arrow.velocity.clone().normalize(),
      );

      const blocked =
        this.world.getBlockAt(
          Math.floor(arrow.position.x),
          Math.floor(arrow.position.y),
          Math.floor(arrow.position.z),
        ) !== BlockType.AIR;
      const hitPlayer = playerPosition && arrow.position.distanceTo(
        new Vector3(playerPosition.x, playerPosition.y + 0.9, playerPosition.z),
      ) < 0.5;
      if (hitPlayer) player.takeDamage?.(1, this);
      if (blocked || hitPlayer || arrow.age > 3) {
        this.scene.remove(arrow.mesh);
        this.arrows.splice(index, 1);
      }
    }
  }

  #buildModel() {
    const parts = [
      [this.assets.skeletonBody, this.assets.skeletonMaterial, 0, 0.95, 0],
      [this.assets.skeletonHead, this.assets.skeletonMaterial, 0, 1.62, 0],
      [this.assets.skeletonLimb, this.assets.skeletonMaterial, -0.22, 0.35, 0],
      [this.assets.skeletonLimb, this.assets.skeletonMaterial, 0.22, 0.35, 0],
    ];
    for (const [geometry, material, x, y, z] of parts) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.addPart(mesh);
    }
  }
}
