import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { BLOCK_COUNT, BLOCKS } from "./blocks.js";

const TEXTURE_SIZE = 16;
const FACE_BRIGHTNESS = [0.8, 0.8, 1, 0.6, 0.8, 0.8];
const shadedTextureCache = new WeakMap();

function createTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  draw(context);

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function shadeTexture(texture, brightness) {
  if (brightness === 1) return texture;

  let variants = shadedTextureCache.get(texture);
  if (!variants) {
    variants = new Map();
    shadedTextureCache.set(texture, variants);
  }
  if (variants.has(brightness)) return variants.get(brightness);

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  context.drawImage(texture.image, 0, 0);
  const image = context.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] *= brightness;
    image.data[index + 1] *= brightness;
    image.data[index + 2] *= brightness;
  }
  context.putImageData(image, 0, 0);

  const shadedTexture = new CanvasTexture(canvas);
  shadedTexture.magFilter = NearestFilter;
  shadedTexture.minFilter = NearestFilter;
  shadedTexture.colorSpace = SRGBColorSpace;
  shadedTexture.wrapS = texture.wrapS;
  shadedTexture.wrapT = texture.wrapT;
  variants.set(brightness, shadedTexture);
  return shadedTexture;
}

export function drawTexture(baseColor, noiseColor, pattern = {}) {
  const options = typeof pattern === "string" ? { kind: pattern } : pattern;
  const kind = options.kind ?? "noise";
  let state = options.seed ?? 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  return createTexture((context) => {
    context.fillStyle = baseColor;
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let index = 0; index < 38; index += 1) {
      context.fillStyle = noiseColor;
      const size = 1 + Math.floor(random() * 2);
      context.fillRect(
        Math.floor(random() * (TEXTURE_SIZE - size + 1)),
        Math.floor(random() * (TEXTURE_SIZE - size + 1)),
        size,
        size,
      );
    }

    context.fillStyle = noiseColor;
    context.strokeStyle = noiseColor;
    switch (kind) {
      case "ore":
        for (let index = 0; index < 12; index += 1) {
          const size = index % 3 === 0 ? 2 : 1;
          context.fillRect(
            Math.floor(random() * (TEXTURE_SIZE - size)),
            Math.floor(random() * (TEXTURE_SIZE - size)),
            size,
            size,
          );
        }
        break;
      case "planks":
        context.lineWidth = 1;
        for (let line = 0; line < 4; line += 1) {
          const y = line * 4 + 2;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(TEXTURE_SIZE, y);
          context.stroke();
        }
        break;
      case "bricks":
      case "tiles":
        context.lineWidth = 1;
        for (let y = 0; y < TEXTURE_SIZE; y += 4) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(TEXTURE_SIZE, y);
          context.stroke();
        }
        for (let row = 0; row < 4; row += 1) {
          const offset = row % 2 ? 2 : 0;
          for (let x = offset; x < TEXTURE_SIZE; x += 4) {
            context.beginPath();
            context.moveTo(x, row * 4);
            context.lineTo(x, row * 4 + 4);
            context.stroke();
          }
        }
        break;
      case "cobble":
        context.lineWidth = 1;
        context.lineJoin = "round";
        for (let index = 0; index < 8; index += 1) {
          const centerX = 1 + random() * 14;
          const centerY = 1 + random() * 14;
          const radiusX = 2 + random() * 2.5;
          const radiusY = 2 + random() * 2.5;
          const points = 5 + Math.floor(random() * 3);
          context.beginPath();
          for (let point = 0; point < points; point += 1) {
            const angle = (point / points) * Math.PI * 2;
            const wobble = 0.72 + random() * 0.48;
            const x = centerX + Math.cos(angle) * radiusX * wobble;
            const y = centerY + Math.sin(angle) * radiusY * wobble;
            if (point === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          }
          context.closePath();
          context.fillStyle = index % 2 ? baseColor : noiseColor;
          context.fill();
          context.strokeStyle = "#414448";
          context.stroke();
        }
        break;
      case "glass":
        context.globalAlpha = 0.75;
        context.fillRect(1, 1, 2, 1);
        context.fillRect(2, 2, 1, 7);
        context.fillRect(9, 9, 6, 1);
        context.globalAlpha = 1;
        break;
      case "foliage":
        for (let index = 0; index < 16; index += 1) {
          context.fillStyle = index % 2 ? noiseColor : "rgba(255, 255, 255, 0.12)";
          context.fillRect(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
            1 + Math.floor(random() * 2),
            1 + Math.floor(random() * 2),
          );
        }
        for (let index = 0; index < 28; index += 1) {
          context.clearRect(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
            1,
            1,
          );
        }
        break;
      case "dirt":
      case "stone":
        for (let index = 0; index < 58; index += 1) {
          context.fillStyle =
            index % 3 === 0
              ? "rgba(255, 255, 255, 0.12)"
              : "rgba(0, 0, 0, 0.14)";
          const size = random() < 0.12 ? 2 : 1;
          context.fillRect(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
            size,
            size,
          );
        }
        break;
      case "grassTop":
        for (let index = 0; index < 66; index += 1) {
          context.fillStyle =
            index % 2 ? "rgba(255, 255, 255, 0.16)" : "rgba(0, 0, 0, 0.14)";
          context.fillRect(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
            random() < 0.12 ? 2 : 1,
            1,
          );
        }
        break;
      case "grassSide":
        for (let x = 0; x < TEXTURE_SIZE; x += 1) {
          const edge = 2 + Math.floor(random() * 3);
          context.fillStyle = "#5eaa32";
          context.fillRect(x, 0, 1, edge);
          if (random() > 0.48) {
            context.fillStyle = "#438326";
            context.fillRect(x, edge - 1, 1, 1 + Math.floor(random() * 3));
          }
        }
        for (let index = 0; index < 22; index += 1) {
          context.fillStyle = index % 2 ? "#70bd3e" : "#438326";
          context.fillRect(Math.floor(random() * TEXTURE_SIZE), Math.floor(random() * 4), 1, 1);
        }
        break;
      case "dots":
        for (let index = 0; index < 10; index += 1) {
          context.fillRect(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
            2,
            2,
          );
        }
        break;
      case "rings":
        context.lineWidth = 1;
        context.strokeStyle = noiseColor;
        context.beginPath();
        context.arc(8, 8, 6, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = "rgba(255, 255, 255, 0.28)";
        context.beginPath();
        context.arc(8, 8, 4, 0, Math.PI * 2);
        context.stroke();
        context.strokeStyle = noiseColor;
        context.beginPath();
        context.arc(8, 8, 2, 0, Math.PI * 2);
        context.stroke();
        break;
      case "wood":
        context.lineWidth = 1;
        for (let line = 0; line < 5; line += 1) {
          const x = Math.floor(random() * TEXTURE_SIZE);
          context.strokeStyle = line % 2 ? noiseColor : "rgba(50, 25, 10, 0.55)";
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x + (random() - 0.5) * 2, TEXTURE_SIZE);
          context.stroke();
        }
        break;
      case "bands":
        for (let y = 2; y < TEXTURE_SIZE; y += 5) context.fillRect(0, y, TEXTURE_SIZE, 1);
        break;
      case "water":
        context.fillStyle = "rgba(205, 239, 255, 0.65)";
        for (let y = 3; y < TEXTURE_SIZE; y += 5) {
          context.fillRect(0, y, TEXTURE_SIZE, 1);
        }
        break;
      default:
        break;
    }
  });
}

