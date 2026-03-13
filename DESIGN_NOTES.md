# Thought Topology Design Notes

## Visual direction

The interface is framed as a cinematic research console instead of a conventional productivity canvas.

- Near-black layered background with soft radial light falloff
- Thin white linework for graph structure and HUD framing
- Cyan and pale-green accents reserved for interaction state, selection, and gesture feedback
- Serif title treatment combined with technical sans-serif body copy to balance elegance and instrumentality
- Floating overlays instead of large opaque toolbars to preserve the sense of a live lab surface

## Interaction model

The app is designed around two equally valid control paths.

- Mouse is the reliability baseline and stays available at all times.
- Hand tracking is additive and uses a visible cursor plus three distinct pinch families to avoid mode confusion.
- Gesture feedback is duplicated in the HUD so the user can verify current intent even when the graph is dense.
- Delete by hand uses a dwell gate to reduce accidental destruction.

## Graph behavior

- Nodes are rendered as compact capsules with labels outside the circle so the center remains visually clean.
- Edges brighten when they relate to the selected or hovered node, which helps the user read local structure quickly.
- Layout is not static. A light physics pass keeps the graph feeling alive while still respecting each topology mode.
- Dragging temporarily overrides physics for direct control, then the graph settles smoothly back into its mode bias.

## Text-to-topology heuristic

The generation pipeline intentionally stays simple and local.

- Split the pasted text into sentences and chunks.
- Extract alphabetic tokens and normalize them to lowercase.
- Remove stopwords and common filler terms.
- Apply light suffix stripping to merge close variants.
- Score terms by local frequency and sentence spread.
- Create edges from sentence-level co-occurrence, then cap the graph to a readable size.

This is not intended as semantic truth extraction. It is a fast local sketching heuristic for turning rough notes into a navigable structure.

## Browser-first rationale

The browser prototype keeps the interaction loop short.

- No build step
- No framework state complexity
- Easy local hosting
- Straight path to future TouchDesigner translation because the rendering, state, and interaction subsystems are already separated conceptually
