import {
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
} from "three";
import { BlockType } from "../world/blocks.js";

const ENCHANTMENT_COST = 10;
const FIREBALL_COST = 5;
const FIREBALL_DAMAGE = 5;
const ENCHANTMENTS = Object.freeze([
  { id: "SHARPNESS", name: "Sharpness" },
  { id: "EFFICIENCY", name: "Efficiency" },
  { id: "UNBREAKING", name: "Unbreaking" },
]);

export class MagicSystem {
  constructor(player, world, camera, inventory) {
    this.player = player;
    this.world = world;
    this.camera = camera;
    this.inventory = inventory;
    this.entities = [];
    this.raycaster = new Raycaster();
    this.screenCenter = new Vector2(0, 0);
    this.projectiles = [];
    this.burningTargets = new Map();
    this.projectileGeometry = new SphereGeometry(0.18, 8, 6);
    this.projectileMaterial = new MeshBasicMaterial({
      color: 0xff5a18,
    });
    this.menu = this.#createMenu();
    this.toast = this.#createToast();
    document.body.append(this.menu);
    document.body.append(this.toast);
    this.toastTimer = null;
  }

  setEntities(entities) {
    this.entities = entities;
  }

  handleRightClick() {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.screenCenter, this.camera);
    const hit = this.raycaster.intersectObjects(this.world.getMeshes(), false)[0];
    if (hit) {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const x = Math.floor(hit.point.x - normal.x * 0.01);
      const y = Math.floor(hit.point.y - normal.y * 0.01);
      const z = Math.floor(hit.point.z - normal.z * 0.01);
      const block = this.world.getBlockAt(x, y, z);
      if (block === BlockType.CHEST || block === BlockType.BED) return false;
      if (block === BlockType.ENCHANTING_TABLE) {
        this.openEnchantingMenu();
        return true;
      }
    }

