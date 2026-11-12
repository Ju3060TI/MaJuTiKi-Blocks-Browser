import {
  BoxGeometry,
  Color,
  Mesh,
  MeshLambertMaterial,
} from "three";

const PARTICLE_SIZE = 0.1;
const PARTICLE_LIFETIME = 1;
const PARTICLE_GRAVITY = 12;

export class ParticleSystem {
  constructor(scene, blockColors) {
    this.scene = scene;
    this.blockColors = blockColors;
    this.geometry = new BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    this.groups = [];
  }

  spawn(blockType, x, y, z) {
    const color = this.blockColors[blockType] ?? new Color(0x808080);
    const material = new MeshLambertMaterial({ color: color.clone() });
    const particles = [];
    const count = 5 + Math.floor(Math.random() * 6);

    for (let index = 0; index < count; index += 1) {
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);
      particles.push({
        mesh,
        velocity: {
          x: (Math.random() - 0.5) * 3,
          y: 1 + Math.random() * 3,
          z: (Math.random() - 0.5) * 3,
        },
        age: 0,
      });
    }

    this.groups.push({ material, particles });
  }

  update(deltaSeconds) {
    for (let groupIndex = this.groups.length - 1; groupIndex >= 0; groupIndex -= 1) {
      const group = this.groups[groupIndex];
      for (let particleIndex = group.particles.length - 1; particleIndex >= 0; particleIndex -= 1) {
        const particle = group.particles[particleIndex];
        particle.age += deltaSeconds;
        if (particle.age >= PARTICLE_LIFETIME) {
          this.scene.remove(particle.mesh);
          group.particles.splice(particleIndex, 1);
          continue;
        }

        particle.velocity.y -= PARTICLE_GRAVITY * deltaSeconds;
        particle.mesh.position.x += particle.velocity.x * deltaSeconds;
        particle.mesh.position.y += particle.velocity.y * deltaSeconds;
        particle.mesh.position.z += particle.velocity.z * deltaSeconds;
      }

      if (group.particles.length === 0) {
        group.material.dispose();
        this.groups.splice(groupIndex, 1);
      }
    }
  }

  dispose() {
    for (const group of this.groups) {
      for (const { mesh } of group.particles) this.scene.remove(mesh);
      group.material.dispose();
    }
    this.groups.length = 0;
    this.geometry.dispose();
  }
}
