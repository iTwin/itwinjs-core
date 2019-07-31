/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Checker } from "../Checker";
import { expect } from "chai";
import { Sample } from "../../serialization/GeometrySamples";
import { Loop } from "../../curve/Loop";
import { LineString3d } from "../../curve/LineString3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { MomentData } from "../../geometry4d/MomentData";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { CurveChain, CurveCollection } from "../../curve/CurveCollection";
import { Angle } from "../../geometry3d/Angle";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { RegionOps } from "../../curve/RegionOps";
import { CurvePrimitive } from "../../curve/CurvePrimitive";

/* tslint:disable:no-console variable-name */
/** Add individual segments of  xyz array to parent. */
function addSegmentsToChain(parent: CurveChain, points: Point3d[]) {
  for (let i = 1; i < points.length; i++)
    parent.tryAddChild(LineSegment3d.create(points[i - 1], points[i]));
}
describe("MomentData", () => {
  it("Polygons", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const loops = Sample.createSimpleXYPointLoops();
    loops.push([Point3d.create(0, 0), Point3d.create(1, 0), Point3d.create(0, 1), Point3d.create(0, 0)]);
    loops.push([Point3d.create(1, 1), Point3d.create(2, 1), Point3d.create(1, 2), Point3d.create(1, 1)]);
    loops.push([Point3d.create(1, 0), Point3d.create(1, 1), Point3d.create(0, 1), Point3d.create(1, 0)]);
    let x0 = 0;
    const shift = 10.0;
    for (const xyLoop of loops) {
      let y0 = 0;
      const loop0 = Loop.create(LineString3d.create(xyLoop));
      const loop1 = Loop.create();
      addSegmentsToChain(loop1, xyLoop);
      for (const loop of [loop0, loop1]) {
        const momentData1 = RegionOps.computeXYAreaMoments(loop);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop, x0, y0, 0);
        GeometryCoreTestIO.showMomentData(allGeometry, momentData1, true, x0, y0, 0);
        y0 += shift;
      }
      x0 += shift;
    }

    for (const xyLoops of loops) {
      const y0 = 0;
      if (xyLoops.length >= 4) {
        const bcurve4 = BSplineCurve3d.createUniformKnots(xyLoops, 4)!;
        const loop4 = Loop.create(bcurve4);
        const momentData1 = RegionOps.computeXYAreaMoments(loop4);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop4, x0, y0, 0);
        GeometryCoreTestIO.showMomentData(allGeometry, momentData1, true, x0, y0, 0);
      }
      x0 += shift;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Moments", "SimpleXYPointLoops");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Arcs", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const loops = Sample.createArcRegions();
    let x0 = 0;
    const shift = 10.0;
    const strokeOptions = StrokeOptions.createForCurves();
    strokeOptions.angleTol = Angle.createDegrees(2.5);
    for (const loop0 of loops) {
      const gyrationData: MomentData[] = [];
      let y0 = 0;
      const momentData0 = RegionOps.computeXYAreaMoments(loop0)!;
      gyrationData.push(MomentData.inertiaProductsToPrincipalAxes(momentData0.origin, momentData0.sums)!);

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop0, x0, y0, 0);
      // console.log(momentData0);
      GeometryCoreTestIO.showMomentData(allGeometry, momentData0, true, x0, y0, 0);
      y0 += shift;
      for (const degrees of [5.0, 2.5, 1.25, 0.0625]) {
        strokeOptions.angleTol = Angle.createDegrees(degrees);
        const loop1 = loop0.cloneStroked(strokeOptions);
        const momentData1 = RegionOps.computeXYAreaMoments(loop1 as Loop)!;
        gyrationData.push(MomentData.inertiaProductsToPrincipalAxes(momentData1.origin, momentData1.sums)!);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop1, x0, y0, 0);
        GeometryCoreTestIO.showMomentData(allGeometry, momentData1, true, x0, y0, 0);
        y0 += shift;
      }
      /*
            const error1 = [];
            const ratios = [];
            for (let i = 1; i < gyrationData.length; i++) {
              error1.push(gyrationData[i].radiusOfGyration.z - gyrationData[0].radiusOfGyration.z);
            }
            for (let i = 1; i < error1.length; i++)
              ratios.push(error1[i] / error1[i - 1]);
      */
      x0 += shift;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Moments", "Arcs");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ParityAndUnionRegions", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 20.0;
    let y0 = 0.0;
    for (const loops of [Sample.createSimpleParityRegions(), Sample.createSimpleUnions()]) {
      let x0 = 0;
      for (const loop0 of loops) {
        const gyrationData: MomentData[] = [];
        const momentData0 = RegionOps.computeXYAreaMoments(loop0)!;
        gyrationData.push(MomentData.inertiaProductsToPrincipalAxes(momentData0.origin, momentData0.sums)!);

        GeometryCoreTestIO.captureCloneGeometry(allGeometry, loop0, x0, y0, 0);
        GeometryCoreTestIO.showMomentData(allGeometry, momentData0, true, x0, y0, 0);
        x0 += shift;
      }
      y0 += shift;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Moments", "ParityAndUnionRegions");
    expect(ck.getNumErrors()).equals(0);
  });

  it("WireMoments", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const y0 = 0.0;
    const strokeOptions = StrokeOptions.createForCurves();
    strokeOptions.maxEdgeLength = 0.1;
    let x0 = 0;
    for (const sampleSet of [
      Sample.createSmoothCurvePrimitives(),
      Sample.createBsplineCurves(true)]) {
      for (const g of sampleSet) {
        const range = g.range();
        const dy = range.yLength() * 2.0;
        const rawSums = RegionOps.computeXYZWireMomentSums(g)!;
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, g, x0, y0, 0);
        GeometryCoreTestIO.showMomentData(allGeometry, rawSums, true, x0, y0, 0);
        // GeometryCoreTestIO.showMomentData(allGeometry, principalMoments, true, x0, y0, 0);
        if (g instanceof CurveCollection) {
          const strokes = g.cloneStroked(strokeOptions);
          const strokeSums = RegionOps.computeXYZWireMomentSums(strokes)!;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, strokes, x0, y0 + dy, 0);
          GeometryCoreTestIO.showMomentData(allGeometry, strokeSums, true, x0, y0 + dy, 0);
        } else if (g instanceof CurvePrimitive) {
          const strokes = LineString3d.create();
          g.emitStrokes(strokes, strokeOptions);
          const strokeSums = RegionOps.computeXYZWireMomentSums(strokes)!;
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, strokes, x0, y0 + dy, 0);
          GeometryCoreTestIO.showMomentData(allGeometry, strokeSums, true, x0, y0 + dy, 0);
        }
        x0 += 10.0 * range.xLength();
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Moments", "WireMoments");
    expect(ck.getNumErrors()).equals(0);
  });

});
