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
import { MainMenu } from "./ui/MainMenu.js";
import { Sky } from "./world/Sky.js";
import { BlockType } from "./world/WorldGenerator.js";
import { World } from "./world/World.js";
import { WorldGenerator } from "./world/WorldGenerator.js";

const canvas = document.querySelector("#game");
const instructions = document.querySelector("#instructions");
const scene = new Scene();
scene.fog = new Fog(0x9bd9ff, 42, 116);
const WORLD_SAVE_KEY = "majutiki-world-save";

function loadSavedWorld() {
  let serialized;
  try {
    serialized = localStorage.getItem(WORLD_SAVE_KEY);
  } catch (error) {
    console.error("Could not access saved-world storage:", error);
    return null;
  }
  if (!serialized) return null;
  try {
    const savedWorld = JSON.parse(serialized);
    if (
      !Number.isInteger(savedWorld?.seed) ||
      !Array.isArray(savedWorld.blockEdits) ||
      !savedWorld.blockEdits.every(([key, entries]) =>
        typeof key === "string" &&
        Array.isArray(entries) &&
        entries.every(([index, type]) =>
          Number.isInteger(index) && index >= 0 &&
          Number.isInteger(type) && type >= 0,
        ),
      )
    ) {
      throw new TypeError("Saved world data is invalid.");
    }
    return savedWorld;
  } catch (error) {
    console.error("Could not load the saved world:", error);
    return null;
  }
}

const savedWorld = loadSavedWorld();

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 180);
const renderer = new WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const ambientLight = new AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const world = new World(
  scene,
  new WorldGenerator(savedWorld?.seed),
  savedWorld?.blockEdits,
);
const inventory = new InventoryManager(world.textures);
const player = new PlayerController(camera, renderer.domElement, world, world.getSpawnPoint(), inventory);
const entities = new EntityManager(scene, world, inventory);
player.magicSystem.setEntities(entities.entities);
const sky = new Sky(scene, ambientLight);
const mainMenu = new MainMenu(player.controls);
const clock = new Clock();
const raycaster = new Raycaster();
const screenCenter = new Vector2(0, 0);
raycaster.far = 6;
const pauseMenu = document.querySelector("#pause-menu");
const resumeButton = document.querySelector("#resume-button");
const pauseSettingsButton = document.querySelector("#pause-settings-button");
const multiplayerButton = document.querySelector("#multiplayer-button");
const saveQuitButton = document.querySelector("#save-quit-button");
const quitTitleButton = document.querySelector("#quit-title-button");
const pauseMessage = document.querySelector("#pause-message");
if (
  !pauseMenu ||
  !resumeButton ||
  !pauseSettingsButton ||
  !multiplayerButton ||
  !saveQuitButton ||
  !quitTitleButton ||
  !pauseMessage
) {
  throw new Error("Pause menu markup is incomplete.");
}

let isPaused = false;
let resumePending = false;
let pauseSettingsOpen = false;
let multiplayerTimer = null;
const multiplayerButtonLabel = multiplayerButton.textContent;

function showPauseMenu() {
  if (isPaused) return;
  isPaused = true;
  resumePending = false;
  pauseMenu.hidden = false;
  document.body.classList.add("game-paused");
  player.controls.unlock();
  resumeButton.focus();
}

function resumeGame() {
  if (!isPaused) return;
  pauseMessage.textContent = "";
  resumePending = true;
  try {
    player.controls.lock();
  } catch (error) {
    resumePending = false;
    pauseMessage.textContent = "Maussteuerung konnte nicht aktiviert werden.";
    console.error("Could not resume pointer lock:", error);
    return;
  }
  isPaused = false;
  pauseMenu.hidden = true;
  document.body.classList.remove("game-paused");
}

function returnToTitle(clearSave) {
  if (clearSave) {
    try {
      localStorage.removeItem(WORLD_SAVE_KEY);
    } catch (error) {
      pauseMessage.textContent = "Die gespeicherte Welt konnte nicht gelöscht werden.";
      console.error("Could not clear the saved world:", error);
      return;
    }
  }
  window.location.reload();
}

