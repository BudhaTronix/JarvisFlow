import type { TopicNodeData } from "../lib/types";

interface ContentPanelProps {
  topic: TopicNodeData | null;
  onClose: () => void;
}

export function ContentPanel({ topic, onClose }: ContentPanelProps) {
  if (!topic) {
    return null;
  }

  return (
    <div className="content-panel-backdrop" onClick={onClose}>
      <aside
        className="content-panel content-panel--open"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={topic.label}
      >
        <div className="content-panel__header">
          <div>
            <p className="eyebrow">Topic meaning</p>
            <h2>{topic.label}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="content-panel__body">{topic.content}</p>
      </aside>
    </div>
  );
}
