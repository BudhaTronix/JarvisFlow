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

export function spreadPointAwayFromOrigin(point: Point, origin: Point, extraDistance: number): Point {
  const deltaX = point.x - origin.x;
  const deltaY = point.y - origin.y;
  const magnitude = Math.hypot(deltaX, deltaY);

  if (magnitude < 0.0001) {
    return clampPoint({ x: point.x, y: point.y - extraDistance }, 0.14, 0.18);
  }

  const scale = (magnitude + extraDistance) / magnitude;
  return clampPoint(
    {
      x: origin.x + deltaX * scale,
      y: origin.y + deltaY * scale,
    },
    0.14,
    0.18,
  );
}

export function separateTrackedPoints<T extends string>(
  points: Record<T, Point>,
  minimumDistance: number,
  lockedKeys: readonly string[] = [],
): Record<T, Point> {
  const nextPoints = { ...points };
  const keys = Object.keys(nextPoints) as T[];
  const locked = new Set(lockedKeys);

  for (let pass = 0; pass < 4; pass += 1) {
    for (let leftIndex = 0; leftIndex < keys.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < keys.length; rightIndex += 1) {
        const firstKey = keys[leftIndex];
        const secondKey = keys[rightIndex];
        const firstPoint = nextPoints[firstKey];
        const secondPoint = nextPoints[secondKey];
        const deltaX = secondPoint.x - firstPoint.x;
        const deltaY = secondPoint.y - firstPoint.y;
        const actualDistance = Math.hypot(deltaX, deltaY);

        if (actualDistance >= minimumDistance) {
          continue;
        }

        const useFallbackVector = actualDistance < 0.0001;
        const directionX = useFallbackVector ? Math.cos((leftIndex + rightIndex + pass + 1) * 1.37) : deltaX / actualDistance;
        const directionY = useFallbackVector ? Math.sin((leftIndex + rightIndex + pass + 1) * 1.37) : deltaY / actualDistance;
        const pushDistance = minimumDistance - (useFallbackVector ? 0 : actualDistance);
        const pushX = directionX * pushDistance;
        const pushY = directionY * pushDistance;
        const firstLocked = locked.has(firstKey);
        const secondLocked = locked.has(secondKey);

        if (firstLocked && secondLocked) {
          continue;
        }

        if (firstLocked) {
          nextPoints[secondKey] = clampPoint(
            {
              x: secondPoint.x + pushX,
              y: secondPoint.y + pushY,
            },
            0.14,
            0.18,
          );
          continue;
        }

        if (secondLocked) {
          nextPoints[firstKey] = clampPoint(
            {
              x: firstPoint.x - pushX,
              y: firstPoint.y - pushY,
            },
            0.14,
            0.18,
          );
          continue;
        }

        nextPoints[firstKey] = clampPoint(
          {
            x: firstPoint.x - pushX / 2,
            y: firstPoint.y - pushY / 2,
          },
          0.14,
          0.18,
        );
        nextPoints[secondKey] = clampPoint(
          {
            x: secondPoint.x + pushX / 2,
            y: secondPoint.y + pushY / 2,
          },
          0.14,
          0.18,
        );
      }
    }
  }

  return nextPoints;
}

export function isClosedPalm(
  tipPoints: Point[],
  palmCenter: Point,
  handSize: number,
  bendRatios: number[],
  bendThreshold: number,
): boolean {
  const closeThreshold = Math.max(handSize * 0.95, 0.1);
  const tipsAreClose = tipPoints.every((point) => distance(point, palmCenter) <= closeThreshold);
  const fingersAreBent =
    bendRatios.slice(1).every((ratio) => ratio >= bendThreshold) &&
    bendRatios[0] >= bendThreshold * 0.7;
  return tipsAreClose && fingersAreBent;
}