function createPickaxeTexture(headColor, handleColor) {
  return createTexture((context) => {
    context.fillStyle = handleColor;
    context.fillRect(7, 5, 2, 10);
    context.fillRect(5, 12, 2, 2);
    context.fillStyle = headColor;
    context.fillRect(3, 3, 10, 2);
    context.fillRect(2, 4, 3, 3);
    context.fillRect(11, 4, 3, 3);
    context.fillStyle = "rgba(255, 255, 255, 0.35)";
    context.fillRect(4, 3, 4, 1);
  });
}

function createCrackTexture(stage) {
  return createTexture((context) => {
    const cracks = [
      [[8, 0], [7, 4], [9, 6], [6, 9], [7, 13], [5, 16]],
      [[0, 5], [4, 6], [7, 4], [10, 6], [15, 5]],
      [[15, 10], [11, 9], [9, 6], [10, 3], [9, 0]],
      [[2, 16], [4, 12], [6, 9], [3, 7], [1, 5]],
      [[5, 13], [8, 11], [10, 12], [13, 10], [16, 11]],
      [[4, 0], [5, 3], [7, 4]],
      [[0, 11], [3, 10], [6, 9]],
      [[12, 16], [11, 13], [10, 12]],
      [[13, 2], [12, 5], [10, 6]],
      [[2, 2], [4, 4], [5, 7]],
    ];
    const visibleCracks = cracks.slice(0, stage);
    context.lineWidth = 1.5;
    context.lineCap = "square";
    for (const crack of visibleCracks) {
      context.beginPath();
      context.moveTo(...crack[0]);
      for (const [x, y] of crack.slice(1)) context.lineTo(x, y);
      context.strokeStyle = "rgba(20, 20, 20, 0.82)";
      context.stroke();
      context.lineWidth = 0.6;
      context.strokeStyle = "rgba(255, 255, 255, 0.55)";
      context.stroke();
      context.lineWidth = 1.5;
    }
  });
}

