import { BLOCK_NAMES, BlockType } from "../world/WorldGenerator.js";
import { BLOCKS, ITEMS } from "../world/blocks.js";

export const ToolType = Object.freeze({
  WOODEN_PICKAXE: "woodenPickaxe",
  STONE_PICKAXE: "stonePickaxe",
  IRON_PICKAXE: "ironPickaxe",
  DIAMOND_PICKAXE: ITEMS.DIAMOND_PICKAXE,
  NETHERITE_PICKAXE: ITEMS.NETHERITE_PICKAXE,
  FLINT_PICKAXE: ITEMS.FLINT_PICKAXE,
  FLINT_AXE: ITEMS.FLINT_AXE,
  WOODEN_AXE: ITEMS.WOODEN_AXE,
  STONE_AXE: ITEMS.STONE_AXE,
  IRON_AXE: ITEMS.IRON_AXE,
  DIAMOND_AXE: ITEMS.DIAMOND_AXE,
  NETHERITE_AXE: ITEMS.NETHERITE_AXE,
  STICK: "stick",
  WOODEN_SWORD: ITEMS.WOODEN_SWORD,
  STONE_SWORD: ITEMS.STONE_SWORD,
  IRON_SWORD: ITEMS.IRON_SWORD,
  DIAMOND_SWORD: ITEMS.DIAMOND_SWORD,
});

const ARMOR_ITEMS = new Set([ITEMS.IRON_CHESTPLATE, ITEMS.DIAMOND_CHESTPLATE]);
const MAGIC_ITEMS = new Set([ITEMS.MAGIC_WAND]);
const TAMING_ITEMS = new Set([ITEMS.BONE]);
const WEAPON_DAMAGE = Object.freeze({
  [ITEMS.WOODEN_SWORD]: 2,
  [ITEMS.STONE_SWORD]: 4,
  [ITEMS.IRON_SWORD]: 6,
  [ITEMS.DIAMOND_SWORD]: 9,
});
const ARMOR_REDUCTION = Object.freeze({
  [ITEMS.IRON_CHESTPLATE]: 6,
  [ITEMS.DIAMOND_CHESTPLATE]: 8,
});
const WEAPON_ITEMS = new Set(Object.keys(WEAPON_DAMAGE));

const ItemType = Object.freeze({
  TORCH: "torch",
  EMPTY_BUCKET: "emptyBucket",
});

const ITEM_NAMES = Object.freeze({
  [ToolType.WOODEN_PICKAXE]: "Wooden Pickaxe",
  [ToolType.STONE_PICKAXE]: "Stone Pickaxe",
  [ToolType.IRON_PICKAXE]: "Iron Pickaxe",
  [ToolType.DIAMOND_PICKAXE]: "Diamond Pickaxe",
  [ToolType.NETHERITE_PICKAXE]: "Netherite Pickaxe",
  [ToolType.FLINT_PICKAXE]: "Flint Pickaxe",
  [ToolType.FLINT_AXE]: "Flint Axe",
  [ToolType.WOODEN_AXE]: "Wooden Axe",
  [ToolType.STONE_AXE]: "Stone Axe",
  [ToolType.IRON_AXE]: "Iron Axe",
  [ToolType.DIAMOND_AXE]: "Diamond Axe",
  [ToolType.NETHERITE_AXE]: "Netherite Axe",
  [ToolType.WOODEN_SWORD]: "Wooden Sword",
  [ToolType.STONE_SWORD]: "Stone Sword",
  [ToolType.IRON_SWORD]: "Iron Sword",
  [ToolType.DIAMOND_SWORD]: "Diamond Sword",
  [ITEMS.IRON_CHESTPLATE]: "Iron Chestplate",
  [ITEMS.DIAMOND_CHESTPLATE]: "Diamond Chestplate",
  [ITEMS.MAGIC_WAND]: "Magic Wand",
  [ITEMS.BONE]: "Bone",
  [ToolType.STICK]: "Stick",
  [ITEMS.FLINT]: "Flint",
  [ItemType.TORCH]: "Torch",
  [ItemType.EMPTY_BUCKET]: "Empty Bucket",
});

