import type { TopicNodeData } from "../lib/types";

interface ContentPanelProps {
  topic: TopicNodeData | null;
  onClose: () => void;
}

export function ContentPanel({ topic, onClose }: ContentPanelProps) {
  return (
    <aside className={topic ? "content-panel content-panel--open" : "content-panel"}>
      <div className="content-panel__header">
        <div>
          <p className="eyebrow">Topic meaning</p>
          <h2>{topic?.label ?? "Select a topic"}</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="content-panel__body">
        {topic?.content ?? "Click a branch, use the keyboard, or use gestures once the camera is active."}
      </p>
    </aside>
  );
}
