import { BlockType } from "../blocks.js";

export const NETHER_BIOMES = Object.freeze([
  { id: "basalt_deltas", label: "Basalt Deltas", temperature: 0.82, humidity: 0.1, surface: BlockType.BASALT },
  { id: "crimson_forest", label: "Crimson Forest", temperature: 0.9, humidity: 0.25, surface: BlockType.RED_WOOL },
  { id: "warped_forest", label: "Warped Forest", temperature: 0.6, humidity: 0.78, surface: BlockType.BLUE_WOOL },
  { id: "volcanic", label: "Volcanic", temperature: 0.9, humidity: 0.12, surface: BlockType.BEDROCK },
]);
