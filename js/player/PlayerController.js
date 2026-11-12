import { Raycaster, Vector2 } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { ToolType } from "../inventory/InventoryManager.js";
import { BlockType, CHUNK_SIZE, WORLD_HEIGHT } from "../world/WorldGenerator.js";
import { ITEMS } from "../world/blocks.js";
import { MagicSystem } from "../systems/MagicSystem.js";

const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const MOVE_SPEED = 5;
const JUMP_SPEED = 8;
const GRAVITY = 22;
const SWIM_SPEED = 3.5;
const WATER_GRAVITY_SCALE = 0.18;
const COLLISION_EPSILON = 1e-5;
const BASE_MAX_HEALTH = 20;
const DAMAGE_COOLDOWN = 1;

export class PlayerController {
  constructor(
    camera,
    domElement,
    world,
    spawnPoint = world.getSpawnPoint(),
    inventory = null,
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;
    this.inventory = inventory;
    this.spawnPoint = { ...spawnPoint };
    this.controls = new PointerLockControls(camera, domElement);
    this.raycaster = new Raycaster();
    this.raycaster.far = 6;
    this.screenCenter = new Vector2(0, 0);
    this.miningHeld = false;
    this.miningTarget = null;
    this.miningElapsed = 0;
    this.position = { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z };
    this.velocityY = 0;
    this.grounded = false;
    this.maxHealth = BASE_MAX_HEALTH;
    this.health = this.maxHealth;
    this.baseDamage = 1;
    this.moveSpeed = MOVE_SPEED;
    this.mana = 0;
    this.characterStatsApplied = false;
    this.damageCooldown = 0;
    this.healthElement = document.querySelector("#health");
    this.healthBar = document.querySelector("#health-fill");
    this.healthLabel = document.querySelector("#health-label");
    this.keys = new Set();
    this.experience = 0;
    this.gameSettings = window.gameSettings ?? { gameMode: "vanilla", rpgClass: "survivor" };
    this.magicSystem = new MagicSystem(this, world, camera, inventory);
    this.forward = camera.getWorldDirection(camera.position.clone());
    this.right = camera.position.clone();

    this.onKeyDown = (event) => {
      this.keys.add(event.code);
      if (event.code === "KeyQ" && !event.repeat && this.controls.isLocked) {
        this.#dropSelectedItem();
        event.preventDefault();
        return;
      }
      if (
        event.code === "Space" &&
        this.gameSettings.gameMode !== "creative" &&
        this.grounded &&
        this.controls.isLocked
      ) {
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
    this.onMouseDown = (event) => {
      if (event.button === 2 && this.controls.isLocked && this.magicSystem.handleRightClick()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.button !== 0 || !this.controls.isLocked) return;
      this.miningHeld = true;
      this.miningElapsed = 0;
    };
    this.onMouseUp = (event) => {
      if (event.button === 0) this.#stopMining();
    };
    this.onUnlock = () => this.#stopMining();
    this.onGameSettingsChange = (event) => this.setGameSettings(event.detail);
    this.onCharacterCreated = (event) => {
      this.setGameSettings(event.detail);
      this.applyCharacterStats();
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("mouseup", this.onMouseUp);
    this.domElement.addEventListener("mousedown", this.onMouseDown);
    this.domElement.addEventListener("click", this.onCanvasClick);
    this.controls.addEventListener("unlock", this.onUnlock);
    window.addEventListener("gamesettingschange", this.onGameSettingsChange);
    window.addEventListener("charactercreated", this.onCharacterCreated);
    this.#syncCamera();
    this.#renderHealth();
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    this.damageCooldown = Math.max(0, this.damageCooldown - delta);
    if (this.controls.isLocked) this.#moveHorizontally(delta);
    if (this.gameSettings.gameMode === "creative") {
      this.#flyVertically(delta);
    } else {
      this.#applyGravity(delta);
    }
    this.world.update(this.position);
    this.#syncCamera();
    this.#updateMining(delta);
    this.world.updateItemDrops(delta, this, this.inventory);
    this.magicSystem.update(delta);
  }

  dispose() {
    this.#stopMining();
    this.magicSystem.dispose();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.domElement.removeEventListener("mousedown", this.onMouseDown);
    this.domElement.removeEventListener("click", this.onCanvasClick);
    this.controls.removeEventListener("unlock", this.onUnlock);
    window.removeEventListener("gamesettingschange", this.onGameSettingsChange);
    window.removeEventListener("charactercreated", this.onCharacterCreated);
    this.controls.dispose();
  }

  cancelMining() {
    this.#stopMining();
  }

  setGameSettings(settings = {}) {
    this.gameSettings = { ...this.gameSettings, ...settings };
    if (this.gameSettings.gameMode === "creative") this.velocityY = 0;
    this.#renderHealth();
  }

  applyCharacterStats() {
    if (this.characterStatsApplied) return;
    const race = this.gameSettings.playerRace ?? "human";
    const playerClass = this.gameSettings.playerClass ?? "warrior";
    const raceStats = {
      human: { health: 0, speed: 0, mana: 0 },
      elf: { health: 0, speed: 2, mana: playerClass === "mage" ? 50 : 25 },
      dwarf: { health: 4, speed: -0.5, mana: 0 },
      zombie: { health: 6, speed: 0, mana: 0 },
      skeleton: { health: -2, speed: 1, mana: 0 },
    }[race] ?? { health: 0, speed: 0, mana: 0 };
    const classStats = {
      warrior: { damage: 2, speed: 0, mana: 0 },
      mage: { damage: 0, speed: 0, mana: race === "elf" ? 0 : 50 },
      archer: { damage: 0, speed: 1, mana: 0 },
      rogue: { damage: 1, speed: 1, mana: 0 },
    }[playerClass] ?? { damage: 0, speed: 0, mana: 0 };

    this.maxHealth = Math.max(1, BASE_MAX_HEALTH + raceStats.health);
    this.health = this.maxHealth;
    this.baseDamage = 1 + classStats.damage;
    this.moveSpeed = Math.max(1, MOVE_SPEED + raceStats.speed + classStats.speed);
    this.mana = raceStats.mana + classStats.mana;
    this.#applyFactionSpawn();
    this.#grantClassEquipment(playerClass);
    this.characterStatsApplied = true;
    this.#renderHealth();
  }

  getAttackDamage() {
    return this.baseDamage + (this.inventory?.getWeaponDamage() ?? 0);
  }

  tryTameMob(entity) {
    if (!entity?.isTameable) return false;
    if (this.inventory?.getSelectedTamingItem() !== ITEMS.BONE) {
      if (this.inventory?.messageElement) {
        this.inventory.messageElement.textContent = "Wähle einen Knochen im Inventar, um zu zähmen.";
      }
      return false;
    }
    if (!this.inventory.removeItem(ITEMS.BONE, 1)) return false;
    if (Math.random() < 0.3) {
      if (this.inventory.messageElement) {
        this.inventory.messageElement.textContent = `${entity.kind} gezähmt!`;
      }
      return true;
    }
    if (this.inventory.messageElement) {
      this.inventory.messageElement.textContent = "Zähmen fehlgeschlagen. Der Knochen ist verbraucht.";
    }
    return false;
  }

  awardExperience(amount) {
    if (Number.isFinite(amount) && amount > 0) {
      this.experience += Math.floor(amount);
    }
  }

  spendExperience(amount) {
    if (!Number.isInteger(amount) || amount <= 0 || this.experience < amount) return false;
    this.experience -= amount;
    return true;
  }

  heal(amount = 1) {
    if (this.gameSettings.gameMode === "creative" || amount <= 0) return false;
    const nextHealth = Math.min(this.maxHealth, this.health + amount);
    if (nextHealth === this.health) return false;
    this.health = nextHealth;
    this.#renderHealth();
    return true;
  }

  applyWeaponHit(target) {
    this.magicSystem.applyWeaponHit(target);
  }

  takeDamage(amount = 1, source = null) {
    if (this.gameSettings.gameMode === "creative") return false;
    if (
      this.gameSettings.gameMode === "rpg" &&
      this.gameSettings.rpgClass === "monster" &&
      source?.kind === "zombie"
    ) {
      return false;
    }
    if (this.damageCooldown > 0 || this.health <= 0) return false;
    const damage = Math.max(0, amount - (this.inventory?.getArmorReduction() ?? 0));
    if (damage === 0) return false;
    this.lastAttacker = source;
    this.health = Math.max(0, this.health - damage);
    this.damageCooldown = DAMAGE_COOLDOWN;
    if (this.health === 0) this.#respawn();
    this.#renderHealth();
    return true;
  }

  #respawn() {
    this.position = { ...this.spawnPoint };
    this.velocityY = 0;
    this.grounded = false;
    this.health = this.maxHealth;
    this.lastAttacker = null;
    this.inventory?.clear();
  }

  #renderHealth() {
    if (this.healthElement) {
      this.healthElement.hidden = this.gameSettings.gameMode === "creative";
    }
    if (this.healthBar) {
      this.healthBar.style.width = `${(this.health / this.maxHealth) * 100}%`;
    }
    this.healthElement?.setAttribute("aria-valuenow", String(this.health));
    this.healthElement?.setAttribute("aria-valuemax", String(this.maxHealth));
    if (this.healthLabel) this.healthLabel.textContent = `Health ${this.health} / ${this.maxHealth}`;
  }

  #applyFactionSpawn() {
    const faction = this.gameSettings.playerFaction;
    if (faction === "elves" || faction === "villager") {
      const centerChunkX = Math.floor(this.position.x / CHUNK_SIZE);
      const centerChunkZ = Math.floor(this.position.z / CHUNK_SIZE);
      const renderDistance = Number(window.gameSettings?.renderDistance ?? 4);
      const radius = Math.max(1, Math.min(10, Math.ceil(renderDistance)));
      for (let distance = 0; distance <= radius; distance += 1) {
        for (let chunkX = centerChunkX - distance; chunkX <= centerChunkX + distance; chunkX += 1) {
          for (let chunkZ = centerChunkZ - distance; chunkZ <= centerChunkZ + distance; chunkZ += 1) {
            if (
              Math.max(
                Math.abs(chunkX - centerChunkX),
                Math.abs(chunkZ - centerChunkZ),
              ) !== distance
            ) {
              continue;
            }
            const farmX = chunkX * CHUNK_SIZE + 2;
            const farmZ = chunkZ * CHUNK_SIZE + 7;
            const terrainY = this.world.generator.getHeightAt(farmX, farmZ);
            for (
              let y = Math.max(1, terrainY - 3);
              y <= Math.min(WORLD_HEIGHT - 3, terrainY + 3);
              y += 1
            ) {
              if (this.world.getBlockAt(farmX, y, farmZ) !== BlockType.FARMLAND) continue;
              const spawn = { x: chunkX * CHUNK_SIZE + 8.5, y: y + 1, z: chunkZ * CHUNK_SIZE + 12.5 };
              if (
                this.world.getBlockAt(Math.floor(spawn.x), spawn.y, Math.floor(spawn.z)) === BlockType.AIR &&
                this.world.getBlockAt(Math.floor(spawn.x), spawn.y + 1, Math.floor(spawn.z)) === BlockType.AIR
              ) {
                this.spawnPoint = spawn;
                this.position = { ...spawn };
                this.world.update(this.position);
                this.#syncCamera();
                return;
              }
            }
          }
        }
      }
      return;
    }

    if (faction !== "monsters") return;
    const centerX = Math.floor(this.position.x);
    const centerZ = Math.floor(this.position.z);
    const maxRadius = CHUNK_SIZE;
    for (let radius = 0; radius <= maxRadius; radius += 2) {
      for (let x = centerX - radius; x <= centerX + radius; x += 2) {
        for (let z = centerZ - radius; z <= centerZ + radius; z += 2) {
          if (Math.max(Math.abs(x - centerX), Math.abs(z - centerZ)) !== radius) continue;
          const groundY = this.world.generator.getHeightAt(x, z);
          for (let y = groundY - 3; y >= 3; y -= 1) {
            if (
              this.world.getBlockAt(x, y - 1, z) !== BlockType.AIR &&
              this.world.getBlockAt(x, y, z) === BlockType.AIR &&
              this.world.getBlockAt(x, y + 1, z) === BlockType.AIR &&
              this.world.getBlockAt(x, y + 2, z) !== BlockType.AIR
            ) {
              const spawn = { x: x + 0.5, y, z: z + 0.5 };
              this.spawnPoint = spawn;
              this.position = { ...spawn };
              this.world.update(this.position);
              this.#syncCamera();
              return;
            }
          }
        }
      }
    }
  }

