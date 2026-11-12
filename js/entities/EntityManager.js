import { BoxGeometry, MeshLambertMaterial } from "three";
import { Animal } from "./Animal.js";
import { BlockType } from "../world/WorldGenerator.js";

const MAX_ANIMALS = 20;
const DESPAWN_DISTANCE = 28;

export class EntityManager {
  constructor(scene, world, inventory) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.animals = [];
    this.spawnTimer = 0;
    this.assets = {
      body: new BoxGeometry(0.58, 0.62, 0.72),
      head: new BoxGeometry(0.42, 0.42, 0.42),
      leg: new BoxGeometry(0.16, 0.42, 0.16),
      materials: {
        pig: new MeshLambertMaterial({ color: 0xe9a4a8 }),
        sheep: new MeshLambertMaterial({ color: 0xe5e2d7 }),
      },
    };
  }

  update(deltaSeconds, playerPosition) {
    const delta = Math.min(deltaSeconds, 0.05);
    this.spawnTimer -= delta;
    if (this.animals.length < MAX_ANIMALS && this.spawnTimer <= 0) {
      this.#spawnNear(playerPosition);
      this.spawnTimer = 0.3;
    }

    for (let index = this.animals.length - 1; index >= 0; index -= 1) {
      const animal = this.animals[index];
      const dx = animal.position.x - playerPosition.x;
      const dz = animal.position.z - playerPosition.z;
      if (dx * dx + dz * dz > DESPAWN_DISTANCE * DESPAWN_DISTANCE) {
        animal.dispose();
        this.animals.splice(index, 1);
        continue;
      }
      animal.update(delta);
    }
  }

  getMeshes() {
    const meshes = [];
    for (const animal of this.animals) {
      for (const child of animal.group.children) meshes.push(child);
    }
    return meshes;
  }

  damage(animal) {
    if (!this.animals.includes(animal) || !animal.damage()) return false;
    animal.dispose();
    this.animals.splice(this.animals.indexOf(animal), 1);
    this.inventory.addItem(animal.kind === "sheep" ? "wool" : "pork", 1);
    return true;
  }

  dispose() {
    for (const animal of this.animals) animal.dispose();
    this.animals.length = 0;
    this.assets.body.dispose();
    this.assets.head.dispose();
    this.assets.leg.dispose();
    this.assets.materials.pig.dispose();
    this.assets.materials.sheep.dispose();
  }

  #spawnNear(playerPosition) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 14;
      const x = Math.floor(playerPosition.x + Math.cos(angle) * radius);
      const z = Math.floor(playerPosition.z + Math.sin(angle) * radius);
      const y = this.world.generator.getHeightAt(x, z);
      if (
        this.world.getBlockAt(x, y, z) !== BlockType.GRASS ||
        this.world.getBlockAt(x, y + 1, z) !== BlockType.AIR ||
        this.world.getBlockAt(x, y + 2, z) !== BlockType.AIR
      ) {
        continue;
      }
      const kind = Math.random() < 0.5 ? "pig" : "sheep";
      this.animals.push(
        new Animal(this.scene, this.world, x + 0.5, y + 1, z + 0.5, kind, this.assets),
      );
      return;
    }
  }
}