const MAX_STACK_SIZE = 64;
const INVENTORY_SLOT_COUNT = 27;
const TOOL_DURABILITY = Object.freeze({
  [ToolType.FLINT_PICKAXE]: 30,
  [ToolType.FLINT_AXE]: 30,
  [ToolType.WOODEN_PICKAXE]: 60,
  [ToolType.WOODEN_AXE]: 60,
  [ToolType.STONE_PICKAXE]: 130,
  [ToolType.STONE_AXE]: 130,
  [ToolType.IRON_PICKAXE]: 250,
  [ToolType.IRON_AXE]: 250,
  [ToolType.DIAMOND_PICKAXE]: 800,
  [ToolType.DIAMOND_AXE]: 800,
  [ToolType.NETHERITE_PICKAXE]: 1500,
  [ToolType.NETHERITE_AXE]: 1500,
});
const TOOL_TYPES = new Set(Object.keys(TOOL_DURABILITY));
const GEAR_ITEMS = new Set([...TOOL_TYPES, ...WEAPON_ITEMS, ...ARMOR_ITEMS, ...MAGIC_ITEMS]);
function isTool(item) {
  return TOOL_TYPES.has(item);
}

function isGear(item) {
  return GEAR_ITEMS.has(item);
}

function createStack(item, count) {
  return {
    item,
    count,
    ...(isTool(item) ? { durability: TOOL_DURABILITY[item] } : {}),
  };
}

function itemName(item) {
  return BLOCK_NAMES[item] ?? ITEM_NAMES[item] ?? String(item);
}

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
  BlockType.ENCHANTING_TABLE,
];
const BLOCK_IDS = new Set(Object.values(BLOCKS).map(({ id }) => id));

const RECIPES = [
  {
    type: "shapeless",
    ingredients: [[BlockType.PLANKS, 2]],
    output: [ToolType.STICK, 4],
  },
  {
    type: "shaped",
    pattern: [
      [ITEMS.FLINT, ITEMS.FLINT],
      [null, ToolType.STICK],
    ],
    output: [ToolType.FLINT_PICKAXE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [ITEMS.FLINT, null],
      [ITEMS.FLINT, ToolType.STICK],
    ],
    output: [ToolType.FLINT_AXE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.PLANKS, BlockType.PLANKS, BlockType.PLANKS],
      [null, ToolType.STICK, null],
      [null, ToolType.STICK, null],
    ],
    output: [ToolType.WOODEN_PICKAXE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.STONE, BlockType.STONE, BlockType.STONE],
      [null, ToolType.STICK, null],
      [null, ToolType.STICK, null],
    ],
    output: [ToolType.STONE_PICKAXE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.IRON_ORE, null, BlockType.IRON_ORE],
      [null, ToolType.STICK, null],
      [null, ToolType.STICK, null],
    ],
    output: [ToolType.IRON_PICKAXE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.DIAMOND_ORE, null, BlockType.DIAMOND_ORE],
      [null, ToolType.STICK, null],
      [null, ToolType.STICK, null],
    ],
    output: [ToolType.DIAMOND_PICKAXE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.GOLD_ORE, BlockType.DIAMOND_ORE, BlockType.GOLD_ORE],
      [null, ToolType.DIAMOND_PICKAXE, null],
      [null, ToolType.STICK, null],
    ],
    output: [ToolType.NETHERITE_PICKAXE, 1],
  },
  {
    type: "shaped",
    pattern: [[BlockType.PLANKS], [BlockType.PLANKS], [ToolType.STICK]],
    output: [ToolType.WOODEN_SWORD, 1],
  },
  {
    type: "shaped",
    pattern: [[BlockType.COBBLESTONE], [BlockType.COBBLESTONE], [ToolType.STICK]],
    output: [ToolType.STONE_SWORD, 1],
  },
  {
    type: "shaped",
    pattern: [[BlockType.IRON_ORE], [BlockType.IRON_ORE], [ToolType.STICK]],
    output: [ToolType.IRON_SWORD, 1],
  },
  {
    type: "shaped",
    pattern: [[BlockType.DIAMOND_ORE], [BlockType.DIAMOND_ORE], [ToolType.STICK]],
    output: [ToolType.DIAMOND_SWORD, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.IRON_ORE, null, BlockType.IRON_ORE],
      [BlockType.IRON_ORE, BlockType.IRON_ORE, BlockType.IRON_ORE],
      [BlockType.IRON_ORE, null, BlockType.IRON_ORE],
    ],
    output: [ITEMS.IRON_CHESTPLATE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.DIAMOND_ORE, null, BlockType.DIAMOND_ORE],
      [BlockType.DIAMOND_ORE, BlockType.DIAMOND_ORE, BlockType.DIAMOND_ORE],
      [BlockType.DIAMOND_ORE, null, BlockType.DIAMOND_ORE],
    ],
    output: [ITEMS.DIAMOND_CHESTPLATE, 1],
  },
  {
    type: "shapeless",
    ingredients: [[BlockType.LAPIS_ORE, 1], [BlockType.DIAMOND_ORE, 1]],
    output: [BlockType.MAGIC_ESSENCE, 1],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.OBSIDIAN, BlockType.DIAMOND_ORE, BlockType.OBSIDIAN],
      [BlockType.OBSIDIAN, BlockType.MAGIC_ESSENCE, BlockType.OBSIDIAN],
    ],
    output: [BlockType.ENCHANTING_TABLE, 1],
  },
  {
    type: "shaped",
    pattern: [[BlockType.MAGIC_ESSENCE], [ToolType.STICK]],
    output: [ITEMS.MAGIC_WAND, 1],
  },
  {
    type: "shapeless",
    ingredients: [[BlockType.COAL_ORE, 1], [ToolType.STICK, 1]],
    output: [ItemType.TORCH, 4],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.IRON_ORE, null, BlockType.IRON_ORE],
      [null, BlockType.IRON_ORE, null],
    ],
    output: [ItemType.EMPTY_BUCKET, 1],
  },
  {
    type: "shapeless",
    ingredients: [[BlockType.WOOD, 1]],
    output: [BlockType.PLANKS, 4],
  },
  {
    type: "shaped",
    pattern: [
      [BlockType.PLANKS, BlockType.PLANKS],
      [BlockType.PLANKS, BlockType.PLANKS],
    ],
    output: [BlockType.CRAFTING_TABLE, 1],
  },
];

