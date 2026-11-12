import { PassiveMob } from "./PassiveMob.js";

export class Pig extends PassiveMob {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, x, y, z, "pig", assets, {
      health: 6,
      drops: [{ item: "Raw Porkchop", count: 1 }],
      modelScale: { x: 1, y: 0.9, z: 1.15 },
    });
  }
}
