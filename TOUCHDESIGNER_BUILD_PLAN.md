# Thought Topology TouchDesigner Build Plan

## Goal

Translate the browser prototype into a TouchDesigner scene that preserves the same conceptual model:

- live pointer source
- node and edge graph state
- topology-mode-aware layout behavior
- inspector-style metadata editing
- export-oriented visual output

## Scene breakdown

### 1. Input layer

- `Video Device In TOP`: webcam feed
- `MediaPipe / external tracking bridge`: hand landmarks into CHOP channels
- `Mouse In CHOP`: fallback pointer
- `Logic CHOP` + `Math CHOP`: gesture thresholds and dwell handling

Output:

- normalized pointer position
- gesture mode enum
- hand tracking confidence

### 2. Graph state layer

- `Table DAT` or `JSON DAT` for node data
- `Table DAT` or `JSON DAT` for edge data
- Python extension on a `COMP` for:
  - node creation
  - node deletion
  - connection creation
  - import/export serialization
  - text-to-topology generation

Suggested tables:

- `nodes`: `id`, `title`, `notes`, `x`, `y`, `vx`, `vy`, `radius`, `score`
- `edges`: `id`, `source`, `target`, `weight`

### 3. Layout and simulation

- Python-driven update step per frame or per beat
- Separate functions for:
  - repulsion
  - edge spring tension
  - centralized bias
  - decentralized cluster assignment
  - distributed spread anchors

Recommended structure:

- one update method on the graph controller extension
- one parameter or menu for topology mode
- one damped integration pass for stable motion

### 4. Rendering layer

- `Geometry COMP` or instancing for nodes
- line generation for edges using SOPs or a renderable line pipeline
- `Text TOP` or instanced text for labels
- `Composite TOP` stack for:
  - graph
  - cursor overlay
  - HUD overlays
  - status indicators

Look translation:

- dark volumetric background
- subtle grid and vignette
- white line network
- cyan/pale-green glow for active state

### 5. UI / control surface

- Container COMP side panel
- buttons for import/export/sample load/clear
- text area or DAT-based note paste input
- inspector fields bound to the selected node
- counters for node and edge totals
- mode chips for topology and gesture state

## Data flow

1. Webcam or mouse input produces pointer position.
2. Gesture resolver chooses drag, connect, delete, or idle.
3. Graph controller mutates node and edge tables.
4. Layout update settles positions every frame.
5. Render layer instantiates visuals from the tables.
6. Export tools serialize graph JSON or capture frames/images.

## Migration path from the browser prototype

- Port the JSON schema unchanged first.
- Port the gesture state machine next.
- Port the text extraction heuristic into a TouchDesigner Python extension.
- Rebuild the renderer with instancing and overlay TOPs.
- Add higher-fidelity post-processing only after interaction parity is reached.

## Acceptance targets

- Mouse-only parity with the browser prototype
- Single-hand pinch gesture parity for drag, connect, and delete
- Import/export compatibility with `topology-sample.json`
- Readable output at 1080p and 4K
- Stable motion with at least a medium-sized graph of 20 to 30 nodes
