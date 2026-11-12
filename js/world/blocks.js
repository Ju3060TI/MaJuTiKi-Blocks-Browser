function defineBlock(
  id,
  name,
  isSolid,
  isFluid,
  textures,
  hardness = 1,
  toolTier = 0,
  materialOptions = {},
) {
  return Object.freeze({
    id,
    name,
    isSolid,
    isFluid,
    textures: Array.isArray(textures) ? Object.freeze([...textures]) : textures,
    hardness,
    toolTier,
    materialOptions: Object.freeze({ ...materialOptions }),
  });
}

const existingBlocks = {
  AIR: defineBlock(0, "Air", false, false, null, 0, 0),
  GRASS: defineBlock(1, "Grass", true, false, [
    "grassSide",
    "grassSide",
    "grassTop",
    "dirt",
    "grassSide",
    "grassSide",
  ], 0.6),
  DIRT: defineBlock(2, "Dirt", true, false, "dirt", 0.5),
  STONE: defineBlock(3, "Stone", true, false, "stone", 1.5, 1),
  WOOD: defineBlock(4, "Wood", true, false, [
    "wood",
    "wood",
    "woodTop",
    "woodTop",
    "wood",
    "wood",
  ], 2),
  LEAVES: defineBlock(5, "Leaves", true, false, "leaves", 0.2),
  SAND: defineBlock(6, "Sand", true, false, "sand", 0.5),
  SNOW: defineBlock(7, "Snow", true, false, "snow", 0.2),
  COAL_ORE: defineBlock(8, "Coal Ore", true, false, "coalOre", 3, 1),
  IRON_ORE: defineBlock(9, "Iron Ore", true, false, "ironOre", 3, 2),
  PLANKS: defineBlock(10, "Planks", true, false, "planks", 2),
  CRAFTING_TABLE: defineBlock(11, "Crafting Table", true, false, [
    "wood",
    "wood",
    "planks",
    "woodTop",
    "wood",
    "wood",
  ], 2),
  WATER: defineBlock(12, "Water", false, true, "water", 100, 0, {
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  }),
  LAVA: defineBlock(13, "Lava", false, true, "lava", 100, 0, {
    emissive: 0xff4a00,
    emissiveIntensity: 0.45,
  }),
  GOLD_ORE: defineBlock(14, "Gold Ore", true, false, "goldOre", 3, 3),
  OIL: defineBlock(15, "Oil", false, true, "oil", 100, 0, {
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  }),
  DIAMOND_ORE: defineBlock(16, "Diamond Ore", true, false, "diamondOre", 3, 3),
  REDSTONE_ORE: defineBlock(17, "Redstone Ore", true, false, "redstoneOre", 3, 2),
  LAPIS_ORE: defineBlock(18, "Lapis Lazuli Ore", true, false, "lapisOre", 3, 2),
  GRAVEL: defineBlock(19, "Gravel", true, false, "gravel", 0.6),
};

