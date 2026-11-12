import { TamedMob } from "./TamedMob.js";

const FUSE_SECONDS = 1.5;
const TRIGGER_DISTANCE = 3;
const BLAST_RADIUS = 3.5;
const BLAST_DAMAGE = 10;
const HOSTILE_KINDS = new Set([
  "zombie",
  "skeleton",
  "spider",
  "creeper",
  "enderman",
  "herobrine",
]);

export class FriendlyCreeper extends TamedMob {
  constructor(scene, world, position, owner, assets) {
    super(scene, world, position, owner, assets, "friendly-creeper");
    this.fuseRemaining = null;
    this.flashTimer = 0;
  }

  update(deltaTime, { player = this.owner, entities = [] } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    const target = entities
      .filter((entity) =>
        entity.alive &&
        HOSTILE_KINDS.has(entity.kind) &&
        Math.hypot(
          entity.position.x - this.position.x,
          entity.position.z - this.position.z,
        ) <= TRIGGER_DISTANCE
      )
      .sort((left, right) =>
        Math.hypot(left.position.x - this.position.x, left.position.z - this.position.z) -
        Math.hypot(right.position.x - this.position.x, right.position.z - this.position.z)
      )[0];

    if (!target) {
      this.fuseRemaining = null;
      this.mesh.scale.setScalar(1);
      this.material.color.setHex(0x55a844);
      this.material.emissive.setHex(0x000000);
      this.material.emissiveIntensity = 0;
      super.update(delta, { player, entities });
      return;
    }

    if (this.fuseRemaining === null) {
      this.fuseRemaining = FUSE_SECONDS;
      this.#playHiss();
    }
    this.fuseRemaining -= delta;
    this.flashTimer += delta;
    if (this.flashTimer >= 0.1) {
      this.flashTimer = 0;
      const flashing = Math.ceil(this.fuseRemaining * 10) % 2 === 0;
      this.material.color.setHex(flashing ? 0xffffff : 0x55a844);
      this.material.emissive.setHex(flashing ? 0xffffff : 0x000000);
      this.material.emissiveIntensity = flashing ? 0.8 : 0;
      this.mesh.scale.setScalar(
        1 + (1 - Math.max(0, this.fuseRemaining) / FUSE_SECONDS) * 0.4,
      );
    }

    super.update(delta, { player, entities, disableCombat: true });
    if (this.fuseRemaining <= 0) this.#detonate(entities);
  }

  #detonate(entities) {
    for (const entity of entities) {
      if (
        !entity.alive ||
        !HOSTILE_KINDS.has(entity.kind) ||
        Math.hypot(
          entity.position.x - this.position.x,
          entity.position.z - this.position.z,
        ) > BLAST_RADIUS
      ) {
        continue;
      }
      entity.takeDamage(BLAST_DAMAGE, this);
    }
    this.die();
  }

  #playHiss() {
    const AudioContextType = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextType) return;
    const context = new AudioContextType();
    const buffer = context.createBuffer(1, context.sampleRate * 0.3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
    }
    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    noise.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 1400;
    gain.gain.value = 0.5;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    noise.addEventListener("ended", () => context.close(), { once: true });
    noise.start();
  }
}
