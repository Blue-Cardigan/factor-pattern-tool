/*
 * lib/sonify/engine.ts — Web Audio scheduler + synth (no external libs).
 *
 * A single AudioContext is created lazily on the first Play (a user gesture) to
 * satisfy autoplay policy. Notes are scheduled ahead of time against
 * AudioContext.currentTime using a look-ahead timer; each note is an oscillator
 * → gain (ADSR-ish) → stereo panner → master gain. The engine exposes the
 * current playback position (in note index, fractional) for rAF-driven UI.
 *
 * Lifecycle: play() / pause() / stop() / setLoop() / dispose(). Always call
 * dispose() on unmount to free nodes and close the context.
 */

import type { Note } from "./mapping";

export type Waveform = OscillatorType; // "sine" | "square" | "sawtooth" | "triangle"

export interface EngineConfig {
  bpm: number;
  waveform: Waveform;
  volume: number; // 0..1 master gain
  loop: boolean;
}

export interface EngineState {
  isPlaying: boolean;
  /** Fractional note position, e.g. 3.4 = 40% through note #3. -1 when idle. */
  position: number;
  currentIndex: number; // floor(position), -1 when idle
}

const LOOKAHEAD_MS = 25; // how often the scheduler wakes
const SCHEDULE_AHEAD = 0.12; // seconds of audio scheduled in advance

export class SonifyEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: number | null = null;

  private notes: Note[] = [];
  private cfg: EngineConfig = { bpm: 120, waveform: "triangle", volume: 0.7, loop: true };

  private playing = false;
  /** index of the next note to schedule. */
  private nextNote = 0;
  /** AudioContext time at which nextNote should sound. */
  private nextNoteTime = 0;
  /** AudioContext time the current note started (for position tracking). */
  private curNoteStart = 0;
  private curNoteIndex = -1;
  /** Live nodes we must tear down. */
  private liveNodes = new Set<{ stop: () => void }>();

  setNotes(notes: Note[]) {
    this.notes = notes;
    if (this.nextNote >= notes.length) this.nextNote = 0;
  }

  setConfig(partial: Partial<EngineConfig>) {
    this.cfg = { ...this.cfg, ...partial };
    if (this.master && this.ctx && partial.volume !== undefined) {
      this.master.gain.setTargetAtTime(this.cfg.volume, this.ctx.currentTime, 0.01);
    }
  }

  private secondsPerNote(): number {
    return 60 / Math.max(20, this.cfg.bpm);
  }

  /** Lazily create the AudioContext (call only from a user gesture). */
  private ensureContext() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.cfg.volume;
    this.master.connect(this.ctx.destination);
  }

  async play() {
    this.ensureContext();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (this.playing) return;
    this.playing = true;
    // Resume from current spot (or start) just ahead of now.
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    if (this.nextNote >= this.notes.length) this.nextNote = 0;
    this.scheduler();
  }

  pause() {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.killLiveNodes();
    this.curNoteIndex = -1;
    if (this.ctx) void this.ctx.suspend();
  }

  /** Stop and rewind to the start. */
  stop() {
    this.pause();
    this.nextNote = 0;
  }

  private killLiveNodes() {
    for (const n of this.liveNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this.liveNodes.clear();
  }

  /** Look-ahead scheduler: enqueue any notes due within SCHEDULE_AHEAD. */
  private scheduler = () => {
    if (!this.ctx || !this.playing) return;
    const spn = this.secondsPerNote();
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      if (this.nextNote >= this.notes.length) {
        if (!this.cfg.loop) {
          // Let the last note ring, then stop.
          this.timer = window.setTimeout(() => this.stop(), spn * 1000 + 200);
          return;
        }
        this.nextNote = 0;
      }
      const note = this.notes[this.nextNote];
      if (note) this.scheduleNote(note, this.nextNoteTime, spn);
      this.curNoteStart = this.nextNoteTime;
      this.curNoteIndex = this.nextNote;
      this.nextNoteTime += spn;
      this.nextNote += 1;
    }
    this.timer = window.setTimeout(this.scheduler, LOOKAHEAD_MS);
  };

  private scheduleNote(note: Note, when: number, dur: number) {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type = this.cfg.waveform;
    osc.frequency.value = note.freq;
    panner.pan.value = Math.max(-1, Math.min(1, note.pan));

    // ADSR-ish envelope sized to the note duration.
    const attack = Math.min(0.02, dur * 0.2);
    const release = Math.min(0.12, dur * 0.5);
    const peak = 0.9;
    const sustain = peak * 0.7;
    const holdEnd = when + Math.max(0.01, dur - release);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + attack);
    gain.gain.linearRampToValueAtTime(sustain, when + attack + Math.min(0.05, dur * 0.3));
    gain.gain.setValueAtTime(sustain, holdEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(gain).connect(panner).connect(this.master);
    osc.start(when);
    const stopAt = when + dur + 0.02;
    osc.stop(stopAt);

    const handle = { stop: () => osc.stop() };
    this.liveNodes.add(handle);
    osc.onended = () => {
      this.liveNodes.delete(handle);
      try {
        osc.disconnect();
        gain.disconnect();
        panner.disconnect();
      } catch {
        /* noop */
      }
    };
  }

  /** Read live playback position for rAF UI. */
  getState(): EngineState {
    if (!this.ctx || !this.playing || this.curNoteIndex < 0 || !this.notes.length) {
      return { isPlaying: this.playing, position: this.playing ? 0 : -1, currentIndex: this.playing ? 0 : -1 };
    }
    const spn = this.secondsPerNote();
    const elapsed = this.ctx.currentTime - this.curNoteStart;
    const frac = Math.max(0, Math.min(1, elapsed / spn));
    const position = this.curNoteIndex + frac;
    return { isPlaying: true, position, currentIndex: this.curNoteIndex };
  }

  isPlaying() {
    return this.playing;
  }

  /** Tear everything down. Call on unmount. */
  dispose() {
    this.playing = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.killLiveNodes();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }
}
