/*
 * features/sonify/PianoRoll.tsx — Horizontal step strip / mini piano-roll.
 *
 * Each note is a vertical bar; y = pitch (higher = higher), x = step order.
 * The currently-playing step is highlighted and a playhead line is drawn at the
 * fractional playback position. Colour tracks turn direction (left/right).
 */

import { useMemo } from "react";
import type { Note } from "@/lib/sonify/mapping";
import { midiToName } from "@/lib/sonify/scales";

interface Props {
  notes: Note[];
  currentIndex: number;
  position: number; // fractional
}

export default function PianoRoll({ notes, currentIndex, position }: Props) {
  const { minMidi, maxMidi } = useMemo(() => {
    if (!notes.length) return { minMidi: 60, maxMidi: 72 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const n of notes) {
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
    }
    if (hi - lo < 4) hi = lo + 4;
    return { minMidi: lo, maxMidi: hi };
  }, [notes]);

  const range = Math.max(1, maxMidi - minMidi);
  const colW = notes.length ? 100 / notes.length : 100;
  const playheadX = notes.length ? (position / notes.length) * 100 : 0;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-violet-500/20 bg-black/40">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        {notes.map((n) => {
          const x = n.index * colW;
          const t = (n.midi - minMidi) / range; // 0..1 low..high
          const barH = 6 + t * 70;
          const y = 96 - barH;
          const active = n.index === currentIndex;
          const left = n.dir < 0;
          const hue = left ? 280 : 200;
          return (
            <rect
              key={n.index}
              x={x + colW * 0.12}
              y={y}
              width={Math.max(0.4, colW * 0.76)}
              height={barH}
              rx={0.6}
              fill={
                active
                  ? "hsl(48,100%,62%)"
                  : `hsl(${hue},70%,${38 + t * 22}%)`
              }
              opacity={active ? 1 : 0.85}
            />
          );
        })}
        {/* playhead */}
        <line
          x1={playheadX}
          x2={playheadX}
          y1={0}
          y2={100}
          stroke="hsl(48,100%,65%)"
          strokeWidth={0.4}
          opacity={position >= 0 ? 0.9 : 0}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* current-note readout */}
      <div className="pointer-events-none absolute right-2 top-2 font-mono text-xs text-amber-300/90">
        {currentIndex >= 0 && notes[currentIndex]
          ? `${midiToName(notes[currentIndex].midi)} · step ${notes[currentIndex].step}`
          : ""}
      </div>
    </div>
  );
}
