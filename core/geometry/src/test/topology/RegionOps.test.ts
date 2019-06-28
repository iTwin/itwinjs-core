/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";

import { Sample } from "../../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";

import { RegionOps } from "../../curve/RegionOps";

describe("RegionOps", () => {

  it("AreaUnion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const yStep = 10.0;
    const rectangle0 = Sample.createRectangleXY(0, 0, 5, 2);
    const rectangle1 = Sample.createRectangleXY(1, 1, 2, 3);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(rectangle0), x0, y0);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(rectangle1), x0, y0);
    y0 += yStep;

    const unionRegion = RegionOps.polygonXYAreaUnionLoopsToPolyface(rectangle0, rectangle1);
    if (ck.testPointer(unionRegion) && unionRegion)
      GeometryCoreTestIO.captureGeometry(allGeometry, unionRegion, x0, y0);
    y0 += yStep;

    const intersectionRegion = RegionOps.polygonXYAreaIntersectLoopsToPolyface(rectangle0, rectangle1);
    if (ck.testPointer(intersectionRegion) && intersectionRegion)
      GeometryCoreTestIO.captureGeometry(allGeometry, intersectionRegion, x0, y0);
    y0 += yStep;

    const differenceRegion = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(rectangle0, rectangle1);
    if (ck.testPointer(differenceRegion) && differenceRegion)
      GeometryCoreTestIO.captureGeometry(allGeometry, differenceRegion, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "AreaUnion");
    expect(ck.getNumErrors()).equals(0);
  });

});
