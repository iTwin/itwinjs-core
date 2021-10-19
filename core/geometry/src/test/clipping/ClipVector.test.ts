/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClipMaskXYZRangePlanes, ClipPrimitive, ClipPrimitiveShapeProps, ClipShape } from "../../clipping/ClipPrimitive";
import { ClipPlane } from "../../clipping/ClipPlane";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { ClipVector, StringifiedClipVector } from "../../clipping/ClipVector";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Matrix4d } from "../../geometry4d/Matrix4d";
import { Checker } from "../Checker";
// External test functions
import { clipPrimitivesAreEqual } from "./ClipPrimitives.test";
import { Angle, GeometryQuery, GrowableXYZArray, LineString3d, Loop, PolygonOps, Sample } from "../../core-geometry";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";

/** Enumerated type for point manipulation at the extremities of a ClipVector's ClipShape. */
const enum PointAdjustment { // eslint-disable-line no-restricted-syntax
  AddX = 0,
  SubX = 1,
  AddY = 2,
  SubY = 3,
  AddZ = 4,
  SubZ = 5,
  None = 6,
}

/** Apply adjustments in place to the given point based on the PointAdjustment identifier specified, returning an array
 *  of two possible points:
 *  [pointInside OR undefined, pointOutside OR undefined]
 */
function makePointAdjustments(point: Point3d, adjustment: PointAdjustment): Array<Point3d | undefined> {
  let pointInside: Point3d | undefined;
  let pointOutside: Point3d | undefined;
  switch (adjustment) {
    case PointAdjustment.AddX:
      pointInside = Point3d.create(point.x + 0.0001, point.y, point.z);
      pointOutside = Point3d.create(point.x - 0.0001, point.y, point.z);
      break;
    case PointAdjustment.SubX:
      pointInside = Point3d.create(point.x - 0.0001, point.y, point.z);
      pointOutside = Point3d.create(point.x + 0.0001, point.y, point.z);
      break;
    case PointAdjustment.AddY:
      pointInside = Point3d.create(point.x, point.y + 0.0001, point.z);
      pointOutside = Point3d.create(point.x, point.y - 0.0001, point.z);
      break;
    case PointAdjustment.SubY:
      pointInside = Point3d.create(point.x, point.y - 0.0001, point.z);
      pointOutside = Point3d.create(point.x, point.y + 0.0001, point.z);
      break;
    case PointAdjustment.AddZ:
      pointInside = Point3d.create(point.x, point.y, point.z + 0.0001);
      pointOutside = Point3d.create(point.x, point.y, point.z - 0.0001);
      break;
    case PointAdjustment.SubZ:
      pointInside = Point3d.create(point.x, point.y, point.z - 0.0001);
      pointOutside = Point3d.create(point.x, point.y, point.z + 0.0001);
      break;
  }
  return [pointInside, pointOutside];
}

/**
 * Given a point and an adjustment that would put the point inside of a ClipVector, test whether the point is at the
 * edge of a ClipVector ClipShape.
 */

function checkPointProximity(clipVector: ClipVector, pointOnEdge: Point3d, pointInside: Point3d | undefined, pointOutside: Point3d | undefined, ck: Checker) {
  ck.testTrue(clipVector.pointInside(pointOnEdge), "Point on ClipShape edge is inside ClipVector");
  if (pointInside)
    ck.testTrue(clipVector.pointInside(pointInside), "Point within ClipShape bounds is inside ClipVector");
  if (pointOutside)
    ck.testTrue(!clipVector.pointInside(pointOutside), "Point outside of ClipShape bounds is outside ClipVector");
}

/** EXPENSIVE -- Tests whether two ClipVectors are equivalent to one another. */
function clipVectorsAreEqual(vector0: ClipVector, vector1: ClipVector): boolean {
  if (vector0.clips.length !== vector1.clips.length)
    return false;

  for (let i = 0; i < vector0.clips.length; i++)
    if (!clipPrimitivesAreEqual(vector0.clips[i], vector1.clips[i]))
      return false;
  return true;
}

