import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import {
  calculateFingerBendRatio,
  centroid,
  clampPoint,
  createThresholds,
  distance,
  isClosedPalm,
  mirrorPoint,
  resolveDominantBentFinger,
  resolveSwipeDirection,
  separateTrackedPoints,
  smoothPoint,
  spreadPointAwayFromOrigin,
} from "../lib/gesture";
import type { ScreenPoint, SelectedNode, TopicPositions } from "../lib/types";

interface GestureControllerOptions {
  enabled: boolean;
  isTopicOpen: boolean;
  canMoveToNextPage: boolean;
  canMoveToPreviousPage: boolean;
  onTopicSelect: (topic: SelectedNode) => void;
  onClosedPalm: () => void;
  onSwipeNextPage: () => void;
  onSwipePreviousPage: () => void;
}

const DEFAULT_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const DEFAULT_CLOSE_GESTURE_PAUSE_MS = 1200;
const DETECTION_INTERVAL_MS = 1000 / 12;
const SWIPE_COOLDOWN_MS = 750;
const SWIPE_GESTURE_PAUSE_MS = 320;
const SWIPE_SAMPLE_WINDOW_MS = 260;
const MODEL_ASSET_PATH = import.meta.env.VITE_HAND_LANDMARKER_MODEL_URL?.trim() || DEFAULT_MODEL_ASSET_PATH;
const CLOSE_GESTURE_PAUSE_MS = (() => {
  const parsedValue = Number.parseInt(import.meta.env.VITE_GESTURE_CLOSE_PAUSE_MS?.trim() ?? "", 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : DEFAULT_CLOSE_GESTURE_PAUSE_MS;
})();
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const DEFAULT_TOPIC_POSITIONS: TopicPositions = {
  center: { x: 0.5, y: 0.5 },
  up: { x: 0.5, y: 0.12 },
  right: { x: 0.88, y: 0.5 },
  down: { x: 0.5, y: 0.88 },
  left: { x: 0.12, y: 0.5 },
};
const TOPIC_KEYS: SelectedNode[] = ["center", "up", "right", "down", "left"];

function getTrackingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "MediaPipe hand tracking could not be initialized.";
}

function positionsChanged(previous: TopicPositions, next: TopicPositions): boolean {
  return TOPIC_KEYS.some(
    (topic) =>
      Math.abs(previous[topic].x - next[topic].x) > 0.004 ||
      Math.abs(previous[topic].y - next[topic].y) > 0.004,
  );
}

function smoothTrackedPoint(
  cache: Record<SelectedNode, ScreenPoint | null>,
  topic: SelectedNode,
  point: ScreenPoint,
): ScreenPoint {
  const nextPoint = smoothPoint(cache[topic], point, 0.38);
  cache[topic] = nextPoint;
  return nextPoint;
}

