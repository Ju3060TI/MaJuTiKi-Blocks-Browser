import {
  BoxGeometry,
  MeshLambertMaterial,
} from "three";
import { Chicken } from "./Chicken.js";
import { Cow } from "./Cow.js";
import { Creeper } from "./Creeper.js";
import { Enderman } from "./Enderman.js";
import { FriendlyCreeper } from "./FriendlyCreeper.js";
import { Herobrine } from "./Herobrine.js";
import { Pig } from "./Pig.js";
import { Skeleton } from "./Skeleton.js";
import { Sheep } from "./Sheep.js";
import { Spider } from "./Spider.js";
import { TamedMob } from "./TamedMob.js";
import { Villager } from "./Villager.js";
import { Zombie } from "./Zombie.js";
import { BlockType, CHUNK_SIZE, WORLD_HEIGHT } from "../world/WorldGenerator.js";

const MAX_ENTITIES = 12;
const HOSTILE_MOB_KINDS = new Set([
  "zombie",
  "skeleton",
  "creeper",
  "spider",
  "enderman",
  "herobrine",
]);
const DESPAWN_DISTANCE = 32;
const MAX_VILLAGERS = 4;
const VILLAGE_SCAN_INTERVAL = 3;
const PLAYER_TARGET_DISTANCE = 16;
const VILLAGER_TARGET_DISTANCE = 24;
const MONSTER_BUFF_RADIUS = 20;
const MONSTER_SPEED_MULTIPLIER = 1.35;
const MONSTER_DAMAGE_MULTIPLIER = 1.5;

