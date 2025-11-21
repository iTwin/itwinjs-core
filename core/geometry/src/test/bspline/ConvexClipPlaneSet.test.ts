/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { BooleanClipFactory } from "../../clipping/BooleanClipFactory";
import { BooleanClipNode } from "../../clipping/BooleanClipNode";
import { ClipPlane } from "../../clipping/ClipPlane";
import { Clipper } from "../../clipping/ClipUtils";
import { ConvexClipPlaneSet, ConvexClipPlaneSetProps } from "../../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets, UnionOfConvexClipPlaneSetsProps } from "../../clipping/UnionOfConvexClipPlaneSets";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Loop, SignedLoops } from "../../curve/Loop";
import { RegionOps } from "../../curve/RegionOps";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3dArrayCarrier } from "../../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { GrowableXYZArrayCache } from "../../geometry3d/ReusableObjectCache";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("ConvexClipPlaneSet", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const errorSet1 = ConvexClipPlaneSet.fromJSON(1 as unknown as ConvexClipPlaneSetProps);
    ck.testExactNumber(0, errorSet1.planes.length);
    const ax = -1;
    const ay = -2;
    const bx = 1;
    const by = 4;
    const boxA = ConvexClipPlaneSet.createXYPolyLine([
      Point3d.create(ax, ay, 0),
      Point3d.create(bx, ay, 0),
      Point3d.create(bx, by, 0),
      Point3d.create(ax, by, 0),
      Point3d.create(ax, ay, 0)],
      [true, true, true, true, true], true);
    const boxA1 = boxA.clone();
    ck.testFalse(errorSet1.isAlmostEqual(boxA));
    ConvexClipPlaneSet.createEmpty(boxA1);
    ck.testExactNumber(0, boxA1.planes.length);
    const boxB = ConvexClipPlaneSet.createXYBox(ax, ay, bx, by);
    const boxC = boxB.clone();
    const segmentM = LineSegment3d.createXYXY(
      Geometry.interpolate(ax, 0.3, bx), ay,
      bx, Geometry.interpolate(ay, 0.9, by), 0);

    for (const transform of [
      Transform.createTranslationXYZ(10, 0, 0),
      Transform.createFixedPointAndMatrix(
        Point3d.create(ax, ay, 0),
        Matrix3d.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(90))!),
      Transform.createFixedPointAndMatrix(
        Point3d.create(3, 2, 5),
        Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 9), Angle.createDegrees(23))!)]) {

      const segmentN = segmentM.cloneTransformed(transform);
      const boxD = boxA.clone();
      boxD.transformInPlace(transform);

      for (const f of [-2, -0.2, 0.001, 0.3, 0.998, 1.0002, 3]) {
        const pointM = segmentM.fractionToPoint(f);
        const inOut = boxA.isPointInside(pointM);
        ck.testBoolean(boxA.isPointInside(pointM), boxB.isPointInside(pointM), "point inside", f, pointM);
        ck.testBoolean(boxA.isPointInside(pointM), boxC.isPointInside(pointM), "point inside clone", f, pointM);
        ck.testBoolean(boxA.isPointInside(pointM), Geometry.isIn01(f), "point inside versus segment fraction, ", pointM);

        const pointN = segmentN.fractionToPoint(f);
        ck.testBoolean(inOut, boxD.isPointInside(pointN), "inOut for transformed", f, pointN);
      }
    }
    ck.checkpoint("ConvexClipPlaneSet.HelloWorld");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("UnionOfConvexSets", () => {
    const ck = new Checker();
    const setA = UnionOfConvexClipPlaneSets.fromJSON(1 as unknown as UnionOfConvexClipPlaneSetsProps);
    const setB = UnionOfConvexClipPlaneSets.createEmpty(setA);
    const box01 = ConvexClipPlaneSet.createRange3dPlanes(Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1));
    const box12 = ConvexClipPlaneSet.createRange3dPlanes(Range3d.createXYZXYZ(1, 0, 0, 2, 1, 1));
    const box23 = ConvexClipPlaneSet.createRange3dPlanes(Range3d.createXYZXYZ(2, 0, 0, 3, 1, 1));
    const setC = UnionOfConvexClipPlaneSets.createConvexSets([box01, box12]);
    const setD = UnionOfConvexClipPlaneSets.createConvexSets([box01, box12, box23]);
    const setCReversed = UnionOfConvexClipPlaneSets.createConvexSets([box12, box01]);
    ck.testTrue(setC.isAlmostEqual(setC), "almostEqual to self");
    ck.testFalse(setC.isAlmostEqual(setD), "almostEqual different count");
    ck.testFalse(setC.isAlmostEqual(setCReversed), "almostEqual different order");
    ck.testDefined(setB);
    const points: Point3d[] = [];
    const range = Range3d.createNull();
    setC.computePlanePlanePlaneIntersectionsInAllConvexSets(points, range, undefined, false);
    ck.testExactNumber(16, points.length, "intersection points in 2 boxes");
    setC.setInvisible(true);
    expect(ck.getNumErrors()).toBe(0);
  });
  // allow XOR etc as property names
  /* eslint-disable @typescript-eslint/naming-convention */
  it("parser", () => {
    const ck = new Checker();
    const boxA = ConvexClipPlaneSet.createXYBox(1, 2, 3, 5);
    const boxB = ConvexClipPlaneSet.createXYBox(0, 0, 1, 10);
    const boxAB = UnionOfConvexClipPlaneSets.createConvexSets([boxA, boxB]);
    const outBoxB = BooleanClipFactory.createCaptureClipOutside(boxB) as BooleanClipNode;
    // const outsideAB = BooleanClipFactory.createCaptureClipOutside(boxAB);
    const jsonA = BooleanClipFactory.anyClipperToJSON(boxA);
    const jsonB = BooleanClipFactory.anyClipperToJSON(boxB);
    const jsonAB = BooleanClipFactory.anyClipperToJSON(boxAB);
    const jsonOutB = BooleanClipFactory.anyClipperToJSON(outBoxB);
    const boxA1 = BooleanClipFactory.parseToClipper(jsonA);
    const boxB1 = BooleanClipFactory.parseToClipper(jsonB);
    const boxAB1 = BooleanClipFactory.parseToClipper(jsonAB);
    ck.testDefined(boxA1);
    ck.testDefined(boxB1);
    ck.testDefined(boxAB1);
    ck.testDefined(BooleanClipFactory.parseToClipperArray(jsonAB));
    ck.testDefined(BooleanClipFactory.parseToClipperArray(jsonB));
    ck.testUndefined(BooleanClipFactory.parseToClipper(undefined));
    ck.testUndefined(BooleanClipFactory.parseToClipper([]));
    ck.testUndefined(BooleanClipFactory.parseToClipper([1]));
    ck.testUndefined(BooleanClipFactory.parseToClipper([jsonA, jsonOutB]));
    ck.testDefined(BooleanClipFactory.parseToClipper(jsonOutB));
    ck.testDefined(BooleanClipFactory.parseToClipperArray(jsonOutB));

    ck.testUndefined(BooleanClipFactory.parseToClipperArray([]));
    ck.testUndefined(BooleanClipFactory.parseToClipperArray(1));
    ck.testUndefined(BooleanClipFactory.parseToClipperArray([1]));

    ck.testUndefined(BooleanClipFactory.parseToClipper({ XOR: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ NXOR: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ AND: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ NAND: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ OR: [1] }));
    ck.testUndefined(BooleanClipFactory.parseToClipper({ NOR: [1] }));
    ck.testUndefined(BooleanClipFactory.anyClipperToJSON(jsonA as Clipper));

    expect(ck.getNumErrors()).toBe(0);
  });
  it("ClipZingers", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const e = ClipPlane.fromJSON({ dist: 0, normal: { x: 0, y: 0, z: 1 }}); if (!ck.testDefined(e)) return; // satisfy stupid lint rule
    const polygon = [Point3d.create(-50,-50), Point3d.create(50,-50), Point3d.create(50, 50), Point3d.create(-50, 50), Point3d.create(-50,-50)];
    const clippers = [ // 7 adjacent convex sets with slight slop
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8054114340360389, -0.592716139415835), -4.149038686116764) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8980524108020354, 0.4398884716068973), 5.126152013274428) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8903085243351061, -0.45535780601220177), -0.30157950480815865) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8088279611394554, -0.5880453462778117), -3.893270196321412) ?? e,
      ]),
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(0.8980524108020354, -0.4398884716068973), -5.12615201327443) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.999979731954491, -0.006366763716703729), 2.217448326126236) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8869706684102969, -0.4618257608447054), -0.3622079383635508) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8707121995300405, -0.4917929092509965), -0.5755027592941668) ?? e,
      ]),
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(0.999979731954491, 0.006366763716703729), -2.2174483261262363) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9999792607661748, -0.006440344519855217), 1.7228605898197484) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.928476690885257, -0.371390676354109), 0.06189844605899064) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8633225675593762, -0.504652498599468), -0.6340718324753822) ?? e,
      ]),
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(0.9999792607661748, 0.006440344519855217), -1.7228605898197487) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-1, 0), 1.25) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.928476690885259, -0.37139067635410417), 0.04642383454426113) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9048187022009956, -0.4257970363298764), -0.2084631323698214) ?? e,
      ]),
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(1, 0), -1.25) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9999779067354997, 0.006647258148163134), 0.7618931009004164) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9284766908852593, -0.37139067635410367), 0.030949223029508977) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.894427190999916, -0.447213595499958), -0.22360679774997894) ?? e,
      ]),
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(0.9999779067354997, -0.006647258148163134), -0.7618931009004165) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9999772258304591, 0.006748912536012234), 0.25443959685720713) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9284766908852592, -0.3713906763541036), 0.015474611514754433) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.8682431421244571, -0.4961389383568375), -0.2377332412959906) ?? e,
      ]),
      ConvexClipPlaneSet.createPlanes([
        ClipPlane.createNormalAndDistance(Vector3d.create(0.9999772258304591, -0.006748912536012234), -0.25443959685720713) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.9557917232674076, -0.2940445233863735), -3.399889728143819) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.923879532511287, -0.3826834323650896), -1.7763568394002505e-15) ?? e,
        ClipPlane.createNormalAndDistance(Vector3d.create(-0.7081650584504229, -0.7060469176973362), -0.23534791349540338) ?? e,
      ]),
    ];
    const cache = new GrowableXYZArrayCache();
    const insides: GrowableXYZArray[] = [];
    const outsides: GrowableXYZArray[] = [];
    const polygonCarrier = new Point3dArrayCarrier(polygon);
    const work = new GrowableXYZArray();
    const testClipPolygon = (clip: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets, useAppend: boolean, dx: number = 0, dz: number = 0): number => {
      insides.length = 0;
      if (useAppend) {
        outsides.length = 0;
        clip.appendPolygonClip(polygonCarrier, insides, outsides, cache);
      } else {
        if (clip instanceof ConvexClipPlaneSet) {
          const inside = new GrowableXYZArray();
          clip.polygonClip(polygon, inside, work);
          insides.push(inside);
        } else
          clip.polygonClip(polygon, insides, work);
      }
      const loops: Loop[] = [];
      for (const poly of insides)
        loops.push(Loop.createPolygon(poly));
      const components = RegionOps.constructAllXYRegionLoops(loops);
      const numNegativeAreaFaces = components.reduce((count: number, component: SignedLoops) => count + component.negativeAreaLoops.length, 0);
      ck.testExactNumber(1, numNegativeAreaFaces, "clip is a single swept xy-region with no holes");
      const clippedPolygon = components[0].negativeAreaLoops[0];
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, clippedPolygon, dx, 0, dz);
      return RegionOps.computeXYArea(clippedPolygon) ?? 0;
    };
    const testUnionClipper = (clipper: UnionOfConvexClipPlaneSets, dx: number = 0, dz: number = 0): void => {
      let sumAreaAppend = 0, sumArea = 0;
      for (const clipSet of clipper.convexSets) {
        const subAreaAppend = testClipPolygon(clipSet, true, dx, dz);
        const subArea = testClipPolygon(clipSet, false, dx + 100, dz);
        ck.testCoordinate(subAreaAppend, subArea, "different methods give same area for single convex set");
        sumAreaAppend += subAreaAppend;
        sumArea += subArea;
      }
      const totalAreaAppend = testClipPolygon(clipper, true, dx, dz + 100);
      const totalArea = testClipPolygon(clipper, false, dx + 100, dz + 100);
      const clipperSize = clipper.convexSets.length;
      ck.testCoordinate(totalAreaAppend, sumAreaAppend, `[size:${clipperSize}][Append] union area equals sum of part areas`);
      ck.testCoordinate(totalArea, sumArea, `[size:${clipperSize}] union area equals sum of part areas`);
      ck.testCoordinate(totalAreaAppend, totalArea, `[size:${clipperSize}] different methods give same union areas`);
    };

    for (let numSets = 1; numSets <= clippers.length; numSets++)
      testUnionClipper(UnionOfConvexClipPlaneSets.createConvexSets(clippers.slice(0, numSets)), (numSets - 1) * 250);

    GeometryCoreTestIO.saveGeometry(allGeometry, "ConvexClipPlaneSet", "ClipZingers");
    expect(ck.getNumErrors()).toBe(0);
  });
});