export function useGestureController({
  enabled,
  isTopicOpen,
  canMoveToNextPage,
  canMoveToPreviousPage,
  onTopicSelect,
  onClosedPalm,
  onSwipeNextPage,
  onSwipePreviousPage,
}: GestureControllerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const gpuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactionRef = useRef({
    isTopicOpen,
    canMoveToNextPage,
    canMoveToPreviousPage,
    onTopicSelect,
    onClosedPalm,
    onSwipeNextPage,
    onSwipePreviousPage,
  });
  const smoothedPointsRef = useRef<Record<SelectedNode, ScreenPoint | null>>({
    center: DEFAULT_TOPIC_POSITIONS.center,
    up: DEFAULT_TOPIC_POSITIONS.up,
    right: DEFAULT_TOPIC_POSITIONS.right,
    down: DEFAULT_TOPIC_POSITIONS.down,
    left: DEFAULT_TOPIC_POSITIONS.left,
  });
  const pendingTopicRef = useRef<SelectedNode | null>(null);
  const stableFramesRef = useRef(0);
  const closedPalmFramesRef = useRef(0);
  const selectionCooldownUntilRef = useRef(0);
  const closeCooldownUntilRef = useRef(0);
  const swipeCooldownUntilRef = useRef(0);
  const gesturePauseUntilRef = useRef(0);
  const lastSeenRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const swipeSamplesRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const [topicPositions, setTopicPositions] = useState<TopicPositions>(DEFAULT_TOPIC_POSITIONS);

  interactionRef.current = {
    isTopicOpen,
    canMoveToNextPage,
    canMoveToPreviousPage,
    onTopicSelect,
    onClosedPalm,
    onSwipeNextPage,
    onSwipePreviousPage,
  };

  useEffect(() => {
    if (!enabled) {
      setTopicPositions(DEFAULT_TOPIC_POSITIONS);
      smoothedPointsRef.current = {
        center: DEFAULT_TOPIC_POSITIONS.center,
        up: DEFAULT_TOPIC_POSITIONS.up,
        right: DEFAULT_TOPIC_POSITIONS.right,
        down: DEFAULT_TOPIC_POSITIONS.down,
        left: DEFAULT_TOPIC_POSITIONS.left,
      };
      swipeSamplesRef.current = [];
      lastDetectionAtRef.current = 0;
      return undefined;
    }

    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let handLandmarker: HandLandmarker | null = null;

    const updateTopicPositions = (nextPositions: TopicPositions) => {
      setTopicPositions((previousPositions) =>
        positionsChanged(previousPositions, nextPositions) ? nextPositions : previousPositions,
      );
    };

    const resetSelectionTracking = () => {
      pendingTopicRef.current = null;
      stableFramesRef.current = 0;
    };

    const resetSwipeTracking = () => {
      swipeSamplesRef.current = [];
    };

    const resetToDefaultLayout = () => {
      smoothedPointsRef.current = {
        center: DEFAULT_TOPIC_POSITIONS.center,
        up: DEFAULT_TOPIC_POSITIONS.up,
        right: DEFAULT_TOPIC_POSITIONS.right,
        down: DEFAULT_TOPIC_POSITIONS.down,
        left: DEFAULT_TOPIC_POSITIONS.left,
      };
      resetSelectionTracking();
      resetSwipeTracking();
      closedPalmFramesRef.current = 0;
      updateTopicPositions(DEFAULT_TOPIC_POSITIONS);
    };

    const stopStream = () => {
      const video = videoRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (video) {
        video.srcObject = null;
      }
    };

    const processFrame = () => {
      if (cancelled) {
        return;
      }

      const video = videoRef.current;
      const now = performance.now();

      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !handLandmarker) {
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (now - lastDetectionAtRef.current < DETECTION_INTERVAL_MS) {
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }
      lastDetectionAtRef.current = now;

      const results = handLandmarker.detectForVideo(video, now);
      const landmarks = results.landmarks[0];

      if (!landmarks) {
        resetSwipeTracking();
        if (now - lastSeenRef.current > 260) {
          resetToDefaultLayout();
        }
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      lastSeenRef.current = now;

      const thumbTip = clampPoint(mirrorPoint({ x: landmarks[4].x, y: landmarks[4].y }));
      const indexTip = clampPoint(mirrorPoint({ x: landmarks[8].x, y: landmarks[8].y }));
      const middleTip = clampPoint(mirrorPoint({ x: landmarks[12].x, y: landmarks[12].y }));
      const ringTip = clampPoint(mirrorPoint({ x: landmarks[16].x, y: landmarks[16].y }));
      const pinkyTip = clampPoint(mirrorPoint({ x: landmarks[20].x, y: landmarks[20].y }));
      const wrist = mirrorPoint({ x: landmarks[0].x, y: landmarks[0].y });
      const indexMcp = mirrorPoint({ x: landmarks[5].x, y: landmarks[5].y });
      const middleMcp = mirrorPoint({ x: landmarks[9].x, y: landmarks[9].y });
      const ringMcp = mirrorPoint({ x: landmarks[13].x, y: landmarks[13].y });
      const pinkyMcp = mirrorPoint({ x: landmarks[17].x, y: landmarks[17].y });
      const palmCenter = centroid([wrist, indexMcp, middleMcp, ringMcp, pinkyMcp]);

      const handSize = (distance(wrist, indexMcp) + distance(wrist, pinkyMcp)) / 2;
      const spreadDistance = Math.max(handSize * 1.22, 0.14);
      const separatedPositions = separateTrackedPoints(
        {
          left: spreadPointAwayFromOrigin(thumbTip, palmCenter, spreadDistance),
          up: spreadPointAwayFromOrigin(indexTip, palmCenter, spreadDistance),
          center: spreadPointAwayFromOrigin(middleTip, palmCenter, spreadDistance * 0.78),
          down: spreadPointAwayFromOrigin(ringTip, palmCenter, spreadDistance),
          right: spreadPointAwayFromOrigin(pinkyTip, palmCenter, spreadDistance),
        },
        Math.max(handSize * 1.45, 0.22),
        ["center"],
      );
      const nextPositions: TopicPositions = {
        left: smoothTrackedPoint(smoothedPointsRef.current, "left", separatedPositions.left),
        up: smoothTrackedPoint(smoothedPointsRef.current, "up", separatedPositions.up),
        center: smoothTrackedPoint(smoothedPointsRef.current, "center", separatedPositions.center),
        down: smoothTrackedPoint(smoothedPointsRef.current, "down", separatedPositions.down),
        right: smoothTrackedPoint(smoothedPointsRef.current, "right", separatedPositions.right),
      };
      updateTopicPositions(nextPositions);

      if (now < gesturePauseUntilRef.current) {
        resetSelectionTracking();
        resetSwipeTracking();
        closedPalmFramesRef.current = 0;
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      const thresholds = createThresholds(handSize);
      const bendThreshold = Math.max(0.2, thresholds.fingerBendRatio);

      const bendMap: Record<SelectedNode, number> = {
        left: calculateFingerBendRatio([
          mirrorPoint({ x: landmarks[2].x, y: landmarks[2].y }),
          mirrorPoint({ x: landmarks[3].x, y: landmarks[3].y }),
          thumbTip,
        ]),
        up: calculateFingerBendRatio([
          indexMcp,
          mirrorPoint({ x: landmarks[6].x, y: landmarks[6].y }),
          mirrorPoint({ x: landmarks[7].x, y: landmarks[7].y }),
          indexTip,
        ]),
        center: calculateFingerBendRatio([
          middleMcp,
          mirrorPoint({ x: landmarks[10].x, y: landmarks[10].y }),
          mirrorPoint({ x: landmarks[11].x, y: landmarks[11].y }),
          middleTip,
        ]),
        down: calculateFingerBendRatio([
          ringMcp,
          mirrorPoint({ x: landmarks[14].x, y: landmarks[14].y }),
          mirrorPoint({ x: landmarks[15].x, y: landmarks[15].y }),
          ringTip,
        ]),
        right: calculateFingerBendRatio([
          pinkyMcp,
          mirrorPoint({ x: landmarks[18].x, y: landmarks[18].y }),
          mirrorPoint({ x: landmarks[19].x, y: landmarks[19].y }),
          pinkyTip,
        ]),
      };
      const bendValues = [bendMap.left, bendMap.up, bendMap.center, bendMap.down, bendMap.right];
      const averageBend = bendValues.reduce((sum, value) => sum + value, 0) / bendValues.length;
      const closedPalmDetected = isClosedPalm(
        [thumbTip, indexTip, middleTip, ringTip, pinkyTip],
        palmCenter,
        handSize,
        bendValues,
        bendThreshold,
      );

      if (closedPalmDetected) {
        closedPalmFramesRef.current += 1;
      } else {
        closedPalmFramesRef.current = 0;
      }

      const requiredCloseFrames = interactionRef.current.isTopicOpen ? 2 : 4;
      if (closedPalmFramesRef.current >= requiredCloseFrames && now >= closeCooldownUntilRef.current) {
        const pauseUntil = now + CLOSE_GESTURE_PAUSE_MS;
        closeCooldownUntilRef.current = pauseUntil;
        selectionCooldownUntilRef.current = pauseUntil;
        swipeCooldownUntilRef.current = pauseUntil;
        gesturePauseUntilRef.current = pauseUntil;
        resetSelectionTracking();
        resetSwipeTracking();
        closedPalmFramesRef.current = 0;
        interactionRef.current.onClosedPalm();
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (interactionRef.current.isTopicOpen) {
        resetSelectionTracking();
        resetSwipeTracking();
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      const handIsOpenForSwipe = !closedPalmDetected && averageBend <= bendThreshold * 0.62;
      const swipeIsAvailable = interactionRef.current.canMoveToNextPage || interactionRef.current.canMoveToPreviousPage;

      if (handIsOpenForSwipe && swipeIsAvailable) {
        swipeSamplesRef.current = [
          ...swipeSamplesRef.current.filter((sample) => now - sample.timestamp <= SWIPE_SAMPLE_WINDOW_MS),
          { x: palmCenter.x, y: palmCenter.y, timestamp: now },
        ];
      } else {
        resetSwipeTracking();
      }

      if (handIsOpenForSwipe && swipeIsAvailable && now >= swipeCooldownUntilRef.current) {
        const swipeDirection = resolveSwipeDirection(
          swipeSamplesRef.current,
          Math.max(handSize * 1.7, 0.2),
          Math.max(handSize * 0.75, 0.12),
        );

        if (swipeDirection) {
          const canExecuteSwipe =
            (swipeDirection === "next" && interactionRef.current.canMoveToNextPage) ||
            (swipeDirection === "previous" && interactionRef.current.canMoveToPreviousPage);

          swipeCooldownUntilRef.current = now + SWIPE_COOLDOWN_MS;
          selectionCooldownUntilRef.current = now + SWIPE_COOLDOWN_MS;
          gesturePauseUntilRef.current = now + SWIPE_GESTURE_PAUSE_MS;
          resetSelectionTracking();
          resetSwipeTracking();

          if (canExecuteSwipe) {
            if (swipeDirection === "next") {
              interactionRef.current.onSwipeNextPage();
            } else {
              interactionRef.current.onSwipePreviousPage();
            }
            animationFrame = window.requestAnimationFrame(processFrame);
            return;
          }
        }
      }

      const bentTopic = resolveDominantBentFinger(bendMap, bendThreshold);

      if (!bentTopic || handIsOpenForSwipe || now < selectionCooldownUntilRef.current) {
        resetSelectionTracking();
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (pendingTopicRef.current === bentTopic) {
        stableFramesRef.current += 1;
      } else {
        pendingTopicRef.current = bentTopic;
        stableFramesRef.current = 1;
      }

      if (stableFramesRef.current >= 3) {
        interactionRef.current.onTopicSelect(bentTopic);
        selectionCooldownUntilRef.current = now + 850;
        resetSelectionTracking();
        resetSwipeTracking();
      }

      animationFrame = window.requestAnimationFrame(processFrame);
    };

    const initialize = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        if (cancelled) {
          stopStream();
          return;
        }

        const video = videoRef.current;
        if (!video) {
          throw new Error("Camera preview element is missing.");
        }

        video.srcObject = stream;
        await video.play();

        const gpuCanvas = gpuCanvasRef.current;
        const canUseGpuDelegate = Boolean(gpuCanvas?.getContext("webgl2"));
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: canUseGpuDelegate ? "GPU" : "CPU",
          },
          canvas: canUseGpuDelegate ? gpuCanvas ?? undefined : undefined,
          numHands: 1,
          runningMode: "VIDEO",
        });

        if (cancelled) {
          return;
        }

        animationFrame = window.requestAnimationFrame(processFrame);
      } catch (error) {
        console.warn(getTrackingErrorMessage(error));
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (handLandmarker) {
        handLandmarker.close();
      }
      stopStream();
    };
  }, [enabled]);

  return {
    videoRef,
    gpuCanvasRef,
    topicPositions,
  };
}
