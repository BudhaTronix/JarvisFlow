import type { Direction } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface GestureThresholds {
  fingerBendRatio: number;
}

export function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
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
  const normalizedHandSize = Math.max(handSize, 0.01);
  return {
    fingerBendRatio: Math.max(0.2, normalizedHandSize * 0.32),
  };
}

export function calculateFingerBendRatio(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  let pathLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    pathLength += distance(points[index - 1], points[index]);
  }

  if (pathLength === 0) {
    return 0;
  }

  const directLength = distance(points[0], points[points.length - 1]);
  return 1 - directLength / pathLength;
}

export function clampPoint(point: Point, paddingX = 0.1, paddingY = 0.12): Point {
  return {
    x: Math.min(1 - paddingX, Math.max(paddingX, point.x)),
    y: Math.min(1 - paddingY, Math.max(paddingY, point.y)),
  };
}

export function mirrorPoint(point: Point): Point {
  return {
    x: 1 - point.x,
    y: point.y,
  };
}

export function isSignificantlyBent(bendRatio: number, threshold: number): boolean {
  return bendRatio >= threshold;
}

export function resolveDominantBentFinger<T extends string>(
  bendMap: Record<T, number>,
  threshold: number,
): T | null {
  let selectedKey: T | null = null;
  let selectedBend = threshold;

  (Object.keys(bendMap) as T[]).forEach((key) => {
    const bendRatio = bendMap[key];
    if (bendRatio > selectedBend) {
      selectedBend = bendRatio;
      selectedKey = key;
    }
  });

  return selectedKey;
}

export function directionToTopicFinger(direction: Direction): Direction {
  return direction;
}
