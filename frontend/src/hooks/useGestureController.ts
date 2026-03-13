import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import {
  centroid,
  createThresholds,
  distance,
  resolveDirection,
  smoothPoint,
  type GesturePhase,
} from "../lib/gesture";
import type { Direction } from "../lib/types";

interface GestureControllerOptions {
  enabled: boolean;
  onJoinStart: () => void;
  onDirectionHighlight: (direction: Direction) => void;
  onDirectionOpen: (direction: Direction) => void;
}

interface GestureControllerState {
  status: string;
  detail: string;
  gesturePhase: GesturePhase;
  activeDirection: Direction | null;
}

const READY_STATUS = "Gesture camera live";
const READY_DETAIL = "Close index and middle fingertips together, keep the other fingers away, then drag outward.";
const DEFAULT_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_ASSET_PATH = import.meta.env.VITE_HAND_LANDMARKER_MODEL_URL?.trim() || DEFAULT_MODEL_ASSET_PATH;
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;

function getTrackingErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "MediaPipe hand tracking could not be initialized.";
}

export function useGestureController({
  enabled,
  onJoinStart,
  onDirectionHighlight,
  onDirectionOpen,
}: GestureControllerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const callbacksRef = useRef({ onJoinStart, onDirectionHighlight, onDirectionOpen });
  const phaseRef = useRef<GesturePhase>("idle");
  const joinOriginRef = useRef<{ x: number; y: number } | null>(null);
  const smoothedCentroidRef = useRef<{ x: number; y: number } | null>(null);
  const pendingDirectionRef = useRef<Direction | null>(null);
  const selectedDirectionRef = useRef<Direction | null>(null);
  const stableFramesRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const lastSeenRef = useRef(0);
  const [controllerState, setControllerState] = useState<GestureControllerState>({
    status: "Camera idle",
    detail: "Open a topic map to start camera-based gesture navigation.",
    gesturePhase: "idle",
    activeDirection: null,
  });

  callbacksRef.current = { onJoinStart, onDirectionHighlight, onDirectionOpen };

  useEffect(() => {
    if (!enabled) {
      setControllerState({
        status: "Camera idle",
        detail: "Open a topic map to start camera-based gesture navigation.",
        gesturePhase: "idle",
        activeDirection: null,
      });
      return undefined;
    }

    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;
    let handLandmarker: HandLandmarker | null = null;

    const setViewState = (nextState: Partial<GestureControllerState>) => {
      setControllerState((previousState) => {
        const mergedState = { ...previousState, ...nextState };
        if (
          previousState.status === mergedState.status &&
          previousState.detail === mergedState.detail &&
          previousState.gesturePhase === mergedState.gesturePhase &&
          previousState.activeDirection === mergedState.activeDirection
        ) {
          return previousState;
        }

        return mergedState;
      });
    };

    const resetGestureRuntime = () => {
      phaseRef.current = "idle";
      joinOriginRef.current = null;
      smoothedCentroidRef.current = null;
      pendingDirectionRef.current = null;
      selectedDirectionRef.current = null;
      stableFramesRef.current = 0;
      setViewState({ gesturePhase: "idle", activeDirection: null });
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

    const handleMissingHand = (time: number) => {
      if (phaseRef.current === "opened" || phaseRef.current === "cooldown") {
        return;
      }

      if (time - lastSeenRef.current > 180) {
        resetGestureRuntime();
        setViewState({ status: READY_STATUS, detail: READY_DETAIL });
      }
    };

    const processFrame = () => {
      if (cancelled) {
        return;
      }

      const video = videoRef.current;
      const now = performance.now();

      if (phaseRef.current === "opened") {
        phaseRef.current = "cooldown";
        setViewState({
          status: "Selection cooldown",
          detail: "Content is locked briefly to keep the UI stable.",
          gesturePhase: "cooldown",
        });
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (phaseRef.current === "cooldown") {
        if (now >= cooldownUntilRef.current) {
          resetGestureRuntime();
          setViewState({ status: READY_STATUS, detail: READY_DETAIL });
        }
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !handLandmarker) {
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      const results = handLandmarker.detectForVideo(video, now);
      const landmarks = results.landmarks[0];

      if (!landmarks) {
        handleMissingHand(now);
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      lastSeenRef.current = now;

      const thumbTip = { x: landmarks[4].x, y: landmarks[4].y };
      const indexTip = { x: landmarks[8].x, y: landmarks[8].y };
      const middleTip = { x: landmarks[12].x, y: landmarks[12].y };
      const ringTip = { x: landmarks[16].x, y: landmarks[16].y };
      const pinkyTip = { x: landmarks[20].x, y: landmarks[20].y };
      const wrist = { x: landmarks[0].x, y: landmarks[0].y };
      const indexMcp = { x: landmarks[5].x, y: landmarks[5].y };
      const middleMcp = { x: landmarks[9].x, y: landmarks[9].y };

      const handSize = (distance(wrist, indexMcp) + distance(wrist, middleMcp)) / 2;
      const thresholds = createThresholds(handSize);
      const isolationThreshold = Math.max(handSize * 0.33, 0.06);
      const pairCentroid = centroid([indexTip, middleTip]);
      const smoothedCentroid = smoothPoint(smoothedCentroidRef.current, pairCentroid);
      smoothedCentroidRef.current = smoothedCentroid;

      const pairDistance = distance(indexTip, middleTip);
      const thumbDistance = distance(thumbTip, pairCentroid);
      const ringDistance = distance(ringTip, pairCentroid);
      const pinkyDistance = distance(pinkyTip, pairCentroid);
      const joinedThreshold = phaseRef.current === "idle" ? thresholds.joinEnter : thresholds.joinExit;
      const fingersAreIsolated =
        thumbDistance > isolationThreshold &&
        ringDistance > isolationThreshold &&
        pinkyDistance > isolationThreshold;
      const isJoined = pairDistance < joinedThreshold && fingersAreIsolated;
      const isOpen = pairDistance > thresholds.open;

      if (phaseRef.current === "idle") {
        if (isJoined) {
          phaseRef.current = "joined";
          joinOriginRef.current = smoothedCentroid;
          callbacksRef.current.onJoinStart();
          setViewState({
            status: "Center locked",
            detail: "Drag outward while keeping index and middle fingertips together.",
            gesturePhase: "joined",
            activeDirection: null,
          });
        }

        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (!isJoined && !isOpen) {
        resetGestureRuntime();
        setViewState({ status: READY_STATUS, detail: READY_DETAIL });
        animationFrame = window.requestAnimationFrame(processFrame);
        return;
      }

      if (joinOriginRef.current) {
        const candidateDirection = resolveDirection(
          smoothedCentroid.x - joinOriginRef.current.x,
          smoothedCentroid.y - joinOriginRef.current.y,
          thresholds.drag,
        );

        if (candidateDirection) {
          if (pendingDirectionRef.current === candidateDirection) {
            stableFramesRef.current += 1;
          } else {
            pendingDirectionRef.current = candidateDirection;
            stableFramesRef.current = 1;
          }

          if (stableFramesRef.current >= 3 && selectedDirectionRef.current !== candidateDirection) {
            selectedDirectionRef.current = candidateDirection;
            phaseRef.current = "dragging";
            callbacksRef.current.onDirectionHighlight(candidateDirection);
            setViewState({
              status: `${candidateDirection.toUpperCase()} selected`,
              detail: "Separate index and middle fingertips to open the topic.",
              gesturePhase: "dragging",
              activeDirection: candidateDirection,
            });
          }
        } else {
          pendingDirectionRef.current = null;
          stableFramesRef.current = 0;
          if (phaseRef.current !== "joined") {
            phaseRef.current = "joined";
            setViewState({
              status: "Center locked",
              detail: "Drag outward while keeping index and middle fingertips together.",
              gesturePhase: "joined",
              activeDirection: null,
            });
          }
        }
      }

      if (selectedDirectionRef.current && isOpen) {
        const directionToOpen = selectedDirectionRef.current;
        callbacksRef.current.onDirectionOpen(directionToOpen);
        phaseRef.current = "opened";
        cooldownUntilRef.current = now + 850;
        joinOriginRef.current = null;
        smoothedCentroidRef.current = null;
        pendingDirectionRef.current = null;
        stableFramesRef.current = 0;
        selectedDirectionRef.current = null;
        setViewState({
          status: `${directionToOpen.toUpperCase()} opened`,
          detail: "Topic content is now open.",
          gesturePhase: "opened",
          activeDirection: directionToOpen,
        });
      }

      animationFrame = window.requestAnimationFrame(processFrame);
    };

    const initialize = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setViewState({
          status: "Camera unavailable",
          detail: "This browser does not support camera capture. Use mouse, buttons, or keyboard instead.",
        });
        return;
      }

      try {
        setViewState({
          status: "Requesting camera",
          detail: "Allow camera access to enable two-finger gesture control.",
        });
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

        setViewState({
          status: "Loading MediaPipe",
          detail: "Preparing the hand landmark model in your browser.",
        });

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

        setViewState({
          status: READY_STATUS,
          detail: READY_DETAIL,
          gesturePhase: "idle",
          activeDirection: null,
        });

        animationFrame = window.requestAnimationFrame(processFrame);
      } catch (error) {
        const video = videoRef.current;
        const previewIsLive = Boolean(stream) && video?.srcObject === stream;
        const errorMessage = getTrackingErrorMessage(error);

        if (!previewIsLive) {
          stopStream();
        }

        setViewState({
          status: previewIsLive ? "Camera preview live" : "Gesture fallback active",
          detail: previewIsLive
            ? `${errorMessage} Gesture tracking is unavailable right now, but mouse and keyboard controls still work.`
            : `${errorMessage} Use mouse or keyboard instead.`,
          gesturePhase: "idle",
          activeDirection: null,
        });
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
    ...controllerState,
  };
}
