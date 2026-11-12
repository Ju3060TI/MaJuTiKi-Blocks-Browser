import { PassiveMob } from "./PassiveMob.js";

export class Cow extends PassiveMob {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, x, y, z, "cow", assets, {
      health: 10,
      drops: [
        { item: "Raw Beef", count: 1 },
        { item: "Leather", count: 1 },
      ],
      modelScale: { x: 1.35, y: 1.2, z: 1.4 },
      walkSpeed: 0.45 + Math.random() * 0.2,
    });
  }
}
