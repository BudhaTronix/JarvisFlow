import type { RefObject } from "react";

import type { GesturePhase } from "../lib/gesture";
import type { Direction } from "../lib/types";

interface CameraPreviewProps {
  status: string;
  detail: string;
  gesturePhase: GesturePhase;
  activeDirection: Direction | null;
  videoRef: RefObject<HTMLVideoElement>;
}

export function CameraPreview({
  status,
  detail,
  gesturePhase,
  activeDirection,
  videoRef,
}: CameraPreviewProps) {
  return (
    <section className="camera-card" aria-label="Camera preview status">
      <div className="camera-copy">
        <p className="camera-status">{status}</p>
        <p className="camera-detail">{detail}</p>
      </div>
      <div className="camera-frame camera-frame--live">
        <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
        <div className="camera-overlay" aria-hidden="true">
          <div className="camera-guide" />
          <div className="camera-badges">
            <span className="camera-badge">{gesturePhase}</span>
            {activeDirection ? <span className="camera-badge camera-badge--accent">{activeDirection}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
