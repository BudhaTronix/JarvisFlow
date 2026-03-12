# JARVIS Flow

JARVIS Flow is a gesture-controlled brainstorming app with a Python API backend and a TypeScript frontend. It starts from a root topic, renders a cross-shaped mind map, and lets you explore the four branches with MediaPipe hand tracking, mouse clicks, keyboard shortcuts, or the on-screen debug pad.

## What phase 1 does

- Shows a start screen with the prompt `Enter a word or a group of words to start brainstorming`.
- Sends the submitted text to a Python API.
- Uses a static Biology dataset when the submitted value is blank.
- Uses a placeholder 5-node structure when the submitted value is non-blank.
- Renders one center topic and four directional topics only: up, right, down, and left.
- Opens topic meaning cards after a gesture selection or with mouse/keyboard fallback controls.
- Runs MediaPipe hand landmark detection in the browser, not on the backend.

## Project layout

- `frontend/`: React + Vite + TypeScript app, MediaPipe hand tracking, UI, keyboard fallback, and gesture helpers.
- `backend/`: FastAPI app, typed response models, phase-1 topic expansion service, and backend unit tests.

## Run the backend

1. Open a terminal in `backend/`.
2. Install dependencies:
   `python -m pip install -r requirements.txt`
3. Start the API:
   `python -m uvicorn app.main:app --reload --port 8000`
4. Optional environment variable:
   - `FRONTEND_ORIGIN=http://localhost:5173`

The API endpoints are:

- `GET /api/health`
- `POST /api/brainstorm`

Request body:

```json
{
  "topic": "biology"
}
```

Response shape:

```json
{
  "root": { "id": "biology", "label": "Biology", "content": "Study of living organisms" },
  "directions": {
    "up": { "id": "cells", "label": "Cells", "content": "Basic unit of life" },
    "right": { "id": "genetics", "label": "Genetics", "content": "Study of genes and heredity" },
    "down": { "id": "ecology", "label": "Ecology", "content": "Study of organisms and environment" },
    "left": { "id": "human-body", "label": "Human Body", "content": "Organs, tissues, and systems" }
  },
  "source": "static"
}
```

## Run the frontend

1. Open a terminal in `frontend/`.
2. Install dependencies:
   `npm install`
3. Create a local env file if needed and set:
   - `VITE_API_BASE_URL=http://localhost:8000`
   - `VITE_HAND_LANDMARKER_MODEL_URL=` (optional override if you want to host the `.task` model yourself)
4. Start the dev server:
   `npm run dev`
5. Open the URL printed by Vite, usually `http://localhost:5173`.

The frontend build and tests use:

- `npm test`
- `npm run build`

## Gesture behavior

The frontend uses MediaPipe Hand Landmarker in single-hand mode.

Phase-1 gesture flow:

1. Allow camera access when the brainstorm screen opens.
2. Join thumb tip, index tip, and middle tip near the center guide shown in the camera preview.
3. While the three fingertips stay joined, drag the hand mostly up, right, down, or left.
4. When one direction becomes dominant and stays stable for a few frames, that branch is highlighted.
5. Open the three fingers outward to open that topic card.
6. A short cooldown prevents immediate retriggers.

Notes:

- Thresholds are normalized using hand size so the interaction is less sensitive to distance from the camera.
- Smoothing and hysteresis are used to reduce flicker.
- The preview includes a center guide because the webcam coordinate space is not the same as the mind-map canvas.
- The MediaPipe WASM runtime is served locally from `frontend/public/mediapipe/wasm` so it matches the installed package version.
- By default the hand landmark model is loaded from Google's hosted MediaPipe model URL. If that URL is blocked on your network, set `VITE_HAND_LANDMARKER_MODEL_URL` to your own hosted copy.
- If model loading fails, the camera preview now stays live and the app falls back to mouse, button, and keyboard controls.

## Mouse, button, and keyboard fallback

You can use the app without gestures.

- Click the center node to open the root topic.
- Click a directional node to open that topic.
- Use the on-screen direction pad to highlight a direction.
- Press `Enter` or click `Open selected topic` to open the highlighted item.
- Keyboard shortcuts:
  - `ArrowUp`, `ArrowRight`, `ArrowDown`, `ArrowLeft`: highlight a branch
  - `Home`: focus the center node
  - `Enter` or `Space`: open the selected topic
  - `Escape`: close the topic panel

## Static phase-1 dataset

When the input is blank, the backend returns:

- Center: `Biology` -> `Study of living organisms`
- Up: `Cells` -> `Basic unit of life`
- Right: `Genetics` -> `Study of genes and heredity`
- Down: `Ecology` -> `Study of organisms and environment`
- Left: `Human Body` -> `Organs, tissues, and systems`

When the input is non-blank, the backend returns a placeholder structure centered on the submitted topic with these four branches:

- `Core Idea`
- `Applications`
- `Questions`
- `Related Topics`

## Where to add OpenAI later

The current backend abstraction lives behind the phase-1 topic expansion service in `backend/app/services/phase_one.py` and the `TopicExpansionService` protocol in `backend/app/services/base.py`.

To add OpenAI later:

1. Create a new service implementation that matches the `expand(topic)` contract.
2. Replace the phase-1 service returned by `get_topic_expansion_service()`.
3. Use `OPENAI_API_KEY` and `OPENAI_MODEL` from the backend environment when you wire the real expansion logic.
