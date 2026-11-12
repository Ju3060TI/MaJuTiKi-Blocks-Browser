import { Group, Mesh } from "three";

const BODY_RADIUS = 0.34;
const BODY_HEIGHT = 0.92;
const GRAVITY = 20;

export class Animal {
  constructor(scene, world, x, y, z, kind, assets) {
    this.scene = scene;
    this.world = world;
    this.kind = kind;
    this.assets = assets;
    this.position = { x, y, z };
    this.velocityY = 0;
    this.direction = Math.random() * Math.PI * 2;
    this.walkSpeed = 0.55 + Math.random() * 0.35;
    this.actionTimer = 1 + Math.random() * 3;
    this.health = 3;
    this.state = "idle";
    this.group = new Group();
    this.#buildModel();
    this.scene.add(this.group);
    this.#syncTransform();
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
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

    if (this.state === "walking") {
      const step = this.walkSpeed * delta;
      const nextX = this.position.x + Math.sin(this.direction) * step;
      const nextZ = this.position.z + Math.cos(this.direction) * step;
      if (!this.#collidesAt(nextX, this.position.y, this.position.z)) {
        this.position.x = nextX;
      } else {
        this.direction += Math.PI * (0.55 + Math.random() * 0.4);
      }
      if (!this.#collidesAt(this.position.x, this.position.y, nextZ)) {
        this.position.z = nextZ;
      } else {
        this.direction += Math.PI * (0.55 + Math.random() * 0.4);
      }
    }

    this.velocityY -= GRAVITY * delta;
    const nextY = this.position.y + this.velocityY * delta;
    if (!this.#collidesAt(this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
    } else if (this.velocityY < 0) {
      this.position.y = this.#findGround(nextY);
      this.velocityY = 0;
    } else {
      this.velocityY = 0;
    }
    this.#syncTransform();
  }

  damage() {
    this.health -= 1;
    return this.health <= 0;
  }

  dispose() {
    this.scene.remove(this.group);
  }

  #buildModel() {
    const body = new Mesh(this.assets.body, this.assets.materials[this.kind]);
    body.position.set(0, 0.57, 0);
    body.scale.set(1, 0.78, 1.35);
    body.userData.animal = this;
    this.group.add(body);

    const head = new Mesh(this.assets.head, this.assets.materials[this.kind]);
    head.position.set(0, 0.68, 0.48);
    head.userData.animal = this;
    this.group.add(head);

    for (const x of [-0.2, 0.2]) {
      for (const z of [-0.23, 0.23]) {
        const leg = new Mesh(this.assets.leg, this.assets.materials[this.kind]);
        leg.position.set(x, 0.22, z);
        leg.userData.animal = this;
        this.group.add(leg);
      }
    }
  }

  #collidesAt(x, feetY, z) {
    const minX = Math.floor(x - BODY_RADIUS);
    const maxX = Math.floor(x + BODY_RADIUS);
    const minZ = Math.floor(z - BODY_RADIUS);
    const maxZ = Math.floor(z + BODY_RADIUS);
    const minY = Math.floor(feetY + 1e-4);
    const maxY = Math.floor(feetY + BODY_HEIGHT - 1e-4);
    for (let blockX = minX; blockX <= maxX; blockX += 1) {
      for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
        for (let blockY = minY; blockY <= maxY; blockY += 1) {
          if (blockY < 0 || this.world.getBlockAt(blockX, blockY, blockZ) !== 0) return true;
        }
      }
    }
    return feetY < 0;
  }

  #findGround(candidateY) {
    const minX = Math.floor(this.position.x - BODY_RADIUS);
    const maxX = Math.floor(this.position.x + BODY_RADIUS);
    const minZ = Math.floor(this.position.z - BODY_RADIUS);
    const maxZ = Math.floor(this.position.z + BODY_RADIUS);
    let highest = 0;
    for (let blockX = minX; blockX <= maxX; blockX += 1) {
      for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
        for (let blockY = Math.max(0, Math.floor(candidateY)); blockY <= Math.floor(this.position.y); blockY += 1) {
          if (this.world.getBlockAt(blockX, blockY, blockZ) !== 0) highest = Math.max(highest, blockY + 1);
        }
      }
    }
    return highest;
  }

  #syncTransform() {
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.group.rotation.y = this.direction;
  }
}
