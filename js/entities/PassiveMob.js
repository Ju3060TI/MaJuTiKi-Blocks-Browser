import { Mesh, Vector3 } from "three";
import { Entity } from "./Entity.js";

const BODY_RADIUS = 0.34;
const BODY_HEIGHT = 0.92;

export class PassiveMob extends Entity {
  constructor(scene, world, x, y, z, kind, assets, options = {}) {
    super(scene, world, new Vector3(x, y, z), options.health ?? 3, {
      radius: options.radius ?? BODY_RADIUS,
      height: options.height ?? BODY_HEIGHT,
    });
    this.kind = kind;
    this.assets = assets;
    this.drops = options.drops ?? [];
    this.modelScale = options.modelScale ?? { x: 1, y: 1, z: 1 };
    this.walkSpeed = options.walkSpeed ?? 0.55 + Math.random() * 0.35;
    this.direction = Math.random() * Math.PI * 2;
    this.actionTimer = 1 + Math.random() * 3;
    this.fleeTimer = 0;
    this.state = "idle";
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { playerPosition } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    if (playerPosition) {
      const dx = this.position.x - playerPosition.x;
      const dz = this.position.z - playerPosition.z;
      if (Math.hypot(dx, dz) < 4) this.fleeFrom(playerPosition);
    }

    if (this.fleeTimer > 0) {
      this.fleeTimer = Math.max(0, this.fleeTimer - delta);
      this.state = "fleeing";
    } else {
      if (this.state === "fleeing") this.state = "idle";
      this.actionTimer -= delta;
      if (this.actionTimer <= 0) {
        if (this.state === "walking") {
          this.state = "idle";
          this.actionTimer = 1 + Math.random() * 3;
        } else {
          this.state = "walking";
          this.direction += (Math.random() - 0.5) * 2.2;
          this.actionTimer = 1.5 + Math.random() * 3;
        }
      }
    }

    if (this.state === "walking" || this.state === "fleeing") {
      const speed = this.state === "fleeing" ? this.walkSpeed * 1.8 : this.walkSpeed;
      const moved = this.moveHorizontal(
        Math.sin(this.direction) * speed * delta,
        Math.cos(this.direction) * speed * delta,
      );
      if (!moved) this.direction += (Math.random() - 0.5) * Math.PI;
    }

    super.update(delta);
  }

  fleeFrom(position) {
    const dx = this.position.x - position.x;
    const dz = this.position.z - position.z;
    if (dx !== 0 || dz !== 0) this.direction = Math.atan2(dx, dz);
    this.fleeTimer = Math.max(this.fleeTimer, 2.5);
    this.state = "fleeing";
  }

  #buildModel() {
    const material = this.assets.materials[this.kind];
    const body = new Mesh(this.assets.body, material);
    body.position.set(0, 0.57, 0);
    body.scale.set(
      this.modelScale.x,
      0.78 * this.modelScale.y,
      1.35 * this.modelScale.z,
    );
    this.addPart(body);

    const head = new Mesh(this.assets.head, material);
    head.position.set(0, 0.68, 0.48 * this.modelScale.z);
    head.scale.set(this.modelScale.x, this.modelScale.y, this.modelScale.z);
    this.addPart(head);

    for (const x of [-0.2, 0.2]) {
      for (const z of [-0.23, 0.23]) {
        const leg = new Mesh(this.assets.leg, material);
        leg.position.set(x * this.modelScale.x, 0.22 * this.modelScale.y, z * this.modelScale.z);
        this.addPart(leg);
      }
    }
  }
}
