import { CanvasTexture, NearestFilter, SRGBColorSpace } from "three";

const TEXTURE_SIZE = 16;

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

function paintNoise(context, baseColor, variations, seed = 1) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  context.fillStyle = baseColor;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  for (let i = 0; i < 48; i += 1) {
    context.fillStyle = variations[Math.floor(random() * variations.length)];
    context.fillRect(
      Math.floor(random() * TEXTURE_SIZE),
      Math.floor(random() * TEXTURE_SIZE),
      1 + Math.floor(random() * 2),
      1 + Math.floor(random() * 2),
    );
  }
}

export function createBlockTextures() {
  const grassTop = createTexture((context) => {
    paintNoise(context, "#5eaa32", ["#4c9128", "#70bb3c", "#438326"], 2);
  });

  const grassSide = createTexture((context) => {
    paintNoise(context, "#80502b", ["#704323", "#936138", "#744828"], 3);
    context.fillStyle = "#5eaa32";
    context.fillRect(0, 0, TEXTURE_SIZE, 4);
    context.fillStyle = "#70bb3c";
    for (let x = 1; x < TEXTURE_SIZE; x += 4) {
      context.fillRect(x, 4, 2, 1);
    }
  });

  const dirt = createTexture((context) => {
    paintNoise(context, "#80502b", ["#704323", "#936138", "#744828"], 4);
  });

  const stone = createTexture((context) => {
    paintNoise(context, "#888888", ["#777777", "#999999", "#707070"], 5);
  });

  const wood = createTexture((context) => {
    paintNoise(context, "#80502b", ["#704323", "#936138", "#744828"], 6);
    context.fillStyle = "#60391f";
    for (let x = 3; x < TEXTURE_SIZE; x += 5) {
      context.fillRect(x, 0, 1, TEXTURE_SIZE);
    }
  });

  const woodTop = createTexture((context) => {
    context.fillStyle = "#b17a45";
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    context.strokeStyle = "#80502b";
    context.lineWidth = 2;
    context.strokeRect(3, 3, 10, 10);
    context.strokeRect(6, 6, 4, 4);
  });

  const leaves = createTexture((context) => {
    paintNoise(context, "#397c2b", ["#2f6d25", "#4b9134", "#397426"], 7);
  });

  const sand = createTexture((context) => {
    paintNoise(context, "#d8c47b", ["#c9b36b", "#e7d48e", "#cdb975"], 8);
  });

  const snow = createTexture((context) => {
    paintNoise(context, "#eef5fa", ["#dce8f0", "#ffffff", "#e5eef5"], 9);
  });

  const coalOre = createTexture((context) => {
    paintNoise(context, "#777777", ["#252525", "#303030", "#999999"], 10);
  });

  const ironOre = createTexture((context) => {
    paintNoise(context, "#777777", ["#ad7954", "#c18d65", "#999999"], 11);
  });

  const planks = createTexture((context) => {
    paintNoise(context, "#a87542", ["#8d5d35", "#ba8952", "#97653a"], 12);
    context.fillStyle = "#704626";
    for (let y = 3; y < TEXTURE_SIZE; y += 5) context.fillRect(0, y, TEXTURE_SIZE, 1);
  });

  return { grassTop, grassSide, dirt, stone, wood, woodTop, leaves, sand, snow, coalOre, ironOre, planks };
}
