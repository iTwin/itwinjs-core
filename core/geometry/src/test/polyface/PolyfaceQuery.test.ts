/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { LineString3d } from "../../curve/LineString3d";
import { Checker } from "../Checker";
import { expect } from "chai";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";

/* tslint:disable:no-console */

it("DrapeLinestring", () => {
  const ck = new Checker();
  let dy = 0.0;
  const allGeometry: GeometryQuery[] = [];

  const wanderingPoints = [[-1, 1, 1], [1.5, 1, 1], [2, 3, -1], [3.5, 3, -2], [3.5, 6, 1], [4, 8, -2], [6, 3, 5], [8, 3, -2]];
  const packedWanderingPoints = new GrowableXYZArray();
  packedWanderingPoints.pushFrom(wanderingPoints);
  const wandringSpline = BSplineCurve3d.createUniformKnots(packedWanderingPoints, 3)!;
  const strokes = LineString3d.create();
  wandringSpline.emitStrokes(strokes);
  for (const linestring of [
    LineString3d.create([[4.2, 3, -2], [6, 3, 1]]),
    LineString3d.create([[4.2, 3, -2], [6, 3, 3]]),
    LineString3d.create(wanderingPoints),
    strokes]) {
    const mesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.create(1, 0, 0.1), Vector3d.create(0, 2, 0.5), 8, 4);
    const panels = PolyfaceQuery.sweepLinestringToFacetsXYreturnSweptFacets(linestring.packedPoints, mesh);
    GeometryCoreTestIO.captureGeometry(allGeometry, [mesh, linestring, panels], 0, dy, 0);
    dy += 20.0;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceQuery", "DrapeLinestring");
  expect(ck.getNumErrors()).equals(0);
});
