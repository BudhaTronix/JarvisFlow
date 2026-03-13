import type { Direction } from "./types";

export type GesturePhase = "idle" | "joined" | "dragging" | "opened" | "cooldown";

export interface Point {
  x: number;
  y: number;
}

export interface GestureThresholds {
  joinEnter: number;
  joinExit: number;
  drag: number;
  open: number;
}

export function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function centroid(points: Point[]): Point {
  const total = points.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

export function smoothPoint(previous: Point | null, next: Point, alpha = 0.35): Point {
  if (!previous) {
    return next;
  }

  return {
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
  };
}

export function createThresholds(handSize: number): GestureThresholds {
  return {
    joinEnter: Math.max(handSize * 0.16, 0.02),
    joinExit: Math.max(handSize * 0.22, 0.03),
    drag: Math.max(handSize * 0.35, 0.06),
    open: Math.max(handSize * 0.3, 0.055),
  };
}

export function resolveDirection(deltaX: number, deltaY: number, dragThreshold: number): Direction | null {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < dragThreshold) {
    return null;
  }

  if (absY > absX * 1.1) {
    return deltaY < 0 ? "up" : "down";
  }

  if (absX > absY * 1.1) {
    return deltaX < 0 ? "right" : "left";
  }

  if (absY >= absX) {
    return deltaY < 0 ? "up" : "down";
  }

  return deltaX < 0 ? "right" : "left";
}
