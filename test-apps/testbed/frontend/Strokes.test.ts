/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Point3d } from "@bentley/geometry-core";
import { StrokesPrimitivePointList, StrokesPrimitivePointLists } from "@bentley/imodeljs-frontend/lib/rendering";

describe("StrokesPrimitivePointList", () => {
  it("StrokesPrimitivePointList works as expected", () => {
    const b = new StrokesPrimitivePointList();
    assert.isTrue(b.points.length === 0, "points set correctly when constructor with no arguments");

    const points = [new Point3d(1, 2, 3), new Point3d(2, 4, 5), new Point3d(6, 7, 8)];
    const c = new StrokesPrimitivePointList(points);
    expect(c.points).to.deep.equal(points);
  });
});

describe("StrokesPrimitivePointLists", () => {
  it("StrokesPrimitivePointLists works as expected", () => {
    const a = new StrokesPrimitivePointList();

    const points = [new Point3d(1, 2, 3), new Point3d(2, 4, 5), new Point3d(6, 7, 8)];
    const b = new StrokesPrimitivePointList(points);

    const list = [a, b];
    const strokesLists = new StrokesPrimitivePointLists(a, b);
    expect(strokesLists).to.deep.equal(list);
  });
});
