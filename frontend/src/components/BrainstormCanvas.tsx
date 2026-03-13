import type { RefObject } from "react";

import type { BrainstormResponse, Direction, SelectedNode, TopicNodeData } from "../lib/types";
import { ContentPanel } from "./ContentPanel";
import { TopicNode } from "./TopicNode";

interface BrainstormCanvasProps {
  graph: BrainstormResponse;
  selectedNode: SelectedNode;
  openTopic: TopicNodeData | null;
  videoRef: RefObject<HTMLVideoElement>;
  onBack: () => void;
  onOpenCenter: () => void;
  onOpenDirection: (direction: Direction) => void;
  onClosePanel: () => void;
}

export function BrainstormCanvas({
  graph,
  selectedNode,
  openTopic,
  videoRef,
  onBack,
  onOpenCenter,
  onOpenDirection,
  onClosePanel,
}: BrainstormCanvasProps) {
  return (
    <main className="canvas-shell">
      <header className="canvas-header">
        <div>
          <p className="eyebrow">Mind-map explorer</p>
          <h1>{graph.root.label}</h1>
          <p className="canvas-subtitle">
            Close index and middle fingertips together, keep the thumb, ring, and pinky away, then drag outward to explore each branch.
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
            <svg className="mindmap-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M50 50 L50 17" />
              <path d="M50 50 L84 50" />
              <path d="M50 50 L50 83" />
              <path d="M50 50 L16 50" />
            </svg>

            <TopicNode
              label={graph.root.label}
              content={graph.root.content}
              placement="center"
              isRoot
              selected={selectedNode === "center"}
              onClick={onOpenCenter}
            />
            <TopicNode
              label={graph.directions.up.label}
              content={graph.directions.up.content}
              placement="up"
              selected={selectedNode === "up"}
              onClick={() => onOpenDirection("up")}
            />
            <TopicNode
              label={graph.directions.right.label}
              content={graph.directions.right.content}
              placement="right"
              selected={selectedNode === "right"}
              onClick={() => onOpenDirection("right")}
            />
            <TopicNode
              label={graph.directions.down.label}
              content={graph.directions.down.content}
              placement="down"
              selected={selectedNode === "down"}
              onClick={() => onOpenDirection("down")}
            />
            <TopicNode
              label={graph.directions.left.label}
              content={graph.directions.left.content}
              placement="left"
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
