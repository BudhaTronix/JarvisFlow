import type { ReactNode } from "react";

interface CameraPreviewProps {
  status: string;
  detail: string;
  children?: ReactNode;
}

export function CameraPreview({ status, detail, children }: CameraPreviewProps) {
  return (
    <section className="camera-card" aria-label="Camera preview status">
      <div className="camera-copy">
        <p className="camera-status">{status}</p>
        <p className="camera-detail">{detail}</p>
      </div>
      <div className="camera-frame">{children ?? <div className="camera-placeholder">Camera inactive</div>}</div>
    </section>
  );
}