export class InventoryManager {
  constructor(textures = {}) {
    this.textures = textures;
    this.textureUrls = new WeakMap();
    this.items = Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
    this.craftingItems = Array.from({ length: 9 }, () => null);
    this.cursorStack = null;
    this.craftMatch = null;
    this.selectedSlot = 0;
    this.selectedTool = null;
    this.selectedWeapon = null;
    this.equippedArmor = null;
    this.selectedMagicItem = null;
    this.selectedTamingItem = null;
    this.gameMode = window.gameSettings?.gameMode ?? "vanilla";
    this.hotbar = document.querySelector("#hotbar");
    this.panel = document.querySelector("#inventory");
    this.slotsElement = document.querySelector("#inventory-items");
    this.craftingGridElement = document.querySelector("#crafting-grid");
    this.outputElement = document.querySelector("#craft-output");
    this.messageElement = document.querySelector("#inventory-message");
    this.hotbarButtons = [];
    this.#buildHotbar();
    this.onGameSettingsChange = (event) => {
      const nextMode = event.detail?.gameMode ?? "vanilla";
      if (nextMode === this.gameMode) return;
      this.gameMode = nextMode;
      this.#buildHotbar();
      this.selectedSlot = Math.min(this.selectedSlot, this.#getHotbarItems().length - 1);
      this.render();
    };
    window.addEventListener("gamesettingschange", this.onGameSettingsChange);
    this.onPanelClick = (event) => this.#handlePanelClick(event);
    this.onDragStart = (event) => this.#handleDragStart(event);
    this.onDragOver = (event) => this.#handleDragOver(event);
    this.onDrop = (event) => this.#handleDrop(event);
    this.onContextMenu = (event) => {
      if (event.target.closest(".item-slot[data-area]")) event.preventDefault();
    };
    this.onDragEnd = () => {
      this.dragSource = null;
      this.panel.querySelectorAll(".drag-over").forEach((slot) => slot.classList.remove("drag-over"));
    };
    this.panel.addEventListener("click", this.onPanelClick);
    this.panel.addEventListener("dragstart", this.onDragStart);
    this.panel.addEventListener("dragover", this.onDragOver);
    this.panel.addEventListener("drop", this.onDrop);
    this.panel.addEventListener("dragend", this.onDragEnd);
    this.panel.addEventListener("contextmenu", this.onContextMenu);
    this.render();
  }

  addItem(item, amount = 1) {
    if (!this.#canAddItem(item, amount)) return false;
    let remaining = amount;
    if (!isGear(item)) for (const stack of this.items) {
      if (!stack || stack.item !== item || stack.count >= MAX_STACK_SIZE) continue;
      const added = Math.min(remaining, MAX_STACK_SIZE - stack.count);
      stack.count += added;
      remaining -= added;
      if (remaining === 0) break;
    }
    for (let index = 0; index < this.items.length && remaining > 0; index += 1) {
      if (this.items[index]) continue;
      const added = isGear(item) ? 1 : Math.min(remaining, MAX_STACK_SIZE);
      this.items[index] = createStack(item, added);
      remaining -= added;
    }
    this.render();
    return true;
  }

  removeItem(item, amount = 1) {
    if (this.gameMode === "creative" && BLOCK_IDS.has(item)) return true;
    if (this.countItem(item) < amount) return false;
    let remaining = amount;
    for (let index = 0; index < this.items.length && remaining > 0; index += 1) {
      const stack = this.items[index];
      if (!stack || stack.item !== item) continue;
      const removed = Math.min(remaining, stack.count);
      stack.count -= removed;
      remaining -= removed;
      if (stack.count === 0) this.items[index] = null;
    }
    if (this.selectedTool === item && this.countItem(item) === 0) this.selectedTool = null;
    if (this.selectedWeapon === item && this.countItem(item) === 0) this.selectedWeapon = null;
    if (this.equippedArmor === item && this.countItem(item) === 0) this.equippedArmor = null;
    if (this.selectedMagicItem === item && this.countItem(item) === 0) this.selectedMagicItem = null;
    if (this.selectedTamingItem === item && this.countItem(item) === 0) this.selectedTamingItem = null;
    this.render();
    return true;
  }

  clear() {
    this.items.fill(null);
    this.craftingItems.fill(null);
    this.cursorStack = null;
    this.selectedTool = null;
    this.selectedWeapon = null;
    this.equippedArmor = null;
    this.selectedMagicItem = null;
    this.selectedTamingItem = null;
    this.render();
  }

  countItem(item) {
    return this.items.reduce(
      (total, stack) => total + (stack?.item === item ? stack.count : 0),
      0,
    );
  }

  getSelectedBlock() {
    const block = this.#getHotbarItems()[this.selectedSlot];
    if (this.gameMode === "creative") return block ?? null;
    return this.countItem(block) > 0 ? block : null;
  }

  getSelectedTool() {
    return this.selectedTool && isTool(this.selectedTool) && this.countItem(this.selectedTool) > 0
      ? this.selectedTool
      : null;
  }

  getSelectedWeapon() {
    return this.selectedWeapon && this.countItem(this.selectedWeapon) > 0
      ? this.selectedWeapon
      : null;
  }

  getSelectedWeaponName() {
    return itemName(this.getSelectedWeapon());
  }

  getArmorReduction() {
    return ARMOR_REDUCTION[this.equippedArmor] ?? 0;
  }

  getWeaponDamage() {
    const stack = this.#getSelectedWeaponStack();
    const sharpness = stack?.enchantments?.includes("SHARPNESS") ? 3 : 0;
    return (WEAPON_DAMAGE[this.getSelectedWeapon()] ?? 0) + sharpness;
  }

  getSelectedWeaponEnchantments() {
    return [...(this.#getSelectedWeaponStack()?.enchantments ?? [])];
  }

  enchantSelectedWeapon(enchantment) {
    const stack = this.#getSelectedWeaponStack();
    if (!stack || stack.enchantments?.includes(enchantment)) return false;
    stack.enchantments ??= [];
    stack.enchantments.push(enchantment);
    this.render();
    return true;
  }

  hasMagicWandSelected() {
    return this.selectedMagicItem === ITEMS.MAGIC_WAND &&
      this.countItem(ITEMS.MAGIC_WAND) > 0;
  }

  selectStartingGear(item) {
    if (this.countItem(item) === 0) return false;
    if (WEAPON_ITEMS.has(item)) this.selectedWeapon = item;
    else if (MAGIC_ITEMS.has(item)) this.selectedMagicItem = item;
    else if (ARMOR_ITEMS.has(item)) this.equippedArmor = item;
    else if (isTool(item)) this.selectedTool = item;
    else return false;
    this.render();
    return true;
  }

  getSelectedTamingItem() {
    return this.selectedTamingItem && TAMING_ITEMS.has(this.selectedTamingItem) &&
      this.countItem(this.selectedTamingItem) > 0
      ? this.selectedTamingItem
      : null;
  }

  selectTamingItem(item) {
    if (item !== null && (!TAMING_ITEMS.has(item) || this.countItem(item) === 0)) return false;
    this.selectedTamingItem = item;
    this.render();
    return true;
  }

  selectTool(tool) {
    if (tool !== null && (!isTool(tool) || this.countItem(tool) === 0)) return;
    this.selectedTool = tool;
    this.render();
  }

  damageSelectedTool() {
    if (!this.selectedTool) return false;
    const stack = this.items.find((itemStack) => itemStack?.item === this.selectedTool);
    if (!stack) {
      this.selectedTool = null;
      return false;
    }
    stack.durability -= 1;
    if (stack.durability <= 0) {
      const brokenTool = stack.item;
      this.items[this.items.indexOf(stack)] = null;
      this.selectedTool = null;
      this.messageElement.textContent = `${itemName(brokenTool)} broke.`;
    }
    this.render();
    return true;
  }

  selectSlot(slot) {
    if (slot < 0 || slot >= this.#getHotbarItems().length) return;
    this.selectedSlot = slot;
    this.render();
  }

  toggle() {
    this.setVisible(this.panel.hidden);
  }

  setVisible(visible) {
    if (!visible && this.cursorStack) {
      if (!this.#canAddItem(this.cursorStack.item, this.cursorStack.count)) {
        this.messageElement.textContent = "Inventory is full; place the held stack before closing.";
        return;
      }
      this.addItem(this.cursorStack.item, this.cursorStack.count);
      this.cursorStack = null;
    }
    this.panel.hidden = !visible;
    if (visible) this.render();
  }

  dispose() {
    window.removeEventListener("gamesettingschange", this.onGameSettingsChange);
    for (const button of this.hotbarButtons) {
      button.removeEventListener("click", button.onSelect);
    }
    this.panel.removeEventListener("click", this.onPanelClick);
    this.panel.removeEventListener("dragstart", this.onDragStart);
    this.panel.removeEventListener("dragover", this.onDragOver);
    this.panel.removeEventListener("drop", this.onDrop);
    this.panel.removeEventListener("dragend", this.onDragEnd);
    this.panel.removeEventListener("contextmenu", this.onContextMenu);
    this.slotsElement.replaceChildren();
    this.hotbar.replaceChildren();
  }

  render() {
    this.#renderHotbar();
    this.#renderItems();
    this.#renderCraftingGrid();
    this.#renderCraftOutput();
  }

  #buildHotbar() {
    for (const button of this.hotbarButtons) {
      button.removeEventListener("click", button.onSelect);
    }
    this.hotbarButtons.length = 0;
    this.hotbar.replaceChildren();
    const items = this.#getHotbarItems();
    for (let slot = 0; slot < items.length; slot += 1) {
      const button = document.createElement("button");
      button.className = "hotbar-slot";
      button.type = "button";
      button.setAttribute("aria-label", `Hotbar slot ${slot + 1}`);
      button.onSelect = () => this.selectSlot(slot);
      button.addEventListener("click", button.onSelect);
      this.hotbar.append(button);
      this.hotbarButtons.push(button);
    }
    this.hotbar.style.maxWidth = "calc(100vw - 24px)";
    this.hotbar.style.overflowX = "auto";
  }

  #renderHotbar() {
    const items = this.#getHotbarItems();
    for (let slot = 0; slot < items.length; slot += 1) {
      const item = items[slot];
      const button = this.hotbarButtons[slot];
      const count = this.gameMode === "creative" ? Infinity : this.countItem(item);
      button.classList.toggle("selected", slot === this.selectedSlot);
      button.title = `${BLOCK_NAMES[item]}${count ? ` ×${count}` : ""}`;
      button.replaceChildren();
      const label = document.createElement("span");
      label.className = "slot-name";
      label.textContent = BLOCK_NAMES[item];
      const icon = this.#createIsometricItem(item);
      const amount = document.createElement("span");
      amount.className = "slot-count";
      amount.textContent = count === Infinity ? "∞" : count ? String(count) : "";
      const key = document.createElement("span");
      key.className = "slot-key";
      key.textContent = String(slot + 1);
      button.append(icon, label, amount, key);
    }
  }

  #getHotbarItems() {
    return this.gameMode === "creative"
      ? Object.values(BLOCKS)
        .filter((block) => block.id !== BlockType.AIR)
        .map((block) => block.id)
      : HOTBAR_ITEMS;
  }

  #renderItems() {
    this.slotsElement.replaceChildren();
    for (let index = 0; index < this.items.length; index += 1) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "item-slot inventory-slot";
      slot.dataset.area = "inventory";
      slot.dataset.slot = String(index);
      slot.setAttribute("role", "gridcell");
      this.#renderStack(slot, this.items[index]);
      this.slotsElement.append(slot);
    }
  }

