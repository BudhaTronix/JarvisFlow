# JARVIS Flow

JARVIS Flow is a gesture-controlled brainstorming app with a Python API backend and a TypeScript frontend. It starts from a root topic, renders a centered cross-shaped mind map, and lets you explore the four branches with MediaPipe hand tracking, mouse clicks, or keyboard shortcuts.

## What phase 1 does

- Shows a start screen with the prompt `Enter a word or a group of words to start brainstorming`.
- Sends the submitted text to a Python API.
- Uses a static Biology dataset when the submitted value is blank.
- Uses a placeholder 5-node structure when the submitted value is non-blank.
- Renders one center topic and four directional topics only: up, right, down, and left.
- Opens topic meaning cards in a centered modal after a gesture selection or with mouse/keyboard fallback controls.
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

1. Keep only index and middle fingertips together.
2. Keep thumb, ring finger, and pinky away from that two-finger cluster.
3. Once the two-finger join is detected, the center topic becomes active.
4. Drag mostly up, down, left, or right to highlight one of the four branches.
5. Separate index and middle fingertips to open the selected topic.
6. A short cooldown prevents immediate retriggers.

Notes:

- Left and right gesture mapping is inverted relative to the original implementation.
- The camera feed is hidden from the UI, but the browser still uses it behind the scenes for gesture detection.
- Thresholds are normalized using hand size so the interaction is less sensitive to distance from the camera.
- The MediaPipe WASM runtime is served locally from `frontend/public/mediapipe/wasm` so it matches the installed package version.
- By default the hand landmark model is loaded from Google's hosted MediaPipe model URL. If that URL is blocked on your network, set `VITE_HAND_LANDMARKER_MODEL_URL` to your own hosted copy.

## Mouse and keyboard fallback

You can use the app without gestures.

- Click the center node to open the root topic.
- Click a directional node to open that topic.
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
