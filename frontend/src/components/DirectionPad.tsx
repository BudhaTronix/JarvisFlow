import type { Direction, SelectedNode } from "../lib/types";

interface DirectionPadProps {
  selectedNode: SelectedNode;
  onSelectCenter: () => void;
  onHighlightDirection: (direction: Direction) => void;
  onOpenSelected: () => void;
}

export function DirectionPad({
  selectedNode,
  onSelectCenter,
  onHighlightDirection,
  onOpenSelected,
}: DirectionPadProps) {
  const buttonClassName = (isActive: boolean) =>
    isActive ? "pad-button pad-button--active" : "pad-button";

  return (
    <section className="pad-card" aria-label="Debug direction controls">
      <div className="pad-grid">
        <span />
        <button
          type="button"
          className={buttonClassName(selectedNode === "up")}
          onClick={() => onHighlightDirection("up")}
        >
          Up
        </button>
        <span />
        <button
          type="button"
          className={buttonClassName(selectedNode === "left")}
          onClick={() => onHighlightDirection("left")}
        >
          Left
        </button>
        <button
          type="button"
          className={buttonClassName(selectedNode === "center")}
          onClick={onSelectCenter}
        >
          Center
        </button>
        <button
          type="button"
          className={buttonClassName(selectedNode === "right")}
          onClick={() => onHighlightDirection("right")}
        >
          Right
        </button>
        <span />
        <button
          type="button"
          className={buttonClassName(selectedNode === "down")}
          onClick={() => onHighlightDirection("down")}
        >
          Down
        </button>
        <span />
      </div>
      <button type="button" className="pad-open-button" onClick={onOpenSelected}>
        Open selected topic
      </button>
    </section>
  );
}
