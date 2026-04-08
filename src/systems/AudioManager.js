// ── Procedural Audio Manager ─────────────────────────────────────
// Synthesizes all sound effects at runtime using Web Audio API.
// No external audio files needed — mirrors SpriteGenerator's approach.

import Phaser from 'phaser';

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.activeSounds = new Map();
    this.maxConcurrent = 6;
    this.whiteNoiseBuffer = null;

    // Music state
    this.currentMusic = null; // { id, schedulerId, nodes[] }
    this.musicVolume = parseFloat(localStorage.getItem('rootbound_music_volume')) || 0.35;

    // Load persisted state
    this.muted = localStorage.getItem('rootbound_muted') === 'true';
    this.volume = parseFloat(localStorage.getItem('rootbound_sfx_volume')) || 0.7;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master → destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.muted ? 0 : this.volume;

    // SFX → master
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.sfxGain.gain.value = 1.0;

    // Music → master
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.masterGain);
    this.musicGain.gain.value = this.musicVolume;

    // Pre-generate noise buffer (1 second at sample rate)
    this._generateNoiseBuffers();
  }

  _generateNoiseBuffers() {
    const sr = this.ctx.sampleRate;
    const length = sr; // 1 second
    this.whiteNoiseBuffer = this.ctx.createBuffer(1, length, sr);
    const data = this.whiteNoiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  play(soundId, params = {}) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Polyphony limiting
    const count = this.activeSounds.get(soundId) || 0;
    if (count >= this.maxConcurrent) return;
    this.activeSounds.set(soundId, count + 1);

    const method = this._sounds[soundId];
    if (method) {
      method.call(this, params);
    }
  }

  _trackEnd(soundId) {
    const count = this.activeSounds.get(soundId) || 1;
    this.activeSounds.set(soundId, Math.max(0, count - 1));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    localStorage.setItem('rootbound_muted', this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.volume;
    }
    localStorage.setItem('rootbound_sfx_volume', this.volume);
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
    localStorage.setItem('rootbound_music_volume', this.musicVolume);
  }

  // ── Music Engine ──────────────────────────────────────────────

  startMusic(biomeId) {
    if (!this.ctx) return;
    if (this.currentMusic && this.currentMusic.id === biomeId) return;

    this.stopMusic(true); // crossfade out old

    const def = BIOME_MUSIC[biomeId];
    if (!def) return;

    const fadeGain = this.ctx.createGain();
    fadeGain.gain.setValueAtTime(0, this.ctx.currentTime);
    fadeGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);
    fadeGain.connect(this.musicGain);

    this.currentMusic = {
      id: biomeId,
      fadeGain,
      schedulerId: null,
      nextBeat: this.ctx.currentTime + 0.1,
      patternIndex: 0,
      activeNodes: [],
      def,
    };

    this._scheduleMusicAhead();
    this.currentMusic.schedulerId = setInterval(() => this._scheduleMusicAhead(), 200);
  }

  stopMusic(crossfade = false) {
    if (!this.currentMusic) return;
    const music = this.currentMusic;
    this.currentMusic = null;

    if (music.schedulerId) clearInterval(music.schedulerId);

    if (crossfade && music.fadeGain) {
      const t = this.ctx.currentTime;
      music.fadeGain.gain.setValueAtTime(music.fadeGain.gain.value, t);
      music.fadeGain.gain.linearRampToValueAtTime(0, t + 1.2);
      // Clean up nodes after fade
      setTimeout(() => {
        music.activeNodes.forEach(n => { try { n.stop(); } catch(e) {} });
        music.activeNodes = [];
        try { music.fadeGain.disconnect(); } catch(e) {}
      }, 1500);
    } else {
      music.activeNodes.forEach(n => { try { n.stop(); } catch(e) {} });
      music.activeNodes = [];
      try { music.fadeGain.disconnect(); } catch(e) {}
    }
  }

  _scheduleMusicAhead() {
    if (!this.currentMusic || !this.ctx) return;
    const music = this.currentMusic;
    const def = music.def;
    const lookAhead = this.ctx.currentTime + 1.5; // schedule 1.5s ahead

    while (music.nextBeat < lookAhead) {
      const beatTime = music.nextBeat;
      const pattern = def.pattern;
      const step = pattern[music.patternIndex % pattern.length];

      // Schedule notes for this beat
      if (step) {
        this._scheduleMusicStep(music, def, step, beatTime);
      }

      music.patternIndex++;
      music.nextBeat += def.beatDuration;
    }
  }

  _scheduleMusicStep(music, def, step, time) {
    // step can be: null (rest), a note index, or an array of note indices
    const notes = Array.isArray(step) ? step : [step];

    for (const noteIdx of notes) {
      if (noteIdx === null || noteIdx === undefined) continue;

      const freq = def.scale[noteIdx % def.scale.length];
      const octaveShift = Math.floor(noteIdx / def.scale.length);
      const finalFreq = freq * Math.pow(2, octaveShift);

      // Melody voice
      for (const voice of def.voices) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = voice.type;
        osc.frequency.setValueAtTime(finalFreq * (voice.octave || 1), time);

        if (voice.detune) osc.detune.value = voice.detune;

        const dur = voice.noteDur || def.beatDuration * 0.8;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(voice.gain || 0.08, time + 0.01);
        gain.gain.setValueAtTime(voice.gain || 0.08, time + dur * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        // Optional filter for timbre
        if (voice.filterFreq) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = voice.filterFreq;
          filter.Q.value = voice.filterQ || 1;
          osc.connect(filter);
          filter.connect(gain);
        } else {
          osc.connect(gain);
        }

        gain.connect(music.fadeGain);
        osc.start(time);
        osc.stop(time + dur + 0.05);
        music.activeNodes.push(osc);
        osc.onended = () => {
          const idx = music.activeNodes.indexOf(osc);
          if (idx !== -1) music.activeNodes.splice(idx, 1);
          try { gain.disconnect(); } catch(e) {}
        };
      }
    }

    // Ambient drone / pad (continuous per beat)
    if (def.drone) {
      const droneOsc = this.ctx.createOscillator();
      const droneGain = this.ctx.createGain();
      droneOsc.type = def.drone.type;
      droneOsc.frequency.value = def.drone.freq;
      if (def.drone.detune) droneOsc.detune.value = def.drone.detune;
      const droneDur = def.beatDuration;
      droneGain.gain.setValueAtTime(def.drone.gain || 0.03, time);
      droneGain.gain.setValueAtTime(def.drone.gain || 0.03, time + droneDur * 0.9);
      droneGain.gain.exponentialRampToValueAtTime(0.001, time + droneDur);
      droneOsc.connect(droneGain);
      droneGain.connect(music.fadeGain);
      droneOsc.start(time);
      droneOsc.stop(time + droneDur + 0.05);
      music.activeNodes.push(droneOsc);
      droneOsc.onended = () => {
        const idx = music.activeNodes.indexOf(droneOsc);
        if (idx !== -1) music.activeNodes.splice(idx, 1);
        try { droneGain.disconnect(); } catch(e) {}
      };
    }
  }

  createMuteButton(scene) {
    const { width } = scene.scale;
    const x = width - 24;
    const y = 24;

    const btn = scene.add.graphics().setDepth(100).setInteractive(
      new Phaser.Geom.Circle(0, 0, 16), Phaser.Geom.Circle.Contains
    );
    btn.setPosition(x, y);

    const drawIcon = () => {
      btn.clear();
      // Background circle
      btn.fillStyle(0x000000, 0.4);
      btn.fillCircle(0, 0, 14);
      btn.lineStyle(1, 0x666666, 0.6);
      btn.strokeCircle(0, 0, 14);

      if (this.muted) {
        // Muted: speaker with X
        btn.fillStyle(0x888888, 0.8);
        btn.fillRect(-6, -3, 4, 6);
        btn.fillTriangle(-6, -3, -10, -6, -10, 6);
        btn.fillTriangle(-6, 3, -10, 6, -10, -6);
        // X mark
        btn.lineStyle(2, 0xFF4444, 0.9);
        btn.lineBetween(2, -5, 9, 5);
        btn.lineBetween(2, 5, 9, -5);
      } else {
        // Unmuted: speaker with waves
        btn.fillStyle(0x88CC88, 0.8);
        btn.fillRect(-6, -3, 4, 6);
        btn.fillTriangle(-6, -3, -10, -6, -10, 6);
        btn.fillTriangle(-6, 3, -10, 6, -10, -6);
        // Sound waves
        btn.lineStyle(1.5, 0x88CC88, 0.6);
        btn.beginPath();
        btn.arc(0, 0, 5, -0.6, 0.6);
        btn.strokePath();
        btn.beginPath();
        btn.arc(0, 0, 9, -0.6, 0.6);
        btn.strokePath();
      }
    };

    drawIcon();

    btn.on('pointerdown', () => {
      this.init(); // Ensure AudioContext exists
      this.toggleMute();
      drawIcon();
    });
    btn.on('pointerover', () => {
      btn.setAlpha(1);
    });
    btn.on('pointerout', () => {
      btn.setAlpha(0.7);
    });
    btn.setAlpha(0.7);

    return btn;
  }

  // ── Helpers ────────────────────────────────────────────────────

  _osc(type, freq, duration, gainVal = 0.3, attack = 0.005, decay = null) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainVal, t + attack);
    const decayTime = decay || duration - attack;
    gain.gain.exponentialRampToValueAtTime(0.001, t + attack + decayTime);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    return { osc, gain, t };
  }

  _noise(duration, filterFreq = 2000, filterQ = 1, gainVal = 0.2) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration + 0.05);
    return { src, gain, t };
  }

  _sweep(type, startFreq, endFreq, duration, gainVal = 0.3) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
    return { osc, gain, t };
  }

  _arpeggio(freqs, noteDur, type = 'sine', gainVal = 0.25) {
    const t = this.ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = t + i * noteDur;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainVal, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDur);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + noteDur + 0.05);
    });
  }

  // ── Sound Definitions ──────────────────────────────────────────

  get _sounds() {
    return {
      // ── Combat ──

      fireProjectile: (params) => {
        const id = 'fireProjectile';
        // Sine sweep down + twang — varies slightly by damage type
        const baseFreq = 800 + (Math.random() * 100 - 50);
        const typeShift = { fire: -100, frost: 100, lightning: 150, poison: -50, void: -80 };
        const shift = typeShift[params.damageType] || 0;
        this._sweep('sine', baseFreq + shift, 400 + shift, 0.08, 0.15);
        this._osc('triangle', 1200 + shift, 0.03, 0.1, 0.003);
        setTimeout(() => this._trackEnd(id), 100);
      },

      projectileHit: () => {
        const id = 'projectileHit';
        this._noise(0.06, 2000 + Math.random() * 500, 2, 0.18);
        this._osc('sine', 300 + Math.random() * 60, 0.05, 0.12, 0.002, 0.04);
        setTimeout(() => this._trackEnd(id), 80);
      },

      critHit: () => {
        const id = 'critHit';
        // Louder hit + metallic ring
        this._noise(0.08, 1800, 2, 0.3);
        this._osc('sine', 250, 0.1, 0.25, 0.002, 0.08);
        this._osc('sine', 1000, 0.2, 0.15, 0.005, 0.18);
        this._osc('triangle', 1500, 0.15, 0.08, 0.005);
        setTimeout(() => this._trackEnd(id), 200);
      },

      enemyKilled: () => {
        const id = 'enemyKilled';
        // Descending pop
        this._sweep('sine', 600, 100, 0.12, 0.2);
        this._noise(0.08, 1500, 1, 0.15);
        setTimeout(() => this._trackEnd(id), 150);
      },

      bossKilled: () => {
        const id = 'bossKilled';
        // Deep impact + rising triumph
        this._osc('sine', 80, 0.25, 0.35, 0.005, 0.22);
        this._sweep('sine', 200, 1200, 0.4, 0.2);
        this._noise(0.15, 800, 1, 0.2);
        // Triumph arpeggio delayed
        setTimeout(() => {
          this._arpeggio([523, 659, 784, 1047], 0.12, 'triangle', 0.2);
        }, 300);
        setTimeout(() => this._trackEnd(id), 800);
      },

      playerHit: () => {
        const id = 'playerHit';
        // Low muffled thud
        this._osc('sine', 150, 0.08, 0.25, 0.002, 0.07);
        this._noise(0.06, 600, 0.5, 0.15);
        setTimeout(() => this._trackEnd(id), 120);
      },

      playerDeath: () => {
        const id = 'playerDeath';
        // Descending fade
        this._sweep('sine', 400, 80, 0.3, 0.25);
        this._noise(0.25, 500, 0.5, 0.12);
        this._sweep('triangle', 300, 60, 0.35, 0.1);
        setTimeout(() => this._trackEnd(id), 350);
      },

      waveStart: () => {
        const id = 'waveStart';
        // Rising announcement
        this._sweep('triangle', 200, 600, 0.25, 0.2);
        this._osc('sine', 400, 0.15, 0.1, 0.05, 0.1);
        setTimeout(() => this._trackEnd(id), 300);
      },

      bossIncoming: () => {
        const id = 'bossIncoming';
        // Menacing low drone + warning
        this._osc('sawtooth', 80, 0.5, 0.15, 0.05, 0.4);
        this._osc('sine', 100, 0.4, 0.2, 0.02, 0.35);
        this._sweep('triangle', 150, 300, 0.35, 0.12);
        // Warning tone
        setTimeout(() => {
          this._osc('square', 440, 0.08, 0.1, 0.003);
        }, 200);
        setTimeout(() => {
          this._osc('square', 440, 0.08, 0.1, 0.003);
        }, 350);
        setTimeout(() => this._trackEnd(id), 500);
      },

      waveComplete: () => {
        const id = 'waveComplete';
        // Ascending C-E-G arpeggio
        this._arpeggio([523, 659, 784], 0.12, 'sine', 0.2);
        setTimeout(() => this._trackEnd(id), 400);
      },

      // ── Status Effects ──

      burn: () => {
        const id = 'burn';
        this._noise(0.05, 3000 + Math.random() * 500, 1.5, 0.1);
        this._osc('sine', 200, 0.03, 0.05, 0.002);
        setTimeout(() => this._trackEnd(id), 60);
      },

      frost: () => {
        const id = 'frost';
        // Shimmer
        const t = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 2000;
        osc2.type = 'sine';
        osc2.frequency.value = 2005; // Beat frequency
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.1);
        osc2.stop(t + 0.1);
        setTimeout(() => this._trackEnd(id), 80);
      },

      freeze: () => {
        const id = 'freeze';
        // Crystalline descending sweep
        this._sweep('sine', 3000, 1500, 0.2, 0.15);
        this._osc('triangle', 2500, 0.15, 0.08, 0.005);
        this._noise(0.1, 4000, 3, 0.08);
        setTimeout(() => this._trackEnd(id), 200);
      },

      poison: () => {
        const id = 'poison';
        // Bubbling via AM
        const t = this.ctx.currentTime;
        const carrier = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const outGain = this.ctx.createGain();
        carrier.type = 'sine';
        carrier.frequency.value = 400;
        lfo.type = 'sine';
        lfo.frequency.value = 8;
        lfoGain.gain.value = 0.08;
        outGain.gain.setValueAtTime(0.08, t);
        outGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        lfo.connect(lfoGain);
        lfoGain.connect(outGain.gain);
        carrier.connect(outGain);
        outGain.connect(this.sfxGain);
        carrier.start(t);
        lfo.start(t);
        carrier.stop(t + 0.08);
        lfo.stop(t + 0.08);
        setTimeout(() => this._trackEnd(id), 60);
      },

      lightning: () => {
        const id = 'lightning';
        // Sharp crack
        this._noise(0.06, 6000, 0.5, 0.25);
        this._noise(0.03, 8000, 1, 0.15);
        // Echo
        setTimeout(() => {
          this._noise(0.04, 4000, 1, 0.08);
        }, 40);
        setTimeout(() => this._trackEnd(id), 100);
      },

      bleed: () => {
        const id = 'bleed';
        this._osc('sine', 250, 0.04, 0.06, 0.002, 0.03);
        setTimeout(() => this._trackEnd(id), 40);
      },

      // ── UI ──

      cardHover: () => {
        const id = 'cardHover';
        this._osc('sine', 800, 0.03, 0.08, 0.003, 0.025);
        setTimeout(() => this._trackEnd(id), 30);
      },

      traitSelected: () => {
        const id = 'traitSelected';
        // Two-note ascending confirmation
        this._arpeggio([500, 750], 0.1, 'sine', 0.2);
        setTimeout(() => this._trackEnd(id), 250);
      },

      setBonusUnlocked: () => {
        const id = 'setBonusUnlocked';
        this._arpeggio([400, 500, 600, 800], 0.08, 'triangle', 0.18);
        setTimeout(() => this._trackEnd(id), 350);
      },

      synergyUnlocked: () => {
        const id = 'synergyUnlocked';
        // Rich chord
        const t = this.ctx.currentTime;
        [400, 500, 600].forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t);
          osc.stop(t + 0.35);
        });
        setTimeout(() => this._trackEnd(id), 300);
      },

      uiClick: () => {
        const id = 'uiClick';
        this._osc('sine', 600, 0.04, 0.12, 0.002, 0.035);
        setTimeout(() => this._trackEnd(id), 40);
      },

      // ── Scene ──

      menuEntrance: () => {
        const id = 'menuEntrance';
        // Low drone buildup + bright ping
        this._osc('sine', 80, 0.5, 0.15, 0.2, 0.3);
        setTimeout(() => {
          this._osc('sine', 800, 0.2, 0.15, 0.005);
          this._osc('triangle', 1200, 0.15, 0.08, 0.005);
        }, 350);
        setTimeout(() => this._trackEnd(id), 600);
      },

      victoryFanfare: () => {
        const id = 'victoryFanfare';
        // 4-note ascending major C-E-G-C with sustained final
        const freqs = [523, 659, 784, 1047];
        const t = this.ctx.currentTime;
        freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const start = t + i * 0.25;
          const dur = i === 3 ? 0.6 : 0.22;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
          gain.gain.setValueAtTime(0.2, start + dur * 0.6);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(start);
          osc.stop(start + dur + 0.05);
        });
        // Pad underneath
        this._osc('sine', 262, 1.2, 0.08, 0.1, 1.0);
        setTimeout(() => this._trackEnd(id), 1500);
      },

      gameOver: () => {
        const id = 'gameOver';
        // 3-note descending minor E-C-A
        const freqs = [330, 262, 220];
        const t = this.ctx.currentTime;
        freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc2.type = 'sawtooth';
          osc2.frequency.value = freq;
          const start = t + i * 0.28;
          const dur = i === 2 ? 0.5 : 0.25;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
          gain.gain.setValueAtTime(0.15, start + dur * 0.5);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.connect(gain);
          osc2.connect(gain);
          // Sawtooth much quieter for darker timbre
          const sawGain = this.ctx.createGain();
          sawGain.gain.value = 0.03;
          osc2.disconnect();
          osc2.connect(sawGain);
          sawGain.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(start);
          osc2.start(start);
          osc.stop(start + dur + 0.05);
          osc2.stop(start + dur + 0.05);
        });
        setTimeout(() => this._trackEnd(id), 1000);
      },
    };
  }
}

