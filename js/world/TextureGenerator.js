import {
  DataTexture,
  NearestFilter,
  NearestMipmapNearestFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import { BLOCK_COUNT, BLOCKS } from "./blocks.js";
import { TextureAtlas } from "./TextureAtlas.js";

const TEXTURE_SIZE = 32;
const DESIGN_SIZE = 16;
const DRAW_SCALE = TEXTURE_SIZE / DESIGN_SIZE;
const TRANSPARENT_PATTERNS = new Set([
  "glass",
  "grassPlant",
  "dryGrass",
  "flower",
  "cherryPetals",
  "sapling",
]);
function parseColor(value) {
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const normalized = hex.length === 3
      ? [...hex].map((digit) => digit + digit).join("")
      : hex;
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
      255,
    ];
  }

  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const [red, green, blue, alpha = "1"] = rgba[1].split(",").map((part) => part.trim());
    return [
      Number(red),
      Number(green),
      Number(blue),
      Math.round(Number(alpha) * 255),
    ];
  }

  const hsl = value.match(/^hsl\(\s*([\d.-]+)\s+([\d.-]+)%\s+([\d.-]+)%\s*\)$/);
  if (hsl) {
    const hue = ((Number(hsl[1]) % 360) + 360) % 360 / 360;
    const saturation = Number(hsl[2]) / 100;
    const lightness = Number(hsl[3]) / 100;
    const channel = (offset) => {
      const k = (offset + hue * 12) % 12;
      const chroma = saturation * Math.min(lightness, 1 - lightness);
      return Math.round(255 * (lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [channel(0), channel(8), channel(4), 255];
  }

  throw new TypeError(`Unsupported texture color: ${value}`);
}

class PixelContext {
  constructor() {
    this.data = new Uint8ClampedArray(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    this.fillStyle = "#000";
    this.strokeStyle = "#000";
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.path = [];
    this.pathClosed = false;
  }

  #blendPixel(x, y, color, alpha = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= TEXTURE_SIZE || y < 0 || y >= TEXTURE_SIZE) return;
    const index = (y * TEXTURE_SIZE + x) * 4;
    const sourceAlpha = Math.max(0, Math.min(1, (color[3] / 255) * alpha));
    const destinationAlpha = this.data[index + 3] / 255;
    const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
    if (outputAlpha === 0) return;
    for (let channel = 0; channel < 3; channel += 1) {
      this.data[index + channel] = (
        color[channel] * sourceAlpha +
        this.data[index + channel] * destinationAlpha * (1 - sourceAlpha)
      ) / outputAlpha;
    }
    this.data[index + 3] = outputAlpha * 255;
  }

  fillRect(x, y, width, height) {
    const color = parseColor(this.fillStyle);
    const left = Math.floor(x * DRAW_SCALE);
    const top = Math.floor(y * DRAW_SCALE);
    const right = Math.ceil((x + width) * DRAW_SCALE);
    const bottom = Math.ceil((y + height) * DRAW_SCALE);
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) {
        this.#blendPixel(px, py, color, this.globalAlpha);
      }
    }
  }

  clearRect(x, y, width, height) {
    const left = Math.floor(x * DRAW_SCALE);
    const top = Math.floor(y * DRAW_SCALE);
    const right = Math.ceil((x + width) * DRAW_SCALE);
    const bottom = Math.ceil((y + height) * DRAW_SCALE);
    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) {
        if (px < 0 || px >= TEXTURE_SIZE || py < 0 || py >= TEXTURE_SIZE) continue;
        this.data.fill(0, (py * TEXTURE_SIZE + px) * 4, (py * TEXTURE_SIZE + px) * 4 + 4);
      }
    }
  }

  fillPixel(x, y) {
    this.#blendPixel(x, y, parseColor(this.fillStyle), this.globalAlpha);
  }

  beginPath() {
    this.path = [];
    this.pathClosed = false;
  }

  moveTo(x, y) {
    this.path.push([x * DRAW_SCALE, y * DRAW_SCALE]);
  }

  lineTo(x, y) {
    this.path.push([x * DRAW_SCALE, y * DRAW_SCALE]);
  }

  closePath() {
    this.pathClosed = true;
  }

  arc(centerX, centerY, radius, startAngle, endAngle) {
    const scaledRadius = radius * DRAW_SCALE;
    const segments = Math.max(12, Math.ceil(Math.abs(endAngle - startAngle) * scaledRadius * 2));
    for (let step = 0; step <= segments; step += 1) {
      const angle = startAngle + ((endAngle - startAngle) * step) / segments;
      this.path.push([
        (centerX + Math.cos(angle) * radius) * DRAW_SCALE,
        (centerY + Math.sin(angle) * radius) * DRAW_SCALE,
      ]);
    }
  }

  stroke() {
    if (this.path.length < 2) return;
    const color = parseColor(this.strokeStyle);
    const count = this.pathClosed ? this.path.length : this.path.length - 1;
    for (let index = 0; index < count; index += 1) {
      const from = this.path[index];
      const to = this.path[(index + 1) % this.path.length];
      const steps = Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])) * 2);
      for (let step = 0; step <= steps; step += 1) {
        const ratio = steps === 0 ? 0 : step / steps;
        const centerX = from[0] + (to[0] - from[0]) * ratio;
        const centerY = from[1] + (to[1] - from[1]) * ratio;
        const radius = Math.max(0, Math.floor((this.lineWidth * DRAW_SCALE - 1) / 2));
        for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy += 1) {
          for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx += 1) {
            this.#blendPixel(centerX + dx, centerY + dy, color, this.globalAlpha);
          }
        }
      }
    }
  }

  fill() {
    if (this.path.length < 3) return;
    const color = parseColor(this.fillStyle);
    const minY = Math.max(0, Math.floor(Math.min(...this.path.map((point) => point[1]))));
    const maxY = Math.min(TEXTURE_SIZE - 1, Math.ceil(Math.max(...this.path.map((point) => point[1]))));
    for (let y = minY; y <= maxY; y += 1) {
      const scanY = y + 0.5;
      const intersections = [];
      for (let index = 0; index < this.path.length; index += 1) {
        const [x1, y1] = this.path[index];
        const [x2, y2] = this.path[(index + 1) % this.path.length];
        if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
          intersections.push(x1 + ((scanY - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        for (let x = Math.max(0, Math.ceil(intersections[index] - 0.5));
          x <= Math.min(TEXTURE_SIZE - 1, Math.floor(intersections[index + 1] - 0.5));
          x += 1) {
          this.#blendPixel(x, y, color, this.globalAlpha);
        }
      }
    }
  }
}

function createTexture(draw) {
  const context = new PixelContext();
  draw(context);
  const texture = new DataTexture(
    context.data,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestMipmapNearestFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeTextureTileable(data) {
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    const firstPixel = (y * TEXTURE_SIZE) * 4;
    const lastPixel = (y * TEXTURE_SIZE + TEXTURE_SIZE - 1) * 4;
    data.copyWithin(lastPixel, firstPixel, firstPixel + 4);
  }
  for (let x = 0; x < TEXTURE_SIZE; x += 1) {
    const firstPixel = x * 4;
    const lastPixel = ((TEXTURE_SIZE - 1) * TEXTURE_SIZE + x) * 4;
    data.copyWithin(lastPixel, firstPixel, firstPixel + 4);
  }
}

export function drawTexture(baseColor, noiseColor, pattern = {}) {
  const options = typeof pattern === "string" ? { kind: pattern } : pattern;
  const kind = options.kind ?? "noise";
  let state = options.seed ?? 1;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  const texture = createTexture((context) => {
    if (!TRANSPARENT_PATTERNS.has(kind)) {
      context.fillStyle = baseColor;
      context.fillRect(0, 0, DESIGN_SIZE, DESIGN_SIZE);
    }
    for (let index = 0;
      !TRANSPARENT_PATTERNS.has(kind) &&
      !["stone", "dirt", "grassTop", "grassSide", "swampGrassSide", "water", "lava"].includes(kind) &&
      index < 152;
      index += 1) {
      context.fillStyle = noiseColor;
      const size = 1 + Math.floor(random() * 2);
      context.fillRect(
        Math.floor(random() * (DESIGN_SIZE - size + 1)),
        Math.floor(random() * (DESIGN_SIZE - size + 1)),
        size,
        size,
      );
    }

    context.fillStyle = noiseColor;
    context.strokeStyle = noiseColor;
    switch (kind) {
      case "ore":
        for (let index = 0; index < 24; index += 1) {
          const size = index % 3 === 0 ? 2 : 1;
          context.fillRect(
            Math.floor(random() * (DESIGN_SIZE - size)),
            Math.floor(random() * (DESIGN_SIZE - size)),
            size,
            size,
          );
        }
        break;
      case "planks":
        context.lineWidth = 1;
        for (let line = 0; line < 8; line += 1) {
          const y = line * 2 + 1;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(DESIGN_SIZE, y);
          context.stroke();
        }
        context.fillStyle = "rgba(45, 28, 16, 0.32)";
        for (let detail = 0; detail < 24; detail += 1) {
          context.fillPixel(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
          );
        }
        break;
      case "bricks":
      case "tiles":
        context.lineWidth = 1;
        for (let y = 0; y < DESIGN_SIZE; y += 2) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(DESIGN_SIZE, y);
          context.stroke();
        }
        for (let row = 0; row < DESIGN_SIZE / 2; row += 1) {
          const offset = row % 2 ? 1 : 0;
          for (let x = offset; x < DESIGN_SIZE; x += 2) {
            context.beginPath();
            context.moveTo(x, row * 2);
            context.lineTo(x, row * 2 + 2);
            context.stroke();
          }
        }
        break;
      case "cobble":
        context.lineWidth = 1;
        context.lineJoin = "round";
        for (let index = 0; index < 8; index += 1) {
          const centerX = 1 + random() * (DESIGN_SIZE - 2);
          const centerY = 1 + random() * (DESIGN_SIZE - 2);
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
        context.fillStyle = "#9edbea";
        for (let coordinate = 0; coordinate < TEXTURE_SIZE; coordinate += 1) {
          context.fillPixel(coordinate, 0);
          context.fillPixel(coordinate, TEXTURE_SIZE - 1);
          context.fillPixel(0, coordinate);
          context.fillPixel(TEXTURE_SIZE - 1, coordinate);
        }
        break;
      case "foliage":
        for (let index = 0; index < 56; index += 1) {
          context.fillStyle = index % 2 ? noiseColor : "rgba(255, 255, 255, 0.12)";
          context.fillRect(
            Math.floor(random() * DESIGN_SIZE),
            Math.floor(random() * DESIGN_SIZE),
            1 + Math.floor(random() * 2),
            1 + Math.floor(random() * 2),
          );
        }
        for (let index = 0; index < 48; index += 1) {
          context.clearRect(
            Math.floor(random() * DESIGN_SIZE),
            Math.floor(random() * DESIGN_SIZE),
            1,
            1,
          );
        }
        break;
      case "dirt":
      case "stone":
        if (kind === "dirt") {
          for (let cluster = 0; cluster < 44; cluster += 1) {
            const centerX = Math.floor(random() * TEXTURE_SIZE);
            const centerY = Math.floor(random() * TEXTURE_SIZE);
            const size = 1 + Math.floor(random() * 3);
            context.fillStyle = cluster % 3 === 0
              ? "rgba(198, 151, 105, 0.28)"
              : "rgba(39, 25, 16, 0.24)";
            context.fillRect(centerX, centerY, size, size);
            if (random() > 0.42) {
              context.fillRect(centerX + size, centerY, 1, size);
              context.fillRect(centerX, centerY + size, size, 1);
            }
          }
        }
        if (kind === "stone") {
          for (let index = 0; index < 96; index += 1) {
            context.fillStyle = index % 3 === 0
              ? "rgba(255, 255, 255, 0.18)"
              : "rgba(0, 0, 0, 0.2)";
            context.fillPixel(
              Math.floor(random() * TEXTURE_SIZE),
              Math.floor(random() * TEXTURE_SIZE),
            );
          }
        }
        break;
      case "grassTop":
        for (let cluster = 0; cluster < 52; cluster += 1) {
          const x = Math.floor(random() * DESIGN_SIZE);
          const y = Math.floor(random() * DESIGN_SIZE);
          const size = random() < 0.18 ? 3 : 1 + Math.floor(random() * 2);
          context.fillStyle = cluster % 2
            ? "rgba(190, 226, 116, 0.32)"
            : "rgba(34, 77, 24, 0.3)";
          context.fillRect(
            x,
            y,
            size,
            1 + Math.floor(random() * 2),
          );
          if (random() > 0.5) context.fillRect(x + size, y + 1, 1, 1);
        }
        break;
      case "grassSide":
        for (let x = 0; x < DESIGN_SIZE; x += 1) {
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
          context.fillRect(Math.floor(random() * DESIGN_SIZE), Math.floor(random() * 4), 1, 1);
        }
        break;
      case "swampGrassSide":
        for (let x = 0; x < DESIGN_SIZE; x += 1) {
          const edge = 2 + Math.floor(random() * 3);
          context.fillStyle = "#365b2d";
          context.fillRect(x, 0, 1, edge);
          if (random() > 0.38) {
            context.fillStyle = "#294725";
            context.fillRect(x, edge - 1, 1, 1 + Math.floor(random() * 3));
          }
        }
        break;
      case "grassPlant":
      case "dryGrass":
        for (let blade = 0; blade < 13; blade += 1) {
          const startX = 1 + Math.floor(random() * (DESIGN_SIZE - 2));
          const height = 7 + Math.floor(random() * 9);
          const lean = Math.floor(random() * 5) - 2;
          context.fillStyle = blade % 2 ? baseColor : noiseColor;
          for (let step = 0; step < height; step += 1) {
            const x = startX + Math.round((lean * step) / height);
            const y = DESIGN_SIZE - 1 - step;
            context.fillRect(x, y, 1, 1);
            if (step < height - 2 && random() > 0.72) {
              context.fillRect(x + (lean > 0 ? -1 : 1), y, 1, 1);
            }
          }
        }
        break;
      case "flower":
        context.fillStyle = "#397c2b";
        context.fillRect(7, 7, 2, 9);
        context.fillRect(5, 11, 3, 1);
        context.fillRect(9, 9, 3, 1);
        context.fillStyle = baseColor;
        context.fillRect(5, 3, 3, 3);
        context.fillRect(8, 2, 3, 3);
        context.fillRect(10, 4, 3, 3);
        context.fillRect(7, 6, 3, 2);
        context.fillStyle = noiseColor;
        context.fillRect(8, 4, 2, 2);
        break;
      case "cherryPetals":
        for (let cluster = 0; cluster < 4; cluster += 1) {
          const x = 1 + Math.floor(random() * (DESIGN_SIZE - 4));
          const y = 8 + Math.floor(random() * (DESIGN_SIZE - 9));
          context.fillStyle = baseColor;
          context.fillRect(x, y, 3, 2);
          context.fillRect(x + 1, y - 1, 2, 1);
          context.fillStyle = noiseColor;
          context.fillRect(x + 1, y, 1, 1);
        }
        break;
      case "sapling":
        context.fillStyle = "#704626";
        context.fillRect(7, 7, 2, 9);
        context.fillStyle = baseColor;
        context.fillRect(4, 6, 3, 3);
        context.fillRect(9, 5, 4, 3);
        context.fillRect(6, 3, 4, 3);
        context.fillStyle = noiseColor;
        context.fillRect(5, 7, 1, 1);
        context.fillRect(10, 5, 1, 1);
        break;
      case "dots":
        for (let index = 0; index < 10; index += 1) {
          context.fillRect(
            Math.floor(random() * DESIGN_SIZE),
            Math.floor(random() * DESIGN_SIZE),
            2,
            2,
          );
        }
        break;
      case "rings":
        context.lineWidth = 1;
        for (const [radius, color] of [
          [7, noiseColor],
          [5.25, "rgba(255, 255, 255, 0.28)"],
          [3.5, noiseColor],
          [1.75, "rgba(50, 25, 10, 0.48)"],
        ]) {
          context.strokeStyle = color;
          context.beginPath();
          context.arc(8, 8, radius, 0, Math.PI * 2);
          context.stroke();
        }
        break;
      case "wood":
        context.lineWidth = 1;
        for (let line = 0; line < 9; line += 1) {
          const x = Math.floor(random() * DESIGN_SIZE);
          context.strokeStyle = line % 2 ? noiseColor : "rgba(50, 25, 10, 0.55)";
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, DESIGN_SIZE);
          context.stroke();
        }
        context.fillStyle = "rgba(50, 25, 10, 0.3)";
        for (let detail = 0; detail < 72; detail += 1) {
          context.fillPixel(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
          );
        }
        break;
      case "bands":
        for (let y = 2; y < DESIGN_SIZE; y += 3) context.fillRect(0, y, DESIGN_SIZE, 1);
        break;
      case "water":
        for (let y = 1; y < TEXTURE_SIZE; y += 5) {
          context.fillStyle = y % 2 ? "rgba(8, 39, 83, 0.2)" : "rgba(9, 47, 91, 0.34)";
          context.fillRect(0, y, TEXTURE_SIZE, 2);
          const rippleX = Math.floor(random() * TEXTURE_SIZE);
          context.fillStyle = "rgba(190, 232, 255, 0.54)";
          context.fillRect(rippleX, y, 3 + Math.floor(random() * 5), 1);
        }
        for (let patch = 0; patch < 32; patch += 1) {
          context.fillStyle = patch % 2
            ? "rgba(4, 33, 72, 0.2)"
            : "rgba(113, 188, 225, 0.16)";
          context.fillRect(
            Math.floor(random() * TEXTURE_SIZE),
            Math.floor(random() * TEXTURE_SIZE),
            1 + Math.floor(random() * 3),
            1 + Math.floor(random() * 2),
          );
        }
        break;
      case "lava":
        for (let band = 0; band < 8; band += 1) {
          const x = Math.floor(random() * DESIGN_SIZE);
          const y = Math.floor(random() * DESIGN_SIZE);
          const radius = 1 + random() * 2.2;
          context.fillStyle = band % 2
            ? "rgba(255, 209, 58, 0.5)"
            : "rgba(103, 20, 7, 0.55)";
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.closePath();
          context.fill();
          context.strokeStyle = "rgba(255, 244, 133, 0.82)";
          context.lineWidth = 0.7;
          context.beginPath();
          context.arc(x - 0.35, y - 0.35, radius * 0.52, Math.PI, Math.PI * 1.8);
          context.stroke();
        }
        break;
      default:
        break;
    }
  });

  if (kind === "stone" || kind === "dirt") {
    makeTextureTileable(texture.image.data);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
  }
  return texture;
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
  const atlas = new TextureAtlas();
  const atlasTexture = atlas.texture;
  const waterTexture = atlasTexture.clone();
  const lavaTexture = atlasTexture.clone();
  // Fluid UVs already target atlas tiles; legacy texture offsets must not shift the full atlas.
  waterTexture.matrixAutoUpdate = false;
  lavaTexture.matrixAutoUpdate = false;
  const textures = {
    woodenPickaxe,
    stonePickaxe,
    ironPickaxe,
    crackStages,
    atlas: atlasTexture,
  };

  const blockTextures = Array(BLOCK_COUNT).fill(null);
  for (const block of Object.values(BLOCKS)) {
    if (block.id === BLOCKS.AIR.id) continue;
    const textureNames = Array.isArray(block.textures)
      ? block.textures
      : Array(6).fill(block.textures);
    const texture = block.id === BLOCKS.WATER.id
      ? waterTexture
      : block.id === BLOCKS.LAVA.id
        ? lavaTexture
        : atlasTexture;
    blockTextures[block.id] = textureNames.map(() => texture);
  }

  return {
    ...textures,
    water: waterTexture,
    lava: lavaTexture,
    blockTextures,
  };
}
