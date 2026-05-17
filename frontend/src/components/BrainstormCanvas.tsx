import type { RefObject } from "react";

import { getTriggerProximity } from "../lib/gesture";
import {
  TRIGGER_BAND_HALF_HEIGHT,
  TRIGGER_LINE_Y,
  TRIGGER_PROXIMITY_RANGE,
  type BrainstormPageData,
  type SelectedNode,
  type TopicNodeData,
  type TopicPositions,
} from "../lib/types";
import { ContentPanel } from "./ContentPanel";
import { TopicNode } from "./TopicNode";

interface BrainstormCanvasProps {
  page: BrainstormPageData;
  source: "static" | "placeholder";
  selectedNode: SelectedNode;
  openTopic: TopicNodeData | null;
  triggerTopic: SelectedNode | null;
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
  const curveX = (endX - startX) * 0.32;
  const curveY = (endY - startY) * 0.2;

  return `M ${startX} ${startY} C ${startX + curveX} ${startY + curveY}, ${endX - curveX} ${endY - curveY}, ${endX} ${endY}`;
}

export function BrainstormCanvas({
  page,
  source,
  selectedNode,
  openTopic,
  triggerTopic,
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
  const topicMap: Record<SelectedNode, TopicNodeData> = {
    center: page.root,
    up: page.directions.up,
    right: page.directions.right,
    down: page.directions.down,
    left: page.directions.left,
  };

  const triggerLineLabel = triggerTopic ? `${topicMap[triggerTopic].label} aligned` : "Open line";

  return (
    <main className="canvas-shell canvas-shell--immersive">
      <video ref={videoRef} className="gesture-video-background" autoPlay muted playsInline aria-hidden="true" />
      <canvas ref={gpuCanvasRef} className="gesture-canvas-hidden" aria-hidden="true" />

      <div className="camera-scrim" aria-hidden="true" />
      <div className="canvas-glow canvas-glow--one" aria-hidden="true" />
      <div className="canvas-glow canvas-glow--two" aria-hidden="true" />
      <div className="canvas-grain" aria-hidden="true" />

      <header className="canvas-hud canvas-hud--top">
        <div className="canvas-brand">
          <p className="eyebrow">JARVIS Flow</p>
          <h1>{page.title}</h1>
          <p className="canvas-subtitle">Move any floating topic through the open line to reveal its meaning.</p>
        </div>
        <div className="hud-actions">
          <span className={`source-pill source-pill--${source}`}>{source}</span>
          {totalPages > 1 ? (
            <div className="page-switcher" aria-label="Topic set navigation">
              <button className="ghost-button ghost-button--hud" type="button" onClick={onPreviousPage} disabled={!canMoveToPreviousPage}>
                Prev Set
              </button>
              <span className="page-pill">
                {pageIndex + 1} / {totalPages}
              </span>
              <button className="ghost-button ghost-button--hud" type="button" onClick={onNextPage} disabled={!canMoveToNextPage}>
                Next Set
              </button>
            </div>
          ) : null}
          <button className="ghost-button ghost-button--hud" type="button" onClick={onBack}>
            New Topic
          </button>
        </div>
      </header>

      <div className="canvas-hud canvas-hud--bottom">
        <span className="hint-pill">Move a wide-open hand edge to edge to change sets</span>
        <span className="hint-pill">Fist gesture steps back one layer</span>
      </div>

      <section className="mindmap-stage">
        <div className={`trigger-line${triggerTopic ? " trigger-line--active" : ""}`} style={{ top: `${TRIGGER_LINE_Y * 100}%` }}>
          <span className="trigger-line__band" />
          <span className="trigger-line__core" />
          <span className="trigger-line__label">{triggerLineLabel}</span>
        </div>

        <svg className="mindmap-trails" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {(["left", "up", "down", "right"] as const).map((topic) => (
            <path
              key={topic}
              className={`mindmap-trail mindmap-trail--${topic}${selectedNode === topic || triggerTopic === topic ? " mindmap-trail--selected" : ""}`}
              d={buildTrailPath(topicPositions.center, topicPositions[topic])}
            />
          ))}
        </svg>

        {floatingTopics.map((topic) => {
          const proximity = getTriggerProximity(
            topicPositions[topic].y,
            TRIGGER_LINE_Y,
            TRIGGER_PROXIMITY_RANGE,
          );
          const inTriggerBand = Math.abs(topicPositions[topic].y - TRIGGER_LINE_Y) <= TRIGGER_BAND_HALF_HEIGHT;
          const selected = selectedNode === topic || triggerTopic === topic;

          return (
            <div
              key={`${topic}-anchor`}
              className={`topic-anchor topic-anchor--${topic}${selected ? " topic-anchor--selected" : ""}${inTriggerBand ? " topic-anchor--band" : ""}`}
              style={{
                left: `${topicPositions[topic].x * 100}%`,
                top: `${topicPositions[topic].y * 100}%`,
                ["--topic-proximity" as string]: proximity.toString(),
              }}
              aria-hidden="true"
            >
              <span className="topic-anchor__core" />
              <span className="topic-anchor__ring" />
            </div>
          );
        })}

        <TopicNode
          topicKey="center"
          label={page.root.label}
          content={page.root.content}
          position={topicPositions.center}
          proximity={getTriggerProximity(topicPositions.center.y, TRIGGER_LINE_Y, TRIGGER_PROXIMITY_RANGE)}
          inTriggerBand={Math.abs(topicPositions.center.y - TRIGGER_LINE_Y) <= TRIGGER_BAND_HALF_HEIGHT}
          isRoot
          selected={selectedNode === "center" || triggerTopic === "center"}
          onClick={onOpenCenter}
        />
        <TopicNode
          topicKey="up"
          label={page.directions.up.label}
          content={page.directions.up.content}
          position={topicPositions.up}
          proximity={getTriggerProximity(topicPositions.up.y, TRIGGER_LINE_Y, TRIGGER_PROXIMITY_RANGE)}
          inTriggerBand={Math.abs(topicPositions.up.y - TRIGGER_LINE_Y) <= TRIGGER_BAND_HALF_HEIGHT}
          selected={selectedNode === "up" || triggerTopic === "up"}
          onClick={() => onOpenDirection("up")}
        />
        <TopicNode
          topicKey="right"
          label={page.directions.right.label}
          content={page.directions.right.content}
          position={topicPositions.right}
          proximity={getTriggerProximity(topicPositions.right.y, TRIGGER_LINE_Y, TRIGGER_PROXIMITY_RANGE)}
          inTriggerBand={Math.abs(topicPositions.right.y - TRIGGER_LINE_Y) <= TRIGGER_BAND_HALF_HEIGHT}
          selected={selectedNode === "right" || triggerTopic === "right"}
          onClick={() => onOpenDirection("right")}
        />
        <TopicNode
          topicKey="down"
          label={page.directions.down.label}
          content={page.directions.down.content}
          position={topicPositions.down}
          proximity={getTriggerProximity(topicPositions.down.y, TRIGGER_LINE_Y, TRIGGER_PROXIMITY_RANGE)}
          inTriggerBand={Math.abs(topicPositions.down.y - TRIGGER_LINE_Y) <= TRIGGER_BAND_HALF_HEIGHT}
          selected={selectedNode === "down" || triggerTopic === "down"}
          onClick={() => onOpenDirection("down")}
        />
        <TopicNode
          topicKey="left"
          label={page.directions.left.label}
          content={page.directions.left.content}
          position={topicPositions.left}
          proximity={getTriggerProximity(topicPositions.left.y, TRIGGER_LINE_Y, TRIGGER_PROXIMITY_RANGE)}
          inTriggerBand={Math.abs(topicPositions.left.y - TRIGGER_LINE_Y) <= TRIGGER_BAND_HALF_HEIGHT}
          selected={selectedNode === "left" || triggerTopic === "left"}
          onClick={() => onOpenDirection("left")}
        />
      </section>

      <ContentPanel topic={openTopic} onClose={onClosePanel} />
    </main>
  );
}

