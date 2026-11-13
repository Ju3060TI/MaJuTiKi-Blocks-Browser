import { BlockType } from "../world/WorldGenerator.js";

const DEFAULT_QUESTS = [
  {
    id: "break_wood",
    label: "Break 10 Wood",
    type: "block",
    target: BlockType.WOOD,
    goal: 10,
    rewardXp: 25,
    progress: 0,
  },
  {
    id: "craft_stone_sword",
    label: "Craft a Stone Sword",
    type: "craft",
    target: "stoneSword",
    goal: 1,
    rewardXp: 40,
    progress: 0,
  },
  {
    id: "break_stone",
    label: "Mine 15 Stone",
    type: "block",
    target: BlockType.STONE,
    goal: 15,
    rewardXp: 35,
    progress: 0,
  },
  {
    id: "craft_iron_pickaxe",
    label: "Craft an Iron Pickaxe",
    type: "craft",
    target: "ironPickaxe",
    goal: 1,
    rewardXp: 60,
    progress: 0,
  },
];

export class QuestSystem {
  constructor(player, inventory, world) {
    this.player = player;
    this.inventory = inventory;
    this.world = world;
    this.quests = DEFAULT_QUESTS.map((quest) => ({ ...quest }));
    this.completed = new Set();
    this.panel = document.querySelector("#quest-panel");
    this.listElement = document.querySelector("#quest-list");
    this.#render();
  }

  setPlayer(player) {
    this.player = player;
  }

  setInventory(inventory) {
    this.inventory = inventory;
  }

  setWorld(world) {
    this.world = world;
  }

  registerQuest(quest) {
    const normalized = {
      ...quest,
      progress: 0,
      completed: false,
    };
    this.quests.push(normalized);
    this.#render();
    return normalized;
  }

  trackBlockBreak(blockType) {
    if (!Number.isInteger(blockType)) return;
    for (const quest of this.quests) {
      if (quest.type !== "block" || quest.target !== blockType) continue;
      this.#advanceQuest(quest, 1);
    }
  }

  trackCraft(item) {
    const itemId = String(item);
    for (const quest of this.quests) {
      if (quest.type !== "craft" || quest.target !== itemId) continue;
      this.#advanceQuest(quest, 1);
    }
  }

  #advanceQuest(quest, amount) {
    if (this.completed.has(quest.id)) return;
    quest.progress = Math.min(quest.goal, quest.progress + amount);
    if (quest.progress >= quest.goal) {
      this.completed.add(quest.id);
      quest.completed = true;
      this.player?.awardExperience?.(quest.rewardXp ?? 0);
      this.player?.showMessage?.(`${quest.label} complete! +${quest.rewardXp ?? 0} XP`);
    }
    this.#render();
  }

  #render() {
    if (!this.listElement) return;
    this.listElement.replaceChildren();
    for (const quest of this.quests) {
      const item = document.createElement("li");
      item.className = `quest-item${quest.completed ? " complete" : ""}`;
      const label = document.createElement("span");
      label.textContent = quest.label;
      const progress = document.createElement("small");
      progress.textContent = `${Math.min(quest.progress, quest.goal)}/${quest.goal}`;
      item.append(label, progress);
      this.listElement.append(item);
    }
  }
}
