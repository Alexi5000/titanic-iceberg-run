// file: src/core/audio_manager.ts
// description: Procedural WebAudio - ocean ambience, speed-following engine hum, ship horn, collision crunch, and mission chime (no audio assets)
// reference: src/main.ts, src/ship/ship_physics.ts

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private master_filter: BiquadFilterNode | null = null;
  private engine_osc: OscillatorNode | null = null;
  private engine_gain: GainNode | null = null;
  private ambience_gain: GainNode | null = null;

  /** Must be called from a user gesture (Enter / click) to satisfy autoplay policy. */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;

    // Master lowpass for the slow-mo "underwater" sweep.
    this.master_filter = this.ctx.createBiquadFilter();
    this.master_filter.type = 'lowpass';
    this.master_filter.frequency.value = 19000;
    this.master.connect(this.master_filter).connect(this.ctx.destination);

    this.start_ambience();
    this.start_engine();
  }

  /** Slow-mo amount 0..1 sweeps the master lowpass down for a muffled effect. */
  set_slowmo(amount: number): void {
    if (!this.ctx || !this.master_filter) return;
    const target = 19000 - amount * 18200;
    this.master_filter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private noise_buffer(seconds: number): AudioBuffer {
    if (!this.ctx) throw new Error('audio not initialized');
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private start_ambience(): void {
    if (!this.ctx || !this.master) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise_buffer(4);
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;

    this.ambience_gain = this.ctx.createGain();
    this.ambience_gain.gain.value = 0.12;

    source.connect(filter).connect(this.ambience_gain).connect(this.master);
    source.start();
  }

  private start_engine(): void {
    if (!this.ctx || !this.master) return;
    this.engine_osc = this.ctx.createOscillator();
    this.engine_osc.type = 'triangle';
    this.engine_osc.frequency.value = 36;

    this.engine_gain = this.ctx.createGain();
    this.engine_gain.gain.value = 0;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    this.engine_osc.connect(filter).connect(this.engine_gain).connect(this.master);
    this.engine_osc.start();
  }

  /** Engine hum tracks ship speed each frame. */
  update_engine(speed: number): void {
    if (!this.ctx || !this.engine_osc || !this.engine_gain) return;
    const intensity = Math.min(Math.abs(speed) / 38, 1);
    const now = this.ctx.currentTime;
    this.engine_osc.frequency.setTargetAtTime(30 + intensity * 26, now, 0.4);
    this.engine_gain.gain.setTargetAtTime(intensity * 0.16, now, 0.5);
  }

  horn(): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    for (const freq of [98, 124]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.25);
      gain.gain.setValueAtTime(0.18, now + 1.9);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

      osc.connect(filter).connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + 2.7);
    }
  }

  collision_crunch(intense: boolean): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise_buffer(1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(intense ? 900 : 500, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 1.0);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intense ? 0.5 : 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + 1.2);
  }

  // ---------- Procedural music layer ----------
  private music_enabled = true;
  private music_timer = 0;
  private music_intensity = 0;
  private last_note_index = 2;

  /** A-minor pentatonic, low to high. */
  private static readonly SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

  load_music_pref(): void {
    try {
      this.music_enabled = localStorage.getItem('tir.music.v1') !== 'off';
    } catch {
      this.music_enabled = true;
    }
  }

  toggle_music(): boolean {
    this.music_enabled = !this.music_enabled;
    try {
      localStorage.setItem('tir.music.v1', this.music_enabled ? 'on' : 'off');
    } catch {
      // No persistence available.
    }
    return this.music_enabled;
  }

  /** Drives the ambient motif; intensity 0..1 follows the ice-field difficulty. */
  update_music(delta: number, intensity: number): void {
    if (!this.ctx || !this.master || !this.music_enabled) return;
    this.music_intensity += (intensity - this.music_intensity) * Math.min(delta * 0.5, 1);

    this.music_timer -= delta;
    if (this.music_timer > 0) return;

    // Beat interval tightens as the ice closes in.
    this.music_timer = 2.2 - this.music_intensity * 1.3 + Math.random() * 0.4;

    // Wander the scale, biased upward under pressure.
    const bias = Math.random() < 0.3 + this.music_intensity * 0.35 ? 1 : -1;
    this.last_note_index = Math.max(0, Math.min(AudioManager.SCALE.length - 1, this.last_note_index + bias * (Math.random() < 0.7 ? 1 : 2)));
    const freq = AudioManager.SCALE[this.last_note_index];

    const now = this.ctx.currentTime;
    const volume = 0.025 + this.music_intensity * 0.05;

    const play_tone = (frequency: number, gain_scale: number, duration: number) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume * gain_scale, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    };

    play_tone(freq, 1, 2.4);
    // Soft fifth below for body, more present at high intensity.
    if (Math.random() < 0.45 + this.music_intensity * 0.3) {
      play_tone(freq * 0.667, 0.55 + this.music_intensity * 0.3, 2.8);
    }
  }

  /** Card-earn sting whose richness scales with rarity. */
  card_sting(rarity: 'common' | 'uncommon' | 'rare' | 'legendary'): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const note_sets: Record<string, number[]> = {
      common: [523],
      uncommon: [523, 659],
      rare: [523, 659, 784],
      legendary: [523, 659, 784, 1047, 1319],
    };
    const notes = note_sets[rarity];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      osc.type = rarity === 'legendary' ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
      const gain = this.ctx.createGain();
      const start = now + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(rarity === 'legendary' ? 0.13 : 0.1, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.85);
    });
  }

  chime(): void {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.master) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  }
}
