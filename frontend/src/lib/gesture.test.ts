import { describe, expect, it } from "vitest";

import {
  calculateFingerBendRatio,
  clampPoint,
  distance,
  isClosedPalm,
  resolveDominantBentFinger,
  resolveSwipeDirection,
  separateTrackedPoints,
  smoothPoint,
  spreadPointAwayFromOrigin,
} from "./gesture";

describe("gesture helpers", () => {
  it("smooths toward the next point", () => {
    expect(smoothPoint(null, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(smoothPoint({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("detects a noticeably bent finger", () => {
    const straightFinger = calculateFingerBendRatio([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
    const bentFinger = calculateFingerBendRatio([
      { x: 0, y: 0 },
      { x: 0.1, y: 1 },
      { x: 0.8, y: 1.5 },
      { x: 1, y: 1 },
    ]);

    expect(straightFinger).toBeLessThan(0.05);
    expect(bentFinger).toBeGreaterThan(0.2);
  });

  it("clamps floating positions away from the edges", () => {
    expect(clampPoint({ x: -0.2, y: 1.3 })).toEqual({ x: 0.1, y: 0.88 });
  });

  it("chooses the strongest bent finger above threshold", () => {
    expect(resolveDominantBentFinger({ thumb: 0.12, index: 0.31, middle: 0.22 }, 0.2)).toBe("index");
    expect(resolveDominantBentFinger({ thumb: 0.12, index: 0.18, middle: 0.19 }, 0.2)).toBeNull();
  });

  it("pushes topic positions outward from the palm center", () => {
    const spreadPoint = spreadPointAwayFromOrigin({ x: 0.55, y: 0.45 }, { x: 0.5, y: 0.5 }, 0.08);

    expect(spreadPoint.x).toBeCloseTo(0.6065685424949239);
    expect(spreadPoint.y).toBeCloseTo(0.3934314575050762);
  });

  it("separates overlapping topics while keeping the center anchored", () => {
    const separatedPoints = separateTrackedPoints(
      {
        center: { x: 0.5, y: 0.5 },
        up: { x: 0.52, y: 0.52 },
        right: { x: 0.68, y: 0.5 },
      },
      0.2,
      ["center"],
    );

    expect(separatedPoints.center).toEqual({ x: 0.5, y: 0.5 });
    expect(distance(separatedPoints.center, separatedPoints.up)).toBeGreaterThanOrEqual(0.199);
  });

  it("detects horizontal swipes and ignores mostly vertical motion", () => {
    expect(
      resolveSwipeDirection(
        [
          { x: 0.72, y: 0.42, timestamp: 0 },
          { x: 0.52, y: 0.44, timestamp: 80 },
          { x: 0.32, y: 0.45, timestamp: 150 },
        ],
        0.2,
        0.12,
      ),
    ).toBe("next");
    expect(
      resolveSwipeDirection(
        [
          { x: 0.24, y: 0.46, timestamp: 0 },
          { x: 0.45, y: 0.44, timestamp: 90 },
          { x: 0.68, y: 0.43, timestamp: 160 },
        ],
        0.2,
        0.12,
      ),
    ).toBe("previous");
    expect(
      resolveSwipeDirection(
        [
          { x: 0.52, y: 0.2, timestamp: 0 },
          { x: 0.55, y: 0.42, timestamp: 100 },
          { x: 0.58, y: 0.66, timestamp: 200 },
        ],
        0.2,
        0.12,
      ),
    ).toBeNull();
  });

  it("recognizes a closed palm only when all fingertips collapse inward", () => {
    expect(
      isClosedPalm(
        [
          { x: 0.52, y: 0.48 },
          { x: 0.53, y: 0.49 },
          { x: 0.51, y: 0.5 },
          { x: 0.5, y: 0.51 },
          { x: 0.49, y: 0.5 },
        ],
        { x: 0.5, y: 0.5 },
        0.12,
        [0.18, 0.24, 0.27, 0.26, 0.25],
        0.22,
      ),
    ).toBe(true);
    expect(
      isClosedPalm(
        [
          { x: 0.22, y: 0.18 },
          { x: 0.32, y: 0.12 },
          { x: 0.5, y: 0.1 },
          { x: 0.66, y: 0.2 },
          { x: 0.78, y: 0.28 },
        ],
        { x: 0.5, y: 0.5 },
        0.12,
        [0.18, 0.24, 0.27, 0.26, 0.25],
        0.22,
      ),
    ).toBe(false);
  });
});
