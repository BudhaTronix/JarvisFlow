import type { RefObject } from "react";

import type { BrainstormPageData, SelectedNode, TopicNodeData, TopicPositions } from "../lib/types";
import { ContentPanel } from "./ContentPanel";
import { TopicNode } from "./TopicNode";

interface BrainstormCanvasProps {
  page: BrainstormPageData;
  source: "static" | "placeholder";
  selectedNode: SelectedNode;
  openTopic: TopicNodeData | null;
  videoRef: RefObject<HTMLVideoElement>;
  gpuCanvasRef: RefObject<HTMLCanvasElement>;
  topicPositions: TopicPositions;
  pageIndex: number;
  totalPages: number;
  canMoveToNextPage: boolean;
  canMoveToPreviousPage: boolean;
  onBack: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onOpenCenter: () => void;
  onOpenDirection: (direction: "up" | "right" | "down" | "left") => void;
  onClosePanel: () => void;
}

const floatingTopics: SelectedNode[] = ["left", "up", "center", "down", "right"];

function buildTrailPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const startX = from.x * 100;
  const startY = from.y * 100;
  const endX = to.x * 100;
  const endY = to.y * 100;
  const curveX = (endX - startX) * 0.28;
  const curveY = (endY - startY) * 0.18;

  return `M ${startX} ${startY} C ${startX + curveX} ${startY + curveY}, ${endX - curveX} ${endY - curveY}, ${endX} ${endY}`;
}

export function BrainstormCanvas({
  page,
  source,
  selectedNode,
  openTopic,
  videoRef,
  gpuCanvasRef,
  topicPositions,
  pageIndex,
  totalPages,
  canMoveToNextPage,
  canMoveToPreviousPage,
  onBack,
  onNextPage,
  onPreviousPage,
  onOpenCenter,
  onOpenDirection,
  onClosePanel,
}: BrainstormCanvasProps) {
  return (
    <main className="canvas-shell">
      <header className="canvas-header">
        <div>
          <p className="eyebrow">Hand-Float Brainstorming</p>
          <h1>{page.root.label}</h1>
          <p className="canvas-subtitle">
            Bend a finger to open a topic, make a fist to step back, and swipe an open hand left or right to move between topic sets.
          </p>
        </div>
        <div className="header-actions">
          <span className={`source-pill source-pill--${source}`}>{source}</span>
          {totalPages > 1 ? (
            <div className="page-switcher" aria-label="Topic set navigation">
              <button className="ghost-button" type="button" onClick={onPreviousPage} disabled={!canMoveToPreviousPage}>
                Prev Set
              </button>
              <span className="page-pill">
                {page.title} {pageIndex + 1} / {totalPages}
              </span>
              <button className="ghost-button" type="button" onClick={onNextPage} disabled={!canMoveToNextPage}>
                Next Set
              </button>
            </div>
          ) : null}
          <button className="ghost-button" type="button" onClick={onBack}>
            New topic
          </button>
        </div>
      </header>

      <section className="canvas-layout">
        <section className="mindmap-card">
          <video ref={videoRef} className="gesture-video-hidden" autoPlay muted playsInline aria-hidden="true" />
          <canvas ref={gpuCanvasRef} className="gesture-canvas-hidden" aria-hidden="true" />

          <div className="mindmap-stage">
            <svg className="mindmap-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {(["left", "up", "down", "right"] as const).map((topic) => (
                <path
                  key={topic}
                  className={`mindmap-trail mindmap-trail--${topic}${selectedNode === topic ? " mindmap-trail--selected" : ""}`}
                  d={buildTrailPath(topicPositions.center, topicPositions[topic])}
                />
              ))}
            </svg>

            {floatingTopics.map((topic) => (
              <div
                key={`${topic}-anchor`}
                className={`topic-anchor topic-anchor--${topic}${selectedNode === topic ? " topic-anchor--selected" : ""}`}
                style={{
                  left: `${topicPositions[topic].x * 100}%`,
                  top: `${topicPositions[topic].y * 100}%`,
                }}
                aria-hidden="true"
              >
                <span className="topic-anchor__core" />
                <span className="topic-anchor__ring" />
              </div>
            ))}

            <TopicNode
              topicKey="center"
              label={page.root.label}
              content={page.root.content}
              position={topicPositions.center}
              isRoot
              selected={selectedNode === "center"}
              onClick={onOpenCenter}
            />
            <TopicNode
              topicKey="up"
              label={page.directions.up.label}
              content={page.directions.up.content}
              position={topicPositions.up}
              selected={selectedNode === "up"}
              onClick={() => onOpenDirection("up")}
            />
            <TopicNode
              topicKey="right"
              label={page.directions.right.label}
              content={page.directions.right.content}
              position={topicPositions.right}
              selected={selectedNode === "right"}
              onClick={() => onOpenDirection("right")}
            />
            <TopicNode
              topicKey="down"
              label={page.directions.down.label}
              content={page.directions.down.content}
              position={topicPositions.down}
              selected={selectedNode === "down"}
              onClick={() => onOpenDirection("down")}
            />
            <TopicNode
              topicKey="left"
              label={page.directions.left.label}
              content={page.directions.left.content}
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
