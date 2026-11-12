import { PassiveMob } from "./PassiveMob.js";

export class Sheep extends PassiveMob {
  constructor(scene, world, x, y, z, assets) {
    super(scene, world, x, y, z, "sheep", assets, {
      health: 8,
      drops: [
        { item: "Wool", count: 1 },
        { item: "Raw Mutton", count: 1 },
      ],
      modelScale: { x: 1.15, y: 1.1, z: 1.2 },
    });
  }
}