// ── Biome Music Definitions ───────────────────────────────────────
// Each biome has: scale (Hz), pattern (note indices, null = rest),
// beatDuration (seconds), voices (oscillator configs), drone (optional).
//
// Musical design per biome:
//   Garden:    Gentle pentatonic in C, calm and pastoral
//   Forest:    Dorian mode, deeper and mysterious
//   Underroot: Phrygian mode, dark and exotic with low drones
//   The Rot:   Locrian/diminished, dissonant and unsettling
//   Canopy:    Lydian mode, airy and bright
//   Emergent:  Mixolydian, epic and wide with crystalline tones
//   Menu:      Simple ambient C major arpeggios
//   Shop:      Relaxed pentatonic, contemplative

const BIOME_MUSIC = {
  // ── Menu — gentle ambient arpeggios ──
  menu: {
    scale: [262, 294, 330, 392, 440, 523], // C major pentatonic + octave
    pattern: [
      0, null, 2, null, 4, null, 2, null,
      3, null, 1, null, 3, null, 5, null,
      4, null, 2, null, 0, null, 2, null,
      3, null, 4, null, 2, null, 0, null,
    ],
    beatDuration: 0.45,
    voices: [
      { type: 'sine', gain: 0.06, octave: 1, noteDur: 0.6 },
      { type: 'sine', gain: 0.025, octave: 2, noteDur: 0.4 },
    ],
    drone: { type: 'sine', freq: 131, gain: 0.025 }, // Low C
  },

  // ── Shop — contemplative, warm pentatonic ──
  shop: {
    scale: [294, 330, 392, 440, 523], // D pentatonic
    pattern: [
      0, null, 2, null, 4, null, null, null,
      3, null, 1, null, 0, null, null, null,
      2, null, 4, null, 3, null, 1, null,
      0, null, null, null, 2, null, null, null,
    ],
    beatDuration: 0.5,
    voices: [
      { type: 'triangle', gain: 0.05, octave: 1, noteDur: 0.7 },
      { type: 'sine', gain: 0.02, octave: 0.5, noteDur: 0.9 },
    ],
    drone: { type: 'sine', freq: 147, gain: 0.02 }, // Low D
  },

  // ── The Garden — pastoral C pentatonic, gentle and green ──
  garden: {
    scale: [262, 294, 330, 392, 440], // C D E G A (pentatonic)
    pattern: [
      0, null, 2, null, 4, null, 3, null,
      2, null, 0, null, 1, null, null, null,
      3, null, 4, null, 2, null, 0, null,
      1, null, 3, null, 2, null, null, null,
      0, null, 4, null, 3, null, 2, null,
      4, null, null, null, 0, null, 2, null,
    ],
    beatDuration: 0.35,
    voices: [
      { type: 'sine', gain: 0.06, octave: 1, noteDur: 0.5 },
      { type: 'triangle', gain: 0.03, octave: 2, noteDur: 0.3 },
    ],
    drone: { type: 'sine', freq: 131, gain: 0.02, detune: 3 }, // Low C with shimmer
  },

  // ── Ancient Forest — D Dorian, woody and deep ──
  forest: {
    scale: [294, 330, 349, 392, 440, 494, 523], // D E F G A B C (Dorian)
    pattern: [
      0, null, null, 2, null, null, 4, null,
      null, 3, null, null, 1, null, null, null,
      5, null, null, 4, null, null, 2, null,
      null, 0, null, null, 3, null, null, null,
      2, null, null, 5, null, null, 3, null,
      null, 1, null, null, 0, null, null, null,
    ],
    beatDuration: 0.38,
    voices: [
      { type: 'triangle', gain: 0.06, octave: 1, noteDur: 0.55, filterFreq: 1200 },
      { type: 'sine', gain: 0.03, octave: 0.5, noteDur: 0.7 },
    ],
    drone: { type: 'triangle', freq: 147, gain: 0.03, detune: -5 }, // Low D
  },

  // ── The Underroot — E Phrygian, exotic and cavernous ──
  underroot: {
    scale: [165, 175, 196, 220, 247, 262, 294], // E F G A B C D (Phrygian)
    pattern: [
      0, null, null, null, 1, null, null, null,
      3, null, null, 2, null, null, null, null,
      4, null, null, null, 5, null, null, null,
      3, null, null, null, 0, null, null, null,
      1, null, null, null, 4, null, null, 2,
      null, null, null, null, 0, null, null, null,
    ],
    beatDuration: 0.42,
    voices: [
      { type: 'sine', gain: 0.05, octave: 1, noteDur: 0.6, filterFreq: 800, filterQ: 2 },
      { type: 'triangle', gain: 0.03, octave: 2, noteDur: 0.35, filterFreq: 600 },
    ],
    drone: { type: 'sawtooth', freq: 82, gain: 0.015 }, // Deep E
  },

  // ── The Rot — B Locrian, dissonant and threatening ──
  the_rot: {
    scale: [247, 262, 294, 330, 349, 392, 440], // B C D E F G A (Locrian)
    pattern: [
      0, null, null, 1, null, null, null, null,
      null, null, 3, null, null, 2, null, null,
      4, null, null, null, null, null, 5, null,
      null, null, 0, null, null, null, null, null,
      3, null, null, null, 1, null, null, null,
      null, null, null, null, 0, null, null, null,
    ],
    beatDuration: 0.44,
    voices: [
      { type: 'sawtooth', gain: 0.03, octave: 1, noteDur: 0.55, filterFreq: 700, filterQ: 3 },
      { type: 'sine', gain: 0.04, octave: 1, noteDur: 0.5, detune: -8 }, // Detuned for unease
    ],
    drone: { type: 'sawtooth', freq: 62, gain: 0.02, detune: 7 }, // Low B rumble
  },

  // ── The Canopy — F Lydian, bright and airy ──
  canopy: {
    scale: [349, 392, 440, 494, 523, 587, 659], // F G A B C D E (Lydian)
    pattern: [
      0, null, 2, null, 4, null, 6, null,
      5, null, 3, null, 1, null, null, null,
      4, null, 6, null, 5, null, 3, null,
      2, null, 0, null, null, null, null, null,
      6, null, 4, null, 2, null, 0, null,
      3, null, 5, null, 4, null, null, null,
    ],
    beatDuration: 0.3,
    voices: [
      { type: 'sine', gain: 0.05, octave: 1, noteDur: 0.35 },
      { type: 'sine', gain: 0.03, octave: 2, noteDur: 0.25 },
      { type: 'triangle', gain: 0.015, octave: 0.5, noteDur: 0.5 },
    ],
    drone: { type: 'sine', freq: 175, gain: 0.02 }, // Low F
  },

  // ── The Emergent — G Mixolydian, epic and crystalline ──
  emergent: {
    scale: [392, 440, 494, 523, 587, 659, 698], // G A B C D E F (Mixolydian)
    pattern: [
      0, null, null, 2, null, null, 4, null,
      null, null, 6, null, null, 5, null, null,
      3, null, null, 1, null, null, 0, null,
      null, null, null, null, 4, null, null, null,
      5, null, null, 6, null, null, 4, null,
      null, null, 2, null, null, 0, null, null,
      1, null, null, 3, null, null, 5, null,
      null, null, 6, null, null, null, null, null,
    ],
    beatDuration: 0.36,
    voices: [
      { type: 'sine', gain: 0.05, octave: 1, noteDur: 0.5 },
      { type: 'triangle', gain: 0.035, octave: 2, noteDur: 0.3 }, // Crystalline high register
      { type: 'sine', gain: 0.02, octave: 0.5, noteDur: 0.7 }, // Epic bass
    ],
    drone: { type: 'sine', freq: 98, gain: 0.025 }, // Low G
  },
};

const audioManager = new AudioManager();
export default audioManager;
