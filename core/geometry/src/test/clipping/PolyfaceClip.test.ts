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
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolygonOps } from "../../geometry3d/PolygonOps";

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

  /** Test PolyfaceBuilder.addPolygon variants with reverse normals. */
  it("addPolygon", () => {
    const ck = new Checker();
    const points0 = [Point3d.create(0, 0), Point3d.create(1, 0), Point3d.create(0, 2)];
    const points1 = [Point3d.create(0, 0, 1), Point3d.create(1, 0, 1), Point3d.create(0, 2, 1), Point3d.create(0, 0, 1)]; // with duplicate !

    const growable0 = new GrowableXYZArray();
    growable0.pushFrom(points0);
    const growable1 = new GrowableXYZArray();
    growable1.pushFrom(points1);

    const singleFacetArea = PolygonOps.areaNormalGo(growable0)!.magnitude();
    const builderG = PolyfaceBuilder.create();

    builderG.addPolygonGrowableXYZArray(growable0);
    // exercise reverse-order block of addPolygonGrowableXYZArray
    builderG.toggleReversedFacetFlag();
    builderG.addPolygonGrowableXYZArray(growable1);

    const polyfaceG = builderG.claimPolyface(true);
    const totalAreaG = PolyfaceQuery.sumFacetAreas(polyfaceG);

    const builderP = PolyfaceBuilder.create();

    builderP.addPolygon(points0);
    // exercise reverse-order block of addPolygonGrowableXYZArray
    builderP.toggleReversedFacetFlag();
    builderP.addPolygon(points1);

    const polyfaceP = builderP.claimPolyface(true);
    const totalAreaP = PolyfaceQuery.sumFacetAreas(polyfaceG);

    ck.testCoordinate(totalAreaG, totalAreaP);
    ck.testCoordinate(2 * singleFacetArea, totalAreaP);

    ck.testCoordinate(2 * singleFacetArea, totalAreaG);
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceG, 0, 0, 0);
    GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceP, 5, 0, 0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "addPolygon");
    expect(ck.getNumErrors()).equals(0);

  });

});
