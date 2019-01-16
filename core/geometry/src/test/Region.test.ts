/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "./Checker";
import { expect } from "chai";
import { UnionRegion } from "../curve/UnionRegion";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Sample } from "../serialization/GeometrySamples";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { ParityRegion } from "../curve/ParityRegion";

describe("Regions", () => {
  it("UnionRegion", () => {
    const ck = new Checker();
    // const allGeometry = [];
    // GeometryCoreTestIO.saveGeometry(allGeometry, "TransformedSolids", "SweepContour");
    const region = UnionRegion.create();
    const segment = LineSegment3d.createXYZXYZ(0, 0, 0, 1, 0, 0);
    const loop = Loop.create(LineString3d.create(Sample.createRectangleXY(0, 0, 4, 3, 0)));
    ck.testFalse(region.tryAddChild(segment));
    ck.testTrue(region.tryAddChild(loop));
    ck.testPointer(region.getChild(0));
    ck.testUndefined(region.getChild(3));
    expect(ck.getNumErrors()).equals(0);
  });

  it("ParityRegion", () => {
    const ck = new Checker();
    // const allGeometry = [];
    // GeometryCoreTestIO.saveGeometry(allGeometry, "TransformedSolids", "SweepContour");
    const region = ParityRegion.create();
    const segment = LineSegment3d.createXYZXYZ(0, 0, 0, 1, 0, 0);
    const loop = Loop.create(LineString3d.create(Sample.createRectangleXY(0, 0, 4, 3, 0)));
    ck.testFalse(region.tryAddChild(segment));
    ck.testTrue(region.tryAddChild(loop));
    ck.testPointer(region.getChild(0));
    ck.testUndefined(region.getChild(3));
    expect(ck.getNumErrors()).equals(0);
  });
});
