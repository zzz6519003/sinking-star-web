const PREFERENCES_KEY = 'sinking-star-audio-v1';
const NOTES = [293.66, 329.63, 369.99, 440, 493.88, 587.33];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function describeSound(before, after, heroIndex) {
  const hero = before.heroes[heroIndex];
  const crystalsMoved = before.crates.some((p, i) => p.x !== after.crates[i].x || p.y !== after.crates[i].y);
  const companionMoved = before.heroes.some((p, i) => i !== heroIndex && (p.x !== after.heroes[i].x || p.y !== after.heroes[i].y));
  if (hero.type === 'wizard' && (crystalsMoved || companionMoved)) return 'swap';
  if (crystalsMoved) return hero.type === 'thief' ? 'pull' : 'push';
  return 'step';
}

export class Ambience {
  constructor(options = {}) {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.55;
    this.ambientEnabled = false;
    this.timer = null;
    this.lastStepAt = -Infinity;
    this.foot = 0;
    this.contextFactory = options.contextFactory || (() => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context() : null;
    });
    try {
      this.storage = options.storage ?? globalThis.localStorage;
      const preferences = JSON.parse(this.storage?.getItem(PREFERENCES_KEY) || 'null');
      if (typeof preferences?.enabled === 'boolean') this.enabled = preferences.enabled;
      if (typeof preferences?.ambient === 'boolean') this.ambientEnabled = preferences.ambient;
      if (Number.isFinite(preferences?.volume)) this.volume = clamp(preferences.volume, 0, 1);
    } catch { /* Sound also works when browser storage is unavailable. */ }
  }

  savePreferences() {
    try { this.storage?.setItem(PREFERENCES_KEY, JSON.stringify({enabled:this.enabled, volume:this.volume, ambient:this.ambientEnabled})); } catch {}
  }

  initialize() {
    if (this.ctx) return true;
    const ctx = this.contextFactory();
    if (!ctx) return false;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    const softness = ctx.createBiquadFilter();
    softness.type = 'lowpass'; softness.frequency.value = 3400; softness.Q.value = 0.45;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -20; limiter.knee.value = 14; limiter.ratio.value = 4;
    limiter.attack.value = 0.006; limiter.release.value = 0.16;
    this.master.connect(softness); softness.connect(limiter); limiter.connect(ctx.destination);
    this.effects = ctx.createGain(); this.effects.gain.value = 0.8; this.effects.connect(this.master);
    this.ambient = ctx.createGain(); this.ambient.gain.value = 0.3; this.ambient.connect(this.master);

    // Short, dark reflections provide space without a bright or muddy echo.
    const reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 0.75), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel); let smooth = 0;
      for (let i = 0; i < samples.length; i++) {
        smooth = smooth * 0.68 + (Math.random() * 2 - 1) * 0.32;
        samples[i] = smooth * Math.pow(1 - i / samples.length, 3.5) * 0.45;
      }
    }
    reverb.buffer = impulse;
    const wet = ctx.createGain(); wet.gain.value = 0.16;
    this.effects.connect(reverb); reverb.connect(wet); wet.connect(this.master);
    this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.4), ctx.sampleRate);
    const noiseData = this.noise.getChannelData(0); let smooth = 0;
    for (let i = 0; i < noiseData.length; i++) {
      smooth = smooth * 0.4 + (Math.random() * 2 - 1) * 0.6;
      noiseData[i] = smooth;
    }
    return true;
  }

  async unlock() {
    if (!this.enabled) return false;
    try {
      if (!this.initialize()) return false;
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.startAmbient();
      return this.ctx.state === 'running';
    } catch { return false; }
  }

  setVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    this.volume = clamp(number, 0, 1);
    this.updateGain(); this.savePreferences();
  }

  updateGain() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, now, 0.025);
  }

  async toggle() {
    this.enabled = !this.enabled;
    this.savePreferences(); this.updateGain();
    if (this.enabled) await this.unlock(); else this.stopAmbient();
    return this.enabled;
  }

  setAmbient(enabled) {
    this.ambientEnabled = Boolean(enabled); this.savePreferences();
    if (this.ambientEnabled) this.unlock(); else {
      this.stopAmbient();
      if(this.ctx)this.ambient.gain.setTargetAtTime(0,this.ctx.currentTime,0.08);
    }
  }

  startAmbient() {
    if (!this.enabled || !this.ambientEnabled || !this.ctx || this.timer) return;
    this.ambient.gain.setTargetAtTime(0.3,this.ctx.currentTime,0.2);
    this.chime();
    this.timer = setInterval(() => this.chime(), 6200);
  }

  stopAmbient() { clearInterval(this.timer); this.timer = null; }

  canPlay() { return this.enabled && this.volume > 0 && this.ctx && this.ctx.state !== 'closed'; }

  tone(frequency, {delay=0, duration=0.22, level=0.06, pan=0, endFrequency=frequency, ambient=false} = {}) {
    if (!this.canPlay()) return;
    const ctx = this.ctx, time = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), envelope = ctx.createGain(), position = ctx.createStereoPanner();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(0.012, duration / 6));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    position.pan.value = clamp(pan, -0.35, 0.35);
    oscillator.connect(envelope); envelope.connect(position); position.connect(ambient ? this.ambient : this.effects);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); position.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + 0.02);
  }

  rustle({duration=0.12, level=0.07, cutoff=1050, pan=0, delay=0} = {}) {
    if (!this.canPlay()) return;
    const ctx = this.ctx, time = ctx.currentTime + delay;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain(), position = ctx.createStereoPanner();
    source.buffer = this.noise;
    filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = 0.35;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + 0.009);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    position.pan.value = clamp(pan, -0.35, 0.35);
    source.connect(filter); filter.connect(envelope); envelope.connect(position); position.connect(this.effects);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); position.disconnect(); };
    source.start(time, Math.random() * 0.12); source.stop(time + duration + 0.02);
  }

  step(role='warrior') {
    if (!this.canPlay()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStepAt < 0.075) return;
    this.lastStepAt = now;
    const foot = ++this.foot % 2 ? -1 : 1, variation = 0.96 + Math.random() * 0.08;
    const frequency = {warrior:128, thief:164, wizard:196}[role] || 145;
    this.tone(frequency * variation, {duration:0.105, level:role === 'thief' ? 0.055 : 0.075, pan:foot * 0.12, endFrequency:frequency * 0.68});
    this.rustle({duration:0.075 + Math.random() * 0.035, level:role === 'thief' ? 0.055 : 0.085, cutoff:role === 'wizard' ? 1350 : 920, pan:foot * 0.12});
  }

  action(kind, role) {
    if (kind !== 'swap') this.step(role);
    if (kind === 'push' || kind === 'pull') {
      this.rustle({duration:0.2, level:0.12, cutoff:kind === 'push' ? 520 : 780});
      this.tone(kind === 'push' ? 98 : 146.83, {duration:0.17, level:0.045, delay:0.015});
    } else if (kind === 'swap') {
      this.rustle({duration:0.29, level:0.055, cutoff:1800});
      this.tone(293.66, {duration:0.32, level:0.045, endFrequency:440, pan:-0.15});
      this.tone(587.33, {duration:0.4, level:0.027, delay:0.075, pan:0.15});
    }
  }

  goal(all=false) {
    [293.66, 440, ...(all ? [587.33] : [])].forEach((note, i) => this.tone(note, {delay:0.06 + i * 0.085, duration:0.65, level:0.045 / (1 + i * 0.2), pan:(i - 1) * 0.1}));
  }

  win() {
    [293.66, 369.99, 440, 587.33].forEach((note, i) => this.tone(note, {delay:0.05 + i * 0.11, duration:1, level:0.045, pan:(i - 1.5) * 0.08}));
  }

  undo() {
    this.tone(329.63, {duration:0.2, level:0.035, endFrequency:293.66});
    this.tone(220, {duration:0.22, level:0.025, delay:0.06});
  }

  select(role) { this.tone({warrior:293.66, thief:369.99, wizard:440}[role] || 329.63, {duration:0.18, level:0.025}); }

  chime() {
    if (!this.ambientEnabled || !this.canPlay()) return;
    const note = NOTES[Math.floor(Math.random() * NOTES.length)];
    this.tone(note / 2, {duration:4.5, level:0.065, ambient:true});
    this.tone(note, {delay:0.15, duration:3.8, level:0.026, ambient:true, pan:0.2});
  }

  async suspend() {
    this.stopAmbient();
    try { if (this.ctx?.state === 'running') await this.ctx.suspend(); } catch {}
  }
}
