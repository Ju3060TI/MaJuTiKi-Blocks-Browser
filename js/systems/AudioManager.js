const STEP_SOUND = Object.freeze({
  grass: { frequency: 1150, rate: 0.72 },
  stone: { frequency: 520, rate: 0.48 },
  wood: { frequency: 790, rate: 0.58 },
});

export class AudioManager {
  constructor() {
    this.context = null;
    this.noiseBuffer = null;
    this.disposed = false;
  }

  unlock() {
    const context = this.#getContext();
    if (!context || context.state !== "suspended") return;
    context.resume().catch((error) => {
      console.error("Could not resume the audio context:", error);
    });
  }

  playBlockBreak() {
    this.#playTone(720, 260, 0.075, "square", 0.045);
  }

  playToolBreak() {
    this.#playTone(380, 95, 0.22, "triangle", 0.09);
  }

  playStep(surface = "grass") {
    const context = this.#getContext();
    if (!context || context.state !== "running") return;
    const sound = STEP_SOUND[surface] ?? STEP_SOUND.grass;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.#getNoiseBuffer(context);
    source.playbackRate.value = sound.rate;
    filter.type = "lowpass";
    filter.frequency.value = sound.frequency;
    gain.gain.setValueAtTime(0.13, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
    source.stop(context.currentTime + 0.08);
  }

  playHurt() {
    this.#playTone(170, 75, 0.2, "sawtooth", 0.1);
    this.#playTone(110, 55, 0.24, "triangle", 0.08, 0.04);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.context) return;
    this.context.close().catch((error) => {
      console.error("Could not close the audio context:", error);
    });
    this.context = null;
    this.noiseBuffer = null;
  }

  #getContext() {
    if (this.disposed || typeof window === "undefined") return null;
    if (this.context) return this.context;
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    this.context = new AudioContextConstructor();
    return this.context;
  }

  #getNoiseBuffer(context) {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sampleCount = Math.ceil(context.sampleRate * 0.12);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      channel[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  #playTone(startFrequency, endFrequency, duration, waveform, volume, delay = 0) {
    const context = this.#getContext();
    if (!context || context.state !== "running") return;
    const startTime = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }
}