describe("ClipVector", () => {
  let clipShape0: ClipShape;
  let clipShape1: ClipShape;
  let clipShape2: ClipShape;
  let clipShape3: ClipShape;
  let clipShape4: ClipShape;
  let clipVector012: ClipVector;
  // let clipVector234: ClipVector;

  /** Create a few polygonal regions, contained by several ClipShapes. The outcome will be the following (labeled by number):
   *                                 (3,3)  ________ (6,3)
   *                                        \      /
   *                                         \ 1  /
   *                                          \  /                                      - All shapes are closed (contain top and bottom z-clips) EXCEPT
   *                                    (4.5,1)\/  _____________(8,1)                     for the upper triangle
   *   (-5,-2)________                            |(6,1)        \
   *         |        |                           |              \
   *         |    0   |                           |       2       \(10,-3)
   *         |________|(-3,-4)          (3,-4)____|___             |
   *                                         /    |  _|________    |
   *                                        /     |_\_|_______/____|(10,-5)             << Upper left of upside-down triangle: (6.3,-4.5)
   *                                       /    3    \|      /                          << Upper right of upside-down triangle: (7.7,-4.5)
   *                                      /___________|\ 4  /
   *                                   (2,-7)   (6.5,-7)\  /
   *                                                     \/(7,-8)
   */
  before(() => {
    clipShape0 = ClipShape.createBlock(Range3d.createXYZXYZ(-5, -4, -50, -3, -2, 50), ClipMaskXYZRangePlanes.All);
    clipShape1 = ClipShape.createShape([Point3d.create(4.5, 1), Point3d.create(6, 3), Point3d.create(3, 3)])!;
    clipShape2 = ClipShape.createShape([
      Point3d.create(6, 1),
      Point3d.create(8, 1),
      Point3d.create(10, -3),
      Point3d.create(10, -5),
      Point3d.create(6, -5),
    ], -.2, -.1)!;
    clipShape3 = ClipShape.createShape([
      Point3d.create(2, -7),
      Point3d.create(6.5, -7),
      Point3d.create(6.5, -4),
      Point3d.create(3, -4),
    ], -5, 5)!;
    clipShape4 = ClipShape.createShape([
      Point3d.create(7, -8),
      Point3d.create(7.7, -4.5),
      Point3d.create(6.3, -4.5),
    ], -5, 5)!;
    clipVector012 = ClipVector.createCapture([clipShape0, clipShape1, clipShape2]);
    // clipVector234 = ClipVector.createCapture([clipShape2, clipShape3, clipShape4]);
  });

  it("ClipVector creation and to/from JSON", () => {
    const ck = new Checker();
    // Test the ability to parse ClipPlanes from all ClipShapes in a ClipVector (this test must be completed first before other tests cause the ClipShapes to cache their sets)
    const newlyCreatedClipVector = ClipVector.createCapture([clipShape0, clipShape1, clipShape2, clipShape3, clipShape4]);
    for (const clip of newlyCreatedClipVector.clips)
      ck.testFalse(clip.arePlanesDefined());
    newlyCreatedClipVector.parseClipPlanes();
    for (const clip of newlyCreatedClipVector.clips) {
      ck.testTrue(clip.arePlanesDefined());
    }

    // Test create methods and cloning/referencing
    const clipVectorTester0 = clipVector012.clone();
    const clipVectorTester1 = ClipVector.createEmpty();
    ck.testTrue(!clipVectorTester1.isValid, "Empty ClipVector should not be valid");
    ClipVector.createCapture(clipVectorTester0.clips, clipVectorTester1);
    ck.testTrue(clipVectorTester1.isValid, "ClipVector should not be empty after copy");
    ClipVector.create(clipVectorTester0.clips, clipVectorTester1);
    ck.testTrue(clipVectorTester1.isValid, "ClipVector should not be empty after clone");
    ClipVector.createEmpty(clipVectorTester1);
    const arrLen = clipVector012.clips.length;
    for (let i = 0; i < arrLen; i++) {
      ck.testTrue(clipVector012.clips[i] !== clipVectorTester0.clips[i], "ClipVector created with clones should have deep copies of each ClipShape");
      ck.testTrue(clipPrimitivesAreEqual(clipVector012.clips[i], clipVectorTester0.clips[i]), "ClipShape members of copied vector and cloned vector should be equivalent");
      clipVectorTester1.appendReference(clipVector012.clips[i]);
      ck.testTrue(clipVector012.clips[i] === clipVectorTester1.clips[0], "ClipShapes appended by reference should be shallow copies of each other");
      clipVectorTester1.clear();
      clipVectorTester1.appendClone(clipVector012.clips[i]);
      ck.testTrue(clipVector012.clips[i] !== clipVectorTester1.clips[0], "ClipVector with appended clone should have deep copy of ClipShape");
      ck.testTrue(clipPrimitivesAreEqual(clipVector012.clips[i], clipVectorTester1.clips[0]), "ClipVector with shallow copied ClipShape should be equivalent");
      clipVectorTester1.clear();
    }

    // Test appendages to the ClipVector array
    clipVectorTester1.appendShape(clipShape2.polygon, clipShape2.zLow, clipShape2.zHigh, undefined, clipShape2.isMask, clipShape2.invisible);
    ck.testTrue(clipPrimitivesAreEqual(clipShape2, clipVectorTester1.clips[0]), "ClipShape can be appended using points array.");

    // Test the to/from JSON methods
    const clipJSON = clipVector012.toJSON();
    ck.testTrue(clipJSON.length === clipVector012.clips.length, "Converted clipVector to a JSON representation as an array of ClipShapes");
    for (const primitive of clipJSON) {
      const shape = primitive as ClipPrimitiveShapeProps;
      ck.testTrue(shape.shape !== undefined && shape.shape.points !== undefined && shape.shape.points.length > 0, "Each ClipShape was stored successfully, with its member points");
    }
    const parsedClipVector = ClipVector.fromJSON(clipJSON);
    ck.testTrue(clipVectorsAreEqual(clipVector012, parsedClipVector), "ClipVector is the same after roundtrip to and from JSON");

    expect(ck.getNumErrors()).equals(0);
  });

  it("Point proximity and classification", () => {
    const ck = new Checker();
    const shape0Extremities: Point3d[] = [
      Point3d.create(-5, -3),
      Point3d.create(-3, -2),
      Point3d.create(-4, -3, -50),
      Point3d.create(-4, -3, 50),
    ];
    const shape0PointAdj: PointAdjustment[] = [PointAdjustment.AddX, PointAdjustment.SubX, PointAdjustment.AddZ, PointAdjustment.SubZ];
    const shape1Extremities: Point3d[] = [
      Point3d.create(4.5, 3),
      Point3d.create(3.75, 2),
      Point3d.create(5.25, 2),
      Point3d.create(4.5, 2, 100000),
    ];
    const shape1PointAdj: PointAdjustment[] = [PointAdjustment.SubY, PointAdjustment.AddX, PointAdjustment.AddY, PointAdjustment.None];
    const shape2Extremities: Point3d[] = [
      Point3d.create(7, 1, -.15),
      Point3d.create(9, -1, -.15),
      Point3d.create(10, -4, -.15),
      Point3d.create(6, -4, -.15),
      Point3d.create(7, -3, -.2),
      Point3d.create(7, -3, -.1),
    ];
    const shape2PointAdj: PointAdjustment[] = [
      PointAdjustment.SubY, PointAdjustment.SubX, PointAdjustment.SubX,
      PointAdjustment.AddX, PointAdjustment.AddZ, PointAdjustment.SubZ,
    ];
    const shapeExtremities: Point3d[][] = [shape0Extremities, shape1Extremities, shape2Extremities];
    const shapePointAdjustments: PointAdjustment[][] = [shape0PointAdj, shape1PointAdj, shape2PointAdj];

    // Ensure that 'LineString' connecting boundaries is considered inside the ClipVector
    for (const arr of shapeExtremities) {
      ck.testTrue(clipVector012.isAnyLineStringPointInside(arr), "Segments connecting ClipShape boundaries should all fall inside ClipVector");
      ck.testTrue(clipVector012.isLineStringCompletelyContained(arr), "Segments connecting ClipShape boundaries should all fall inside ClipVector");
    }
    // Check whether points are considered inside or outside at the extremities of each contained ClipShape
    let clipVectorSingleShape: ClipVector | undefined;
    for (let i = 0; i < clipVector012.clips.length; i++) {
      clipVectorSingleShape = ClipVector.create([clipVector012.clips[i]], clipVectorSingleShape);
      for (let j = 0; j < shapeExtremities[i].length; j++) {
        const pointOnEdge = shapeExtremities[i][j];
        const pointAdjustments = makePointAdjustments(pointOnEdge, shapePointAdjustments[i][j]);
        checkPointProximity(clipVectorSingleShape, pointOnEdge, pointAdjustments[0], pointAdjustments[1], ck);
        ck.testExactNumber(clipVectorSingleShape.classifyPointContainment([pointOnEdge]), 1, "Edge point should be classified as strongly inside for a single ClipShape");
        if (pointAdjustments[0])
          ck.testExactNumber(clipVectorSingleShape.classifyPointContainment([pointAdjustments[0]!]), 1, "Inner point should be classified as strongly inside for a single ClipShape");
        if (pointAdjustments[1])
          ck.testExactNumber(clipVectorSingleShape.classifyPointContainment([pointAdjustments[1]!]), 3, "Outer point should be strongly outside for single ClipShape, given it is the only point.");
        if (pointAdjustments[0] && pointAdjustments[1])
          ck.testExactNumber(clipVectorSingleShape.classifyPointContainment([pointAdjustments[0]!, pointAdjustments[1]!]), 2, "Array of outer AND inner points should return ambiguous for single ClipShape");
      }
    }
    // Ensure that pointInside check only passes for points within intersecting ClipShapes
    ck.testFalse(clipVector012.pointInside(Point3d.create(-4, -3)), "Point inside check should fail for non-intersecting ClipShapes");
    const intersectionClipVector = ClipVector.createCapture([
      ClipShape.createShape([Point3d.create(-5, 5), Point3d.create(-5, -5), Point3d.create(0.00001, 0)], -0.00001, 0.00001)!,
      ClipShape.createShape([Point3d.create(5, 5), Point3d.create(5, -5), Point3d.create(-0.00001, 0)], -0.00001, 0.00001)!,
    ]);
    ck.testTrue(intersectionClipVector.pointInside(Point3d.create(0, 0, 0)), "Origin point is inside ClipVector of intersecting triangles");
    ck.testFalse(intersectionClipVector.pointInside(Point3d.create(0.00011)), "Point inside one of two triangles fails pointInside check");
    ck.testFalse(intersectionClipVector.pointInside(Point3d.create(-0.00011)), "Point inside one of two triangles fails pointInside check");

    expect(ck.getNumErrors()).equals(0);
  });

  it("Transformations and matrix multiplication", () => {
    const ck = new Checker();
    const m0 = Matrix4d.createIdentity();
    const t0 = Transform.createIdentity();
    const clipVectorClone = clipVector012.clone();
    ck.testTrue(clipVectorClone.multiplyPlanesByMatrix4d(m0, true, true));
    // Should contain no changes
    ck.testTrue(clipVectorsAreEqual(clipVectorClone, clipVector012), "Multiplying by identity matrix does not alter the ClipVector");
    ck.testTrue(clipVectorClone.transformInPlace(t0));
    ck.testTrue(clipVectorsAreEqual(clipVectorClone, clipVector012), "Transforming with identity transform has no effect");

    clipVectorClone.appendShape([Point3d.create(2, 0, 0), Point3d.create(0, 1, 0), Point3d.create(-1, 0, 0)], undefined, undefined, undefined, true);

    // TODO: Provide checks for correct application of an actual transform into a new coordinate system

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });

  it("Extract boundary loops", () => {
    const ck = new Checker();
    const vectorLen = clipVector012.clips.length;
    const lastShape = clipVector012.clips[vectorLen - 1] as ClipShape;
    const expClipMask = ClipMaskXYZRangePlanes.XAndY | (lastShape.zLowValid ? ClipMaskXYZRangePlanes.ZLow : 0) | (lastShape.zHighValid ? ClipMaskXYZRangePlanes.ZHigh : 0);
    let expZLow = -Number.MAX_VALUE;
    let expZHigh = Number.MAX_VALUE;
    let zLowFound = false;
    let zHighFound = false;
    // Find final mask, zLow, and zHigh of clipVector012
    for (let i = vectorLen - 1; i >= 0; i--) {
      const shape = clipVector012.clips[i] as ClipShape;
      if (shape.zLowValid) {
        zLowFound = true;
        expZLow = shape.zLow!;
      }
      if (shape.zHighValid) {
        zHighFound = true;
        expZHigh = shape.zHigh!;
      }
      if (zLowFound && zHighFound)
        break;
    }
    const loopPoints: Point3d[][] = [];
    const retVal = clipVector012.extractBoundaryLoops(loopPoints);
    ck.testExactNumber(expClipMask, retVal[0], "ClipMask returned matches expected");
    ck.testExactNumber(expZLow, retVal[1], "zLow returned matches expected");
    ck.testExactNumber(expZHigh, retVal[2], "zHigh returned matches expected");
    for (let loopNum = 0; loopNum < loopPoints.length; loopNum++) {
      ck.testTrue(loopPoints[loopNum].length === (clipVector012.clips[loopNum] as ClipShape).polygon.length, "Extracted point array is of same length as ClipShape polygon");
      for (let pointNum = 0; pointNum < loopPoints[loopNum].length; pointNum++)
        ck.testTrue(loopPoints[loopNum][pointNum].isAlmostEqual((clipVector012.clips[loopNum] as ClipShape).polygon[pointNum]), "Extracted point matches point in ClipShape polygon array");
    }

    // TODO: Attempt the same check, with member transforms in each of the ClipShapes s.t. the points are transformed as they are extracted

    expect(ck.getNumErrors()).equals(0);
  });

  it("converts to compact string representation", () => {
    let cv = ClipVector.createEmpty();
    expect(cv.toCompactString()).to.equal("_");

    let convexSet = ConvexClipPlaneSet.createPlanes([]);
    let primitive = ClipPrimitive.createCapture(convexSet, false);
    cv = ClipVector.createCapture([primitive]);
    expect(cv.toCompactString()).to.equal("0___");
    primitive = ClipPrimitive.createCapture(convexSet, true);
    cv = ClipVector.createCapture([primitive]);
    expect(cv.toCompactString()).to.equal("1___");

    const plane = ClipPlane.createNormalAndDistance(new Vector3d(0, 1, 0), -5, true, false)!;
    expect(plane).not.to.be.undefined;
    convexSet = ConvexClipPlaneSet.createPlanes([plane]);
    primitive = ClipPrimitive.createCapture(convexSet);
    cv = ClipVector.createCapture([primitive]);
    expect(cv.toCompactString()).to.equal("010_1_0_-5____");

    const planes = [plane];
    planes.push(ClipPlane.createNormalAndDistance(new Vector3d(0, 0, -1), 0.00000000005, true, true)!);
    convexSet = ConvexClipPlaneSet.createPlanes(planes);
    primitive = ClipPrimitive.createCapture(convexSet);
    cv = ClipVector.createCapture([primitive]);
    expect(cv.toCompactString()).to.equal("010_1_0_-5_30_0_-1_5e-11____");

    const set2 = ConvexClipPlaneSet.createPlanes([ClipPlane.createNormalAndDistance(new Vector3d(1, 0, 0), 4, false, true)!]);
    cv = ClipVector.createCapture([primitive, ClipPrimitive.createCapture(set2, true)]);
    expect(cv.toCompactString()).to.equal("010_1_0_-5_30_0_-1_5e-11___121_0_0_4____");
  });
});

