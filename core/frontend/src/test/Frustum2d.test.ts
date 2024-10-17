/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Frustum2d } from "../Frustum2d";

describe("Frustum2d", () => {
  it("should range from -1 to 1", () => {
    expect(Frustum2d.minimumZDistance).toBe(1);
    expect(Frustum2d.minimumZExtents.low).toBe(-1);
    expect(Frustum2d.minimumZExtents.high).toBe(1);
  });

  it("should map display priority to depth", () => {
    expect(Frustum2d.depthFromDisplayPriority(0)).toBe(0);
    expect(Frustum2d.depthFromDisplayPriority(500)).toBe(1);
    expect(Frustum2d.depthFromDisplayPriority(-500)).toBe(-1);
    expect(Frustum2d.depthFromDisplayPriority(250)).toBe(0.5);
    expect(Frustum2d.depthFromDisplayPriority(-125)).toBe(-0.25);
    expect(Frustum2d.depthFromDisplayPriority(501)).toBe(1);
    expect(Frustum2d.depthFromDisplayPriority(-501)).toBe(-1);
    expect(Frustum2d.depthFromDisplayPriority(99999)).toBe(1);
    expect(Frustum2d.depthFromDisplayPriority(-99999)).toBe(-1);
  });
});
