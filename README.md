# Thought Topology

Thought Topology is a static browser prototype for hand-tracked thought mapping and network-topology exploration. It uses a canvas renderer, plain HTML/CSS/JavaScript, and MediaPipe Hands from a CDN. The app is fully usable with mouse-only controls when webcam access is denied or unavailable.

## Files

- `index.html`: app shell, HUD, side panel, hidden media/input elements, CDN imports
- `styles.css`: dark cinematic research-lab UI styling and responsive layout
- `app.js`: graph state, renderer, interaction logic, MediaPipe hand tracking, text generation, import/export
- `topology-sample.json`: sample topology for quick loading and import testing
- `DESIGN_NOTES.md`: visual and interaction rationale
- `TOUCHDESIGNER_BUILD_PLAN.md`: TouchDesigner-oriented scene breakdown

## Requirements

- A modern browser with canvas and webcam support
- A simple local HTTP server
- Internet access for:
  - MediaPipe Hands CDN
  - Google Fonts CDN used for typography

## Run locally

1. Open a terminal in this folder:

   ```bash
   cd /Users/budhadityamukhopadhyay/projects/Personal/HandRecognition
   ```

2. Start a local server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open the app:

   ```text
   http://localhost:8000
   ```

4. Click `Start Camera` if you want hand tracking, then allow camera access.

Notes:

- Use `http://localhost:8000`, not `file://...`, because browsers restrict camera access and `fetch()` behavior for local JSON imports when opened directly from disk.
- If camera access is denied, the full mouse fallback remains active.

## Gesture mapping

### Mouse fallback

- Click empty space: create a node
- Drag node: move a node
- `Shift` + drag from one node to another: connect nodes
- `Alt` + click a node: delete a node

### Hand tracking

- Thumb + index pinch: create, select, drag
- Thumb + middle pinch: connect nodes
- Thumb + ring pinch: delete hovered node after a short dwell

## App workflow

- Use the side panel to switch topology mode between `Centralized`, `Decentralized`, and `Distributed`.
- Paste notes into the textarea and click `Generate Topology` to create a local graph from important recurring terms.
- Use the inspector to edit the selected node title and notes.
- Export topology state as JSON, import saved JSON, or save the canvas as PNG.
- Use `Load Sample` to restore the included sample graph.

## Architecture summary

- Rendering: one canvas-based graph renderer with a `requestAnimationFrame` loop
- State: in-memory nodes, edges, selection, hover, drag, connection, hand tracking, and topology mode
- Layout:
  - `Centralized`: hub-and-spoke bias around a main center
  - `Decentralized`: several cluster hubs with local groupings
  - `Distributed`: broad even spread with mild positioning anchors
- Text generation: local tokenization, stopword removal, light stemming, frequency and sentence-spread scoring, co-occurrence edges
- Export/import: JSON schema version `1` with graph mode, nodes, edges, and metadata

## Data format

JSON exports and imports use this structure:

```json
{
  "version": 1,
  "mode": "centralized",
  "nodes": [
    {
      "id": "node-abc",
      "title": "Example",
      "notes": "Optional notes",
      "x": 320,
      "y": 180
    }
  ],
  "edges": [
    {
      "id": "edge-abc",
      "source": "node-abc",
      "target": "node-def",
      "weight": 2
    }
  ],
  "meta": {
    "createdAt": "2026-03-13T00:00:00.000Z",
    "source": "Thought Topology export"
  }
}
```

## CDN dependencies

- `https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js`
- `https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js`
- `https://fonts.googleapis.com/...` and `https://fonts.gstatic.com/...` for typography

## Quick validation checklist

- Open the app over `http://localhost:8000`
- Confirm `Load Sample` works
- Confirm node editing works from the inspector
- Confirm JSON export/import round-trips
- Confirm PNG export downloads an image
- Confirm mouse-only control works with the camera denied
- Confirm hand tracking initializes after clicking `Start Camera` and approving camera access