export class EntityManager {
  constructor(scene, world, inventory) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.entities = [];
    this.spawnTimer = 0;
    this.assets = {
      body: new BoxGeometry(0.58, 0.62, 0.72),
      head: new BoxGeometry(0.42, 0.42, 0.42),
      leg: new BoxGeometry(0.16, 0.42, 0.16),
      zombieBody: new BoxGeometry(0.56, 0.72, 0.34),
      zombieHead: new BoxGeometry(0.42, 0.42, 0.42),
      zombieLimb: new BoxGeometry(0.18, 0.7, 0.2),
      skeletonBody: new BoxGeometry(0.48, 0.76, 0.3),
      skeletonHead: new BoxGeometry(0.4, 0.4, 0.4),
      skeletonLimb: new BoxGeometry(0.14, 0.7, 0.14),
      villagerBody: new BoxGeometry(0.62, 0.9, 0.42),
      villagerHead: new BoxGeometry(0.48, 0.52, 0.48),
      villagerNose: new BoxGeometry(0.15, 0.2, 0.2),
      villagerArm: new BoxGeometry(0.18, 0.68, 0.2),
      herobrineBody: new BoxGeometry(0.62, 0.9, 0.42),
      herobrineHead: new BoxGeometry(0.48, 0.52, 0.48),
      herobrineLimb: new BoxGeometry(0.18, 0.72, 0.2),
      herobrineEye: new BoxGeometry(0.09, 0.07, 0.035),
      spiderBody: new BoxGeometry(0.72, 0.42, 0.9),
      spiderHead: new BoxGeometry(0.55, 0.42, 0.5),
      spiderLeg: new BoxGeometry(0.12, 0.12, 0.62),
      creeperBody: new BoxGeometry(0.62, 0.9, 0.42),
      creeperHead: new BoxGeometry(0.52, 0.52, 0.52),
      creeperLeg: new BoxGeometry(0.2, 0.42, 0.2),
      endermanBody: new BoxGeometry(0.52, 1.1, 0.38),
      endermanHead: new BoxGeometry(0.48, 0.5, 0.42),
      endermanLimb: new BoxGeometry(0.13, 0.75, 0.13),
      endermanEye: new BoxGeometry(0.1, 0.07, 0.025),
      tamedCollar: new BoxGeometry(0.48, 0.12, 0.48),
      arrowGeometry: new BoxGeometry(0.07, 0.07, 0.5),
      materials: {
        pig: new MeshLambertMaterial({ color: 0xe9a4a8 }),
        cow: new MeshLambertMaterial({ color: 0x55463c }),
        sheep: new MeshLambertMaterial({ color: 0xe3ded1 }),
        chicken: new MeshLambertMaterial({ color: 0xf0eee5 }),
      },
      zombieMaterial: new MeshLambertMaterial({ color: 0x4c8b46 }),
      skeletonMaterial: new MeshLambertMaterial({ color: 0xd8d2c2 }),
      arrowMaterial: new MeshLambertMaterial({ color: 0x744522 }),
      villagerRobe: new MeshLambertMaterial({ color: 0x84613d }),
      villagerSkin: new MeshLambertMaterial({ color: 0xc99572 }),
      herobrineRobe: new MeshLambertMaterial({ color: 0x161820 }),
      herobrineSkin: new MeshLambertMaterial({ color: 0xd8dbe0 }),
      herobrinePants: new MeshLambertMaterial({ color: 0x20232b }),
      herobrineEyes: new MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.8,
      }),
      spiderMaterial: new MeshLambertMaterial({ color: 0x30231f }),
      spiderEyes: new MeshLambertMaterial({
        color: 0xd72b35,
        emissive: 0x6d0008,
        emissiveIntensity: 0.8,
      }),
      creeperMaterial: new MeshLambertMaterial({ color: 0x55a844 }),
      endermanMaterial: new MeshLambertMaterial({ color: 0x111016 }),
      endermanEyes: new MeshLambertMaterial({
        color: 0xb54cff,
        emissive: 0x8e22ff,
        emissiveIntensity: 1.5,
      }),
      tamedMobMaterial: new MeshLambertMaterial({ color: 0x537b9e }),
      tamedCollarMaterial: new MeshLambertMaterial({
        color: 0x29b6f6,
        emissive: 0x0784d2,
        emissiveIntensity: 0.7,
      }),
      friendlyCreeperMaterial: new MeshLambertMaterial({ color: 0x55a844 }),
    };
    this.spawnedVillages = new Set();
    this.villageScanTimer = 0;
  }

  update(deltaSeconds, player, isDay = true) {
    const delta = Math.min(deltaSeconds, 0.05);
    const playerPosition = player.position ?? player;
    const settings = window.gameSettings ?? { gameMode: "vanilla" };
    if (settings.gameMode === "creative") {
      for (const entity of this.entities) entity.dispose();
      this.entities.length = 0;
      this.spawnTimer = 0;
      return;
    }
    const configuredSimulationDistance = Number(settings.simDistance ?? 4);
    const simulationDistance = Math.max(
      1,
      Math.min(10, Number.isFinite(configuredSimulationDistance) ? configuredSimulationDistance : 4),
    ) * CHUNK_SIZE;
    const configuredRenderDistance = Number(settings.renderDistance ?? 4);
    const renderDistance = Math.max(
      2,
      Math.min(10, Number.isFinite(configuredRenderDistance) ? configuredRenderDistance : 4),
    ) * CHUNK_SIZE;
    const despawnDistance = Math.max(
      DESPAWN_DISTANCE,
      Math.max(simulationDistance, renderDistance) + CHUNK_SIZE,
    );
    this.villageScanTimer -= delta;
    if (this.villageScanTimer <= 0) {
      this.#spawnVillagersNear(playerPosition, renderDistance / CHUNK_SIZE);
      this.villageScanTimer = VILLAGE_SCAN_INTERVAL;
    }
    this.spawnTimer -= delta;
    if (
      this.entities.filter((entity) => entity.kind !== "villager").length < MAX_ENTITIES &&
      this.spawnTimer <= 0
    ) {
      this.#spawnNear(playerPosition, isDay, settings.gameMode);
      this.spawnTimer = 2.5;
    }

    this.#updateMonsterBuffs();
    for (let index = this.entities.length - 1; index >= 0; index -= 1) {
      const entity = this.entities[index];
      const dx = entity.position.x - playerPosition.x;
      const dz = entity.position.z - playerPosition.z;
      const distanceSquared = dx * dx + dz * dz;
      const keepEntityNearPlayer =
        entity instanceof TamedMob ||
        (entity.kind === "villager" && entity.tradeMenu && !entity.tradeMenu.hidden);
      if (!keepEntityNearPlayer && distanceSquared > despawnDistance * despawnDistance) {
        if (entity.kind === "villager") this.spawnedVillages.delete(entity.villageKey);
        entity.dispose();
        this.entities.splice(index, 1);
        continue;
      }
      if (!keepEntityNearPlayer && distanceSquared > simulationDistance * simulationDistance) continue;
      if (entity.kind === "villager") {
        entity.update(delta, { entities: this.entities, player, playerPosition });
      } else if (entity.kind === "herobrine") {
        entity.update(delta, { player, playerPosition, entities: this.entities });
      } else if (entity instanceof TamedMob) {
        entity.update(delta, { player, entities: this.entities });
      } else if (
        entity.kind === "zombie" ||
        entity.kind === "skeleton" ||
        entity.kind === "spider" ||
        entity.kind === "creeper" ||
        entity.kind === "enderman"
      ) {
        const monstersFaction = player.gameSettings?.playerFaction === "monsters";
        const villager = entity.kind !== "enderman" &&
          entity.kind !== "creeper" &&
          (monstersFaction || distanceSquared > PLAYER_TARGET_DISTANCE ** 2)
          ? this.#findNearestVillager(entity.position)
          : null;
        const isMonsterAlly = monstersFaction &&
          (entity.kind === "zombie" || entity.kind === "skeleton");
        const target = villager ?? (isMonsterAlly ? null : player);
        const damageMultiplier = entity.herobrineBuffed ? MONSTER_DAMAGE_MULTIPLIER : 1;
        const targetPlayer = target === player;
        entity.update(delta, {
          player: target
            ? {
              position: target.position ?? playerPosition,
              camera: targetPlayer ? player.camera : undefined,
              takeDamage: (amount, source) =>
                target.takeDamage?.(amount * damageMultiplier, source),
            }
            : null,
          playerPosition: target?.position ?? (isMonsterAlly ? null : playerPosition),
          isDay,
          entities: this.entities,
        });
      } else {
        entity.update(delta, { player, playerPosition, isDay });
      }
      if (!entity.alive) this.entities.splice(index, 1);
    }
  }

  getMeshes() {
    const meshes = [];
    for (const entity of this.entities) {
      for (const child of entity.mesh.children) meshes.push(child);
    }
    return meshes;
  }

  clearHostileMobs() {
    for (let index = this.entities.length - 1; index >= 0; index -= 1) {
      const entity = this.entities[index];
      if (!HOSTILE_MOB_KINDS.has(entity.kind)) continue;
      entity.dispose();
      this.entities.splice(index, 1);
    }
  }

  damage(entity, playerPosition = null, amount = 1) {
    if (!this.entities.includes(entity)) return false;
    if (entity.kind === "spider") entity.provoke();
    if (!entity.takeDamage(amount)) {
      if (entity instanceof Cow || entity instanceof Pig ||
          entity instanceof Sheep || entity instanceof Chicken) {
        if (playerPosition) entity.fleeFrom(playerPosition);
      }
      return false;
    }
    entity.dispose();
    this.entities.splice(this.entities.indexOf(entity), 1);
    for (const drop of entity.drops ?? []) {
      this.inventory.addItem(drop.item, drop.count);
    }
    return true;
  }

  interact(entity, button, player) {
    if (
      button === 2 &&
      entity?.isTameable &&
      this.entities.includes(entity)
    ) {
      if (player.tryTameMob(entity)) this.#replaceWithTamedMob(entity, player);
      return true;
    }
    if (
      button !== 2 ||
      entity?.kind !== "villager" ||
      !this.entities.includes(entity)
    ) {
      return false;
    }
    entity.openTradeMenu(this.inventory, player?.controls);
    player?.controls?.unlock();
    return true;
  }

  #replaceWithTamedMob(entity, owner) {
    const index = this.entities.indexOf(entity);
    if (index < 0) return;
    const companion = entity.kind === "creeper"
      ? new FriendlyCreeper(
        this.scene,
        this.world,
        entity.position,
        owner,
        this.assets,
      )
      : new TamedMob(
        this.scene,
        this.world,
        entity.position,
        owner,
        this.assets,
      );
    entity.dispose();
    this.entities.splice(index, 1, companion);
  }

  dispose() {
    for (const entity of this.entities) entity.dispose();
    this.entities.length = 0;
    for (const key of [
      "body",
      "head",
      "leg",
      "zombieBody",
      "zombieHead",
      "zombieLimb",
      "skeletonBody",
      "skeletonHead",
      "skeletonLimb",
      "villagerBody",
      "villagerHead",
      "villagerNose",
      "villagerArm",
      "herobrineBody",
      "herobrineHead",
      "herobrineLimb",
      "herobrineEye",
      "spiderBody",
      "spiderHead",
      "spiderLeg",
      "creeperBody",
      "creeperHead",
      "creeperLeg",
      "endermanBody",
      "endermanHead",
      "endermanLimb",
      "endermanEye",
      "tamedCollar",
      "arrowGeometry",
    ]) {
      this.assets[key].dispose();
    }
    this.assets.materials.pig.dispose();
    this.assets.materials.cow.dispose();
    this.assets.materials.sheep.dispose();
    this.assets.materials.chicken.dispose();
    this.assets.zombieMaterial.dispose();
    this.assets.skeletonMaterial.dispose();
    this.assets.arrowMaterial.dispose();
    this.assets.villagerRobe.dispose();
    this.assets.villagerSkin.dispose();
    this.assets.herobrineRobe.dispose();
    this.assets.herobrineSkin.dispose();
    this.assets.herobrinePants.dispose();
    this.assets.herobrineEyes.dispose();
    this.assets.spiderMaterial.dispose();
    this.assets.spiderEyes.dispose();
    this.assets.creeperMaterial.dispose();
    this.assets.endermanMaterial.dispose();
    this.assets.endermanEyes.dispose();
    this.assets.tamedMobMaterial.dispose();
    this.assets.tamedCollarMaterial.dispose();
    this.assets.friendlyCreeperMaterial.dispose();
  }

  #updateMonsterBuffs() {
    const bosses = this.entities.filter((entity) =>
      entity.alive && entity.kind === "herobrine"
    );
    for (const entity of this.entities) {
      if (entity.kind !== "zombie" && entity.kind !== "skeleton") continue;
      if (!entity.herobrineMoveHookInstalled) {
        const moveHorizontal = entity.moveHorizontal.bind(entity);
        entity.moveHorizontal = (dx, dz) => {
          const multiplier = entity.herobrineBuffed ? MONSTER_SPEED_MULTIPLIER : 1;
          return moveHorizontal(dx * multiplier, dz * multiplier);
        };
        entity.herobrineMoveHookInstalled = true;
      }
      entity.herobrineBuffed = bosses.some((boss) =>
        Math.hypot(
          boss.position.x - entity.position.x,
          boss.position.z - entity.position.z,
        ) <= MONSTER_BUFF_RADIUS
      );
    }
  }

  #spawnVillagersNear(playerPosition, renderDistanceChunks) {
    const centerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
    const centerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
    const radius = Math.max(1, Math.ceil(renderDistanceChunks));
    const villagerCount = this.entities.filter((entity) => entity.kind === "villager").length;
    if (villagerCount >= MAX_VILLAGERS) return;

    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 1) {
        const chunkX = centerChunkX + offsetX;
        const chunkZ = centerChunkZ + offsetZ;
        const villageKey = `${chunkX},${chunkZ}`;
        if (this.spawnedVillages.has(villageKey)) continue;

        const farmX = chunkX * CHUNK_SIZE + 2;
        const farmZ = chunkZ * CHUNK_SIZE + 7;
        const terrainY = this.world.generator.getHeightAt(farmX, farmZ);
        let farmlandY = -1;
        for (
          let y = Math.max(1, terrainY - 3);
          y <= Math.min(WORLD_HEIGHT - 3, terrainY + 3);
          y += 1
        ) {
          if (this.world.getBlockAt(farmX, y, farmZ) === BlockType.FARMLAND) {
            farmlandY = y;
            break;
          }
        }
        if (farmlandY < 0) continue;

        const spawnX = chunkX * CHUNK_SIZE + 8.5;
        const spawnZ = chunkZ * CHUNK_SIZE + 10.5;
        const blockX = Math.floor(spawnX);
        const blockZ = Math.floor(spawnZ);
        if (
          this.world.getBlockAt(blockX, farmlandY + 1, blockZ) !== BlockType.AIR ||
          this.world.getBlockAt(blockX, farmlandY + 2, blockZ) !== BlockType.AIR
        ) {
          continue;
        }
        const villager = new Villager(
          this.scene,
          this.world,
          spawnX,
          farmlandY + 1,
          spawnZ,
          { x: spawnX, z: spawnZ },
          this.assets,
        );
        villager.villageKey = villageKey;
        this.entities.push(villager);
        this.spawnedVillages.add(villageKey);
        if (this.entities.filter((entity) => entity.kind === "villager").length >= MAX_VILLAGERS) {
          return;
        }
      }
    }
  }

  #findNearestVillager(position) {
    let nearest = null;
    let nearestDistanceSquared = VILLAGER_TARGET_DISTANCE ** 2;
    for (const entity of this.entities) {
      if (!entity.alive || entity.kind !== "villager") continue;
      const dx = entity.position.x - position.x;
      const dz = entity.position.z - position.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared < nearestDistanceSquared) {
        nearest = entity;
        nearestDistanceSquared = distanceSquared;
      }
    }
    return nearest;
  }

  #spawnNear(playerPosition, isDay, gameMode) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 14;
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
      let entity;
      if (isDay) {
        const passiveMobs = [Cow, Pig, Sheep, Chicken];
        const MobType = passiveMobs[Math.floor(Math.random() * passiveMobs.length)];
        entity = new MobType(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
      } else if (gameMode === "rpg" && Math.random() < 0.01) {
        entity = new Herobrine(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
      } else {
        const roll = Math.random();
        if (roll < 0.03) {
          entity = new Enderman(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
        } else if (roll < 0.25) {
          entity = new Spider(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
        } else if (roll < 0.48) {
          entity = new Creeper(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
        } else if (roll < 0.74) {
          entity = new Zombie(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
        } else {
          entity = new Skeleton(this.scene, this.world, x + 0.5, y + 1, z + 0.5, this.assets);
        }
      }
      this.entities.push(entity);
      return;
    }
  }
}
