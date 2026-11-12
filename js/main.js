import {
  AmbientLight,
  Clock,
  Fog,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { EntityManager } from "./entities/EntityManager.js";
import { InventoryManager } from "./inventory/InventoryManager.js";
import { PlayerController } from "./player/PlayerController.js";
import { Sky } from "./world/Sky.js";
import { BlockType } from "./world/WorldGenerator.js";
import { World } from "./world/World.js";
import { WorldGenerator } from "./world/WorldGenerator.js";

const canvas = document.querySelector("#game");
const instructions = document.querySelector("#instructions");
const scene = new Scene();
scene.fog = new Fog(0x9bd9ff, 42, 116);

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 180);
const renderer = new WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const ambientLight = new AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const world = new World(scene, new WorldGenerator());
const player = new PlayerController(camera, renderer.domElement, world);
const inventory = new InventoryManager();
const entities = new EntityManager(scene, world, inventory);
const sky = new Sky(scene, ambientLight);
const clock = new Clock();
const raycaster = new Raycaster();
const screenCenter = new Vector2(0, 0);
raycaster.far = 6;

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyE" && !event.repeat) {
    inventory.toggle();
    if (!inventory.panel.hidden) player.controls.unlock();
    event.preventDefault();
    return;
  }
  if (event.code.startsWith("Digit")) {
    const slot = Number(event.code.slice(5)) - 1;
    if (slot >= 0 && slot < 9) inventory.selectSlot(slot);
  }
});

document.querySelector("#inventory-close").addEventListener("click", () => inventory.setVisible(false));
document.querySelector("#inventory").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) inventory.setVisible(false);
});

function isPlayerOverlappingBlock(x, y, z) {
  return (
    x + 1 > player.position.x - 0.3 &&
    x < player.position.x + 0.3 &&
    z + 1 > player.position.z - 0.3 &&
    z < player.position.z + 0.3 &&
    y + 1 > player.position.y &&
    y < player.position.y + 1.8
  );
}

function interact(button) {
  if (!player.controls.isLocked) return;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(screenCenter, camera);
  const targets = [...entities.getMeshes(), ...world.getMeshes()];
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return;

  const animal = hit.object.userData.animal;
  if (animal) {
    if (button === 0) entities.damage(animal);
    return;
  }

  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const hitBlock = {
    x: Math.floor(hit.point.x - normal.x * 0.01),
    y: Math.floor(hit.point.y - normal.y * 0.01),
    z: Math.floor(hit.point.z - normal.z * 0.01),
  };
  if (button === 0) {
    const dropped = world.breakBlock(hitBlock.x, hitBlock.y, hitBlock.z);
    if (dropped !== BlockType.AIR) inventory.addItem(dropped, 1);
    return;
  }

  const block = inventory.getSelectedBlock();
  if (block === null) return;
  const placeAt = {
    x: Math.floor(hit.point.x + normal.x * 0.01),
    y: Math.floor(hit.point.y + normal.y * 0.01),
    z: Math.floor(hit.point.z + normal.z * 0.01),
  };
  if (
    world.getBlockAt(placeAt.x, placeAt.y, placeAt.z) !== BlockType.AIR ||
    isPlayerOverlappingBlock(placeAt.x, placeAt.y, placeAt.z)
  ) {
    return;
  }
  if (world.setBlockAt(placeAt.x, placeAt.y, placeAt.z, block)) inventory.removeItem(block, 1);
}

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  interact(event.button);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

player.controls.addEventListener("lock", () => {
  instructions.textContent = "WASD move · Space jump · Left click mine / attack · Right click place · E inventory";
});
player.controls.addEventListener("unlock", () => {
  instructions.textContent = "Click to play · WASD move · Space jump · E inventory";
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  player.update(delta);
  entities.update(delta, player.position);
  sky.update(delta, player.position);
  renderer.render(scene, camera);
}

window.addEventListener("pagehide", () => {
  player.dispose();
  inventory.dispose();
  entities.dispose();
  sky.dispose();
  world.dispose();
  renderer.dispose();
});

animate();
