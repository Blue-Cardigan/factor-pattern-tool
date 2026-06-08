# Factor Pattern Tool — Design Brainstorm

<response>
<probability>0.07</probability>
<text>
## Idea A: Scientific Notebook / Generative Art Lab

**Design Movement:** Brutalist-meets-scientific instrument — think oscilloscope screens, graph paper, and engineering notebooks.

**Core Principles:**
- Raw, functional beauty — every element earns its place
- Monospace type everywhere except display headings
- Dark background with glowing, high-contrast lines
- Controls feel like physical instrument dials

**Color Philosophy:** Near-black (#0d0d0d) background. Neon amber (#ffb300) for primary lines, electric cyan (#00e5ff) for secondary/factor lines, muted slate for UI chrome. Emotional intent: precision, discovery, late-night tinkering.

**Layout Paradigm:** Left column = controls panel (fixed, narrow, instrument-style). Right = full-height canvas. No header. Tool fills the viewport.

**Signature Elements:**
- Grid overlay on canvas (faint, like graph paper)
- Monospace labels and tick marks on controls
- Glowing line trails with subtle blur

**Interaction Philosophy:** Immediate feedback — every parameter change redraws instantly. Sliders feel physical.

**Animation:** Lines draw themselves stroke-by-stroke on generate. Smooth 400ms ease-in-out. Reduced motion: instant draw.

**Typography System:** `JetBrains Mono` for all UI labels and numbers. `Space Grotesk` bold for the tool title only.
</text>
</response>

<response>
<probability>0.06</probability>
<text>
## Idea B: Minimalist Mathematical Sketchbook

**Design Movement:** Swiss International Typographic Style — Helvetica, grids, negative space as a design element.

**Core Principles:**
- Extreme restraint — only what is necessary
- Typography as the primary visual element
- Paper-white background, ink-black type and lines
- Geometric precision without decoration

**Color Philosophy:** White (#ffffff) background, near-black (#1a1a1a) for lines and text, a single accent of deep indigo (#3730a3) for interactive states. Emotional intent: academic rigour, mathematical elegance.

**Layout Paradigm:** Centered single-column. Canvas above, controls below in a tight horizontal strip. Generous top margin.

**Signature Elements:**
- Hairline borders (0.5px) on all containers
- Numerical factor annotations alongside the path
- No rounded corners anywhere

**Interaction Philosophy:** Deliberate — user sets parameters, then explicitly generates. No auto-redraw.

**Animation:** Fade-in only (opacity 0→1, 200ms). Lines appear instantly.

**Typography System:** `DM Mono` for numbers and labels. `DM Sans` for headings. Strict type scale.
</text>
</response>

<response>
<probability>0.08</probability>
<text>
## Idea C: Dark Generative Art Studio (CHOSEN)

**Design Movement:** Contemporary creative coding tool — think p5.js editor meets Figma dark mode. Inspired by tools like cables.gl and Shadertoy.

**Core Principles:**
- Deep dark background creates a "canvas in the void" feel
- Vibrant, multi-colour line rendering with hue cycling
- Controls are compact, sidebar-docked, never intrusive
- The pattern IS the hero — maximum canvas real estate

**Color Philosophy:** Background: deep charcoal (#111318). Canvas: pure black. Lines: hue-cycled from a warm coral through violet to cyan — each repetition of the pattern gets a different hue. UI chrome: cool grey (#1e2028) with subtle borders. Accent: electric violet (#7c3aed). Emotional intent: wonder, play, late-night creative flow.

**Layout Paradigm:** Full-viewport split — left sidebar (320px, fixed) for all controls, right = full canvas. No top nav. The sidebar collapses on mobile.

**Signature Elements:**
- Hue-cycled multi-colour lines (each loop iteration = different colour)
- Subtle glow/bloom effect on lines (CSS filter: drop-shadow)
- Animated stroke-draw effect when generating

**Interaction Philosophy:** Live preview — parameters update the pattern in real time. Sliders have immediate visual feedback. "Generate" button triggers the draw animation.

**Animation:** Path draws stroke by stroke using SVG stroke-dashoffset animation, 600ms total, staggered per segment. Controls panel slides in from left on load.

**Typography System:** `IBM Plex Mono` for all numeric inputs and factor displays. `Outfit` (weight 600) for headings and labels. Clean, technical but warm.
</text>
</response>

## Selected: Idea C — Dark Generative Art Studio

Full-viewport dark layout. Left sidebar for controls. Right = canvas. Hue-cycled coloured lines. IBM Plex Mono + Outfit typography. Electric violet accent.
