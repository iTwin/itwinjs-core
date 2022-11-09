/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */

import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { expect } from "chai";
import { LineString3d } from "../../curve/LineString3d";
import { Arc3d } from "../../curve/Arc3d";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { OffsetMeshContext } from "../../polyface/multiclip/OffsetMeshContext";
import { IndexedPolyface } from "../../polyface/Polyface";
import { RFunctions } from "./DrapeLinestring.test";
import { Sample } from "../../serialization/GeometrySamples";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";

// import { GraphChecker } from "../topology/Graph.test";
describe("OffsetMeshContext", () => {

  it("OffsetPyramids", () => {
    const ck = new Checker();

    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const radius = 2.0;
    const height = 2.0;
    let x0 = 0;
    for (const numEdge of [3,4,6]){
      const builder = PolyfaceBuilder.create(options);
      const strokes = LineString3d.create();
      for (let i = 0; i  < numEdge; i++){
        const theta = Angle.createDegrees(i * 360 / numEdge);
        strokes.addPointXYZ (radius * theta.cos (), radius * theta.sin (), 0);
      }
      strokes.addClosurePoint ();
      const apex = Point3d.create(0, 0, height);
      // upward cone
      builder.addTriangleFan(apex, strokes, false);
      const polyface = builder.claimPolyface();
      x0 = testOffsets (ck, allGeometry, polyface, [0.05, 0.2], x0);
      }
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetPyramids");
    expect(ck.getNumErrors()).equals(0);
  });

  it("OffsetsFromFan", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const options = StrokeOptions.createForFacets();
    options.shouldTriangulate = true;
    const builder = PolyfaceBuilder.create(options);
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(4, 0, 0), Point3d.create(3, 3, 0), Point3d.create(0, 4, 0))!;
    const strokes = LineString3d.create();
    arc.emitStrokes(strokes, options);
    const coneA = Point3d.create(0, 0, 5);
    const coneB = Point3d.create (0,0,0);
    // upward cone
    builder.addTriangleFan(coneA, strokes, false);
    builder.addTriangleFan(coneB, strokes, true);
    const polyface = builder.claimPolyface();
    /*
    const baseGraph = OffsetMeshContext.buildBaseGraph (polyface);
    GraphChecker.dumpGraph (baseGraph);
    */
   testOffsets (ck, allGeometry, polyface, [0.5, 0.5, 1.0], 0.0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetsFromFan");
    expect(ck.getNumErrors()).equals(0);
  });

it("OffsetsFanToLine", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const options = StrokeOptions.createForFacets();
  options.shouldTriangulate = true;
  let x0 = 0;
  for (const pointCount of [2,4]){
    const builder = PolyfaceBuilder.create(options);
    const strokes = LineString3d.create();
    for (let i = 0; i < pointCount; i++){
      strokes.addPointXYZ (2,Geometry.interpolate (-2, i / pointCount, 2),2);
    }
    const coneA = Point3d.create(0, 0, 5);
    const coneB = Point3d.create (0,0,0);
    // upward cone
    builder.addTriangleFan(coneA, strokes, false);
    builder.addTriangleFan(coneB, strokes, true);
    const polyface = builder.claimPolyface();
    /*
    const baseGraph = OffsetMeshContext.buildBaseGraph (polyface);
    GraphChecker.dumpGraph (baseGraph);
    */
    x0 = testOffsets (ck, allGeometry, polyface, [0.5, 0.5, 1.0], x0);
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetsFanToLine");
  expect(ck.getNumErrors()).equals(0);
});

it("OffsetDTM", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0.0;
  let numTest = 0;
  const numX0 = 4;
  const numY0 = 5;
  const ax = 4.0;
  const ay = 3.0;
  const az = 1.0;
  for (const densityMultiplier of /* [1, 2, 4, 8] */[1, 3]) {
    const numX = numX0 * densityMultiplier;
    const numY = numY0 * densityMultiplier;
    numTest++;
    const dx = ax / numX;
    const dy = ay / numY;
    const _dZdX = az / numX;
    const _dZdY = az / numY;
    const mesh = Sample.createTriangularUnitGridPolyface(
      Point3d.create(0, 0, 0), Vector3d.create(dx, 0, _dZdX), Vector3d.create(0, dy, _dZdY), numX, numY);
    if (numTest > 0)
      mesh.data.point.mapComponent(2,
        (x: number, y: number, _z: number) => {
          return 1.0 * RFunctions.cosineOfMappedAngle(x, 0.0, 5.0) * RFunctions.cosineOfMappedAngle(y, 0.0, 8.0);
        });
    x0 = testOffsets (ck, allGeometry, mesh, [0.5, 0.5, 1.0], x0);
    }
  GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetDTM");
  expect(ck.getNumErrors()).equals(0);
});
it.only("OffsetSampler", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0.0;
  const closedSweeps = Sample.createClosedSolidSampler(true);
  for (const s of closedSweeps) {
    const builder = PolyfaceBuilder.create();
    builder.addGeometryQuery(s);
    const mesh = builder.claimPolyface();
    const range = mesh.range ();

    x0 = testOffsets (ck, allGeometry, mesh, [0.05 * range.xLength()], x0);
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "OffsetMeshContext", "OffsetSampler");
  expect(ck.getNumErrors()).equals(0);
});

});

function testOffsets(_ck: Checker, allGeometry: GeometryQuery[], polyface: IndexedPolyface, offsets: number[], xStart: number){
  const options = StrokeOptions.createForFacets();
  let y0 = 0;
  let x0 = xStart;
  const range = polyface.data.point.getRange ();
  const xStep = 3.0 * range.xLength();
  const yStep = 3.0 * range.yLength ();
for (const offsetSign of [1.0, -1.0]){
    x0 = xStart;
    for (const offset of offsets){
      GeometryCoreTestIO.captureCloneGeometry (allGeometry, polyface, x0, y0);
      const offsetBuilder = PolyfaceBuilder.create(options);
        OffsetMeshContext.buildOffsetMesh (polyface, offsetBuilder, offsetSign * offset);
        const offset0 = offsetBuilder.claimPolyface ();
        GeometryCoreTestIO.captureCloneGeometry (allGeometry, offset0, x0, y0);
        x0 += xStep;
      }
    y0 += yStep;
    }
  return x0;
  }