    if (!this.inventory.hasMagicWandSelected()) return false;
    this.castFireball();
    return true;
  }

  openEnchantingMenu() {
    this.menu.hidden = false;
    this.menu.style.display = "grid";
    this.#renderMenu();
    this.player.controls.unlock();
  }

  closeEnchantingMenu() {
    this.menu.hidden = true;
    this.menu.style.display = "none";
  }

  applyRandomEnchantment() {
    const item = this.inventory.getSelectedEnchantableItem();
    if (!item) {
      this.message.textContent = "Wähle zuerst ein Werkzeug oder eine Waffe im Inventar aus.";
      return false;
    }
    if (this.player.experience < ENCHANTMENT_COST) {
      this.message.textContent = `Du benötigst ${ENCHANTMENT_COST} XP.`;
      return false;
    }
    const existing = new Set(this.inventory.getSelectedEnchantments());
    const available = ENCHANTMENTS.filter(({ id }) => !existing.has(id));
    if (available.length === 0) {
      this.message.textContent = "Dieses Item hat bereits alle Verzauberungen.";
      return false;
    }

    const enchantment = available[Math.floor(Math.random() * available.length)];
    if (!this.player.spendExperience(ENCHANTMENT_COST)) {
      this.message.textContent = `Du benötigst ${ENCHANTMENT_COST} XP.`;
      return false;
    }
    if (!this.inventory.enchantSelectedItem(enchantment.id)) {
      this.player.awardExperience(ENCHANTMENT_COST);
      this.message.textContent = "Die Verzauberung konnte nicht angewendet werden.";
      return false;
    }

    this.message.textContent = `${enchantment.name} angewendet.`;
    this.#renderMenu();
    return true;
  }

  applyWeaponHit(target) {
    const enchantments = new Set(this.inventory.getSelectedWeaponEnchantments());
    if (enchantments.has("LIFESTEAL")) this.player.heal(2);
    if (enchantments.has("FIRE_ASPECT")) this.#ignite(target, 3);
  }

  castFireball() {
    if (!this.player.spendExperience(FIREBALL_COST)) {
      const message = `Der Feuerball kostet ${FIREBALL_COST} XP.`;
      this.message.textContent = message;
      this.#showToast(message);
      return false;
    }

    const direction = this.camera.getWorldDirection(new Vector3()).normalize();
    const position = this.camera.position.clone().addScaledVector(direction, 0.8);
    const mesh = new Mesh(this.projectileGeometry, this.projectileMaterial);
    mesh.position.copy(position);
    this.world.scene.add(mesh);
    this.projectiles.push({
      mesh,
      position,
      velocity: direction.multiplyScalar(14),
      elapsed: 0,
    });
    return true;
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    this.#updateProjectiles(delta);
    this.#updateBurningTargets(delta);
  }

  dispose() {
    clearTimeout(this.toastTimer);
    for (const projectile of this.projectiles) {
      this.world.scene.remove(projectile.mesh);
    }
    this.projectiles.length = 0;
    this.burningTargets.clear();
    this.menu.remove();
    this.toast.remove();
    this.projectileGeometry.dispose();
    this.projectileMaterial.dispose();
  }

  #createMenu() {
    const overlay = document.createElement("section");
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Verzauberung");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "30",
      display: "none",
      placeItems: "center",
      padding: "20px",
      background: "rgb(0 0 0 / 70%)",
      color: "#fff",
      fontFamily: '"Courier New", monospace',
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(420px, 100%)",
      padding: "24px",
      border: "2px solid #fff",
      background: "#252b30",
      boxShadow: "0 12px 40px rgb(0 0 0 / 55%)",
      textAlign: "center",
    });

    const title = document.createElement("h2");
    title.textContent = "Verzauberung";
    this.experienceLabel = document.createElement("p");
    this.weaponLabel = document.createElement("p");
    this.message = document.createElement("p");
    this.message.setAttribute("aria-live", "polite");
    this.enchantButton = document.createElement("button");
    this.enchantButton.type = "button";
    this.enchantButton.textContent = `Zufällige Verzauberung (${ENCHANTMENT_COST} XP)`;
    this.closeButton = document.createElement("button");
    this.closeButton.type = "button";
    this.closeButton.textContent = "Schließen";

    for (const button of [this.enchantButton, this.closeButton]) {
      Object.assign(button.style, {
        display: "block",
        width: "100%",
        marginTop: "10px",
        padding: "12px",
        border: "2px solid #fff",
        background: "#666",
        color: "#fff",
        font: "bold 14px 'Courier New', monospace",
        cursor: "pointer",
      });
    }
    this.enchantButton.addEventListener("click", () => this.applyRandomEnchantment());
    this.closeButton.addEventListener("click", () => this.closeEnchantingMenu());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeEnchantingMenu();
    });
    panel.append(
      title,
      this.experienceLabel,
      this.weaponLabel,
      this.message,
      this.enchantButton,
      this.closeButton,
    );
    overlay.append(panel);
    return overlay;
  }

  #createToast() {
    const toast = document.createElement("p");
    toast.hidden = true;
    toast.setAttribute("role", "status");
    Object.assign(toast.style, {
      position: "fixed",
      zIndex: "40",
      left: "50%",
      bottom: "130px",
      transform: "translateX(-50%)",
      margin: "0",
      padding: "10px 16px",
      border: "1px solid #fff",
      background: "rgb(24 27 30 / 92%)",
      color: "#fff",
      font: "bold 14px 'Courier New', monospace",
      pointerEvents: "none",
    });
    return toast;
  }

  #showToast(message) {
    this.toast.textContent = message;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.hidden = true;
    }, 1800);
  }

  #renderMenu() {
    const item = this.inventory.getSelectedEnchantableItem();
    const name = item ? this.inventory.getItemName(item.item) : null;
    this.experienceLabel.textContent = `Erfahrung: ${this.player.experience} XP`;
    this.weaponLabel.textContent = item
      ? `${name} · ${this.inventory.getSelectedEnchantments().join(", ") || "unverzaubert"}`
      : "Wähle ein Werkzeug oder eine Waffe im Inventar aus.";
    this.enchantButton.disabled = !item ||
      this.player.experience < ENCHANTMENT_COST ||
      ENCHANTMENTS.every(({ id }) => this.inventory.getSelectedEnchantments().includes(id));
    this.enchantButton.style.opacity = this.enchantButton.disabled ? "0.55" : "1";
  }

  #updateProjectiles(delta) {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.elapsed += delta;
      projectile.position.addScaledVector(projectile.velocity, delta);
      projectile.mesh.position.copy(projectile.position);
      const target = this.entities.find((entity) =>
        entity.alive &&
        entity.position.distanceTo(projectile.position) < 0.8
      );
      const block = this.world.getBlockAt(
        Math.floor(projectile.position.x),
        Math.floor(projectile.position.y),
        Math.floor(projectile.position.z),
      );
      if (target) {
        target.takeDamage(FIREBALL_DAMAGE);
        this.#ignite(target, 3);
      }
      if (target || block !== BlockType.AIR || projectile.elapsed > 3) {
        this.world.scene.remove(projectile.mesh);
        this.projectiles.splice(index, 1);
      }
    }
  }

  #ignite(target, duration) {
    if (!target?.alive) return;
    this.burningTargets.set(target, {
      remaining: duration,
      damageTimer: 1,
    });
  }

  #updateBurningTargets(delta) {
    for (const [target, fire] of this.burningTargets) {
      if (!target.alive || fire.remaining <= 0) {
        this.burningTargets.delete(target);
        continue;
      }
      fire.remaining -= delta;
      fire.damageTimer -= delta;
      if (fire.damageTimer <= 0) {
        target.takeDamage(1);
        fire.damageTimer = 1;
      }
    }
  }
}
