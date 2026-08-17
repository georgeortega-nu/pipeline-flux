# Pipeline Flux

A live 3D recruiting funnel. Candidates are physics-driven particles falling
through six stages, each rendered as a translucent membrane. Passers keep
falling and warm in color as they get deeper. Rejects hit a real collision,
deflect sideways, and fade. The result reads like a Sankey diagram that is
actually running.

## How it works

**Fate is encoded in the collision mask.** Each candidate rolls its outcome once
at spawn. Its `collisionFilterMask` is then set to the single membrane bit where
it will be rejected, or to the collector plate at the bottom if it clears
everything. So cannon-es genuinely stops and deflects rejects at the correct
stage, while everyone else falls straight through. No fake animations, no
per-frame filtering.

**One draw call for the whole field.** A six-vertex quad lives in an
`InstancedBufferGeometry` and is billboarded in the vertex shader. Position,
depth, state, alpha, and a per-particle seed ride along as dynamic instanced
attributes. The glow is a core plus a `pow(1 - d, 3.2)` halo under additive
blending, so there is no post-processing pass to pay for. Color ramps from cool
slate through amber to white-hot as a candidate advances.

**The taper is a force field.** A physical cone would make candidates skid and
cost a lot of contacts, so the funnel wall is a damped radial spring that
squeezes the swarm inward as it descends, with a slow swirl so depth reads in
motion. Membrane collisions stay fully physical.

**Bodies are pooled.** Physics bodies are created once and recycled, and are
added to and removed from the world on spawn and despawn. Reset allocates
nothing and leaks nothing.

## Stack

Vite, TypeScript, React, Three.js with custom GLSL, cannon-es, Tailwind with
shadcn-style Radix primitives, Web Audio for procedural stage cues, IndexedDB
for config and saved presets, and a service worker for offline loads.

## Controls

Drag to orbit, scroll to zoom. Intake sets candidates per second. The five pass
rate sliders set the probability of clearing each membrane, and the readout
shows the resulting candidates-per-hire ratio. Presets cover a few real pipeline
shapes. Audio is muted until you turn it on.

`prefers-reduced-motion` freezes the field mid-flight in a deterministic
snapshot rather than animating, with an override in the panel.

## Local development

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Deployed by GitHub Actions to Pages on every push to `main`.
