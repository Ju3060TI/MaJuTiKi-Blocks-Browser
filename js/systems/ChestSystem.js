const CHEST_SLOT_COUNT = 27;

export class ChestSystem {
  constructor(world, inventory) {
    this.world = world;
    this.inventory = inventory;
    this.position = null;
    this.slots = [];
    this.cursor = null;
    this.overlay = this.#createOverlay();
    document.body.append(this.overlay);
  }

  get isOpen() {
    return !this.overlay.hidden;
  }

  openAt(position) {
    this.position = { x: position.x, y: position.y, z: position.z };
    this.slots = this.world.getChestInventoryAt(this.position);
    this.cursor = null;
    this.message.textContent = "";
    this.#render();
    this.overlay.hidden = false;
  }

  close() {
    if (this.cursor) {
      const { stack, source, index } = this.cursor;
      const slots = source === "player" ? this.inventory.items : this.slots;
      if (slots[index]) {
        this.message.textContent = "Lege den gehaltenen Stapel zuerst zurück.";
        return false;
      }
      slots[index] = stack;
      this.cursor = null;
    }
    if (!this.#saveChest()) return false;
    this.overlay.hidden = true;
    this.position = null;
    this.inventory.render();
    this.onClose?.();
    return true;
  }

  dispose() {
    this.overlay.remove();
    this.position = null;
    this.cursor = null;
  }

  #createOverlay() {
    const template = document.querySelector("#chest-menu-template");
    if (!template) throw new Error("Chest menu template is missing.");
    const overlay = template.content.firstElementChild.cloneNode(true);
    this.chestGrid = overlay.querySelector("#chest-slots");
    this.playerGrid = overlay.querySelector("#chest-player-slots");
    this.message = overlay.querySelector(".chest-message");
    this.#makeGrid(this.chestGrid, "chest");
    this.#makeGrid(this.playerGrid, "player");
    overlay.querySelector(".chest-close").addEventListener("click", () => this.close());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });
    return overlay;
  }

  #makeGrid(grid, area) {
    for (let index = 0; index < CHEST_SLOT_COUNT; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chest-slot";
      button.dataset.slot = String(index);
      button.dataset.area = area;
      button.setAttribute(
        "aria-label",
        `${area === "chest" ? "Truheninhalt" : "Spielerinventar"}, Feld ${index + 1}`,
      );
      button.addEventListener("click", () => this.#selectSlot(area, index));
      grid.append(button);
    }
  }

  #selectSlot(area, index) {
    const slots = area === "chest" ? this.slots : this.inventory.items;
    const stack = slots[index];
    if (!this.cursor) {
      if (!stack) return;
      this.cursor = { stack, source: area, index };
      slots[index] = null;
    } else if (!stack) {
      slots[index] = this.cursor.stack;
      this.cursor = null;
    } else {
      slots[index] = this.cursor.stack;
      this.cursor = { stack, source: area, index };
    }
    this.inventory.render();
    this.#render();
    this.#saveChest();
  }

  #render() {
    this.#renderGrid(this.chestGrid, this.slots);
    this.#renderGrid(this.playerGrid, this.inventory.items);
  }

  #renderGrid(grid, slots) {
    for (const button of grid.children) {
      const index = Number(button.dataset.slot);
      const stack = slots[index];
      button.replaceChildren();
      button.classList.toggle("filled", Boolean(stack));
      if (!stack) {
        button.textContent = "";
        button.title = "Leeres Feld";
        continue;
      }
      const name = this.inventory.getItemName(stack.item);
      const label = document.createElement("span");
      label.textContent = name;
      const count = document.createElement("small");
      count.textContent = `×${stack.count}`;
      button.append(label, count);
      button.title = `${name} ×${stack.count}`;
      if (stack.enchantments?.length) {
        button.classList.add("enchanted-item");
        button.title += ` — ${stack.enchantments.join(", ")}`;
      } else {
        button.classList.remove("enchanted-item");
      }
      if (stack.durability !== undefined) {
        const durability = document.createElement("small");
        durability.textContent = `${stack.durability}/${stack.maxDurability}`;
        button.append(durability);
      }
      button.setAttribute("aria-label", button.title);
    }
  }

  #saveChest() {
    if (!this.position) return;
    try {
      this.world.setChestInventoryAt(this.position, this.slots);
      this.world.saveToStorage();
      this.message.textContent = "";
      return true;
    } catch (error) {
      this.message.textContent = "Die Truhe konnte nicht dauerhaft gespeichert werden.";
      console.error("Could not save chest contents:", error);
      return false;
    }
  }
}
