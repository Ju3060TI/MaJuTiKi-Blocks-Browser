import { BlockType } from "./blocks.js";
import { END_BIOMES } from "./biomes/EndBiomes.js";
import { NETHER_BIOMES } from "./biomes/NetherBiomes.js";
import { OVERWORLD_BIOMES } from "./biomes/OverworldBiomes.js";

export { END_BIOMES, NETHER_BIOMES, OVERWORLD_BIOMES };

export const BIOMES = Object.freeze([
  ...OVERWORLD_BIOMES,
  ...NETHER_BIOMES,
  ...END_BIOMES,
]);

export const BIOME_REGISTRY = BIOMES;

function gaussianFalloff(distance) {
  return Math.max(0, 1 - distance * distance);
}

export function getBiomeWeightsFromClimate(
  temperature,
  humidity,
  registry = BIOMES,
) {
  const entries = registry.map((biome) => {
    const tempDistance = Math.abs(temperature - biome.temperature);
    const humidityDistance = Math.abs(humidity - biome.humidity);
    const score = gaussianFalloff(tempDistance * 1.4 + humidityDistance * 1.7);
    return [biome.id, score];
  });
  const total = entries.reduce((sum, [, score]) => sum + score, 0) || 1;
  return Object.fromEntries(
    entries.map(([id, score]) => [id, score / total]),
  );
}

export function getBiomeSurfaceForWeights(
  weights,
  registry = BIOMES,
  sample,
) {
  const dominant = [...registry].sort(
    (a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0),
  )[0];
  if (sample === undefined) {
    return dominant?.surface ?? BlockType.GRASS;
  }

  let threshold = 0;
  for (const biome of registry) {
    const weight = weights[biome.id] ?? 0;
    if (weight <= 0) continue;
    threshold += weight;
    if (sample <= threshold) return biome.surface ?? BlockType.GRASS;
  }
  return dominant?.surface ?? BlockType.GRASS;
}

export function getBiomeList() {
  return BIOMES.map((biome) => biome.id);
}