const additionalBlocks = [
  ["COBBLESTONE", "Cobblestone", true, "cobblestone", 2, 1],
  ["RED_SAND", "Red Sand", true, "redSand", 0.5, 0],
  ["CLAY", "Clay", true, "clay", 0.6, 0],
  ["ICE", "Ice", true, "ice", 0.5, 0],
  ["MUD", "Mud", true, "mud", 0.5, 0],
  ["MOSSY_COBBLESTONE", "Mossy Cobblestone", true, "mossyCobblestone", 2, 1],
  ["ANDESITE", "Andesite", true, "andesite", 1.5, 1],
  ["DIORITE", "Diorite", true, "diorite", 1.5, 1],
  ["GRANITE", "Granite", true, "granite", 1.5, 1],
  ["BASALT", "Basalt", true, "basalt", 1.5, 1],
  ["TUFF", "Tuff", true, "tuff", 1.5, 1],
  ["CALCITE", "Calcite", true, "calcite", 0.75, 0],
  ["OBSIDIAN", "Obsidian", true, "obsidian", 50, 3],
  ["BEDROCK", "Bedrock", true, "bedrock", -1, 5],
  ["OAK_LOG", "Oak Log", true, "oakLog", 2, 0],
  ["BIRCH_LOG", "Birch Log", true, "birchLog", 2, 0],
  ["SPRUCE_LOG", "Spruce Log", true, "spruceLog", 2, 0],
  ["JUNGLE_LOG", "Jungle Log", true, "jungleLog", 2, 0],
  ["ACACIA_LOG", "Acacia Log", true, "acaciaLog", 2, 0],
  ["DARK_OAK_LOG", "Dark Oak Log", true, "darkOakLog", 2, 0],
  ["OAK_LEAVES", "Oak Leaves", true, "oakLeaves", 0.2, 0],
  ["BIRCH_LEAVES", "Birch Leaves", true, "birchLeaves", 0.2, 0],
  ["SPRUCE_LEAVES", "Spruce Leaves", true, "spruceLeaves", 0.2, 0],
  ["JUNGLE_LEAVES", "Jungle Leaves", true, "jungleLeaves", 0.2, 0],
  ["ACACIA_LEAVES", "Acacia Leaves", true, "acaciaLeaves", 0.2, 0],
  ["DARK_OAK_LEAVES", "Dark Oak Leaves", true, "darkOakLeaves", 0.2, 0],
  ["OAK_PLANKS", "Oak Planks", true, "oakPlanks", 2, 0],
  ["BIRCH_PLANKS", "Birch Planks", true, "birchPlanks", 2, 0],
  ["SPRUCE_PLANKS", "Spruce Planks", true, "sprucePlanks", 2, 0],
  ["JUNGLE_PLANKS", "Jungle Planks", true, "junglePlanks", 2, 0],
  ["ACACIA_PLANKS", "Acacia Planks", true, "acaciaPlanks", 2, 0],
  ["DARK_OAK_PLANKS", "Dark Oak Planks", true, "darkOakPlanks", 2, 0],
  ["CACTUS", "Cactus", true, "cactus", 0.4, 0],
  ["PUMPKIN", "Pumpkin", true, "pumpkin", 1, 0],
  ["MELON", "Melon", true, "melon", 1, 0],
  ["SUGAR_CANE", "Sugar Cane", false, "sugarCane", 0, 0],
  ["BAMBOO", "Bamboo", false, "bamboo", 0, 0],
  ["TALL_GRASS", "Tall Grass", false, "tallGrass", 0, 0],
  ["DANDELION", "Dandelion", false, "dandelion", 0, 0],
  ["POPPY", "Poppy", false, "poppy", 0, 0],
  ["ROSE_BUSH", "Rose Bush", false, "roseBush", 0, 0],
  ["COPPER_ORE", "Copper Ore", true, "copperOre", 3, 1],
  ["EMERALD_ORE", "Emerald Ore", true, "emeraldOre", 3, 3],
  ["NETHER_QUARTZ_ORE", "Nether Quartz Ore", true, "netherQuartzOre", 3, 2],
  ["COAL_BLOCK", "Coal Block", true, "coalBlock", 5, 1],
  ["IRON_BLOCK", "Iron Block", true, "ironBlock", 5, 2],
  ["COPPER_BLOCK", "Copper Block", true, "copperBlock", 5, 1],
  ["GOLD_BLOCK", "Gold Block", true, "goldBlock", 5, 2],
  ["REDSTONE_BLOCK", "Redstone Block", true, "redstoneBlock", 5, 2],
  ["LAPIS_BLOCK", "Lapis Lazuli Block", true, "lapisBlock", 5, 1],
  ["DIAMOND_BLOCK", "Diamond Block", true, "diamondBlock", 5, 2],
  ["EMERALD_BLOCK", "Emerald Block", true, "emeraldBlock", 5, 2],
  ["GLASS", "Glass", true, "glass", 0.3, 0, {
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  }],
  ["TERRACOTTA", "Terracotta", true, "terracotta", 1.25, 0],
  ["WHITE_WOOL", "White Wool", true, "whiteWool", 0.8, 0],
  ["RED_WOOL", "Red Wool", true, "redWool", 0.8, 0],
  ["BLUE_WOOL", "Blue Wool", true, "blueWool", 0.8, 0],
  ["GREEN_WOOL", "Green Wool", true, "greenWool", 0.8, 0],
  ["BLACK_WOOL", "Black Wool", true, "blackWool", 0.8, 0],
  ["BRICKS", "Bricks", true, "bricks", 2, 1],
  ["STONE_BRICKS", "Stone Bricks", true, "stoneBricks", 1.5, 1],
  ["SANDSTONE", "Sandstone", true, "sandstone", 0.8, 0],
  ["RED_SANDSTONE", "Red Sandstone", true, "redSandstone", 0.8, 0],
  ["QUARTZ_BLOCK", "Quartz Block", true, "quartzBlock", 0.8, 0],
  ["PRISMARINE", "Prismarine", true, "prismarine", 1.5, 1],
  ["FURNACE", "Furnace", true, "furnace", 3.5, 1],
  ["CHEST", "Chest", true, "chest", 2.5, 0],
  ["TORCH", "Torch", false, "torch", 0, 0],
  ["GLOWSTONE", "Glowstone", true, "glowstone", 0.3, 0, {
    emissive: 0xffcf63,
    emissiveIntensity: 0.25,
  }],
  ["SEA_LANTERN", "Sea Lantern", true, "seaLantern", 0.3, 0, {
    emissive: 0x7de9df,
    emissiveIntensity: 0.3,
  }],
  ["DOOR", "Wooden Door", true, "planks", 3, 0],
  ["FARMLAND", "Farmland", true, "dirt", 0.6, 0],
  ["ENCHANTING_TABLE", "Enchanting Table", true, "craftingTable", 3, 0],
  ["MAGIC_ESSENCE", "Magic Essence", true, "glowstone", 1, 0, {
    emissive: 0x8c4dff,
    emissiveIntensity: 0.5,
  }],
];

