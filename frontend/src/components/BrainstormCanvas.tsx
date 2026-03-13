import type { RefObject } from "react";

import type { BrainstormResponse, SelectedNode, TopicNodeData, TopicPositions } from "../lib/types";
import { ContentPanel } from "./ContentPanel";
import { TopicNode } from "./TopicNode";

interface BrainstormCanvasProps {
  graph: BrainstormResponse;
  selectedNode: SelectedNode;
  openTopic: TopicNodeData | null;
  videoRef: RefObject<HTMLVideoElement>;
  topicPositions: TopicPositions;
  onBack: () => void;
  onOpenCenter: () => void;
  onOpenDirection: (direction: "up" | "right" | "down" | "left") => void;
  onClosePanel: () => void;
}

export function BrainstormCanvas({
  graph,
  selectedNode,
  openTopic,
  videoRef,
  topicPositions,
  onBack,
  onOpenCenter,
  onOpenDirection,
  onClosePanel,
}: BrainstormCanvasProps) {
  return (
    <main className="canvas-shell">
      <header className="canvas-header">
        <div>
          <p className="eyebrow">Hand-Float Brainstorming</p>
          <h1>{graph.root.label}</h1>
          <p className="canvas-subtitle">
            Each topic follows one fingertip. Bend a finger by about 20% or more to open that topic.
          </p>
        </div>
        <div className="header-actions">
          <span className={`source-pill source-pill--${graph.source}`}>{graph.source}</span>
          <button className="ghost-button" type="button" onClick={onBack}>
            New topic
          </button>
        </div>
      </header>

      <section className="canvas-layout">
        <section className="mindmap-card">
          <video ref={videoRef} className="gesture-video-hidden" autoPlay muted playsInline aria-hidden="true" />

          <div className="mindmap-stage">
            <TopicNode
              label={graph.root.label}
              content={graph.root.content}
              position={topicPositions.center}
              isRoot
              selected={selectedNode === "center"}
              onClick={onOpenCenter}
            />
            <TopicNode
              label={graph.directions.up.label}
              content={graph.directions.up.content}
              position={topicPositions.up}
              selected={selectedNode === "up"}
              onClick={() => onOpenDirection("up")}
            />
            <TopicNode
              label={graph.directions.right.label}
              content={graph.directions.right.content}
              position={topicPositions.right}
              selected={selectedNode === "right"}
              onClick={() => onOpenDirection("right")}
            />
            <TopicNode
              label={graph.directions.down.label}
              content={graph.directions.down.content}
              position={topicPositions.down}
              selected={selectedNode === "down"}
              onClick={() => onOpenDirection("down")}
            />
            <TopicNode
              label={graph.directions.left.label}
              content={graph.directions.left.content}
              position={topicPositions.left}
              selected={selectedNode === "left"}
              onClick={() => onOpenDirection("left")}
            />
          </div>
        </section>
      </section>

      <ContentPanel topic={openTopic} onClose={onClosePanel} />
    </main>
  );
}
