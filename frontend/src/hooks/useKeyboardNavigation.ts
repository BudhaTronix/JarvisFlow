import { useEffect, useRef } from "react";

import type { Direction, SelectedNode } from "../lib/types";

interface KeyboardNavigationOptions {
  enabled: boolean;
  canMoveToNextPage: boolean;
  canMoveToPreviousPage: boolean;
  selectedNode: SelectedNode;
  onSelectCenter: () => void;
  onHighlightDirection: (direction: Direction) => void;
  onOpenSelected: () => void;
  onClosePanel: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

export function useKeyboardNavigation({
  enabled,
  canMoveToNextPage,
  canMoveToPreviousPage,
  selectedNode,
  onSelectCenter,
  onHighlightDirection,
  onOpenSelected,
  onClosePanel,
  onNextPage,
  onPreviousPage,
}: KeyboardNavigationOptions) {
  const handlersRef = useRef({
    canMoveToNextPage,
    canMoveToPreviousPage,
    selectedNode,
    onSelectCenter,
    onHighlightDirection,
    onOpenSelected,
    onClosePanel,
    onNextPage,
    onPreviousPage,
  });

  handlersRef.current = {
    canMoveToNextPage,
    canMoveToPreviousPage,
    selectedNode,
    onSelectCenter,
    onHighlightDirection,
    onOpenSelected,
    onClosePanel,
    onNextPage,
    onPreviousPage,
  };

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea") {
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          handlersRef.current.onHighlightDirection("up");
          break;
        case "ArrowRight":
          event.preventDefault();
          handlersRef.current.onHighlightDirection("right");
          break;
        case "ArrowDown":
          event.preventDefault();
          handlersRef.current.onHighlightDirection("down");
          break;
        case "ArrowLeft":
          event.preventDefault();
          handlersRef.current.onHighlightDirection("left");
          break;
        case "Home":
          event.preventDefault();
          handlersRef.current.onSelectCenter();
          break;
        case "PageDown":
          if (handlersRef.current.canMoveToNextPage) {
            event.preventDefault();
            handlersRef.current.onNextPage();
          }
          break;
        case "PageUp":
          if (handlersRef.current.canMoveToPreviousPage) {
            event.preventDefault();
            handlersRef.current.onPreviousPage();
          }
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          handlersRef.current.onOpenSelected();
          break;
        case "Escape":
          event.preventDefault();
          handlersRef.current.onClosePanel();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