export function createBlockTextures() {
  const woodenPickaxe = createPickaxeTexture("#936138", "#704323");
  const stonePickaxe = createPickaxeTexture("#888888", "#704323");
  const ironPickaxe = createPickaxeTexture("#c2c7cc", "#704323");
  const crackStages = Array.from({ length: 10 }, (_, index) => createCrackTexture(index + 1));

  const overrides = {
    grassTop: ["#5eaa32", "#438326", "grassTop"],
    grassSide: ["#80502b", "#60391f", "grassSide"],
    dirt: ["#80502b", "#704323", "dirt"],
    stone: ["#888888", "#696969", "stone"],
    wood: ["#80502b", "#60391f", "wood"],
    woodTop: ["#b17a45", "#80502b", "rings"],
    leaves: ["#397c2b", "#2f6d25", "foliage"],
    sand: ["#d8c47b", "#c9b36b", "noise"],
    snow: ["#eef5fa", "#dce8f0", "noise"],
    coalOre: ["#777777", "#242424", "ore"],
    ironOre: ["#777777", "#b9815d", "ore"],
    goldOre: ["#777777", "#edc442", "ore"],
    diamondOre: ["#777777", "#35d7d2", "ore"],
    redstoneOre: ["#777777", "#d3342d", "ore"],
    lapisOre: ["#777777", "#3157c8", "ore"],
    water: ["#2879bb", "#a9e3ff", "water"],
    lava: ["#b83212", "#ffd34a", "bands"],
    oil: ["#171b20", "#76506e", "bands"],
    planks: ["#a87542", "#704626", "planks"],
  };
  const blockEntries = Object.entries(BLOCKS);
  const textureSources = new Map();
  for (const [key, block] of blockEntries) {
    if (block.id === BLOCKS.AIR.id) continue;
    const names = Array.isArray(block.textures) ? block.textures : [block.textures];
    for (const name of names) {
      if (name && !textureSources.has(name)) textureSources.set(name, { key, block });
    }
  }

  const textures = {
    woodenPickaxe,
    stonePickaxe,
    ironPickaxe,
    crackStages,
  };
  for (const [textureName, { key, block }] of textureSources) {
    const [baseColor, noiseColor, pattern] = getBlockStyle(key, textureName, block.id, overrides);
    const texture = drawTexture(baseColor, noiseColor, {
      kind: pattern,
      seed: block.id * 7919 + textureName.length * 101,
    });
    if (textureName === "water") {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.needsUpdate = true;
    }
    textures[textureName] = texture;
  }

  const blockTextures = Array(BLOCK_COUNT).fill(null);
  for (const block of Object.values(BLOCKS)) {
    if (block.id === BLOCKS.AIR.id) continue;
    const textureNames = Array.isArray(block.textures)
      ? block.textures
      : Array(6).fill(block.textures);
    blockTextures[block.id] = textureNames.map((name, faceIndex) => {
      const texture = textures[name];
      if (!texture) throw new Error(`Missing texture "${name}" for ${block.name}.`);
      return shadeTexture(texture, FACE_BRIGHTNESS[faceIndex] ?? 0.8);
    });
  }

  return {
    ...textures,
    blockTextures,
  };
}

