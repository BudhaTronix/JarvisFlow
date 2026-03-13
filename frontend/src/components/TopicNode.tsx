import type { CSSProperties } from "react";

import type { ScreenPoint, SelectedNode } from "../lib/types";

interface TopicNodeProps {
  topicKey: SelectedNode;
  label: string;
  content: string;
  position: ScreenPoint;
  proximity: number;
  inTriggerBand: boolean;
  selected: boolean;
  isRoot?: boolean;
  onClick: () => void;
}

export function TopicNode({
  topicKey,
  label,
  content,
  position,
  proximity,
  inTriggerBand,
  selected,
  isRoot = false,
  onClick,
}: TopicNodeProps) {
  const scale = 1 + proximity * 0.05 + (inTriggerBand ? 0.05 : 0) + (selected ? 0.04 : 0);
  const style = {
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    transform: `translate(-50%, -50%) scale(${scale})`,
    ["--topic-proximity" as string]: proximity.toString(),
    ["--topic-band" as string]: inTriggerBand ? "1" : "0",
  } satisfies CSSProperties;

  return (
    <button
      type="button"
      data-topic={topicKey}
      className={[
        "topic-node",
        `topic-node--${topicKey}`,
        selected ? "topic-node--selected" : "",
        inTriggerBand ? "topic-node--band" : "",
        isRoot ? "topic-node--root" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onClick={onClick}
    >
      <span className="topic-node__label">{label}</span>
      <span className="topic-node__content">{content}</span>
    </button>
  );
}
