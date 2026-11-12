import { Mesh, Vector3 } from "three";
import { BlockType } from "../world/blocks.js";
import { DialogueSystem } from "../systems/DialogueSystem.js";
import { Entity } from "./Entity.js";

const WANDER_RADIUS = 7;
const DEFEND_RADIUS = 5;
const ATTACK_DISTANCE = 2;
const WALK_SPEED = 0.65;
const WOOD_COST = 10;
const PROFESSIONS = ["Bäcker", "Schmied", "Bauer", "Bibliothekar"];
const MOODS = ["freundlich", "neugierig", "müde", "vorsichtig"];

export class Villager extends Entity {
  constructor(scene, world, x, y, z, home, assets) {
    super(scene, world, new Vector3(x, y, z), 8, { radius: 0.32, height: 1.8 });
    this.kind = "villager";
    this.home = new Vector3(home.x, y, home.z);
    this.assets = assets;
    this.profession = PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)];
    this.mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    this.voicePitch = 0.8 + Math.random() * 0.4;
    this.voiceRate = 0.9 + Math.random() * 0.2;
    this.dialogue = new DialogueSystem(this);
    this.direction = Math.random() * Math.PI * 2;
    this.actionTimer = 1 + Math.random() * 2;
    this.attackCooldown = 0;
    this.tradeMenu = null;
    this.tradeMessage = null;
    this.onTradeKeyDown = (event) => {
      if (event.code === "Escape") this.closeTradeMenu(true);
    };
    this.#buildModel();
    this.syncTransform();
  }

  update(deltaTime, { entities = [], player, playerPosition = player?.position } = {}) {
    if (!this.alive) return;
    const delta = Math.min(deltaTime, 0.05);
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    const threats = entities
      .filter((entity) =>
        entity.alive &&
        (entity.kind === "zombie" || entity.kind === "skeleton")
      )
      .map((entity) => ({
        entity,
        distance: Math.hypot(
          entity.position.x - this.position.x,
          entity.position.z - this.position.z,
        ),
      }))
      .filter(({ entity, distance }) =>
        distance <= DEFEND_RADIUS &&
        Math.abs(entity.position.y - this.position.y) < 2
      );
    if (
      player?.gameSettings?.playerFaction === "monsters" &&
      playerPosition &&
      Math.abs(playerPosition.y - this.position.y) < 2 &&
      Math.hypot(
        playerPosition.x - this.position.x,
        playerPosition.z - this.position.z,
      ) <= DEFEND_RADIUS
    ) {
      threats.push({
        entity: player,
        distance: Math.hypot(
          playerPosition.x - this.position.x,
          playerPosition.z - this.position.z,
        ),
      });
    }
    const threat = threats.sort((left, right) => left.distance - right.distance)[0];

    if (threat) {
      this.direction = Math.atan2(
        threat.entity.position.x - this.position.x,
        threat.entity.position.z - this.position.z,
      );
      if (threat.distance <= ATTACK_DISTANCE && this.attackCooldown === 0) {
        threat.entity.takeDamage(1);
        this.attackCooldown = 1;
      } else if (threat.distance > ATTACK_DISTANCE) {
        this.moveHorizontal(
          Math.sin(this.direction) * WALK_SPEED * 1.6 * delta,
          Math.cos(this.direction) * WALK_SPEED * 1.6 * delta,
        );
      }
    } else {
      this.#wander(delta);
    }

    super.update(delta);
  }

  openTradeMenu(inventory, controls) {
    if (!this.alive) return;
    if (!this.tradeMenu) this.#createTradeMenu(inventory);
    this.controls = controls;
    this.tradeMenu.hidden = false;
    this.tradeMenu.style.display = "grid";
    this.#updateTradeAvailability(inventory);
    this.tradeMessage.textContent = "Tausche 10 Holz gegen 1 Eisenerz.";
    window.addEventListener("keydown", this.onTradeKeyDown);
  }

  closeTradeMenu(restorePointerLock = false) {
    if (!this.tradeMenu) return;
    this.isClosingTrade = true;
    this.dialogue.close();
    this.isClosingTrade = false;
    this.tradeMenu.hidden = true;
    this.tradeMenu.style.display = "none";
    window.removeEventListener("keydown", this.onTradeKeyDown);
    if (restorePointerLock && this.alive) this.controls?.lock?.();
  }

  die() {
    if (!this.alive) return;
    this.closeTradeMenu();
    this.dialogue.dispose();
    this.tradeMenu?.remove();
    this.tradeMenu = null;
    super.die();
  }

  #wander(delta) {
    this.actionTimer -= delta;
    if (this.actionTimer <= 0) {
      this.direction += (Math.random() - 0.5) * 2;
      this.actionTimer = 1.5 + Math.random() * 3;
    }

    const nextX = this.position.x + Math.sin(this.direction) * WALK_SPEED * delta;
    const nextZ = this.position.z + Math.cos(this.direction) * WALK_SPEED * delta;
    const offsetX = nextX - this.home.x;
    const offsetZ = nextZ - this.home.z;
    if (Math.hypot(offsetX, offsetZ) > WANDER_RADIUS) {
      this.direction = Math.atan2(-offsetX, -offsetZ);
    }
    if (!this.moveHorizontal(
      Math.sin(this.direction) * WALK_SPEED * delta,
      Math.cos(this.direction) * WALK_SPEED * delta,
    )) {
      this.direction += (Math.random() - 0.5) * Math.PI;
    }
  }

  #createTradeMenu(inventory) {
    const overlay = document.createElement("section");
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Handel mit Dorfbewohner");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "40",
      display: "none",
      placeItems: "center",
      padding: "24px",
      background: "rgba(8, 12, 16, 0.76)",
      backdropFilter: "blur(5px)",
      fontFamily: "system-ui, sans-serif",
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(420px, 100%)",
      padding: "24px",
      color: "#f4f4f4",
      background: "#252a30",
      border: "2px solid #aeb8c2",
      boxShadow: "0 12px 36px rgba(0, 0, 0, 0.55)",
    });
    const title = document.createElement("h2");
    title.textContent = "Dorfbewohner";
    const offer = document.createElement("p");
    offer.textContent = "10 Holz  →  1 Eisenerz";
    const message = document.createElement("p");
    message.setAttribute("aria-live", "polite");
    const tradeButton = document.createElement("button");
    tradeButton.type = "button";
    tradeButton.textContent = "Tauschen";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Zurück";
    const dialogueButton = document.createElement("button");
    dialogueButton.type = "button";
    dialogueButton.textContent = "Reden";
    for (const button of [tradeButton, dialogueButton, closeButton]) {
      Object.assign(button.style, {
        margin: "8px 8px 0 0",
        padding: "10px 16px",
        color: "#fff",
        background: "#4b5965",
        border: "2px solid #d5dce2",
        cursor: "pointer",
        font: "inherit",
      });
    }
    this.tradeMessage = message;

    tradeButton.addEventListener("click", () => {
      if (inventory.countItem(BlockType.WOOD) < WOOD_COST) {
        message.textContent = "Du benötigst 10 Holz.";
        return;
      }
      if (!inventory.addItem(BlockType.IRON_ORE, 1)) {
        message.textContent = "Dein Inventar ist voll.";
        return;
      }
      if (!inventory.removeItem(BlockType.WOOD, WOOD_COST)) {
        inventory.removeItem(BlockType.IRON_ORE, 1);
        message.textContent = "Der Handel ist fehlgeschlagen.";
        return;
      }
      message.textContent = "Handel abgeschlossen: 1 Eisenerz erhalten.";
      this.#updateTradeAvailability(inventory);
    });
    closeButton.addEventListener("click", () => this.closeTradeMenu(true));
    dialogueButton.addEventListener("click", () => {
      this.tradeMenu.hidden = true;
      this.tradeMenu.style.display = "none";
      this.dialogue.open(() => {
        if (!this.alive || !this.tradeMenu || this.isClosingTrade) return;
        this.tradeMenu.hidden = false;
        this.tradeMenu.style.display = "grid";
      });
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeTradeMenu(true);
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    panel.append(title, offer, message, tradeButton, dialogueButton, closeButton);
    overlay.append(panel);
    document.body.append(overlay);
    this.tradeMenu = overlay;
    this.tradeButton = tradeButton;
    this.dialogueButton = dialogueButton;
    this.onTradeKeyDown = (event) => {
      if (event.code === "Escape" && !this.dialogue.isOpen) this.closeTradeMenu(true);
    };
  }

  #updateTradeAvailability(inventory) {
    if (!this.tradeButton || !inventory) return;
    this.tradeButton.disabled = inventory.countItem(BlockType.WOOD) < WOOD_COST;
  }

  #buildModel() {
    const body = new Mesh(this.assets.villagerBody, this.assets.villagerRobe);
    body.position.set(0, 0.82, 0);
    this.addPart(body);

    const head = new Mesh(this.assets.villagerHead, this.assets.villagerSkin);
    head.position.set(0, 1.58, 0);
    this.addPart(head);

    const nose = new Mesh(this.assets.villagerNose, this.assets.villagerSkin);
    nose.position.set(0, 1.48, 0.29);
    this.addPart(nose);

    for (const x of [-0.38, 0.38]) {
      const arm = new Mesh(this.assets.villagerArm, this.assets.villagerRobe);
      arm.position.set(x, 0.83, 0);
      this.addPart(arm);
    }
  }
}
