import { PassiveMob } from "./PassiveMob.js";

export class Chicken extends PassiveMob {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, x, y, z, "chicken", assets, {
      health: 4,
      radius: 0.22,
      height: 0.8,
      drops: [
        { item: "Feather", count: 1 },
        { item: "Raw Chicken", count: 1 },
      ],
      modelScale: { x: 0.72, y: 0.75, z: 0.72 },
      walkSpeed: 0.7 + Math.random() * 0.25,
    });
  }

  applyGravity(delta) {
    this.velocity.y -= 5 * delta;
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
}
