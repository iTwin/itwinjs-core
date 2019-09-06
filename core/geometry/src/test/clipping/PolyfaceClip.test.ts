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
import { RFunctions } from "../polyface/PolyfaceQuery.test";
import { LinearSweep } from "../../solid/LinearSweep";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Box } from "../../solid/Box";
import { Range3d } from "../../geometry3d/Range";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Transform } from "../../geometry3d/Transform";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Angle } from "../../geometry3d/Angle";

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

  it("Section", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0.0;
    const zShift = 0.01;
    for (const multiplier of [1, 3]) {
      x0 += multiplier * 10;
      const polyface = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), 3 * multiplier, 4 * multiplier);
      if (multiplier > 1)
        polyface.data.point.mapComponent(2,
          (x: number, y: number, _z: number) => {
            return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, -1.0, 8.0);
          });
      for (let q = 1; q <= multiplier + 1.5; q++) {
        const clipper = ClipPlane.createNormalAndPointXYZXYZ(q, 1, 0, q, q, 1)!;
        const section = PolyfaceClip.sectionPolyfaceClipPlane(polyface, clipper)!;
        // save with zShift to separate cleanly from the background mesh . .
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, 0, zShift);
        GeometryCoreTestIO.captureGeometry(allGeometry, section, x0, 0, 0);
      }
      // !!! save this only at end so the x0 shift does not move the mesh for the clippers.
      GeometryCoreTestIO.captureGeometry(allGeometry, polyface, x0, 0, 0);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "Section");
    expect(ck.getNumErrors()).equals(0);

  });

  it("ClosedSection", () => {
    const ck = new Checker();
    let x0 = 0.0;
    const y0 = 0.0;
    const y1 = 10.0;
    const y2 = 20.0;
    const y3 = 30.0;
    const allGeometry: GeometryQuery[] = [];
    const xyStar = Sample.createStar(0, 0, 0, 4, 2, 4, true);
    // xyStar.reverse ();
    const sweep = LinearSweep.createZSweep(xyStar, 0, 10, true)!;
    const options = StrokeOptions.createForFacets();
    options.maxEdgeLength = 4.0;
    const builder = PolyfaceBuilder.create(options);
    builder.addLinearSweep(sweep);
    const facets = builder.claimPolyface(true);
    const range = facets.range();
    range.expandInPlace(0.5);
    for (const clipPlane of [
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 1, 1, 3)!,
      ClipPlane.createNormalAndPointXYZXYZ(1, 0.5, 0.2, 0, 1, 1)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 1, 1, 1, 1, 2)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, 2)!]) {
      for (const insideClip of [true, false]) {
        const clipPlanePoints = clipPlane.intersectRange(range)!;
        const frame = clipPlane.getFrame();
        const section = PolyfaceClip.sectionPolyfaceClipPlane(facets, clipPlane);
        const clippedPolyface = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(facets, clipPlane, insideClip, true);
        const cutPlane = PolyfaceBuilder.polygonToTriangulatedPolyface(clipPlanePoints.getPoint3dArray());
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, facets, x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutPlane, x0, y0, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y1, 0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPolyface, x0, y3, 0);
        for (const s of section) {
          if (s.isPhysicallyClosed) {
            const region = PolyfaceBuilder.polygonToTriangulatedPolyface(s.packedPoints.getPoint3dArray(), frame);
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0, y2, 0);
          }
        }
        x0 += 10.0;
      }
      x0 += 30.0;
    }
    ck.testUndefined(PolyfaceBuilder.polygonToTriangulatedPolyface(
      [Point3d.create(0, 0), Point3d.create(0, 1)]), "should fail triangulating less than 3 points");
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "ClosedSection");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Box", () => {
    const ck = new Checker();
    const builder = PolyfaceBuilder.create();
    builder.addBox(Box.createRange(Range3d.create(Point3d.create(-1, -1, -1), Point3d.create(1, 1, 1)), true)!);
    const facets = builder.claimPolyface();
    const range = facets.range();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const y0 = 0;
    for (const clipPlane of [
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, 1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 0, -1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 2, 1, 0, 0, 0)!,
      ClipPlane.createNormalAndPointXYZXYZ(0, 2, -1, 0, 0, 0)!]) {
      const clipPlanePoints = clipPlane.intersectRange(range)!;
      const frame = clipPlane.getFrame();
      const dy = 2.0 * range.yLength();
      const y1 = y0 + dy;
      const y2 = y1 + dy;
      const y3 = y2 + dy;
      const section = PolyfaceClip.sectionPolyfaceClipPlane(facets, clipPlane);
      const clippedPolyface = PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(facets, clipPlane, true, true);
      const cutPlane = PolyfaceBuilder.polygonToTriangulatedPolyface(clipPlanePoints.getPoint3dArray());
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, facets, x0, y0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutPlane, x0, y0, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, section, x0, y1, 0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPolyface, x0, y3, 0);
      for (const s of section) {
        if (s.isPhysicallyClosed) {
          const region = PolyfaceBuilder.polygonToTriangulatedPolyface(s.packedPoints.getPoint3dArray(), frame);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, region, x0, y2, 0);
        }
      }
      x0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "Box");
    expect(ck.getNumErrors()).equals(0);
  });

  it("UnderAndOver", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    let y0 = 0;
    for (const numX of [2, 5]) {
      for (const numY of [2, 4]) {
        for (const mapY of [false, true]) {
          y0 = 0;
          const yStep = numY + 1;
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(Point3d.create(x0, y0), Point3d.create(x0, y0 + yStep)));
          GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(Point3d.create(x0, y0 + yStep), Point3d.create(x0, y0 + 2 * yStep)));
          const meshX = Sample.createTriangularUnitGridPolyface(Point3d.create(0.1, 0.2, -0.5), Vector3d.create(0.5, 0, 0.3), Vector3d.create(0, 0.6, 0), numX, numY);
          if (mapY)
            meshX.data.point.mapComponent(2,
              (x: number, y: number, _z: number) => {
                return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, -1.0, 8.0);
              });
          const meshY = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), numX, numY);
          /*
          let z0 = 0.125;
          const builderY = PolyfaceBuilder.create();
          builderY.addPolygon([Point3d.create(0, 0, z0), Point3d.create(2, 0, z0), Point3d.create(2, 2, z0), Point3d.create(0, 2, z0)]);
          const meshY = builderY.claimPolyface();
           */
          if (mapY)
            meshY.data.point.mapComponent(2,
              (x: number, y: number, _z: number) => {
                return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 3.0) * RFunctions.cosineOfMappedAngle(y, -1.0, 5.0);
              });
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshX, x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshY, x0, y0);
          const visitorX = meshX.createVisitor();
          const visitorY = meshY.createVisitor();
          const builderXUnderY = PolyfaceBuilder.create();
          const builderXOverY = PolyfaceBuilder.create();
          PolyfaceClip.clipPolyfaceUnderOverConvexPolyfaceIntoBuilders(visitorX, visitorY, builderXUnderY, builderXOverY);
          const builderYUnderX = PolyfaceBuilder.create();
          const builderYOverX = PolyfaceBuilder.create();
          PolyfaceClip.clipPolyfaceUnderOverConvexPolyfaceIntoBuilders(visitorY, visitorX, builderYUnderX, builderYOverX);

          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderXUnderY.claimPolyface(), x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderXOverY.claimPolyface(), x0, y0);
          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderYUnderX.claimPolyface(), x0, y0);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, builderYOverX.claimPolyface(), x0, y0);
          y0 += yStep;
          const cutFill = PolyfaceClip.computeCutFill(meshX, meshY);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAUnderB, x0, y0);
          y0 += yStep;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAOverB, x0, y0);
          x0 += numX * 2 + 4;
        }
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "UnderAndOver");
    expect(ck.getNumErrors()).equals(0);

  });

  it("CutFill", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const numXA = 6;
    const numYA = 5;
    const numXB = 8;
    const numYB = 8;
    const meshA = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), numXA, numYA);
    const amplitudeA = 0.2;
    const amplitudeB = -0.35;
    meshA.data.point.mapComponent(2,
      (x: number, y: number, _z: number) => {
        return amplitudeA * RFunctions.cosineOfMappedAngle(x, 0.0, numXA) * RFunctions.cosineOfMappedAngle(y, 0, numYA);
      });

    const meshB = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(0.4), Vector3d.unitY(0.3), numXB, numYB);
    meshB.data.point.mapComponent(2,
      (x: number, y: number, _z: number) => {
        return amplitudeB * RFunctions.cosineOfMappedAngle(x, 0.0, 3.0) * RFunctions.cosineOfMappedAngle(y, 1, 5.0);
      });
    // spin meshB so its grids do not align with mesh A
    const transform = Transform.createFixedPointAndMatrix(Point3d.create(0, numYB / 2, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(30)));
    meshB.tryTransformInPlace(transform);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshA, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, meshB, x0, y0);
    const cutFill = PolyfaceClip.computeCutFill(meshA, meshB);

    y0 -= numYA;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAUnderB, x0, y0);
    y0 -= numYA;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, cutFill.meshAOverB, x0, y0);

    GeometryCoreTestIO.saveGeometry(allGeometry, "PolyfaceClip", "CutFill");
    expect(ck.getNumErrors()).equals(0);

  });

});
