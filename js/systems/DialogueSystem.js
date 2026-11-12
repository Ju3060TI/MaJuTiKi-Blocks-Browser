const DIALOGUE_ENDPOINT = "/api/dialogue";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function speakText(text, pitch = 1, rate = 1) {
  if (
    typeof text !== "string" ||
    !text.trim() ||
    !window.speechSynthesis ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text.trim());
  utterance.lang = "de-DE";
  utterance.pitch = clamp(Number(pitch) || 1, 0.5, 2);
  utterance.rate = clamp(Number(rate) || 1, 0.5, 2);
  window.speechSynthesis.speak(utterance);
  return true;
}

export class DialogueSystem {
  constructor(npc) {
    this.npc = npc;
    this.overlay = null;
    this.abortController = null;
    this.isOpen = false;
  }

  open(onClose = null) {
    if (!this.overlay) this.#createUI();
    this.onClose = onClose;
    this.overlay.hidden = false;
    this.overlay.style.display = "grid";
    this.isOpen = true;
    window.addEventListener("keydown", this.onKeyDown);
    this.input.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.abortController?.abort();
    this.abortController = null;
    this.sendButton.disabled = false;
    this.input.disabled = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.speechSynthesis?.cancel();
    this.overlay.hidden = true;
    this.overlay.style.display = "none";
    this.onClose?.();
  }

  dispose() {
    this.close();
    this.overlay?.remove();
    this.overlay = null;
  }

  async #sendMessage() {
    const message = this.input.value.trim();
    if (!message || this.sendButton.disabled) return;
    this.abortController?.abort();
    this.abortController = new AbortController();
    const requestController = this.abortController;
    this.sendButton.disabled = true;
    this.input.disabled = true;
    this.output.textContent = `${this.npc.profession} überlegt...`;

    try {
      const prompt =
        `Du bist ein ${this.npc.profession} in einem Minecraft-Dorf. ` +
        `Deine aktuelle Stimmung ist ${this.npc.mood}. ` +
        "Antworte in maximal 2 kurzen Sätzen, damit es natürlich klingt, wenn du es vorliest.";
      const response = await fetch(
        window.gameSettings?.dialogueEndpoint ?? DIALOGUE_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: message },
            ],
          }),
          signal: requestController.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Dialogue service returned HTTP ${response.status}.`);
      }
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? data.response;
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Dialogue service returned an empty response.");
      }
      if (!this.isOpen || requestController.signal.aborted) return;
      this.output.textContent = text.trim();
      speakText(text, this.npc.voicePitch, this.npc.voiceRate);
      this.input.value = "";
    } catch (error) {
      if (error.name === "AbortError") return;
      if (this.isOpen) {
        this.output.textContent = "Das Gespräch ist gerade nicht möglich. Bitte versuche es erneut.";
        console.error("Villager dialogue failed:", error);
      }
    } finally {
      if (this.abortController === requestController) {
        this.abortController = null;
        this.sendButton.disabled = false;
        this.input.disabled = false;
        if (this.isOpen) this.input.focus();
      }
    }
  }

  #createUI() {
    const overlay = document.createElement("section");
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `Gespräch mit ${this.npc.profession}`);
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "45",
      display: "none",
      placeItems: "center",
      padding: "24px",
      background: "rgba(8, 12, 16, 0.82)",
      backdropFilter: "blur(5px)",
      fontFamily: "system-ui, sans-serif",
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      width: "min(520px, 100%)",
      padding: "24px",
      color: "#f4f4f4",
      background: "#252a30",
      border: "2px solid #aeb8c2",
      boxShadow: "0 12px 36px rgba(0, 0, 0, 0.55)",
    });
    const title = document.createElement("h2");
    title.textContent = `${this.npc.profession} · ${this.npc.mood}`;
    const output = document.createElement("p");
    output.textContent = "Grüße, Reisender. Was möchtest du wissen?";
    output.setAttribute("aria-live", "polite");
    Object.assign(output.style, { minHeight: "48px", lineHeight: "1.5" });
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 240;
    input.placeholder = "Schreibe eine Nachricht...";
    input.setAttribute("aria-label", "Nachricht an den Dorfbewohner");
    Object.assign(input.style, {
      width: "100%",
      minHeight: "42px",
      padding: "10px",
      color: "#fff",
      background: "#171b20",
      border: "1px solid #85919d",
      font: "inherit",
    });
    const sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.textContent = "Senden";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Gespräch schließen";
    for (const button of [sendButton, closeButton]) {
      Object.assign(button.style, {
        margin: "12px 8px 0 0",
        padding: "10px 16px",
        color: "#fff",
        background: "#4b5965",
        border: "2px solid #d5dce2",
        cursor: "pointer",
        font: "inherit",
      });
    }

    sendButton.addEventListener("click", () => this.#sendMessage());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.#sendMessage();
      if (event.key === "Escape") this.close();
    });
    closeButton.addEventListener("click", () => this.close());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.close();
    });
    panel.addEventListener("click", (event) => event.stopPropagation());
    panel.append(title, output, input, sendButton, closeButton);
    overlay.append(panel);
    document.body.append(overlay);
    this.overlay = overlay;
    this.output = output;
    this.input = input;
    this.sendButton = sendButton;
    this.onKeyDown = (event) => {
      if (event.key !== "Escape" || !this.isOpen) return;
      event.stopImmediatePropagation();
      this.close();
    };
  }
}
