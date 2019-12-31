/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Checker } from "../Checker";
import { expect } from "chai";
import { Range2d } from "../../geometry3d/Range";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineString3d } from "../../curve/LineString3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ParityRegion } from "../../curve/ParityRegion";
import { Loop } from "../../curve/Loop";
// import { LineSegment3d } from "../../curve/LineSegment3d";
/* tslint:disable:no-console */

function makeLoop(range: Range2d, close: boolean): GrowableXYZArray {
  const loop = new GrowableXYZArray();
  loop.pushXYZ(range.low.x, range.low.y, 0);
  loop.pushXYZ(range.high.x, range.low.y, 0);
  loop.pushXYZ(range.high.x, range.high.y, 0);
  loop.pushXYZ(range.low.x, range.high.y, 0);
  if (close)
    loop.pushXYZ(range.low.x, range.low.y, 0);
  return loop;
}

describe("PolygonOps", () => {
  it("SortOuterAndHoleLoopsXY.DeepNest", () => {
    const ck = new Checker();
    const a = 5.0;
    const b = 2.0 * a;
    const range1 = Range2d.createXYXY(0, 0, a, a);
    const loops: GrowableXYZArray[] = [];
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    for (let i = 0; i < 4; i++) {
      let y0 = 0.0;
      loops.push(makeLoop(range1, true));
      range1.scaleAboutCenterInPlace(0.9);
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.createArrayOfLineString3dFromVariantData(loops), x0, y0);
      y0 += b;
      const outputRegions = PolygonOps.sortOuterAndHoleLoopsXY(loops);
      for (const region of outputRegions) {
        GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.createArrayOfLineString3dFromVariantData(region), x0, y0);
        y0 += b;
      }
      x0 += b;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOps", "SortOuterAndHoleLoopsXY.DeepNest");
    expect(ck.getNumErrors()).equals(0);

  });

  it("SortOuterAndHoleLoopsXY.ManyHoles", () => {
    const ck = new Checker();
    const a = 5.0;
    const b = 2.0 * a;
    let x0 = 0.0;
    const allGeometry: GeometryQuery[] = [];
    for (const numHole of [0, 1, 3, 13]) {
      console.log({ numHoles: numHole });
      const range1 = Range2d.createXYXY(0, 0, numHole * a, a);
      const loops: GrowableXYZArray[] = [];
      loops.push(makeLoop(range1, true));
      for (let i = 0; i < numHole; i++) {
        // Place holes along the range.
        const xx = i * a;
        // Even numbered interior boxes go "above", odds stay inside.
        const yy = ((i & (0x01)) === 0) ? a : 0;
        const holeRange = Range2d.createXYXY(xx, yy, xx + a, yy + a);
        holeRange.scaleAboutCenterInPlace(0.9);
        loops.push(makeLoop(holeRange, true));
        const numHoleA = (i % 3);
        for (let k = 0; k < numHoleA; k++) {
          holeRange.scaleAboutCenterInPlace(0.8);
          loops.push(makeLoop(holeRange, true));
        }
      }
      let y0 = 0.0;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.createArrayOfLineString3dFromVariantData(loops), x0, y0);
      y0 += 1.5 * b;
      const outputRegions = PolygonOps.sortOuterAndHoleLoopsXY(loops);
      for (const region of outputRegions) {
        // GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.createXYXY(-0.5 * a, 0, (numHole + 0.5) * a, 0), x0, y0);
        // GeometryCoreTestIO.captureCloneGeometry(allGeometry, LineString3d.createArrayOfLineString3dFromVariantData(region), x0, y0);
        if (region.length > 1) {
          const parityLoops = [];
          for (const loopA of region)
            parityLoops.push(Loop.create(LineString3d.create(loopA)));
          const parityRegion = ParityRegion.createLoops(parityLoops);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, parityRegion, x0, y0);
        } else {
          GeometryCoreTestIO.captureGeometry(allGeometry, Loop.create(LineString3d.create(region[0])), x0, y0);
        }
        // y0 += 1.5 * b;
      }
      x0 += (numHole + 2) * a;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOps", "SortOuterAndHoleLoopsXY.ManyHoles");
    expect(ck.getNumErrors()).equals(0);

  });

});
