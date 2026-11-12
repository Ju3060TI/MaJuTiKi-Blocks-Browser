import { BLOCK_NAMES, BlockType } from "../world/WorldGenerator.js";

const HOTBAR_ITEMS = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.WOOD,
  BlockType.SAND,
  BlockType.SNOW,
  BlockType.PLANKS,
  BlockType.CRAFTING_TABLE,
  BlockType.LEAVES,
];

const RECIPES = [
  {
    name: "4 Planks",
    ingredients: [[BlockType.WOOD, 1]],
    output: [BlockType.PLANKS, 4],
  },
  {
    name: "Crafting Table",
    ingredients: [[BlockType.PLANKS, 4]],
    output: [BlockType.CRAFTING_TABLE, 1],
  },
];

export class InventoryManager {
  constructor() {
    this.items = new Map();
    this.selectedSlot = 0;
    this.hotbar = document.querySelector("#hotbar");
    this.panel = document.querySelector("#inventory");
    this.slotsElement = document.querySelector("#inventory-items");
    this.recipesElement = document.querySelector("#recipes");
    this.messageElement = document.querySelector("#inventory-message");
    this.hotbarButtons = [];
    this.#buildHotbar();
    this.#buildRecipes();
    this.render();
  }

  addItem(item, amount = 1) {
    this.items.set(item, this.countItem(item) + amount);
    this.render();
  }

  removeItem(item, amount = 1) {
    const count = this.countItem(item);
    if (count < amount) return false;
    if (count === amount) this.items.delete(item);
    else this.items.set(item, count - amount);
    this.render();
    return true;
  }

  countItem(item) {
    return this.items.get(item) ?? 0;
  }

  getSelectedBlock() {
    const block = HOTBAR_ITEMS[this.selectedSlot];
    return this.countItem(block) > 0 ? block : null;
  }

  selectSlot(slot) {
    if (slot < 0 || slot >= HOTBAR_ITEMS.length) return;
    this.selectedSlot = slot;
    this.render();
  }

  toggle() {
    this.setVisible(this.panel.hidden);
  }

  setVisible(visible) {
    this.panel.hidden = !visible;
    if (visible) this.render();
  }

  dispose() {
    for (const button of this.hotbarButtons) {
      button.removeEventListener("click", button.onSelect);
    }
    this.recipesElement.replaceChildren();
    this.hotbar.replaceChildren();
  }

  render() {
    this.#renderHotbar();
    this.#renderItems();
    this.#renderRecipes();
  }

  #buildHotbar() {
    for (let slot = 0; slot < HOTBAR_ITEMS.length; slot += 1) {
      const button = document.createElement("button");
      button.className = "hotbar-slot";
      button.type = "button";
      button.setAttribute("aria-label", `Hotbar slot ${slot + 1}`);
      button.onSelect = () => this.selectSlot(slot);
      button.addEventListener("click", button.onSelect);
      this.hotbar.append(button);
      this.hotbarButtons.push(button);
    }
  }

  #buildRecipes() {
    for (let index = 0; index < RECIPES.length; index += 1) {
      const recipe = RECIPES[index];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recipe";
      button.dataset.recipe = String(index);
      button.addEventListener("click", () => this.#craft(index));
      this.recipesElement.append(button);
    }
  }

  #renderHotbar() {
    for (let slot = 0; slot < HOTBAR_ITEMS.length; slot += 1) {
      const item = HOTBAR_ITEMS[slot];
      const button = this.hotbarButtons[slot];
      const count = this.countItem(item);
      button.classList.toggle("selected", slot === this.selectedSlot);
      button.title = `${BLOCK_NAMES[item]}${count ? ` ×${count}` : ""}`;
      button.replaceChildren();
      const label = document.createElement("span");
      label.className = "slot-name";
      label.textContent = BLOCK_NAMES[item];
      const amount = document.createElement("span");
      amount.className = "slot-count";
      amount.textContent = count ? String(count) : "";
      const key = document.createElement("span");
      key.className = "slot-key";
      key.textContent = String(slot + 1);
      button.append(label, amount, key);
    }
  }

  #renderItems() {
    this.slotsElement.replaceChildren();
    for (const [item, amount] of this.items) {
      const row = document.createElement("div");
      row.className = "inventory-item";
      const name = document.createElement("span");
      name.textContent = typeof item === "number" ? BLOCK_NAMES[item] : item;
      const count = document.createElement("strong");
      count.textContent = String(amount);
      row.append(name, count);
      this.slotsElement.append(row);
    }
    if (this.items.size === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-inventory";
      empty.textContent = "Your inventory is empty. Break blocks to collect them.";
      this.slotsElement.append(empty);
    }
  }

  #renderRecipes() {
    for (const button of this.recipesElement.querySelectorAll("[data-recipe]")) {
      const recipe = RECIPES[Number(button.dataset.recipe)];
      const ingredients = recipe.ingredients
        .map(([item, amount]) => `${BLOCK_NAMES[item]} ×${amount}`)
        .join(" + ");
      const [output, count] = recipe.output;
      button.textContent = `${ingredients}  →  ${BLOCK_NAMES[output]}${count > 1 ? ` ×${count}` : ""}`;
      button.disabled = !recipe.ingredients.every(([item, amount]) => this.countItem(item) >= amount);
    }
  }

  #craft(index) {
    const recipe = RECIPES[index];
    if (!recipe || !recipe.ingredients.every(([item, amount]) => this.countItem(item) >= amount)) return;
    for (const [item, amount] of recipe.ingredients) this.removeItem(item, amount);
    this.addItem(...recipe.output);
    this.messageElement.textContent = `Crafted ${BLOCK_NAMES[recipe.output[0]]}.`;
  }
}
