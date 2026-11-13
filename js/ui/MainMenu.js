const LOADING_DURATION_MS = 650;
const POINTER_LOCK_TIMEOUT_MS = 2000;
const WORLD_OPTIONS_KEY = "majutiki-world-settings";

function loadWorldOptions() {
  try {
    const savedOptions = JSON.parse(localStorage.getItem(WORLD_OPTIONS_KEY) ?? "{}");
    return savedOptions && typeof savedOptions === "object" ? savedOptions : {};
  } catch (error) {
    console.error("Could not load world settings:", error);
    return {};
  }
}

function createRandomSeed() {
  const values = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`;
  }
  return Math.random().toString(36).slice(2, 14);
}

function getSetting(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(min, Math.min(max, Math.round(number)))
    : fallback;
}

export class MainMenu {
  constructor(controls) {
    this.controls = controls;
    this.element = document.querySelector("#main-menu");
    this.worldCreationMenu = document.querySelector("#world-creation-menu");
    this.worldNameInput = document.querySelector("#world-name");
    this.worldSeedInput = document.querySelector("#world-seed");
    this.worldGameModeSelect = document.querySelector("#world-game-mode");
    this.randomSeedButton = document.querySelector("#random-seed-button");
    this.worldCreationBackButton = document.querySelector("#world-creation-back");
    this.createWorldButton = document.querySelector("#create-world-button");
    this.worldCreationMessage = document.querySelector("#world-creation-message");
    this.characterScreen = document.querySelector("#char-creation-screen");
    this.characterBackButton = document.querySelector("#character-back");
    this.enterWorldButton = document.querySelector("#enter-world-button");
    this.factionSelect = document.querySelector("#player-faction");
    this.raceSelect = document.querySelector("#player-race");
    this.playerClassSelect = document.querySelector("#player-class");
    this.characterMessage = document.querySelector("#character-message");
    this.loadingScreen = document.querySelector("#loading-screen");
    this.playButton = document.querySelector("#play-button");
    this.settingsButton = document.querySelector("#settings-button");
    this.settingsMenu = document.querySelector("#settings-menu");
    this.settingsBackButton = document.querySelector("#settings-back");
    this.gameModeSelect = document.querySelector("#game-mode");
    this.rpgClassControl = document.querySelector("#rpg-class-control");
    this.rpgClassSelect = document.querySelector("#rpg-class");
    this.renderDistanceSlider = document.querySelector("#render-distance");
    this.renderDistanceValue = document.querySelector("#render-distance-value");
    this.lodDistanceSlider = document.querySelector("#lod-distance");
    this.lodDistanceValue = document.querySelector("#lod-distance-value");
    this.simDistanceSlider = document.querySelector("#sim-distance");
    this.simDistanceValue = document.querySelector("#sim-distance-value");
    this.menuButtons = document.querySelector(".menu-buttons");
    this.message = document.querySelector("#menu-message");
    if (
      !this.element ||
      !this.worldCreationMenu ||
      !this.worldNameInput ||
      !this.worldSeedInput ||
      !this.worldGameModeSelect ||
      !this.randomSeedButton ||
      !this.worldCreationBackButton ||
      !this.createWorldButton ||
      !this.worldCreationMessage ||
      !this.characterScreen ||
      !this.characterBackButton ||
      !this.enterWorldButton ||
      !this.factionSelect ||
      !this.raceSelect ||
      !this.playerClassSelect ||
      !this.characterMessage ||
      !this.loadingScreen ||
      !this.playButton ||
      !this.settingsButton ||
      !this.settingsMenu ||
      !this.settingsBackButton ||
      !this.gameModeSelect ||
      !this.rpgClassControl ||
      !this.rpgClassSelect ||
      !this.renderDistanceSlider ||
      !this.renderDistanceValue ||
      !this.lodDistanceSlider ||
      !this.lodDistanceValue ||
      !this.simDistanceSlider ||
      !this.simDistanceValue ||
      !this.menuButtons ||
      !this.message
    ) {
      throw new Error("Main menu markup is incomplete.");
    }

    const savedSettings = {
      ...loadWorldOptions(),
      ...(window.settings ?? {}),
      ...(window.gameSettings ?? {}),
    };
    window.gameSettings = {
      ...savedSettings,
      worldName: typeof savedSettings.worldName === "string" ? savedSettings.worldName : "",
      worldSeed: typeof savedSettings.worldSeed === "string" ? savedSettings.worldSeed : "",
      gameMode: ["creative", "vanilla", "rpg"].includes(savedSettings.gameMode)
        ? savedSettings.gameMode
        : "vanilla",
      rpgClass: ["survivor", "villager", "monster"].includes(savedSettings.rpgClass)
        ? savedSettings.rpgClass
        : "survivor",
      renderDistance: getSetting(savedSettings.renderDistance, 4, 2, 10),
      simDistance: getSetting(savedSettings.simDistance, 4, 1, 10),
      lodDistance: getSetting(savedSettings.lodDistance, 2, 1, 5),
      playerFaction: ["neutral", "villager", "elves", "dwarves", "monsters"].includes(savedSettings.playerFaction)
        ? savedSettings.playerFaction
        : "neutral",
      playerRace: ["human", "elf", "dwarf", "zombie", "skeleton"].includes(savedSettings.playerRace)
        ? savedSettings.playerRace
        : "human",
      playerClass: ["warrior", "mage", "archer", "rogue"].includes(savedSettings.playerClass)
        ? savedSettings.playerClass
        : "warrior",
    };
    window.settings = window.gameSettings;
    this.gameModeSelect.value = window.gameSettings.gameMode;
    this.rpgClassSelect.value = window.gameSettings.rpgClass;
    this.#updateClassVisibility();
    this.renderDistanceSlider.value = String(window.gameSettings.renderDistance);
    this.lodDistanceSlider.value = String(window.gameSettings.lodDistance);
    this.simDistanceSlider.value = String(window.gameSettings.simDistance);
    this.factionSelect.value = window.gameSettings.playerFaction;
    this.raceSelect.value = window.gameSettings.playerRace;
    this.playerClassSelect.value = window.gameSettings.playerClass;
    this.worldNameInput.value = window.gameSettings.worldName;
    this.worldSeedInput.value = window.gameSettings.worldSeed;
    this.worldGameModeSelect.value = window.gameSettings.gameMode;
    this.#updateDistanceLabels();

    this.starting = false;
    this.loadingTimer = null;
    this.lockTimeout = null;
    this.onPlay = (event) => {
      event.preventDefault();
      this.#showWorldCreation();
    };
    this.onRandomSeed = () => {
      this.worldSeedInput.value = createRandomSeed();
      this.worldCreationMessage.textContent = "";
    };
    this.onWorldCreationBack = () => this.#hideWorldCreation();
    this.onCreateWorld = () => this.#createWorld();
    this.onCharacterBack = () => this.#showMainMenu();
    this.onEnterWorld = () => this.#enterWorld();
    this.onSettings = () => this.#showSettings();
    this.onSettingsBack = () => this.#showMenuButtons();
    this.onDistanceInput = () => this.#handleDistanceInput();
    this.onGameModeChange = () => this.#handleGameSettingsInput();
    this.onRpgClassChange = () => this.#handleGameSettingsInput();
    this.onLock = () => this.#handlePointerLock();
    this.onPointerLockError = () => this.#handlePointerLockError();

    this.playButton.addEventListener("click", this.onPlay);
    this.randomSeedButton.addEventListener("click", this.onRandomSeed);
    this.worldCreationBackButton.addEventListener("click", this.onWorldCreationBack);
    this.createWorldButton.addEventListener("click", this.onCreateWorld);
    this.characterBackButton.addEventListener("click", this.onCharacterBack);
    this.enterWorldButton.addEventListener("click", this.onEnterWorld);
    this.settingsButton.addEventListener("click", this.onSettings);
    this.settingsBackButton.addEventListener("click", this.onSettingsBack);
    this.renderDistanceSlider.addEventListener("input", this.onDistanceInput);
    this.lodDistanceSlider.addEventListener("input", this.onDistanceInput);
    this.simDistanceSlider.addEventListener("input", this.onDistanceInput);
    this.gameModeSelect.addEventListener("change", this.onGameModeChange);
    this.rpgClassSelect.addEventListener("change", this.onRpgClassChange);
    this.controls.addEventListener("lock", this.onLock);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    this.controls.unlock();
    document.body.classList.add("menu-open");
    this.#dispatchGameSettings();
  }

  dispose() {
    clearTimeout(this.loadingTimer);
    clearTimeout(this.lockTimeout);
    this.playButton.removeEventListener("click", this.onPlay);
    this.randomSeedButton.removeEventListener("click", this.onRandomSeed);
    this.worldCreationBackButton.removeEventListener("click", this.onWorldCreationBack);
    this.createWorldButton.removeEventListener("click", this.onCreateWorld);
    this.characterBackButton.removeEventListener("click", this.onCharacterBack);
    this.enterWorldButton.removeEventListener("click", this.onEnterWorld);
    this.settingsButton.removeEventListener("click", this.onSettings);
    this.settingsBackButton.removeEventListener("click", this.onSettingsBack);
    this.renderDistanceSlider.removeEventListener("input", this.onDistanceInput);
    this.lodDistanceSlider.removeEventListener("input", this.onDistanceInput);
    this.simDistanceSlider.removeEventListener("input", this.onDistanceInput);
    this.gameModeSelect.removeEventListener("change", this.onGameModeChange);
    this.rpgClassSelect.removeEventListener("change", this.onRpgClassChange);
    this.controls.removeEventListener("lock", this.onLock);
    document.removeEventListener("pointerlockerror", this.onPointerLockError);
  }

  #startGame() {
    this.#beginWorld();
  }

  #showWorldCreation() {
    this.worldCreationMessage.textContent = "";
    this.worldCreationMenu.hidden = false;
    this.worldNameInput.focus();
  }

  #hideWorldCreation() {
    this.worldCreationMenu.hidden = true;
    this.playButton.focus();
  }

  #createWorld() {
    const worldName = this.worldNameInput.value.trim() || "Neue Welt";
    const worldSeed = this.worldSeedInput.value.trim() || createRandomSeed();
    const gameMode = this.worldGameModeSelect.value;
    if (!["vanilla", "creative", "rpg"].includes(gameMode)) {
      throw new RangeError(`Unsupported game mode: ${gameMode}`);
    }

    Object.assign(window.gameSettings, { worldName, worldSeed, gameMode });
    this.worldNameInput.value = worldName;
    this.worldSeedInput.value = worldSeed;
    this.gameModeSelect.value = gameMode;
    this.#updateClassVisibility();

    try {
      localStorage.setItem(WORLD_OPTIONS_KEY, JSON.stringify({
        worldName,
        worldSeed,
        gameMode,
      }));
    } catch (error) {
      this.worldCreationMessage.textContent = "Welteinstellungen konnten nicht gespeichert werden.";
      console.error("Could not save world settings:", error);
      return;
    }

    this.worldCreationMessage.textContent = "";
    this.#dispatchGameSettings();
    this.worldCreationMenu.hidden = true;
    this.#startGame();
  }

  #enterWorld() {
    this.#beginWorld();
  }

  #beginWorld() {
    if (this.starting) return;
    this.starting = true;
    clearTimeout(this.loadingTimer);
    clearTimeout(this.lockTimeout);
    this.message.textContent = "";
    this.characterMessage.textContent = "";
    this.worldCreationMenu.hidden = true;
    window.gameSettings.playerFaction = this.factionSelect.value;
    window.gameSettings.playerRace = this.raceSelect.value;
    window.gameSettings.playerClass = this.playerClassSelect.value;
    this.element.hidden = true;
    this.characterScreen.hidden = true;
    this.loadingScreen.hidden = false;

    try {
      this.controls.lock();
    } catch (error) {
      this.#restoreMenu("Mouse capture could not be requested. Please try again.");
      console.error("Pointer lock request failed:", error);
      return;
    }

    this.#dispatchGameSettings();
    window.dispatchEvent(new CustomEvent("charactercreated", {
      detail: { ...window.gameSettings },
    }));
    this.lockTimeout = window.setTimeout(() => {
      if (this.controls.isLocked || !this.starting) return;
      this.#restoreMenu("Mouse capture was blocked. Click Play and allow pointer lock.");
    }, POINTER_LOCK_TIMEOUT_MS);
  }

  #handlePointerLock() {
    if (!this.starting) return;
    clearTimeout(this.lockTimeout);
    this.loadingTimer = window.setTimeout(() => {
      this.loadingScreen.hidden = true;
      document.body.classList.remove("menu-open");
      this.starting = false;
    }, LOADING_DURATION_MS);
  }

  #handlePointerLockError() {
    if (this.starting) {
      this.#restoreMenu("Could not capture the mouse. Please try again.");
    }
  }

  #restoreMenu(message) {
    clearTimeout(this.loadingTimer);
    clearTimeout(this.lockTimeout);
    this.loadingScreen.hidden = true;
    this.element.hidden = true;
    this.worldCreationMenu.hidden = false;
    this.characterScreen.hidden = true;
    document.body.classList.add("menu-open");
    this.worldCreationMessage.textContent = message;
    this.starting = false;
  }

  #showMainMenu() {
    this.characterScreen.hidden = true;
    this.worldCreationMenu.hidden = true;
    this.element.hidden = false;
    this.menuButtons.hidden = false;
    this.settingsMenu.hidden = true;
    this.playButton.focus();
  }

  #showSettings() {
    this.menuButtons.hidden = true;
    this.settingsMenu.hidden = false;
    this.renderDistanceSlider.focus();
  }

  #showMenuButtons() {
    this.settingsMenu.hidden = true;
    this.menuButtons.hidden = false;
    this.settingsButton.focus();
  }

  #handleDistanceInput() {
    const renderDistance = Number(this.renderDistanceSlider.value);
    const lodDistance = Number(this.lodDistanceSlider.value);
    const simDistance = Number(this.simDistanceSlider.value);
    window.gameSettings.renderDistance = renderDistance;
    window.gameSettings.lodDistance = lodDistance;
    window.gameSettings.simDistance = simDistance;
    this.#updateDistanceLabels();
    this.#dispatchGameSettings();
  }

  #handleGameSettingsInput() {
    window.gameSettings.gameMode = this.gameModeSelect.value;
    window.gameSettings.rpgClass = this.rpgClassSelect.value;
    this.#updateClassVisibility();
    this.#dispatchGameSettings();
  }

  #updateClassVisibility() {
    this.rpgClassControl.hidden = window.gameSettings.gameMode !== "rpg";
  }

  #dispatchGameSettings() {
    window.dispatchEvent(
      new CustomEvent("gamesettingschange", {
        detail: { ...window.gameSettings },
      }),
    );
  }

  #updateDistanceLabels() {
    this.renderDistanceValue.value = `${this.renderDistanceSlider.value} Chunks`;
    this.renderDistanceValue.textContent = this.renderDistanceValue.value;
    this.lodDistanceValue.value = `${this.lodDistanceSlider.value} Chunks`;
    this.lodDistanceValue.textContent = this.lodDistanceValue.value;
    this.simDistanceValue.value = `${this.simDistanceSlider.value} Chunks`;
    this.simDistanceValue.textContent = this.simDistanceValue.value;
  }
}
