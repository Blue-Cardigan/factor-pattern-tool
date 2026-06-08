/*
 * features/sonify/SonifyView.tsx — Sonification studio.
 *
 * Maps a Ruleset's StepInstruction[] to a melody and plays it through the Web
 * Audio API (lib/sonify/engine). Controls: N, ruleset, tempo, scale, root,
 * octaves, waveform, volume, pitch source, Play/Pause, Loop. Visualises the
 * notes as a piano-roll and the geometry as a lit turtle path, both synced to
 * playback via requestAnimationFrame. "Send to Canvas" hands the config off.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Repeat, Send, Sparkles } from "lucide-react";

import { allRulesets, getRuleset, DEFAULT_RULESET_ID } from "@/lib/core/rulesets";
import { defaultParams } from "@/lib/core/types";
import { useModeContext } from "@/features/ModeContext";

import { SonifyEngine, type Waveform } from "@/lib/sonify/engine";
import {
  mapStepsToNotes,
  PITCH_SOURCES,
  type PitchSource,
} from "@/lib/sonify/mapping";
import {
  SCALES,
  NOTE_NAMES,
  getScale,
  midiOf,
  type ScaleId,
  type NoteName,
} from "@/lib/sonify/scales";
import { PRESETS, type SonifyPreset } from "./presets";
import PianoRoll from "./PianoRoll";
import TurtlePreview from "./TurtlePreview";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WAVEFORMS: { id: Waveform; label: string }[] = [
  { id: "triangle", label: "Triangle" },
  { id: "sine", label: "Sine" },
  { id: "square", label: "Square" },
  { id: "sawtooth", label: "Sawtooth" },
];

const ROOT_OCTAVE = 3; // base octave for the chosen root

export default function SonifyView() {
  const { loadIntoCanvas } = useModeContext();
  const rulesets = useMemo(() => allRulesets(), []);

  // ---- config state ----
  const [rulesetId, setRulesetId] = useState(DEFAULT_RULESET_ID);
  const [n, setN] = useState(24);
  const [bpm, setBpm] = useState(120);
  const [scaleId, setScaleId] = useState<ScaleId>("pentatonic");
  const [root, setRoot] = useState<NoteName>("C");
  const [octaveRange, setOctaveRange] = useState(3);
  const [waveform, setWaveform] = useState<Waveform>("triangle");
  const [volume, setVolume] = useState(0.7);
  const [pitchSource, setPitchSource] = useState<PitchSource>("index");
  const [directionOctave, setDirectionOctave] = useState(true);
  const [loop, setLoop] = useState(true);

  // ---- playback display state ----
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [position, setPosition] = useState(-1);

  const engineRef = useRef<SonifyEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SonifyEngine();

  // ---- derive steps + notes ----
  const steps = useMemo(() => {
    const rule = getRuleset(rulesetId) ?? getRuleset(DEFAULT_RULESET_ID)!;
    const params = defaultParams(rule, n);
    return rule.generate(params);
  }, [rulesetId, n]);

  const notes = useMemo(() => {
    const rootMidi = midiOf(root, ROOT_OCTAVE);
    return mapStepsToNotes(steps, {
      scale: getScale(scaleId),
      rootMidi,
      octaveRange,
      pitchSource,
      directionOctave,
      panAmount: 0.7,
    });
  }, [steps, scaleId, root, octaveRange, pitchSource, directionOctave]);

  // push notes + config to the engine whenever they change
  useEffect(() => {
    engineRef.current?.setNotes(notes);
  }, [notes]);

  useEffect(() => {
    engineRef.current?.setConfig({ bpm, waveform, volume, loop });
  }, [bpm, waveform, volume, loop]);

  // rAF position read while playing
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    let raf = 0;
    const tick = () => {
      const st = engine.getState();
      setIsPlaying(st.isPlaying);
      setCurrentIndex(st.currentIndex);
      setPosition(st.position);
      if (engine.isPlaying()) {
        raf = requestAnimationFrame(tick);
      }
    };
    if (isPlaying) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // teardown on unmount
  useEffect(() => {
    const engine = engineRef.current;
    return () => engine?.dispose();
  }, []);

  const togglePlay = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isPlaying()) {
      engine.pause();
      setIsPlaying(false);
      setCurrentIndex(-1);
      setPosition(-1);
    } else {
      await engine.play();
      setIsPlaying(true);
    }
  };

  const applyPreset = (p: SonifyPreset) => {
    engineRef.current?.pause();
    setIsPlaying(false);
    setCurrentIndex(-1);
    setPosition(-1);
    setRulesetId(p.rulesetId);
    setN(p.n);
    setBpm(p.bpm);
    setScaleId(p.scale);
    setRoot(p.root);
    setOctaveRange(p.octaveRange);
    setWaveform(p.waveform);
    setPitchSource(p.pitchSource);
    setDirectionOctave(p.directionOctave);
  };

  const sendToCanvas = () => {
    loadIntoCanvas({
      rulesetId,
      n,
      angleA: 90,
      angleB: 90,
      factorTurnsRight: true,
      stepLength: 10,
      repetitions: 8,
    });
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden bg-gradient-to-b from-zinc-950 to-black p-4 text-zinc-200">
      {/* header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-[Outfit,sans-serif] text-xl font-semibold text-violet-200">
            Sonify
          </h1>
          <p className="text-xs text-zinc-400">
            Hear the turn sequence — each step becomes a note. Press Play, then tune the sound.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={togglePlay}
            className="bg-violet-600 hover:bg-violet-500"
            size="sm"
          >
            {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            <span className="ml-1">{isPlaying ? "Pause" : "Play"}</span>
          </Button>
          <Button
            variant={loop ? "default" : "outline"}
            size="sm"
            onClick={() => setLoop((v) => !v)}
            className={loop ? "bg-violet-700 hover:bg-violet-600" : "border-violet-500/30"}
            title="Loop playback"
          >
            <Repeat className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={sendToCanvas}
            className="border-violet-500/30"
          >
            <Send className="size-4" />
            <span className="ml-1">Send to Canvas</span>
          </Button>
        </div>
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => applyPreset(p)}
            title={p.blurb}
            className="group flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/5 px-3 py-1 text-xs text-violet-200 transition hover:border-violet-400/60 hover:bg-violet-500/15"
          >
            <Sparkles className="size-3 text-amber-300/80" />
            {p.name}
          </button>
        ))}
      </div>

      {/* visualisations */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="min-h-[140px]">
          <PianoRoll notes={notes} currentIndex={currentIndex} position={position} />
        </div>
        <div className="min-h-[140px]">
          <TurtlePreview steps={steps} currentIndex={currentIndex} />
        </div>
      </div>

      {/* controls */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-violet-500/15 bg-black/30 p-3 md:grid-cols-4">
        {/* ruleset */}
        <div className="col-span-2 flex flex-col gap-1">
          <Label className="text-xs text-zinc-400">Ruleset</Label>
          <Select value={rulesetId} onValueChange={setRulesetId}>
            <SelectTrigger className="h-8 border-violet-500/20 bg-black/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rulesets.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* N */}
        <div className="flex flex-col gap-1">
          <Label className="flex justify-between text-xs text-zinc-400">
            <span>N (steps)</span>
            <span className="font-mono text-violet-300">{n}</span>
          </Label>
          <Slider
            min={2}
            max={120}
            step={1}
            value={[n]}
            onValueChange={([v]) => setN(v)}
          />
        </div>

        {/* tempo */}
        <div className="flex flex-col gap-1">
          <Label className="flex justify-between text-xs text-zinc-400">
            <span>Tempo</span>
            <span className="font-mono text-violet-300">{bpm} BPM</span>
          </Label>
          <Slider
            min={40}
            max={300}
            step={1}
            value={[bpm]}
            onValueChange={([v]) => setBpm(v)}
          />
        </div>

        {/* scale */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-zinc-400">Scale</Label>
          <Select value={scaleId} onValueChange={(v) => setScaleId(v as ScaleId)}>
            <SelectTrigger className="h-8 border-violet-500/20 bg-black/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* root */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-zinc-400">Root note</Label>
          <Select value={root} onValueChange={(v) => setRoot(v as NoteName)}>
            <SelectTrigger className="h-8 border-violet-500/20 bg-black/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_NAMES.map((nm) => (
                <SelectItem key={nm} value={nm}>
                  {nm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* octaves */}
        <div className="flex flex-col gap-1">
          <Label className="flex justify-between text-xs text-zinc-400">
            <span>Octave range</span>
            <span className="font-mono text-violet-300">{octaveRange}</span>
          </Label>
          <Slider
            min={1}
            max={5}
            step={1}
            value={[octaveRange]}
            onValueChange={([v]) => setOctaveRange(v)}
          />
        </div>

        {/* waveform */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-zinc-400">Waveform</Label>
          <Select value={waveform} onValueChange={(v) => setWaveform(v as Waveform)}>
            <SelectTrigger className="h-8 border-violet-500/20 bg-black/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WAVEFORMS.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* pitch source */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-zinc-400">Pitch from</Label>
          <Select value={pitchSource} onValueChange={(v) => setPitchSource(v as PitchSource)}>
            <SelectTrigger className="h-8 border-violet-500/20 bg-black/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PITCH_SOURCES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* volume */}
        <div className="flex flex-col gap-1">
          <Label className="flex justify-between text-xs text-zinc-400">
            <span>Volume</span>
            <span className="font-mono text-violet-300">{Math.round(volume * 100)}%</span>
          </Label>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
          />
        </div>

        {/* direction octave */}
        <div className="flex items-end gap-2 pb-1">
          <Switch
            id="dir-oct"
            checked={directionOctave}
            onCheckedChange={setDirectionOctave}
          />
          <Label htmlFor="dir-oct" className="text-xs text-zinc-400">
            Turn shifts octave
          </Label>
        </div>
      </div>
    </div>
  );
}
