# JARVIS Flow

JARVIS Flow is a gesture-controlled brainstorming app with a Python API backend and a TypeScript frontend. It starts from a root topic, renders a fullscreen cinematic topic field, and lets you explore phase-1 topic sets with MediaPipe hand tracking, mouse clicks, or keyboard shortcuts.

## What phase 1 does

- Shows a start screen with the prompt `Enter a word or a group of words to start brainstorming`.
- Sends the submitted text to a Python API.
- Uses a static Biology dataset when the submitted value is blank.
- Uses a placeholder multi-page topic structure when the submitted value is non-blank.
- Uses the full browser viewport as the mind-map stage.
- Attaches each topic to a fingertip when a hand is visible.
- Spreads the floating topics outward from the palm so they stay separated instead of overlapping.
- Opens topic meaning cards when a floating topic enters the horizontal trigger line at 90% of the viewport height.
- Uses the closed-palm gesture as a one-step-back action: it closes an open topic card first, and a second closed palm from the mind map returns to the start screen.
- Lets you configure a pause after the close gesture so hand tracking waits before starting the next detection cycle.
- Supports wide-open edge-to-edge hand swipes between topic sets when another set is available.
- Runs browser-side hand tracking with the MediaPipe GPU delegate when a compatible WebGL path is available, otherwise it falls back to CPU.
- Throttles hand-landmark detection and interpolates node motion between detections to reduce visible stutter.

## Project layout

- `frontend/`: React + Vite + TypeScript app, MediaPipe hand tracking, paged topic navigation, fullscreen UI, keyboard fallback, and gesture helpers.
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

1. The brainstorming screen fills the whole viewport.
2. When a hand appears, each topic floats with one fingertip.
3. Topic-to-finger mapping:
   - Thumb: left topic
   - Index: up topic
   - Middle: center/root topic
   - Ring: down topic
   - Pinky: right topic
4. The topic labels are pushed outward from the palm center so they stay readable and avoid overlapping.
5. A luminous horizontal trigger line sits at 90% of the viewport height.
6. When a floating topic enters the trigger band around that line and stays there briefly, that topic opens.
7. If multiple topics touch the trigger band together, the one closest to the line center wins.
8. A topic must leave the trigger band before it can retrigger.
9. Close the whole hand into a stable fist to go back one step.
10. If a topic card is open, the fist closes the card and returns to the mind map.
11. Start with a wide-open hand near the left edge and move it to the right edge to load the next topic set.
12. Start with a wide-open hand near the right edge and move it to the left edge to load the previous topic set.
13. If another topic set is not available in that direction, the swipe does nothing.
14. Swipe navigation is suppressed while a topic is open or while a topic is actively intersecting the trigger line.
15. After a close/back gesture, the app pauses gesture detection for the configured settle time.

Notes:

- The visible background stays black.
- The camera feed stays hidden, but the browser still uses it for gesture detection.
- The floating positions mirror the hand horizontally so movement feels natural on screen.
- If no hand is visible, the topics fall back to a centered default layout.
- The MediaPipe WASM runtime is served locally from `frontend/public/mediapipe/wasm` so it matches the installed package version.
- By default the hand landmark model is loaded from Google's hosted MediaPipe model URL. If that URL is blocked on your network, set `VITE_HAND_LANDMARKER_MODEL_URL` to your own hosted copy.
- The default close-gesture pause is 1200 ms, and you can override it with `VITE_GESTURE_CLOSE_PAUSE_MS`.
- The installed MediaPipe web package exposes a `GPU` delegate that uses a hidden WebGL canvas on the web; it does not expose a true WebGPU-specific task path in this build.
- Hand-landmark inference is throttled to lower CPU use while keeping gestures responsive.

## Mouse and keyboard fallback

You can use the app without gestures.

- Click the center node to open the root topic.
- Click a floating topic to open that topic.
- Use the `Prev Set` and `Next Set` buttons when more topic sets are available.
- Keyboard shortcuts:
  - `ArrowUp`, `ArrowRight`, `ArrowDown`, `ArrowLeft`: highlight a branch
  - `Home`: focus the center node
  - `PageUp`: previous topic set
  - `PageDown`: next topic set
  - `Enter` or `Space`: open the selected topic
  - `Escape`: close the topic panel

## Static phase-1 dataset

When the input is blank, the backend returns five hardcoded topic sets. The first set is the original requested Biology page:

- Center: `Biology` -> `Study of living organisms`
- Up: `Cells` -> `Basic unit of life`
- Right: `Genetics` -> `Study of genes and heredity`
- Down: `Ecology` -> `Study of organisms and environment`
- Left: `Human Body` -> `Organs, tissues, and systems`

Additional swipe pages for the static dataset are also hardcoded in `backend/app/services/phase_one.py`.

When the input is non-blank, the backend returns five placeholder topic sets centered on the submitted idea:

- `Overview`
- `Execution`
- `Expansion`
- `Signals`
- `Launch`

## Where to add OpenAI later

The current backend abstraction lives behind the phase-1 topic expansion service in `backend/app/services/phase_one.py` and the `TopicExpansionService` protocol in `backend/app/services/base.py`.

To add OpenAI later:

1. Create a new service implementation that matches the `expand(topic)` contract.
2. Replace the phase-1 service returned by `get_topic_expansion_service()`.
3. Use `OPENAI_API_KEY` and `OPENAI_MODEL` from the backend environment when you wire the real expansion logic.