  #renderCraftingGrid() {
    for (const slot of this.craftingGridElement.querySelectorAll("[data-craft-slot]")) {
      const index = Number(slot.dataset.craftSlot);
      slot.dataset.area = "crafting";
      slot.dataset.slot = String(index);
      this.#renderStack(slot, this.craftingItems[index]);
    }
  }

  #renderCraftOutput() {
    this.craftMatch = null;
    for (const recipe of RECIPES) {
      const consumption = recipe.type === "shaped"
        ? this.#matchShapedRecipe(recipe.pattern)
        : this.#matchShapelessRecipe(recipe.ingredients);
      if (!consumption) continue;
      this.craftMatch = { recipe, consumption };
      break;
    }
    const output = this.craftMatch?.recipe.output;
    const canCraft = output && this.#canAddItem(output[0], output[1]);
    this.outputElement.disabled = !canCraft;
    this.#renderStack(
      this.outputElement,
      canCraft ? { item: output[0], count: output[1] } : null,
    );
    if (output && !canCraft) this.outputElement.title = "Inventory is full";
  }

  #renderStack(slot, stack) {
    slot.replaceChildren();
    slot.classList.toggle("filled", Boolean(stack));
    slot.classList.toggle(
      "tool-item",
      Boolean(stack && isGear(stack.item)),
    );
    slot.classList.toggle(
      "selected",
      Boolean(
        stack &&
        (stack.item === this.selectedTool ||
          stack.item === this.selectedWeapon ||
        stack.item === this.equippedArmor ||
        stack.item === this.selectedMagicItem ||
        stack.item === this.selectedTamingItem),
      ),
    );
    slot.draggable = Boolean(stack);
    if (!stack) {
      slot.setAttribute("aria-label", "Empty slot");
      slot.title = "Empty slot";
      return;
    }

    const name = itemName(stack.item);
    slot.setAttribute("aria-label", `${name}, ${stack.count}`);
    slot.title = isTool(stack.item)
      ? `${name} — durability ${stack.durability}/${TOOL_DURABILITY[stack.item]}`
      : isGear(stack.item)
        ? `${name}${stack.enchantments?.length ? ` — ${stack.enchantments.join(", ")}` : ""}${stack.item === this.selectedWeapon || stack.item === this.equippedArmor || stack.item === this.selectedMagicItem ? " — equipped" : ""}`
        : `${name} ×${stack.count}`;
    slot.append(this.#createIsometricItem(stack.item));
    if (stack.count > 1) {
      const count = document.createElement("span");
      count.className = "stack-count";
      count.textContent = String(stack.count);
      slot.append(count);
    }
  }

  #getItemTexture(item, faceIndex = 0) {
    if (Number.isInteger(item)) {
      return this.textures.blockTextures?.[item]?.[faceIndex] ?? null;
    }
    const textureKey = {
      [ToolType.WOODEN_PICKAXE]: "woodenPickaxe",
      [ToolType.STONE_PICKAXE]: "stonePickaxe",
      [ToolType.IRON_PICKAXE]: "ironPickaxe",
    }[item];
    return textureKey ? this.textures[textureKey] : null;
  }

  #createIsometricItem(item) {
    const isoBlock = document.createElement("span");
    isoBlock.className = "iso-block";
    isoBlock.setAttribute("aria-hidden", "true");
    let hasTexture = false;
    const faceIndexes = { top: 2, left: 4, right: 0 };
    for (const face of ["top", "left", "right"]) {
      const element = document.createElement("span");
      element.className = `iso-face iso-face-${face}`;
      const texture = this.#getItemTexture(item, faceIndexes[face]);
      const textureUrl = texture ? this.#getTextureUrl(texture) : null;
      if (textureUrl) {
        element.style.setProperty("--block-texture", `url("${textureUrl}")`);
        hasTexture = true;
      }
      isoBlock.append(element);
    }
    if (!hasTexture) {
      const label = document.createElement("span");
      label.className = "iso-fallback";
      label.textContent = itemName(item).slice(0, 2).toUpperCase();
      isoBlock.append(label);
    }
    return isoBlock;
  }

  #getTextureUrl(texture) {
    const cached = this.textureUrls.get(texture);
    if (cached) return cached;
    if (typeof texture.image?.toDataURL !== "function") return null;
    const url = texture.image.toDataURL();
    this.textureUrls.set(texture, url);
    return url;
  }

  #handlePanelClick(event) {
    const output = event.target.closest("#craft-output");
    if (output) {
      this.#craftFromOutput();
      return;
    }
    const slot = event.target.closest(".item-slot[data-area]");
    if (!slot) return;
    if (this.ignoreNextClick) {
      this.ignoreNextClick = false;
      return;
    }
    const area = slot.dataset.area;
    const index = Number(slot.dataset.slot);
    const stack = this.#getStack(area, index);
    if (
      area === "inventory" &&
      !this.cursorStack &&
      TAMING_ITEMS.has(stack?.item)
    ) {
      this.selectTamingItem(
        stack.item === this.selectedTamingItem ? null : stack.item,
      );
      return;
    }
    if (area === "inventory" && !this.cursorStack && isGear(stack?.item)) {
      if (isTool(stack.item) && !Object.hasOwn(WEAPON_DAMAGE, stack.item)) {
        this.selectTool(stack.item === this.selectedTool ? null : stack.item);
      } else if (Object.hasOwn(WEAPON_DAMAGE, stack.item)) {
        this.selectedWeapon = stack.item === this.selectedWeapon ? null : stack.item;
        this.render();
      } else if (ARMOR_ITEMS.has(stack.item)) {
        this.equippedArmor = stack.item === this.equippedArmor ? null : stack.item;
        this.render();
      } else if (MAGIC_ITEMS.has(stack.item)) {
        this.selectedMagicItem = stack.item === this.selectedMagicItem ? null : stack.item;
        this.render();
      }
      return;
    }
    this.#interactStack(area, index, event.button === 2);
  }

  #handleDragStart(event) {
    const slot = event.target.closest(".item-slot[data-area]");
    if (!slot) return;
    const source = { area: slot.dataset.area, index: Number(slot.dataset.slot) };
    if (!this.#getStack(source.area, source.index)) {
      event.preventDefault();
      return;
    }
    this.dragSource = source;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${source.area}:${source.index}`);
  }

  #handleDragOver(event) {
    const slot = event.target.closest(".item-slot[data-area]");
    if (!slot || slot.id === "craft-output") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    slot.classList.add("drag-over");
  }

  #handleDrop(event) {
    const target = event.target.closest(".item-slot[data-area]");
    if (!target || target.id === "craft-output" || !this.dragSource) return;
    event.preventDefault();
    const destination = { area: target.dataset.area, index: Number(target.dataset.slot) };
    this.#moveStack(this.dragSource, destination);
    this.ignoreNextClick = true;
    window.setTimeout(() => {
      this.ignoreNextClick = false;
    }, 0);
    this.dragSource = null;
    this.messageElement.textContent = "";
    this.render();
  }

  #getStack(area, index) {
    return area === "inventory" ? this.items[index] : this.craftingItems[index];
  }

  #getSelectedWeaponStack() {
    const weapon = this.getSelectedWeapon();
    return weapon ? this.items.find((stack) => stack?.item === weapon) ?? null : null;
  }

  #setStack(area, index, stack) {
    if (area === "inventory") this.items[index] = stack;
    else this.craftingItems[index] = stack;
  }

  #interactStack(area, index, rightClick = false) {
    const slotStack = this.#getStack(area, index);
    if (rightClick) {
      if (!this.cursorStack && slotStack) {
        const picked = Math.ceil(slotStack.count / 2);
        this.cursorStack = { item: slotStack.item, count: picked };
        slotStack.count -= picked;
        if (slotStack.count === 0) this.#setStack(area, index, null);
      } else if (this.cursorStack && !slotStack) {
        this.#setStack(area, index, { item: this.cursorStack.item, count: 1 });
        this.cursorStack.count -= 1;
        if (this.cursorStack.count === 0) this.cursorStack = null;
      } else if (
        this.cursorStack &&
        slotStack?.item === this.cursorStack.item &&
        slotStack.count < MAX_STACK_SIZE
      ) {
        slotStack.count += 1;
        this.cursorStack.count -= 1;
        if (this.cursorStack.count === 0) this.cursorStack = null;
      }
      this.render();
      this.#renderCursorMessage();
      return;
    }
    if (!this.cursorStack) {
      if (!slotStack) return;
      this.cursorStack = slotStack;
      this.#setStack(area, index, null);
    } else if (!slotStack) {
      this.#setStack(area, index, this.cursorStack);
      this.cursorStack = null;
    } else if (
      !isGear(slotStack.item) &&
      slotStack.item === this.cursorStack.item &&
      slotStack.count < MAX_STACK_SIZE
    ) {
      const moved = Math.min(this.cursorStack.count, MAX_STACK_SIZE - slotStack.count);
      slotStack.count += moved;
      this.cursorStack.count -= moved;
      if (this.cursorStack.count === 0) this.cursorStack = null;
    } else {
      this.#setStack(area, index, this.cursorStack);
      this.cursorStack = slotStack;
    }
    this.render();
    this.#renderCursorMessage();
  }

  #renderCursorMessage() {
    this.messageElement.textContent = this.cursorStack
      ? `Holding ${itemName(this.cursorStack.item)} ×${this.cursorStack.count}`
      : "";
  }

  #moveStack(source, destination) {
    if (source.area === destination.area && source.index === destination.index) return;
    const sourceStack = this.#getStack(source.area, source.index);
    const destinationStack = this.#getStack(destination.area, destination.index);
    if (!sourceStack) return;
    if (
      !isGear(sourceStack.item) &&
      destinationStack?.item === sourceStack.item &&
      destinationStack.count < MAX_STACK_SIZE
    ) {
      const moved = Math.min(sourceStack.count, MAX_STACK_SIZE - destinationStack.count);
      destinationStack.count += moved;
      sourceStack.count -= moved;
      if (sourceStack.count === 0) this.#setStack(source.area, source.index, null);
      return;
    }
    this.#setStack(source.area, source.index, destinationStack);
    this.#setStack(destination.area, destination.index, sourceStack);
  }

  #canAddItem(item, amount) {
    if (!Number.isInteger(amount) || amount <= 0) return false;
    if (isGear(item)) {
      return this.items.filter((stack) => !stack).length >= amount;
    }
    let capacity = 0;
    for (const stack of this.items) {
      if (!stack) capacity += MAX_STACK_SIZE;
      else if (stack.item === item) capacity += MAX_STACK_SIZE - stack.count;
      if (capacity >= amount) return true;
    }
    return false;
  }

  #matchShapedRecipe(pattern) {
    const height = pattern.length;
    const width = Math.max(...pattern.map((row) => row.length));
    for (const mirrored of [false, true]) {
      for (let offsetY = 0; offsetY <= 3 - height; offsetY += 1) {
        for (let offsetX = 0; offsetX <= 3 - width; offsetX += 1) {
          const consumption = [];
          let matches = true;
          for (let y = 0; y < 3 && matches; y += 1) {
            for (let x = 0; x < 3; x += 1) {
              const patternY = y - offsetY;
              const patternX = x - offsetX;
              const inside = patternY >= 0 && patternY < height &&
                patternX >= 0 && patternX < width;
              const expected = inside
                ? pattern[patternY][mirrored ? width - 1 - patternX : patternX] ?? null
                : null;
              const stack = this.craftingItems[y * 3 + x];
              if (!expected && stack) {
                matches = false;
                break;
              }
              if (expected && (!stack || stack.item !== expected || stack.count < 1)) {
                matches = false;
                break;
              }
              if (expected) consumption.push({ index: y * 3 + x, amount: 1 });
            }
          }
          if (matches) return consumption;
        }
      }
    }
    return null;
  }

  #matchShapelessRecipe(ingredients) {
    const needed = new Map();
    for (const [item, amount] of ingredients) {
      needed.set(item, (needed.get(item) ?? 0) + amount);
    }
    const present = new Map();
    const consumption = [];
    for (let index = 0; index < this.craftingItems.length; index += 1) {
      const stack = this.craftingItems[index];
      if (!stack) continue;
      present.set(stack.item, (present.get(stack.item) ?? 0) + stack.count);
    }
    if (present.size !== needed.size) return null;
    for (const [item, amount] of needed) {
      if (present.get(item) < amount) return null;
      let remaining = amount;
      for (let index = 0; index < this.craftingItems.length && remaining > 0; index += 1) {
        const stack = this.craftingItems[index];
        if (!stack || stack.item !== item) continue;
        const consumed = Math.min(remaining, stack.count);
        consumption.push({ index, amount: consumed });
        remaining -= consumed;
      }
    }
    return consumption;
  }

  #craftFromOutput() {
    if (!this.craftMatch) return;
    const { recipe, consumption } = this.craftMatch;
    const [item, amount] = recipe.output;
    if (!this.#canAddItem(item, amount)) return;
    for (const { index, amount: consumed } of consumption) {
      const stack = this.craftingItems[index];
      stack.count -= consumed;
      if (stack.count === 0) this.craftingItems[index] = null;
    }
    this.addItem(item, amount);
    if (isTool(item)) this.selectedTool = item;
    this.messageElement.textContent = `Crafted ${itemName(item)}.`;
    this.render();
  }
}