const generatedBlocks = Object.fromEntries(
  additionalBlocks.map(([key, name, isSolid, texture, hardness, toolTier, materialOptions = {}], index) => [
    key,
    defineBlock(
      Object.keys(existingBlocks).length + index,
      name,
      isSolid,
      false,
      texture,
      hardness,
      toolTier,
      materialOptions,
    ),
  ]),
);

export const BLOCKS = Object.freeze({ ...existingBlocks, ...generatedBlocks });

const blockIds = Object.values(BLOCKS).map((block) => block.id);
if (new Set(blockIds).size !== blockIds.length) {
  throw new Error("Block IDs must be unique.");
}

export const BLOCK_COUNT = Math.max(...blockIds) + 1;

export const BlockType = Object.freeze(
  Object.fromEntries(Object.entries(BLOCKS).map(([key, block]) => [key, block.id])),
);

export const BLOCK_NAMES = Object.freeze(
  Object.fromEntries(Object.values(BLOCKS).map((block) => [block.id, block.name])),
);

export const ITEMS = Object.freeze({
  FLINT: "flint",
  BONE: "bone",
  FLINT_PICKAXE: "flintPickaxe",
  FLINT_AXE: "flintAxe",
  WOODEN_AXE: "woodenAxe",
  STONE_AXE: "stoneAxe",
  IRON_AXE: "ironAxe",
  DIAMOND_PICKAXE: "diamondPickaxe",
  DIAMOND_AXE: "diamondAxe",
  NETHERITE_PICKAXE: "netheritePickaxe",
  NETHERITE_AXE: "netheriteAxe",
  WOODEN_SWORD: "woodenSword",
  STONE_SWORD: "stoneSword",
  IRON_SWORD: "ironSword",
  DIAMOND_SWORD: "diamondSword",
  IRON_CHESTPLATE: "ironChestplate",
  DIAMOND_CHESTPLATE: "diamondChestplate",
  MAGIC_WAND: "magicWand",
});
