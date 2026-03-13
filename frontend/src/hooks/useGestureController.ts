import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import {
  centroid,
  clampPoint,
  distance,
  getClosestTopicInTriggerBand,
  isClosedPalm,
  mirrorPoint,
  resolveSwipeDirection,
  separateTrackedPoints,
  smoothPoint,
  spreadPointAwayFromOrigin,
} from "../lib/gesture";
import {
  TRIGGER_BAND_HALF_HEIGHT,
  TRIGGER_LINE_Y,
  type ScreenPoint,
  type SelectedNode,
  type TopicPositions,
} from "../lib/types";

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
const DETECTION_SMOOTHING_ALPHA = 0.32;
const RENDER_SMOOTHING_ALPHA = 0.28;
const RENDER_POSITION_THRESHOLD = 0.0012;
const SWIPE_COOLDOWN_MS = 750;
const SWIPE_GESTURE_PAUSE_MS = 320;
const SWIPE_SAMPLE_WINDOW_MS = 260;
const TRIGGER_STABLE_FRAMES = 2;
const TRIGGER_OPEN_COOLDOWN_MS = 720;
const TRIGGER_RELEASE_OFFSET = 0.02;
const MODEL_ASSET_PATH = import.meta.env.VITE_HAND_LANDMARKER_MODEL_URL?.trim() || DEFAULT_MODEL_ASSET_PATH;
const CLOSE_GESTURE_PAUSE_MS = (() => {
  const parsedValue = Number.parseInt(import.meta.env.VITE_GESTURE_CLOSE_PAUSE_MS?.trim() ?? "", 10);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : DEFAULT_CLOSE_GESTURE_PAUSE_MS;
})();
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;
const DEFAULT_TOPIC_POSITIONS: TopicPositions = {
  center: { x: 0.5, y: 0.28 },
  up: { x: 0.5, y: 0.1 },
  right: { x: 0.79, y: 0.38 },
  down: { x: 0.5, y: 0.84 },
  left: { x: 0.21, y: 0.38 },
};
const TOPIC_KEYS: SelectedNode[] = ["center", "up", "right", "down", "left"];

function getTrackingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "MediaPipe hand tracking could not be initialized.";
}

function positionsChanged(previous: TopicPositions, next: TopicPositions, threshold = 0.004): boolean {
  return TOPIC_KEYS.some(
    (topic) =>
      Math.abs(previous[topic].x - next[topic].x) > threshold ||
      Math.abs(previous[topic].y - next[topic].y) > threshold,
  );
}

