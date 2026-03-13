import { describe, expect, it } from "vitest";

import { createThresholds, resolveDirection, smoothPoint } from "./gesture";

describe("gesture helpers", () => {
  it("picks the dominant axis direction", () => {
    expect(resolveDirection(0.02, -0.14, 0.05)).toBe("up");
    expect(resolveDirection(0.18, 0.03, 0.05)).toBe("left");
    expect(resolveDirection(-0.16, 0.04, 0.05)).toBe("right");
    expect(resolveDirection(0.01, 0.02, 0.05)).toBeNull();
  });

  it("smooths toward the next point", () => {
    expect(smoothPoint(null, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(smoothPoint({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("creates sensible minimum gesture thresholds", () => {
    expect(createThresholds(0.02)).toEqual({
      joinEnter: 0.02,
      joinExit: 0.03,
      drag: 0.06,
      open: 0.055,
    });
  });
});
