import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const MOVE_SPEED = 5;
const JUMP_SPEED = 8;
const GRAVITY = 22;
const COLLISION_EPSILON = 1e-5;

export class PlayerController {
  constructor(camera, domElement, world, spawnPoint = world.getSpawnPoint()) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;
    this.controls = new PointerLockControls(camera, domElement);
    this.position = { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z };
    this.velocityY = 0;
    this.grounded = false;
    this.keys = new Set();
    this.forward = camera.getWorldDirection(camera.position.clone());
    this.right = camera.position.clone();

    this.onKeyDown = (event) => {
      this.keys.add(event.code);
      if (event.code === "Space" && this.grounded && this.controls.isLocked) {
        this.velocityY = JUMP_SPEED;
        this.grounded = false;
        event.preventDefault();
      }
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    this.onBlur = () => this.keys.clear();
    this.onCanvasClick = () => {
      if (!this.controls.isLocked) this.controls.lock();
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.domElement.addEventListener("click", this.onCanvasClick);
    this.#syncCamera();
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    if (this.controls.isLocked) this.#moveHorizontally(delta);
    this.#applyGravity(delta);
    this.world.update(this.position);
    this.#syncCamera();
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.domElement.removeEventListener("click", this.onCanvasClick);
    this.controls.dispose();
  }

  #moveHorizontally(delta) {
    const forwardAmount = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const strafeAmount = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    if (forwardAmount === 0 && strafeAmount === 0) return;

    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);

    const length = Math.hypot(forwardAmount, strafeAmount);
    const stepX = ((this.forward.x * forwardAmount + this.right.x * strafeAmount) / length) * MOVE_SPEED * delta;
    const stepZ = ((this.forward.z * forwardAmount + this.right.z * strafeAmount) / length) * MOVE_SPEED * delta;
    this.#tryMove("x", stepX);
    this.#tryMove("z", stepZ);
  }

  #applyGravity(delta) {
    if (this.keys.has("Space") && this.grounded && this.controls.isLocked) {
      this.velocityY = JUMP_SPEED;
      this.grounded = false;
    }

    this.velocityY -= GRAVITY * delta;
    const nextY = this.position.y + this.velocityY * delta;
    if (!this.#collidesAt(this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
      this.grounded = false;
      return;
    }

    if (this.velocityY < 0) {
      this.position.y = this.#findGroundHeight(nextY);
      this.grounded = true;
    } else {
      this.position.y = this.#findCeilingHeight(nextY);
    }
    this.velocityY = 0;
  }

  #tryMove(axis, amount) {
    const next = { ...this.position, [axis]: this.position[axis] + amount };
    if (!this.#collidesAt(next.x, next.y, next.z)) {
      this.position[axis] = next[axis];
    }
  }

  #collidesAt(x, feetY, z) {
    const minX = Math.floor(x - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxX = Math.floor(x + PLAYER_RADIUS - COLLISION_EPSILON);
    const minY = Math.floor(feetY + COLLISION_EPSILON);
    const maxY = Math.floor(feetY + PLAYER_HEIGHT - COLLISION_EPSILON);
    const minZ = Math.floor(z - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxZ = Math.floor(z + PLAYER_RADIUS - COLLISION_EPSILON);

    for (let blockX = minX; blockX <= maxX; blockX += 1) {
      for (let blockY = minY; blockY <= maxY; blockY += 1) {
        for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
          if (this.world.getBlockAt(blockX, blockY, blockZ) !== 0) return true;
        }
      }
    }
    return false;
  }

  #findGroundHeight(candidateY) {
    let highestTop = candidateY;
    const minX = Math.floor(this.position.x - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxX = Math.floor(this.position.x + PLAYER_RADIUS - COLLISION_EPSILON);
    const minZ = Math.floor(this.position.z - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxZ = Math.floor(this.position.z + PLAYER_RADIUS - COLLISION_EPSILON);

    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let y = Math.floor(candidateY); y <= Math.floor(this.position.y); y += 1) {
          if (this.world.getBlockAt(x, y, z) !== 0) highestTop = Math.max(highestTop, y + 1);
        }
      }
    }
    return highestTop;
  }

  #findCeilingHeight(candidateY) {
    let lowestBottom = candidateY + PLAYER_HEIGHT;
    const minX = Math.floor(this.position.x - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxX = Math.floor(this.position.x + PLAYER_RADIUS - COLLISION_EPSILON);
    const minZ = Math.floor(this.position.z - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxZ = Math.floor(this.position.z + PLAYER_RADIUS - COLLISION_EPSILON);
    const minY = Math.floor(this.position.y + PLAYER_HEIGHT);
    const maxY = Math.floor(candidateY + PLAYER_HEIGHT);

    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          if (this.world.getBlockAt(x, y, z) !== 0) lowestBottom = Math.min(lowestBottom, y);
        }
      }
    }
    return lowestBottom - PLAYER_HEIGHT;
  }

  #syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }
}
