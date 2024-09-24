/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Point3d } from "@itwin/core-geometry";
import { StrokesPrimitivePointList, StrokesPrimitivePointLists } from "../../../common/internal/render/Strokes";

describe("StrokesPrimitivePointList", () => {
  it("StrokesPrimitivePointList works as expected", () => {
    const b = new StrokesPrimitivePointList();
    expect(b.points.length).toBe(0);

    const points = [new Point3d(1, 2, 3), new Point3d(2, 4, 5), new Point3d(6, 7, 8)];
    const c = new StrokesPrimitivePointList(points);
    expect(c.points).toEqual(points);
  });
});

describe("StrokesPrimitivePointLists", () => {
  it("StrokesPrimitivePointLists works as expected", () => {
    const a = new StrokesPrimitivePointList();

    const points = [new Point3d(1, 2, 3), new Point3d(2, 4, 5), new Point3d(6, 7, 8)];
    const b = new StrokesPrimitivePointList(points);

    const list = [a, b];
    const strokesLists = new StrokesPrimitivePointLists(a, b);
    expect(strokesLists).toEqual(list);
  });
});
