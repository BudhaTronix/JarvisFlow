interface TopicNodeProps {
  label: string;
  content: string;
  placement: "center" | "up" | "right" | "down" | "left";
  selected: boolean;
  isRoot?: boolean;
  onClick: () => void;
}

export function TopicNode({ label, content, placement, selected, isRoot = false, onClick }: TopicNodeProps) {
  return (
    <button
      type="button"
      className={[
        "topic-node",
        `topic-node--${placement}`,
        selected ? "topic-node--selected" : "",
        isRoot ? "topic-node--root" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <span className="topic-node__label">{label}</span>
      <span className="topic-node__content">{content}</span>
    </button>
  );
}