function getBlockStyle(key, textureName, id, overrides) {
  if (overrides[textureName]) return overrides[textureName];

  const name = key.toLowerCase();
  const seed = id * 47 + textureName.length * 13;
  const hue = seed % 360;
  const color = (saturation, lightness) => `hsl(${hue} ${saturation}% ${lightness}%)`;
  if (name.includes("ore")) {
    const oreColors = {
      copper: "#c77742",
      emerald: "#39b96b",
      quartz: "#eee7da",
    };
    const oreColor = Object.entries(oreColors).find(([ore]) => name.includes(ore))?.[1] ?? color(75, 58);
    return ["#777777", oreColor, "ore"];
  }
  if (name.includes("log")) return [color(38, 38), color(30, 25), "wood"];
  if (name.includes("planks")) return [color(44, 52), color(42, 34), "planks"];
  if (name.includes("leaves") || name.includes("grass")) return [color(50, 38), color(56, 28), "foliage"];
  if (name.includes("wool")) return [color(30, 78), color(24, 58), "dots"];
  if (name.includes("glass") || name.includes("ice")) return ["#9edbea", "#e1fbff", "glass"];
  if (name.includes("brick") || name.includes("tile")) return [color(34, 48), color(25, 30), "bricks"];
  if (name.includes("block")) return [color(42, 55), color(35, 38), "tiles"];
  if (name.includes("torch") || name.includes("lantern") || name.includes("glowstone")) {
    return ["#e3b857", "#fff1a1", "dots"];
  }
  if (name.includes("sand")) return ["#d8bf7b", "#b99f5f", "noise"];
  if (name.includes("snow") || name.includes("calcite") || name.includes("quartz")) {
    return ["#e8e8df", "#c8cbc9", "noise"];
  }
  if (name.includes("copper")) return ["#b96d46", "#d99a68", "ore"];
  if (name.includes("gold")) return ["#d8aa32", "#f0ca55", "tiles"];
  if (name.includes("diamond")) return ["#45c8c2", "#9cf5e8", "tiles"];
  if (name.includes("emerald")) return ["#279b55", "#72dc89", "tiles"];
  if (name.includes("lapis")) return ["#29478f", "#547bd1", "tiles"];
  if (name.includes("redstone") || name.includes("red_sand") || name.includes("red_wool")) {
    return ["#a94632", "#d96d43", "ore"];
  }
  if (name.includes("water") || name.includes("prismarine")) return ["#347f91", "#69b2b5", "bands"];
  if (name.includes("lava") || name.includes("pumpkin")) return ["#bd4a20", "#ed8b2f", "dots"];
  if (name.includes("coal")) return ["#323638", "#111516", "tiles"];
  if (name.includes("bedrock") || name.includes("basalt") || name.includes("obsidian")) {
    return ["#292c33", "#111318", "cobble"];
  }
  if (name.includes("cobble") || name.includes("stone") || name.includes("andesite") || name.includes("diorite")) {
    return ["#81858a", "#565a5e", "cobble"];
  }
  if (name.includes("dirt") || name.includes("mud") || name.includes("clay")) {
    return ["#79533b", "#563a2c", "noise"];
  }
  if (name.includes("wood") || name.includes("chest") || name.includes("crafting")) {
    return ["#94613a", "#644126", "planks"];
  }
  return [color(42, 52), color(35, 34), "noise"];
}
