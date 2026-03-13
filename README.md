# JARVIS Flow

JARVIS Flow is a gesture-controlled brainstorming app with a Python API backend and a TypeScript frontend. It starts from a root topic, renders a black-background floating topic field, and lets you explore the five phase-1 topics with MediaPipe hand tracking, mouse clicks, or keyboard shortcuts.

## What phase 1 does

- Shows a start screen with the prompt `Enter a word or a group of words to start brainstorming`.
- Sends the submitted text to a Python API.
- Uses a static Biology dataset when the submitted value is blank.
- Uses a placeholder 5-node structure when the submitted value is non-blank.
- Keeps the floating topic field centered on the page.
- Attaches each topic to a fingertip when a hand is visible.
- Spreads the floating topics outward from the palm so they stay separated instead of overlapping.
- Opens topic meaning cards in a centered modal after a gesture selection or with mouse/keyboard fallback controls.
- Uses the closed-palm gesture as a one-step-back action: it closes an open topic card first, and a second closed palm from the mind map returns to the start screen.
- Lets you configure a pause after the close gesture so hand tracking waits before starting the next detection cycle.
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
   - `VITE_GESTURE_CLOSE_PAUSE_MS=1200` (optional pause after a close/back gesture before gesture detection resumes)
4. Start the dev server:
   `npm run dev`
5. Open the URL printed by Vite, usually `http://localhost:5173`.

The frontend build and tests use:

- `npm test`
- `npm run build`

## Gesture behavior

The frontend uses MediaPipe Hand Landmarker in single-hand mode.

Phase-1 gesture flow:

1. The visible topic field stays centered on the page.
2. When a hand appears, each topic floats with one fingertip.
3. Topic-to-finger mapping:
   - Thumb: left topic
   - Index: up topic
   - Middle: center/root topic
   - Ring: down topic
   - Pinky: right topic
4. The topic labels are pushed outward from the palm center so they stay readable and avoid overlapping.
5. Bend one finger so its curl changes by more than about 20%.
6. The strongest bent finger is treated as the selected topic and opens that topic card.
7. Close the whole hand into a stable fist to go back one step.
8. If a topic card is open, the fist closes the card and returns to the mind map.
9. After a close/back gesture, the app pauses gesture detection for the configured settle time.
10. If the mind map is already the current view, the next fist returns to the start screen.

Notes:

- The visible background stays black.
- The camera feed stays hidden, but the browser still uses it for gesture detection.
- The floating positions mirror the hand horizontally so movement feels natural on screen.
- If no hand is visible, the topics fall back to a centered default layout.
- The MediaPipe WASM runtime is served locally from `frontend/public/mediapipe/wasm` so it matches the installed package version.
- By default the hand landmark model is loaded from Google's hosted MediaPipe model URL. If that URL is blocked on your network, set `VITE_HAND_LANDMARKER_MODEL_URL` to your own hosted copy.
- The default close-gesture pause is 1200 ms, and you can override it with `VITE_GESTURE_CLOSE_PAUSE_MS`.

## Mouse and keyboard fallback

You can use the app without gestures.

- Click the center node to open the root topic.
- Click a floating topic to open that topic.
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
