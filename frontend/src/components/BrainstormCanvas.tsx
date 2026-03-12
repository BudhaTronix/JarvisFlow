import { CameraPreview } from "./CameraPreview";
import { ContentPanel } from "./ContentPanel";
import { TopicNode } from "./TopicNode";
import type { BrainstormResponse, Direction, SelectedNode, TopicNodeData } from "../lib/types";

interface BrainstormCanvasProps {
  graph: BrainstormResponse;
  selectedNode: SelectedNode;
  openTopic: TopicNodeData | null;
  onBack: () => void;
  onFocusCenter: () => void;
  onOpenDirection: (direction: Direction) => void;
  onClosePanel: () => void;
}

export function BrainstormCanvas({
  graph,
  selectedNode,
  openTopic,
  onBack,
  onFocusCenter,
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
            Drag outward from the center with a three-finger pinch to explore each branch.
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
          <CameraPreview
            status="Hand tracking standby"
            detail="Mouse support is active now. MediaPipe gesture capture comes online in the next milestone."
          />

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
              onClick={onFocusCenter}
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

        <ContentPanel topic={openTopic} onClose={onClosePanel} />
      </section>
    </main>
  );
}