describe("StringifiedClipVector", () => {
  it("creates from ClipVector", () => {
    expect(StringifiedClipVector.fromClipVector(undefined)).to.be.undefined;
    expect(StringifiedClipVector.fromClipVector(ClipVector.createEmpty())).to.be.undefined;

    const cv = ClipVector.createCapture([ClipPrimitive.createCapture(ConvexClipPlaneSet.createPlanes([]), false)]);
    const scv = StringifiedClipVector.fromClipVector(cv)!;
    expect(scv).not.to.be.undefined;
    expect(scv).to.equal(cv);
    expect(scv.clipString).not.to.be.undefined;
    expect(scv.clipString).to.equal(cv.toCompactString());

    expect(StringifiedClipVector.fromClipVector(cv)).to.equal(scv);
  });

  it("OuterAndMask", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const outer = [[-10, -10], [10, 0], [10, 10], [-10, 10], [-10, -10]];
    const triangle = [[-2, -5], [8, 2], [0, 6], [-2, -5]];
    const innerNonConvex = [[2, 6], [5, 6], [5, 1], [4, 4], [2, 6]];
    // const innerCircle = Sample.createArcStrokes(2, Point3d.create(5, 4), 12.0, Angle.createDegrees(12), Angle.createDegrees(372));
    const innerCircle = Sample.createArcStrokes(2, Point3d.create(0, 0), 5.0, Angle.createDegrees(0), Angle.createDegrees(360));
    const innerU = [[2, 1], [4, 2], [4, 5], [5, 6], [5, 2], [8, 1], [9, 8], [3, 7], [2, 1]];
    const twoInletsWithWhisker = [[2, 1], [4, 2], [4, 5], [5, 6], [5, 2], [8, 1],
      [10, 8], [5, 8], [5, 9], [9, 9], [9, 12],
      [10,13],[12,13],[10,13],[9,12],
      [7, 11], [3, 12], [2, 1]];
    const innerDart = [
        [0, 0],
        [-6, -8],
        [10, 0],
        [-6,8],
//        [5, 0],
      ];
      const innerDart1 = [
        [7, 0],
        [9, -2],
        [5, 0],
        [9, 2],
//        [9, 0],
      ];

    let x0 = 0;
    const shiftAndRotateJson = [
      [-0.704754, 0.709452, 0, 2],
      [-0.709452, -0.704754, 0, 4],
      [0, 0, 1, 0],
    ];
    for (const isMask of [true, false]){
      const jsonTriangle = [{ shape: { points: outer } }, { shape: { points: triangle, mask: isMask } }];
      const jsonOutsideCircle = [{ shape: { points: innerCircle, mask: isMask}}];
      const jsonCircle = [{ shape: { points: outer } }, { shape: { points: innerCircle, mask: isMask}}];
      const jsonC = [{ shape: { points: outer } }, { shape: { points: innerNonConvex, mask: isMask}}];
      const jsonD = [{ shape: { points: outer } }, { shape: { points: innerU, mask: isMask}}];
      const jsonDart = [{ shape: { points: outer } }, { shape: { points: innerDart, mask: isMask}}];
      const jsonDart1 = [{ shape: { points: outer } }, { shape: { points: innerDart1, mask: isMask}}];
      const jsonTwoInlets = [{ shape: { points: outer } }, { shape: { points: twoInletsWithWhisker, mask: isMask}}];
      const jsonTwoInletsReversed = [{ shape: { points: outer } }, { shape: { points: twoInletsWithWhisker.slice().reverse(), mask: isMask } }];
      const jsonDart1Trans = [{ shape: { points: outer } }, { shape: { points: innerDart, mask: isMask, trans: shiftAndRotateJson } }];
      const jsonTriangleTrans =  [{ shape: { points: outer } }, { shape: { points: triangle, mask: isMask, trans: shiftAndRotateJson } }];
      // const polygonToClip = Sample.createArcStrokes(3, Point3d.create(5, 5), 6.0, Angle.createDegrees(0), Angle.createDegrees(360));
      const polygonToClip = Sample.createRectangleXY(-10, -10, 30, 30);
      const y0 = 0;
      for (const json of [jsonOutsideCircle, jsonCircle, jsonTriangle, jsonTriangleTrans, jsonDart1Trans, jsonTwoInlets, jsonTwoInletsReversed, jsonDart, jsonDart1, jsonDart, jsonTriangle, jsonC, jsonCircle, jsonD, jsonDart]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, GrowableXYZArray.create (outer), x0, y0);
        const primitive = ClipPrimitive.fromJSON(json[json.length - 1]);
        const clipVector = ClipVector.fromJSON(json);
        if (primitive) {
          exerciseClipPrimitive(ck, allGeometry, primitive, polygonToClip, isMask, x0, y0);
          if (ck.testType(clipVector, ClipVector)) {
            const y1 = y0 + 200;
            exerciseClipVector(ck, allGeometry, clipVector, polygonToClip, 0, x0, y1);
          }
        }
        x0 += 200.0;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipVector", "OuterAndMask");
    expect(ck.getNumErrors()).equals(0);
  });
  it("OuterAndMaskLargeCoordinateAndTransform", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const clip1 =
    [
      {
        shape: {
          points: [[0, 0], [97.608056, 0], [-11.108483, 98.118449], [0, 0]],
          transA: [
            [-0.704754, 0.709452, 0, 99560.076989],
            [-0.709452, -0.704754, 0, 80175.346101],
            [0, 0, 1, 0],
          ],
        },
      },
      {
        shape: {
          mask: true,
          points: [
            [28.449347, 15.11684],
            [5.096967, 59.735151],
            [83.292234, 6.542878],
            [28.449347, 15.11684],
          ],
          transA: [
            [-0.704754, 0.709452, 0, 99560.076989],
            [-0.709452, -0.704754, 0, 80175.346101],
            [0, 0, 1, 0],
          ],
        },
      },
      ];
    const _extraClipper = ClipPrimitive.fromJSON(
      {
        shape: {
          points: [
            [99415.230141, 80036.940295],
            [99637.538271, 80036.940295],
            [99637.538271, 80201.560936],
            [99415.230141, 80201.560936],
            [99415.230141, 80036.940295],
          ],
          zhigh: 5.001e-4,
          zlow: -5.0005e-4,
        },
      });

    let x0 = 0;
    const y0 = 0;
    for (const json of [clip1]) {
      // const polygonToClip = Sample.createRectangleXY(99400, 80000, 400, 400);
      const polygonToClip = Sample.createRectangleXY(0,-0, 100, 100);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polygonToClip, x0, y0);
      const cv = ClipVector.fromJSON(json);
      if (cv) {
        {
          exerciseClipVector(ck, allGeometry, cv, polygonToClip, 40, x0, y0);
          for (const primitive of cv.clips) {
            x0 += 200;
            exerciseClipPrimitive(ck, allGeometry, primitive, polygonToClip, false, x0, y0);
          }
        }
      }
      x0 += 200.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipVector", "OuterAndMaskLargeCoordinateAndTransform");
    expect(ck.getNumErrors()).equals(0);
  });
  it("OuterAndMask", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const outer = [[-10, -10], [10, 0], [10, 10], [-10, 10], [-10, -10]];
    const triangle = [[-2, -5], [8, 2], [0, 6], [-2, -5]];
    const innerNonConvex = [[2, 6], [5, 6], [5, 1], [4, 4], [2, 6]];
    // const innerCircle = Sample.createArcStrokes(2, Point3d.create(5, 4), 12.0, Angle.createDegrees(12), Angle.createDegrees(372));
    const innerCircle = Sample.createArcStrokes(2, Point3d.create(0, 0), 5.0, Angle.createDegrees(0), Angle.createDegrees(360));
    const innerU = [[2, 1], [4, 2], [4, 5], [5, 6], [5, 2], [8, 1], [9, 8], [3, 7], [2, 1]];
    const twoInletsWithWhisker = [[2, 1], [4, 2], [4, 5], [5, 6], [5, 2], [8, 1],
      [10, 8], [5, 8], [5, 9], [9, 9], [9, 12],
      [10,13],[12,13],[10,13],[9,12],
      [7, 11], [3, 12], [2, 1]];
    const innerDart = [
        [0, 0],
        [-6, -8],
        [10, 0],
        [-6,8],
//        [5, 0],
      ];
      const innerDart1 = [
        [7, 0],
        [9, -2],
        [5, 0],
        [9, 2],
//        [9, 0],
      ];

    let x0 = 0;
    const shiftAndRotateJson = [
      [-0.704754, 0.709452, 0, 2],
      [-0.709452, -0.704754, 0, 4],
      [0, 0, 1, 0],
    ];
    for (const isMask of [true, false]){
      const jsonTriangle = [{ shape: { points: outer } }, { shape: { points: triangle, mask: isMask } }];
      const jsonOutsideCircle = [{ shape: { points: innerCircle, mask: isMask}}];
      const jsonCircle = [{ shape: { points: outer } }, { shape: { points: innerCircle, mask: isMask}}];
      const jsonC = [{ shape: { points: outer } }, { shape: { points: innerNonConvex, mask: isMask}}];
      const jsonD = [{ shape: { points: outer } }, { shape: { points: innerU, mask: isMask}}];
      const jsonDart = [{ shape: { points: outer } }, { shape: { points: innerDart, mask: isMask}}];
      const jsonDart1 = [{ shape: { points: outer } }, { shape: { points: innerDart1, mask: isMask}}];
      const jsonTwoInlets = [{ shape: { points: outer } }, { shape: { points: twoInletsWithWhisker, mask: isMask}}];
      const jsonTwoInletsReversed = [{ shape: { points: outer } }, { shape: { points: twoInletsWithWhisker.slice().reverse(), mask: isMask } }];
      const jsonDart1Trans = [{ shape: { points: outer } }, { shape: { points: innerDart, mask: isMask, trans: shiftAndRotateJson } }];
      const jsonTriangleTrans =  [{ shape: { points: outer } }, { shape: { points: triangle, mask: isMask, trans: shiftAndRotateJson } }];
      // const polygonToClip = Sample.createArcStrokes(3, Point3d.create(5, 5), 6.0, Angle.createDegrees(0), Angle.createDegrees(360));
      const polygonToClip = Sample.createRectangleXY(-10, -10, 30, 30);
      const y0 = 0;
      for (const json of [jsonOutsideCircle, jsonCircle, jsonTriangle, jsonTriangleTrans, jsonDart1Trans, jsonTwoInlets, jsonTwoInletsReversed, jsonDart, jsonDart1, jsonDart, jsonTriangle, jsonC, jsonCircle, jsonD, jsonDart]) {
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, GrowableXYZArray.create (outer), x0, y0);
        const primitive = ClipPrimitive.fromJSON(json[json.length - 1]);
        const clipVector = ClipVector.fromJSON(json);
        if (primitive) {
          exerciseClipPrimitive(ck, allGeometry, primitive, polygonToClip, isMask, x0, y0);
          if (ck.testType(clipVector, ClipVector)) {
            const y1 = y0 + 200;
            exerciseClipVector(ck, allGeometry, clipVector, polygonToClip, 0, x0, y1);
          }
        }
        x0 += 200.0;
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipVector", "OuterAndMask");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ClipperInterfaces", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const a = 10;
    const b = 1.5;
    ck.testLT(2 * b, a, "Confirm diamonds will fit well within outer rectangle -- needed for test conditions.");
    const outerPoints = Sample.createCenteredRectangleXY(0, 0, 2 * a, a);
    const outerRange = Range3d.createArray(outerPoints);
    const leftHolePoints = Sample.createArcStrokes(1, Point3d.create(-a, 0, 0), 2 * b,
      Angle.createDegrees(0), Angle.createDegrees(360), true, 0);
    const rightHolePoints = Sample.createArcStrokes(1, Point3d.create(a, 0, 0), b,
      Angle.createDegrees(0), Angle.createDegrees(360), true, 0);
    const leftRange = Range3d.createArray(leftHolePoints);
    const rightRange = Range3d.createArray(rightHolePoints);
    const outerPrimitive = ClipShape.createShape(outerPoints, undefined, undefined, undefined, false)!;
    const leftHolePrimitive = ClipShape.createShape (leftHolePoints,undefined, undefined, undefined, true)!;
    const rightHolePrimitive = ClipShape.createShape(rightHolePoints, undefined, undefined, undefined, true)!;
    const clipVector = ClipVector.createCapture([outerPrimitive, leftHolePrimitive, rightHolePrimitive]);
    const x0 = 0;
    const y0 = 0;

    const e0 = 0.1;
    const e1 = 1.2;
    const inPoints = [Point3d.create(0, 0), leftRange.fractionToPoint (e0, e0, 0), rightRange.fractionToPoint (e1,e1, 0)];
    const outPoints = [
      Point3d.create(-a, 0),
      Point3d.create(a, 0),
      outerRange.fractionToPoint (e0, e1)];
    GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 2, inPoints, 0.4, x0, y0);
    GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 0, outPoints, 0.4, x0, y0);
    for (const point of inPoints)
      ck.testTrue(clipVector.isPointOnOrInside(point), prettyPrint({expectIn: point}));
    for (const point of outPoints)
      ck.testFalse(clipVector.isPointOnOrInside(point), prettyPrint({ expectOut: point }));
    const drawTheBoundaries = (x0A: number, y0A: number) => {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, outerPoints, x0A, y0A);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, leftHolePoints, x0A, y0A);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, rightHolePoints, x0A, y0A);
    };
    const y1 = y0 + 3 * a;
    const y2 = y1 + 5 * a;
    drawTheBoundaries(x0, y0);
    drawTheBoundaries(x0, y1);
    drawTheBoundaries(x0, y2);

    for (const testCase of [
      { range: outerRange, isHole: false },
      { range: leftRange, isHole: true },
      { range: rightRange, isHole: true }]) {
      // do some clips for display ...
      const fractionYA = 0.5;
      const fractionYC = 1.4;
      const pointA = testCase.range.fractionToPoint(0.5, fractionYA);
      const pointB = testCase.range.fractionToPoint(0.55, 0.6);
      const fractionInRange = (1.0 - fractionYA) / (fractionYC - fractionYA);
      const pointC = testCase.range.fractionToPoint(0.5, fractionYC);    // One half of this is in the range
      const lengthAC = pointA.distance(pointC);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, [pointA, pointB, pointC, pointA], x0, y1);
      ClipUtilities.announcePolylineClip(clipVector, [pointA, pointB, pointC, pointA],
        (clippedPoint0: Point3d, clippedPoint1: Point3d) => {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [clippedPoint0, clippedPoint1], x0, y2);
        });
      // Test some clipped lengths ..
      // We know the holes are symmetric in their ranges and deeply buried, strokes from center have predictable clip lengths ..
      const clippedLength = ClipUtilities.sumPolylineClipLength(clipVector, [pointA, pointC]);
      const expectedClipFraction = testCase.isHole ? 1.0 - fractionInRange : fractionInRange;
      ck.testCoordinate(clippedLength, expectedClipFraction * lengthAC, "Length of clippedStroke");
      }
