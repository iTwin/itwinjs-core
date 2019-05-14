/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "../Checker";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Sample } from "../../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

import { PolyfaceClip } from "../../polyface/PolyfaceClip";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
/* tslint:disable:no-console no-trailing-whitespace */
describe("PolyfaceClip", () => {
  it("ClipPlane", () => {
    const ck = new Checker();
    const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), 3, 4);
    const clipper = ClipPlane.createNormalAndPointXYZXYZ(1, 1, 0, 1, 1, 1)!;

    const leftClip = PolyfaceClip.clipPolyface(polyface, clipper)!;
    const rightClip = PolyfaceClip.clipPolyfaceClipPlane(polyface, clipper, false)!;
    const area = PolyfaceQuery.sumFacetAreas(polyface);
    const areaLeft = PolyfaceQuery.sumFacetAreas(leftClip);
    const areaRight = PolyfaceQuery.sumFacetAreas(rightClip);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, leftClip, 0, 10, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, rightClip, 0, 10, 0);
    ck.testCoordinate(area, areaLeft + areaRight);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ClipPlane");
    expect(ck.getNumErrors()).equals(0);

  });

  it("ConvexClipPlaneSet", () => {
    const ck = new Checker();
    const vectorU = Vector3d.create(1, -1, 0);
    const vectorV = Vector3d.create(1, 2, 0);
    const singleFacetArea = vectorU.crossProductMagnitude(vectorV);
    const xEdges = 4;
    const yEdges = 5;
    const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), vectorU, vectorV, xEdges + 1, yEdges + 1);
    const x0 = 2;
    const y0 = 0.5;
    const ax = 1.0;
    const ay = 2.0;
    const clipper = ConvexClipPlaneSet.createXYBox(x0, y0, x0 + ax, y0 + ay);

    // The mesh should be big enough to completely contain the clip -- hence output area is known .....
    const insidePart = PolyfaceClip.clipPolyface(polyface, clipper)!;
    const area = PolyfaceQuery.sumFacetAreas(polyface);
    const insideArea = PolyfaceQuery.sumFacetAreas(insidePart);
    ck.testCoordinate(xEdges * yEdges * singleFacetArea, area);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, insidePart.clone()!, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, insidePart, 0, 10, 0);

    ck.testCoordinate(ax * ay, insideArea);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ConvexClipPlaneSet");
    expect(ck.getNumErrors()).equals(0);

  });
});