resumeButton.addEventListener("click", resumeGame);
pauseSettingsButton.addEventListener("click", () => {
  pauseSettingsOpen = true;
  pauseMenu.hidden = true;
  mainMenu.element.hidden = false;
  mainMenu.menuButtons.hidden = true;
  mainMenu.settingsMenu.hidden = false;
  mainMenu.renderDistanceSlider.focus();
});
mainMenu.settingsBackButton.addEventListener("click", () => {
  if (!pauseSettingsOpen) return;
  pauseSettingsOpen = false;
  mainMenu.element.hidden = true;
  pauseMenu.hidden = false;
  resumeButton.focus();
});
multiplayerButton.addEventListener("click", () => {
  clearTimeout(multiplayerTimer);
  multiplayerButton.textContent = "Aktuell in Arbeit...";
  multiplayerButton.disabled = true;
  multiplayerTimer = window.setTimeout(() => {
    multiplayerButton.textContent = multiplayerButtonLabel;
    multiplayerButton.disabled = false;
    multiplayerTimer = null;
  }, 2000);
});
saveQuitButton.addEventListener("click", () => {
  try {
    world.saveToStorage(WORLD_SAVE_KEY);
    returnToTitle(false);
  } catch (error) {
    pauseMessage.textContent = "Speichern fehlgeschlagen. Prüfe den verfügbaren Speicherplatz.";
    console.error("Could not save the world:", error);
  }
});
quitTitleButton.addEventListener("click", () => returnToTitle(true));
document.addEventListener("pointerlockerror", () => {
  if (!resumePending) return;
  resumePending = false;
  isPaused = true;
  pauseMenu.hidden = false;
  document.body.classList.add("game-paused");
  pauseMessage.textContent = "Maussteuerung blockiert. Bitte erneut versuchen.";
});
player.controls.addEventListener("lock", () => {
  if (resumePending) resumePending = false;
});

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape") {
    if (player.controls.isLocked) {
      event.preventDefault();
      showPauseMenu();
    }
    return;
  }
  if (isPaused) return;
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

  const entity = hit.object.userData.entity ?? hit.object.userData.animal;
  if (entity) {
    if (button === 2) {
      entities.interact(entity, button, player);
      return;
    }
    if (button === 0) {
      player.cancelMining();
      entities.damage(entity, player.position, player.getAttackDamage());
      player.applyWeaponHit(entity);
    }
    return;
  }

  if (button === 0) return;

  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const hitBlock = {
    x: Math.floor(hit.point.x - normal.x * 0.01),
    y: Math.floor(hit.point.y - normal.y * 0.01),
    z: Math.floor(hit.point.z - normal.z * 0.01),
  };
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
  if (
    world.setBlockAt(placeAt.x, placeAt.y, placeAt.z, block) &&
    window.gameSettings?.gameMode !== "creative"
  ) {
    inventory.removeItem(block, 1);
  }
}

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  interact(event.button);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

player.controls.addEventListener("lock", () => {
  instructions.textContent = "WASD move · Space jump · Left click mine / attack · Right click place · Q drop · E inventory";
});
player.controls.addEventListener("unlock", () => {
  instructions.textContent = "Click to play · WASD move · Space jump · Q drop item · E inventory";
});

function animate() {
  const delta = clock.getDelta();
  if (!isPaused) {
    player.update(delta);
    sky.update(delta, player.position);
    const isDay = Math.sin(sky.time * Math.PI * 2 - Math.PI / 2) > 0;
    entities.update(delta, player, isDay);
  }
  renderer.render(scene, camera);
}

window.addEventListener("pagehide", () => {
  clearTimeout(multiplayerTimer);
  renderer.setAnimationLoop(null);
  mainMenu.dispose();
  player.dispose();
  inventory.dispose();
  entities.dispose();
  sky.dispose();
  world.dispose();
  renderer.dispose();
});

renderer.setAnimationLoop(animate);
