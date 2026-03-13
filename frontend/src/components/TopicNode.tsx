import type { ScreenPoint } from "../lib/types";

interface TopicNodeProps {
  label: string;
  content: string;
  position: ScreenPoint;
  selected: boolean;
  isRoot?: boolean;
  onClick: () => void;
}

export function TopicNode({ label, content, position, selected, isRoot = false, onClick }: TopicNodeProps) {
  return (
    <button
      type="button"
      className={[
        "topic-node",
        selected ? "topic-node--selected" : "",
        isRoot ? "topic-node--root" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
      }}
      onClick={onClick}
    >
      <span className="topic-node__label">{label}</span>
      <span className="topic-node__content">{content}</span>
    </button>
  );
}
