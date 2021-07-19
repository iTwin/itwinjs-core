/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Arc3d } from "../../curve/Arc3d";
import { AnyRegion } from "../../curve/CurveChain";
import { CurveChain, CurveCollection } from "../../curve/CurveCollection";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { RegionOps } from "../../curve/RegionOps";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Angle } from "../../geometry3d/Angle";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { MomentData } from "../../geometry4d/MomentData";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console, @typescript-eslint/naming-convention */
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

  it("OrientedArea", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let y0 = 0;
    const regions: AnyRegion[] = [];
    const regionD0 = Loop.create(
      LineString3d.create([[1, 4], [0, 4], [0, 0], [1, 0]]),
      Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 0), Point3d.create(3, 2), Point3d.create(1, 4))!);
    const mirrorX = Transform.createFixedPointAndMatrix(undefined, Matrix3d.createScale(-1, 1, 1));
    const regionD1 = regionD0.cloneTransformed(mirrorX)!;
    regions.push(regionD0, regionD1 as Loop);
    const skewFactor = 0.25;
    const skew = Transform.createFixedPointAndMatrix(undefined, Matrix3d.createRowValues(1, skewFactor, 0, 0, 1, 0, 0, 0, 1));
    regions.push(regionD0.cloneTransformed(skew)! as AnyRegion);
    regions.push(regionD1.cloneTransformed(skew)! as AnyRegion);
    const poles = new Float64Array([
      1, 0, 0,
      4, 0, 0,
      4, 1, 0,
      1, 1, 0,
      2, 2, 0,
      5, 2, 0,
      6, 3, 0,
      5, 4, 0,
      1, 4, 0]);
    for (const order of [3, 4, 5]) {
      const regionE0 = Loop.create(
        LineString3d.create([[1, 4], [0, 4], [0, 0], [1, 0]]),
        BSplineCurve3d.createUniformKnots(poles, order)!);
      regions.push(regionE0);
    }
    for (const r0 of regions) {
      const r1 = r0.cloneTransformed(mirrorX)!;
      const areas: Array<number | undefined> = [];
      let x0 = 0;
      for (const r of [r0, r1]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, r, x0, y0);
        const rawMomentData = RegionOps.computeXYAreaMoments(r as AnyRegion)!;
        const principalMomentData = MomentData.inertiaProductsToPrincipalAxes(rawMomentData.origin, rawMomentData.sums)!;
        ck.testDefined(principalMomentData.absoluteQuantity);
        GeometryCoreTestIO.showMomentData(allGeometry, principalMomentData, false, x0, y0);
        areas.push(principalMomentData.absoluteQuantity);
        x0 += 20.0;
      }
      if (areas[0] !== undefined && areas[1] !== undefined)
        ck.testCoordinate(areas[0], areas[1], "area before and after mirror.");
      y0 += 10.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Moments", "OrientedArea");
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
      Sample.createBsplineCurves(true),
      Sample.createSimpleParityRegions()]) {
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
