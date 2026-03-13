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
  separateTrackedPoints,
  smoothPoint,
  spreadPointAwayFromOrigin,
} from "../lib/gesture";
import type { ScreenPoint, SelectedNode, TopicPositions } from "../lib/types";

interface GestureControllerOptions {
  enabled: boolean;
  onTopicSelect: (topic: SelectedNode) => void;
  onClosedPalm: () => void;
}

const DEFAULT_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_ASSET_PATH = import.meta.env.VITE_HAND_LANDMARKER_MODEL_URL?.trim() || DEFAULT_MODEL_ASSET_PATH;
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

export function useGestureController({ enabled, onTopicSelect, onClosedPalm }: GestureControllerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const callbacksRef = useRef({ onTopicSelect, onClosedPalm });
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
  const cooldownUntilRef = useRef(0);
  const lastSeenRef = useRef(0);
  const [topicPositions, setTopicPositions] = useState<TopicPositions>(DEFAULT_TOPIC_POSITIONS);

  callbacksRef.current = { onTopicSelect, onClosedPalm };

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

    const resetToDefaultLayout = () => {
      smoothedPointsRef.current = {
        center: DEFAULT_TOPIC_POSITIONS.center,
        up: DEFAULT_TOPIC_POSITIONS.up,
        right: DEFAULT_TOPIC_POSITIONS.right,
        down: DEFAULT_TOPIC_POSITIONS.down,
        left: DEFAULT_TOPIC_POSITIONS.left,
      };
      resetSelectionTracking();
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

      const results = handLandmarker.detectForVideo(video, now);
      const landmarks = results.landmarks[0];

      if (!landmarks) {
        if (now - lastSeenRef.current > 220) {
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

      const closedPalmDetected = isClosedPalm(
        [thumbTip, indexTip, middleTip, ringTip, pinkyTip],
        palmCenter,
        handSize,
        [bendMap.left, bendMap.up, bendMap.center, bendMap.down, bendMap.right],
        bendThreshold,
      );

      if (closedPalmDetected) {
        closedPalmFramesRef.current += 1;
      } else {
        closedPalmFramesRef.current = 0;
      }

      if (closedPalmFramesRef.current >= 4 && now >= cooldownUntilRef.current) {
        cooldownUntilRef.current = now + 1100;
        resetSelectionTracking();
        closedPalmFramesRef.current = 0;
        callbacksRef.current.onClosedPalm();
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      const bentTopic = resolveDominantBentFinger(bendMap, bendThreshold);

      if (!bentTopic || now < cooldownUntilRef.current) {
        if (!bentTopic) {
          resetSelectionTracking();
        }
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
        callbacksRef.current.onTopicSelect(bentTopic);
        cooldownUntilRef.current = now + 850;
        resetSelectionTracking();
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
            width: { ideal: 960 },
            height: { ideal: 720 },
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

        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
          },
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
    topicPositions,
  };
}