  #grantClassEquipment(playerClass) {
    const equipment = {
      warrior: ITEMS.WOODEN_SWORD,
      mage: ITEMS.MAGIC_WAND,
      archer: ITEMS.FLINT_PICKAXE,
      rogue: ITEMS.FLINT_AXE,
    }[playerClass];
    if (equipment && this.inventory?.addItem(equipment, 1)) {
      this.inventory.selectStartingGear(equipment);
    }
  }

  #updateMining(delta) {
    if (!this.miningHeld || !this.controls.isLocked) {
      this.world.clearMiningProgress();
      this.miningTarget = null;
      this.miningElapsed = 0;
      return;
    }

    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    const hit = this.raycaster.intersectObjects(this.world.getMeshes(), false)[0];
    if (!hit?.face) {
      this.#resetMiningTarget();
      return;
    }

    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const block = {
      x: Math.floor(hit.point.x - normal.x * 0.01),
      y: Math.floor(hit.point.y - normal.y * 0.01),
      z: Math.floor(hit.point.z - normal.z * 0.01),
    };
    const type = this.world.getBlockAt(block.x, block.y, block.z);
    if (type === BlockType.AIR) {
      this.#resetMiningTarget();
      return;
    }

    const targetKey = `${block.x},${block.y},${block.z}`;
    if (targetKey !== this.miningTarget) {
      this.miningTarget = targetKey;
      this.miningElapsed = 0;
    }

    const duration = this.#miningDuration(type);
    this.miningElapsed += delta;
    const progress = duration === 0 ? 1 : Math.min(1, this.miningElapsed / duration);
    this.world.setMiningProgress(block.x, block.y, block.z, progress);
    if (progress < 1) return;

    const tool = this.inventory?.getSelectedTool();
    const dropped = this.world.breakBlock(block.x, block.y, block.z);
    const canHarvest = this.#canHarvest(dropped, tool);
    const isFluid = [
      BlockType.WATER,
      BlockType.LAVA,
      BlockType.OIL,
    ].includes(dropped);
    if (dropped === BlockType.GRAVEL && Math.random() < 0.3) {
      this.inventory?.addItem(ITEMS.FLINT, 1);
    } else if (dropped !== BlockType.AIR && canHarvest && !isFluid) {
      this.world.spawnItemDrop(
        dropped,
        { x: block.x + 0.5, y: block.y + 0.65, z: block.z + 0.5 },
        { x: (Math.random() - 0.5) * 1.4, y: 1.8, z: (Math.random() - 0.5) * 1.4 },
      );
    }
    if (dropped !== BlockType.AIR && !isFluid && this.gameSettings.gameMode !== "creative") {
      this.awardExperience(1);
    }
    if (tool && canHarvest && !isFluid) this.inventory?.damageSelectedTool();
    this.#resetMiningTarget();
  }

  #dropSelectedItem() {
    const item = this.inventory?.getSelectedBlock();
    if (item === null || item === undefined || !this.inventory.removeItem(item, 1)) return;
    this.camera.getWorldDirection(this.forward);
    this.world.spawnItemDrop(
      item,
      {
        x: this.position.x + this.forward.x * 0.8,
        y: this.position.y + 1,
        z: this.position.z + this.forward.z * 0.8,
      },
      { x: this.forward.x * 2, y: 2, z: this.forward.z * 2 },
    );
  }

  #miningDuration(blockType) {
    if (this.gameSettings.gameMode === "creative") return 0;
    const tool = this.inventory?.getSelectedTool();
    const isWood = [
      BlockType.WOOD,
      BlockType.PLANKS,
      BlockType.CRAFTING_TABLE,
      BlockType.LEAVES,
    ].includes(blockType);
    const pickaxeDurations = {
      [ToolType.FLINT_PICKAXE]: 6,
      [ToolType.WOODEN_PICKAXE]: 4,
      [ToolType.STONE_PICKAXE]: 2.5,
      [ToolType.IRON_PICKAXE]: 1.5,
      [ToolType.DIAMOND_PICKAXE]: 1,
      [ToolType.NETHERITE_PICKAXE]: 0.75,
    };
    const axeDurations = {
      [ToolType.FLINT_AXE]: 0.8,
      [ToolType.WOODEN_AXE]: 0.65,
      [ToolType.STONE_AXE]: 0.5,
      [ToolType.IRON_AXE]: 0.35,
      [ToolType.DIAMOND_AXE]: 0.25,
      [ToolType.NETHERITE_AXE]: 0.2,
    };
    if (blockType === BlockType.STONE) {
      if (tool && Object.hasOwn(pickaxeDurations, tool)) return pickaxeDurations[tool];
      return 9;
    }
    if (blockType === BlockType.IRON_ORE) {
      return {
        [ToolType.STONE_PICKAXE]: 5,
        [ToolType.IRON_PICKAXE]: 3,
        [ToolType.DIAMOND_PICKAXE]: 2,
        [ToolType.NETHERITE_PICKAXE]: 1.5,
      }[tool] ?? 9;
    }
    if ([BlockType.DIAMOND_ORE, BlockType.GOLD_ORE, BlockType.LAPIS_ORE, BlockType.REDSTONE_ORE].includes(blockType)) {
      return {
        [ToolType.IRON_PICKAXE]: 5,
        [ToolType.DIAMOND_PICKAXE]: 2.5,
        [ToolType.NETHERITE_PICKAXE]: 1.8,
      }[tool] ?? 9;
    }
    if (isWood && tool && Object.hasOwn(axeDurations, tool)) return axeDurations[tool];
    if (tool && Object.hasOwn(pickaxeDurations, tool)) return 0.4;
    return blockType === BlockType.WOOD || blockType === BlockType.PLANKS ? 2 : 0.8;
  }

  #canHarvest(blockType, tool) {
    const tier = {
      [ToolType.FLINT_PICKAXE]: 1,
      [ToolType.WOODEN_PICKAXE]: 1.5,
      [ToolType.STONE_PICKAXE]: 2,
      [ToolType.IRON_PICKAXE]: 3,
      [ToolType.DIAMOND_PICKAXE]: 4,
      [ToolType.NETHERITE_PICKAXE]: 5,
    }[tool] ?? 0;
    const requiredTier = {
      [BlockType.STONE]: 1,
      [BlockType.COAL_ORE]: 1,
      [BlockType.IRON_ORE]: 2,
      [BlockType.GOLD_ORE]: 2,
      [BlockType.LAPIS_ORE]: 2,
      [BlockType.REDSTONE_ORE]: 2,
      [BlockType.DIAMOND_ORE]: 3,
    }[blockType] ?? 0;
    if (requiredTier > 0) return tier >= requiredTier;
    return true;
  }

  #resetMiningTarget() {
    this.world.clearMiningProgress();
    this.miningTarget = null;
    this.miningElapsed = 0;
  }

  #stopMining() {
    this.miningHeld = false;
    this.#resetMiningTarget();
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
    const stepX = ((this.forward.x * forwardAmount + this.right.x * strafeAmount) / length) * this.moveSpeed * delta;
    const stepZ = ((this.forward.z * forwardAmount + this.right.z * strafeAmount) / length) * this.moveSpeed * delta;
    this.#tryMove("x", stepX);
    this.#tryMove("z", stepZ);
  }

  #flyVertically(delta) {
    this.velocityY = 0;
    if (!this.controls.isLocked) return;
    const verticalInput = Number(this.keys.has("Space")) -
      Number(this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
    if (verticalInput === 0) return;
    const nextY = this.position.y + verticalInput * this.moveSpeed * delta;
    if (!this.#collidesAt(this.position.x, nextY, this.position.z)) {
      this.position.y = nextY;
    }
  }

  #applyGravity(delta) {
    if (this.#isInWater()) {
      this.grounded = false;
      if (this.keys.has("Space") && this.controls.isLocked) {
        this.velocityY = Math.min(SWIM_SPEED, this.velocityY + GRAVITY * delta);
      } else {
        this.velocityY = Math.max(
          -SWIM_SPEED,
          this.velocityY - GRAVITY * WATER_GRAVITY_SCALE * delta,
        );
      }
    } else {
      if (this.keys.has("Space") && this.grounded && this.controls.isLocked) {
        this.velocityY = JUMP_SPEED;
        this.grounded = false;
      }
      this.velocityY -= GRAVITY * delta;
    }

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
          if (this.world.isSolidAt(blockX, blockY, blockZ)) return true;
        }
      }
    }
    return false;
  }

  #isInWater() {
    const minX = Math.floor(this.position.x - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxX = Math.floor(this.position.x + PLAYER_RADIUS - COLLISION_EPSILON);
    const minY = Math.floor(this.position.y + COLLISION_EPSILON);
    const maxY = Math.floor(this.position.y + PLAYER_HEIGHT - COLLISION_EPSILON);
    const minZ = Math.floor(this.position.z - PLAYER_RADIUS + COLLISION_EPSILON);
    const maxZ = Math.floor(this.position.z + PLAYER_RADIUS - COLLISION_EPSILON);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          const type = this.world.getBlockAt(x, y, z);
          if (type === BlockType.WATER || type === BlockType.OIL) return true;
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
          if (this.world.isSolidAt(x, y, z)) highestTop = Math.max(highestTop, y + 1);
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
          if (this.world.isSolidAt(x, y, z)) lowestBottom = Math.min(lowestBottom, y);
        }
      }
    }
    return lowestBottom - PLAYER_HEIGHT;
  }

  #syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
  }
}