/*
    // Apply clip to rectangles with clear relationship to the holes at   x+=a:
    const h = 1.5 * a;
    const w = 2 * b;
    const pointsQ0 = Sample.createCenteredRectangleXY(0, 0, w, h, 0);
    const pointsQLeft = Sample.createCenteredRectangleXY(-a, 0, w, h, 0);
    const pointsQRight = Sample.createCenteredRectangleXY(a, 0, w, h, 0);
    for (const testCase of [
      { points: pointsQ0, excludedArea: 0 },
      { points: pointsQLeft, excludedArea: PolygonOps.areaXY (leftHolePoints) },
      { points: pointsQRight, excludedArea: PolygonOps.areaXY (rightHolePoints) }]) {
    }
  */
    GeometryCoreTestIO.saveGeometry(allGeometry, "ClipVector", "ClipperInterfaces");
    expect(ck.getNumErrors()).equals(0);
  });
});

function exerciseClipVector(ck: Checker, allGeometry: GeometryQuery[], cv: ClipVector, polygonToClip: Point3d[], testDensity: number, x0: number, y0: number) {
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polygonToClip, x0, y0);
  const range = Range3d.createArray(polygonToClip);
  // const a = 2 * range.yLength();
  const b = range.xLength() / (4 * testDensity);
  const loops: Point3d[][] = [];

  if (ck.testType(cv, ClipVector, "parsed clip vector")) {
    cv. extractBoundaryLoops(loops);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, loops, x0, y0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polygonToClip, x0, y0);
    for (let ii = 1; ii < testDensity; ii++){
      for (let jj = 1; jj < testDensity; jj++){
        const xyz = range.fractionToPoint(ii / testDensity, jj / testDensity, 0);
        const inside = cv.pointInside(xyz);
        GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, inside ? -3 : 0, xyz, b, x0, y0);
      }
}
  }
}
export function exerciseClipPrimitive(ck: Checker, allGeometry: GeometryQuery[], primitive: ClipPrimitive, polygonToClip: Point3d[],
  expectContainment: boolean, // true if caller expects that the primitive shape is contained in the polygonToClip
  x0: number, y0: number) {
    const range2 = Range3d.createArray(polygonToClip);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polygonToClip, x0, y0);
  if (primitive instanceof ClipShape) {
    if (primitive.transformIsValid){
      const transformedPolygon = primitive.transformFromClip!.multiplyPoint3dArray(primitive.polygon);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, transformedPolygon, x0, y0);
    } else {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, primitive.polygon, x0, y0);
    }
  }
  const range = Range3d.createArray(polygonToClip);
  const a = 2 * range.yLength();
  y0 += a;
  const planeSets = primitive.fetchClipPlanesRef();
  // eslint-disable-next-line no-console
  // console.log(planeSets?.toJSON());
  const workArray = new GrowableXYZArray();
  if (planeSets) {
    const convexSets = planeSets.convexSets;
    let area0 = 0.0;
    for (let i = 0; i < convexSets.length; i++) {
      const convexSet = planeSets.convexSets[i];
      // const clips: GrowableXYZArray[] = [];
      const xyz = GrowableXYZArray.create(polygonToClip);
      convexSet.clipConvexPolygonInPlace(xyz, workArray);
      // convexSet.polygonClip(polygonToClip, clips);
      xyz.forceClosure();
      area0 += PolygonOps.areaXY(xyz);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, xyz, x0, y0);
      }
      if (primitive instanceof ClipShape && expectContainment){
        const range1 = Range3d.createArray(primitive.polygon);
        if (range1.containsRange(range2)) {
          const area1 = PolygonOps.areaXY(primitive.polygon);
          const area2 = PolygonOps.areaXY(polygonToClip);
          if (primitive.isMask)
            ck.testCoordinate(area0, area2 - area1, "Expect mask to remove clip shape from containing polygon");
          else
            ck.testCoordinate(area0, area1, "Expect clipper to excise clip shape from containing polygon");
        }
      }
    const compositeClip: GrowableXYZArray[] = [];
    primitive.fetchClipPlanesRef()?.polygonClip(polygonToClip, compositeClip);
    for (const c of compositeClip) {
      c.forceClosure();
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, Loop.create (LineString3d.create (c)), x0, y0 + 2 * range2.yLength());
    }
  }
}
