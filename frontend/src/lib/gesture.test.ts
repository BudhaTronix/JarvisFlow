import { describe, expect, it } from "vitest";

import { calculateFingerBendRatio, clampPoint, resolveDominantBentFinger, smoothPoint } from "./gesture";

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
});