function smoothTrackedPoint(
  cache: Record<SelectedNode, ScreenPoint | null>,
  topic: SelectedNode,
  point: ScreenPoint,
): ScreenPoint {
  const nextPoint = smoothPoint(cache[topic], point, DETECTION_SMOOTHING_ALPHA);
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
  const targetPositionsRef = useRef<TopicPositions>(DEFAULT_TOPIC_POSITIONS);
  const renderedPositionsRef = useRef<TopicPositions>(DEFAULT_TOPIC_POSITIONS);
  const closedPalmFramesRef = useRef(0);
  const triggerCandidateRef = useRef<SelectedNode | null>(null);
  const triggerStableFramesRef = useRef(0);
  const triggerLatchRef = useRef<SelectedNode | null>(null);
  const openCooldownUntilRef = useRef(0);
  const closeCooldownUntilRef = useRef(0);
  const swipeCooldownUntilRef = useRef(0);
  const gesturePauseUntilRef = useRef(0);
  const lastSeenRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const swipeSamplesRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const [topicPositions, setTopicPositions] = useState<TopicPositions>(DEFAULT_TOPIC_POSITIONS);
  const [triggerTopic, setTriggerTopic] = useState<SelectedNode | null>(null);

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
      setTriggerTopic(null);
      targetPositionsRef.current = DEFAULT_TOPIC_POSITIONS;
      renderedPositionsRef.current = DEFAULT_TOPIC_POSITIONS;
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

    const updateRenderedPositions = (nextPositions: TopicPositions, threshold = RENDER_POSITION_THRESHOLD) => {
      renderedPositionsRef.current = nextPositions;
      setTopicPositions((previousPositions) =>
        positionsChanged(previousPositions, nextPositions, threshold) ? nextPositions : previousPositions,
      );
    };

    const animateDisplayedPositions = () => {
      const renderedPositions = renderedPositionsRef.current;
      const targetPositions = targetPositionsRef.current;
      const nextPositions: TopicPositions = {
        center: smoothPoint(renderedPositions.center, targetPositions.center, RENDER_SMOOTHING_ALPHA),
        up: smoothPoint(renderedPositions.up, targetPositions.up, RENDER_SMOOTHING_ALPHA),
        right: smoothPoint(renderedPositions.right, targetPositions.right, RENDER_SMOOTHING_ALPHA),
        down: smoothPoint(renderedPositions.down, targetPositions.down, RENDER_SMOOTHING_ALPHA),
        left: smoothPoint(renderedPositions.left, targetPositions.left, RENDER_SMOOTHING_ALPHA),
      };

      if (positionsChanged(renderedPositions, nextPositions, RENDER_POSITION_THRESHOLD)) {
        updateRenderedPositions(nextPositions);
        return;
      }

      if (positionsChanged(renderedPositions, targetPositions, RENDER_POSITION_THRESHOLD)) {
        updateRenderedPositions(targetPositions);
      }
    };

    const updateTriggerTopic = (nextTopic: SelectedNode | null) => {
      setTriggerTopic((previousTopic) => (previousTopic === nextTopic ? previousTopic : nextTopic));
    };

    const resetTriggerCandidate = () => {
      triggerCandidateRef.current = null;
      triggerStableFramesRef.current = 0;
    };

    const resetSwipeTracking = () => {
      swipeSamplesRef.current = [];
    };

    const releaseTriggerLatchIfNeeded = (positions: TopicPositions) => {
      const latchedTopic = triggerLatchRef.current;
      if (!latchedTopic) {
        return;
      }

      const distanceToLine = Math.abs(positions[latchedTopic].y - TRIGGER_LINE_Y);
      if (distanceToLine > TRIGGER_BAND_HALF_HEIGHT + TRIGGER_RELEASE_OFFSET) {
        triggerLatchRef.current = null;
      }
    };

    const resetToDefaultLayout = () => {
      targetPositionsRef.current = DEFAULT_TOPIC_POSITIONS;
      smoothedPointsRef.current = {
        center: DEFAULT_TOPIC_POSITIONS.center,
        up: DEFAULT_TOPIC_POSITIONS.up,
        right: DEFAULT_TOPIC_POSITIONS.right,
        down: DEFAULT_TOPIC_POSITIONS.down,
        left: DEFAULT_TOPIC_POSITIONS.left,
      };
      updateTriggerTopic(null);
      resetTriggerCandidate();
      resetSwipeTracking();
      closedPalmFramesRef.current = 0;
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

      animateDisplayedPositions();

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
        updateTriggerTopic(null);
        resetTriggerCandidate();
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
      const tipPoints = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];

      const handSize = (distance(wrist, indexMcp) + distance(wrist, pinkyMcp)) / 2;
      const spreadDistance = Math.max(handSize * 1.2, 0.14);
      const separatedPositions = separateTrackedPoints(
        {
          left: spreadPointAwayFromOrigin(thumbTip, palmCenter, spreadDistance),
          up: spreadPointAwayFromOrigin(indexTip, palmCenter, spreadDistance),
          center: spreadPointAwayFromOrigin(middleTip, palmCenter, spreadDistance * 0.78),
          down: spreadPointAwayFromOrigin(ringTip, palmCenter, spreadDistance),
          right: spreadPointAwayFromOrigin(pinkyTip, palmCenter, spreadDistance),
        },
        Math.max(handSize * 1.42, 0.22),
        ["center"],
      );
      const nextPositions: TopicPositions = {
        left: smoothTrackedPoint(smoothedPointsRef.current, "left", separatedPositions.left),
        up: smoothTrackedPoint(smoothedPointsRef.current, "up", separatedPositions.up),
        center: smoothTrackedPoint(smoothedPointsRef.current, "center", separatedPositions.center),
        down: smoothTrackedPoint(smoothedPointsRef.current, "down", separatedPositions.down),
        right: smoothTrackedPoint(smoothedPointsRef.current, "right", separatedPositions.right),
      };
      targetPositionsRef.current = nextPositions;
      releaseTriggerLatchIfNeeded(nextPositions);

      const closestInBand = getClosestTopicInTriggerBand(
        nextPositions,
        TRIGGER_LINE_Y,
        TRIGGER_BAND_HALF_HEIGHT,
      );
      updateTriggerTopic(closestInBand?.topic ?? null);

      if (now < gesturePauseUntilRef.current) {
        resetTriggerCandidate();
        resetSwipeTracking();
        closedPalmFramesRef.current = 0;
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      const closedPalmDetected = isClosedPalm(tipPoints, palmCenter, handSize);
      if (closedPalmDetected) {
        closedPalmFramesRef.current += 1;
      } else {
        closedPalmFramesRef.current = 0;
      }

      const requiredCloseFrames = interactionRef.current.isTopicOpen ? 2 : 4;
      if (closedPalmFramesRef.current >= requiredCloseFrames && now >= closeCooldownUntilRef.current) {
        const pauseUntil = now + CLOSE_GESTURE_PAUSE_MS;
        closeCooldownUntilRef.current = pauseUntil;
        openCooldownUntilRef.current = pauseUntil;
        swipeCooldownUntilRef.current = pauseUntil;
        gesturePauseUntilRef.current = pauseUntil;
        resetTriggerCandidate();
        resetSwipeTracking();
        closedPalmFramesRef.current = 0;
        interactionRef.current.onClosedPalm();
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      const swipeIsAvailable = interactionRef.current.canMoveToNextPage || interactionRef.current.canMoveToPreviousPage;
      const averageTipDistance = tipPoints.reduce((sum, point) => sum + distance(point, palmCenter), 0) / tipPoints.length;
      const thumbToPinkyDistance = distance(thumbTip, pinkyTip);
      const handIsOpenForSwipe =
        !closedPalmDetected &&
        averageTipDistance >= Math.max(handSize * 1.02, 0.12) &&
        thumbToPinkyDistance >= Math.max(handSize * 1.35, 0.18);

      if (interactionRef.current.isTopicOpen) {
        resetTriggerCandidate();
        resetSwipeTracking();
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (closestInBand && now >= openCooldownUntilRef.current && closestInBand.topic !== triggerLatchRef.current) {
        if (triggerCandidateRef.current === closestInBand.topic) {
          triggerStableFramesRef.current += 1;
        } else {
          triggerCandidateRef.current = closestInBand.topic;
          triggerStableFramesRef.current = 1;
        }

        if (triggerStableFramesRef.current >= TRIGGER_STABLE_FRAMES) {
          triggerLatchRef.current = closestInBand.topic;
          openCooldownUntilRef.current = now + TRIGGER_OPEN_COOLDOWN_MS;
          gesturePauseUntilRef.current = now + 180;
          resetTriggerCandidate();
          resetSwipeTracking();
          interactionRef.current.onTopicSelect(closestInBand.topic);
          animationFrame = window.requestAnimationFrame(processFrame);
          return;
        }
      } else {
        resetTriggerCandidate();
      }

      const canSwipeNow =
        swipeIsAvailable &&
        !closestInBand &&
        handIsOpenForSwipe &&
        now >= swipeCooldownUntilRef.current;

      if (canSwipeNow) {
        swipeSamplesRef.current = [
          ...swipeSamplesRef.current.filter((sample) => now - sample.timestamp <= SWIPE_SAMPLE_WINDOW_MS),
          { x: palmCenter.x, y: palmCenter.y, timestamp: now },
        ];
      } else {
        resetSwipeTracking();
      }

      if (canSwipeNow) {
        const swipeDirection = resolveSwipeDirection(
          swipeSamplesRef.current,
          Math.max(handSize * 1.68, 0.2),
          Math.max(handSize * 0.72, 0.12),
        );

        if (swipeDirection) {
          const canExecuteSwipe =
            (swipeDirection === "next" && interactionRef.current.canMoveToNextPage) ||
            (swipeDirection === "previous" && interactionRef.current.canMoveToPreviousPage);

          swipeCooldownUntilRef.current = now + SWIPE_COOLDOWN_MS;
          openCooldownUntilRef.current = now + SWIPE_COOLDOWN_MS;
          gesturePauseUntilRef.current = now + SWIPE_GESTURE_PAUSE_MS;
          resetTriggerCandidate();
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
            width: { ideal: 512 },
            height: { ideal: 384 },
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
    triggerTopic,
  };
}
