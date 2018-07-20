/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Checker } from "./Checker";
import { expect } from "chai";
import { ClipPrimitive, ClipShape, PlaneSetParamsCache, ClipMask } from "../clipping/ClipPrimitive";
import { ClipPlane, ConvexClipPlaneSet, ClipPlaneSet } from "../clipping/ClipPlane";
import { Point3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { Geometry } from "../Geometry";

/** Returns true if the range given does not contain any values extending to +/- infinity. */
function isFiniteRange(range: Range3d): boolean {
  if (range.low.x === -Number.MAX_VALUE)
    return false;
  if (range.low.y === -Number.MAX_VALUE)
    return false;
  if (range.low.z === -Number.MAX_VALUE)
    return false;
  if (range.high.x === Number.MAX_VALUE)
    return false;
  if (range.high.y === Number.MAX_VALUE)
    return false;
  if (range.high.z === Number.MAX_VALUE)
    return false;
  return true;
}

/**
 * For every ClipPlane in this ClipPrimitive, perform a function in the form (ClipPlane) => boolean. Will return true if all calls to
 * function return true, otherwise, returns false immediately.
 */
function applyFunctionToPlanes(clipPrimitive: ClipPrimitive, isMask: boolean, func: ((plane: ClipPlane) => boolean)): boolean {
  let set: ClipPlaneSet | undefined;
  if (isMask)
    set = clipPrimitive.fetchMaskPlanesRef();
  else
    set = clipPrimitive.fetchClipPlanesRef();
  if (set === undefined)
    return false;
  for (const convexSet of set.convexSets)
    for (const plane of convexSet.planes)
      if (!func(plane))
        return false;
  return true;
}

/** EXPENSIVE -- Returns true if two convex sets are equal. */
function convexSetsAreEqual(convexSet0: ConvexClipPlaneSet, convexSet1: ConvexClipPlaneSet): boolean {
  if (convexSet0.planes.length !== convexSet1.planes.length)
    return false;

  for (const plane0 of convexSet0.planes) {
    let foundMatch = false;
    for (const plane1 of convexSet1.planes) {
      if (plane0.isAlmostEqual(plane1)) {
        foundMatch = true;
        break;
      }
    }
    if (!foundMatch)
      return false;
  }
  return true;
}

function clipPlaneSetsAreEqual(set0: ClipPlaneSet, set1: ClipPlaneSet): boolean {
  if (set0.convexSets.length !== set1.convexSets.length)
    return false;

  for (const convexSet0 of set0.convexSets) {
    let foundMatch = false;
    for (const convexSet1 of set1.convexSets) {
      if (convexSetsAreEqual(convexSet0, convexSet1)) {
        foundMatch = true;
        break;
      }
    }
    if (!foundMatch)
      return false;
  }
  return true;
}

export function clipShapesAreEqual(clip0: ClipShape, clip1: ClipShape): boolean {
  if (!clipPlaneSetsAreEqual(clip0.fetchClipPlanesRef(), clip1.fetchClipPlanesRef()))
    return false;
  if (clip0.fetchMaskPlanesRef() === undefined && clip1.fetchMaskPlanesRef() !== undefined)
    return false;
  if (clip0.fetchMaskPlanesRef() !== undefined && clip1.fetchMaskPlanesRef() === undefined)
    return false;
  if (clip0.fetchMaskPlanesRef() !== undefined && !clipPlaneSetsAreEqual(clip0.fetchMaskPlanesRef()!, clip1.fetchMaskPlanesRef()!))
    return false;
  if (clip0.invisible !== clip1.invisible)
    return false;
  for (let i = 0; i < clip0.polygon.length; i++)  // Polygon points should be in the same order
    if (!clip0.polygon[i].isAlmostEqual(clip1.polygon[i]))
      return false;
  if (clip0.isMask !== clip1.isMask)
    return false;
  if ((clip0.zLowValid !== clip1.zLowValid) || (clip0.zHighValid !== clip1.zHighValid) || (clip0.transformValid !== clip1.transformValid))
    return false;
  if ((clip0.zLow !== clip1.zLow) || (clip0.zHigh !== clip1.zHigh))
    return false;
  if (clip0.transformValid && (!clip0.transformFromClip!.isAlmostEqual(clip1.transformFromClip!) || !clip1.transformToClip!.isAlmostEqual(clip1.transformToClip!)))
    return false;
  if (clip0.bCurve === undefined && clip1.bCurve !== undefined)
    return false;
  if (clip0.bCurve !== undefined && clip1.bCurve === undefined)
    return false;
  if (clip0.bCurve !== undefined && !clip0.bCurve!.isAlmostEqual(clip1.bCurve!))
    return false;
  return true;
}

describe("ClipPrimitive", () => {
  const ck = new Checker();
  const min2D = Point3d.create(-54, 18);  // Bottom left point of the octogon formed from octogonalPoints
  const max2D = Point3d.create(-42, 42);  // Top right point of the octogon formed from octogonalPoints
  let octogonalPoints: Point3d[];         // Points array representing an octogon in quadrant II

  before(() => {
    octogonalPoints = [
      min2D,
      Point3d.create(max2D.x, min2D.y),
      Point3d.create(max2D.x + 5, min2D.y + 5),
      Point3d.create(max2D.x + 5, max2D.y - 5),
      max2D,
      Point3d.create(min2D.x, max2D.y),
      Point3d.create(min2D.x - 5, max2D.y - 5),
      Point3d.create(min2D.x - 5, min2D.y + 5),
    ];
  });

  it("GetRange", () => {
    const clipPrimitive = ClipShape.createEmpty();
    const clipPrimitiveRange = Range3d.createNull();
    const convexSet = ConvexClipPlaneSet.createEmpty();
    const convexSetRange = Range3d.createNull();
    const numIterations = 10;
    const scaleFactor = 6;
    for (let i = 0; i < numIterations; i++) {
      const p = i * scaleFactor;

      // Test with positive box
      ConvexClipPlaneSet.createXYBox(p, p, p + 1, p + 1, convexSet);
      convexSet.addZClipPlanes(false, p, p + 1);
      ClipShape.createBlock(Range3d.createXYZXYZ(p, p, p, p + 1, p + 1, p + 1), ClipMask.All, false, false, undefined, clipPrimitive);
      ck.testFalse(clipPrimitive.arePlanesDefined());
      clipPrimitive.fetchClipPlanesRef();
      ck.testTrue(clipPrimitive.arePlanesDefined());
      convexSet.getRangeOfAlignedPlanes(undefined, convexSetRange);
      ck.testTrue(convexSetRange !== undefined);
      clipPrimitive.getRange(false, undefined, clipPrimitiveRange);
      ck.testTrue(clipPrimitiveRange !== undefined);
      ck.testRange3d(convexSetRange, clipPrimitiveRange, "Expect range of convex set to be equal to range of ClipShape");

      ck.testTrue(clipPrimitive.isValidPolygon());

      // Test with negative box
      ConvexClipPlaneSet.createXYBox(-p - 1, -p - 1, -p, -p, convexSet);
      convexSet.addZClipPlanes(false, p, p + 1);
      clipPrimitive.setPolygon([Point3d.create(-p - 1, -p - 1), Point3d.create(-p - 1, -p), Point3d.create(-p, -p), Point3d.create(-p, -p - 1)]);
      convexSet.getRangeOfAlignedPlanes(undefined, convexSetRange);
      ck.testTrue(convexSetRange !== undefined);
      clipPrimitive.getRange(false, undefined, clipPrimitiveRange);
      ck.testTrue(clipPrimitiveRange !== undefined);
      ck.testRange3d(convexSetRange, clipPrimitiveRange, "Expect range of convex set to be equal to range of ClipShape");
    }

    // Exercise check for z-clips
    ck.testTrue(clipPrimitive.containsZClip(), "Expected clip primitive to contain a normal along the z-axis");
    ClipShape.createShape([Point3d.create(1, 2), Point3d.create(50, 50), Point3d.create(100, -1)], undefined, undefined, undefined, false, false, clipPrimitive);
    ck.testFalse(clipPrimitive.containsZClip(), "Expected clip primitive of box with open top and bottom to not contain z-clip");

    // Exercise invisibility switch
    clipPrimitive.setInvisible(true);
    const checkIsInvisible = (plane: ClipPlane): boolean => {
      if (plane.invisible)
        return true;
      return false;
    };
    ck.testTrue(applyFunctionToPlanes(clipPrimitive, false, checkIsInvisible), "All planes should be invisible after setInvisible() call.");

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });

  it("Transformations", () => {
    const originalPoint = Point3d.create(5.7865, 1.24123, 0.000009);
    const testPoint = originalPoint.clone();
    // Created with identity transform - should create no changes
    const clipShape = ClipShape.createEmpty(false, false, Transform.createIdentity());
    clipShape.performTransformFromClip(testPoint);
    ck.testPoint3d(originalPoint, testPoint, "Point should be unchanged when transformed with ClipShape containing identity transform");
    clipShape.performTransformToClip(testPoint);
    ck.testPoint3d(originalPoint, testPoint, "Point should be unchanged when transformed with ClipShape containing identity transform");

    // TODO: Provide checks for correct application of an actual transform into a new coordinate system

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });

  it("Plane edge additions using PlaneSetParamsCache", () => {
    const clipCache = new PlaneSetParamsCache(-5, 5);
    const values = [-87, -30, 0, 15.45, 1067];
    const sideLength = 10;
    // Creates several boxed regions using an AddPlaneSetParams object
    for (const i of values)
      ClipPrimitive.addOutsideEdgeSetToParams(i, i, i + sideLength, i, clipCache);   // This will take care of z clipping specified by low and high of params
    ck.testFalse(isFiniteRange(clipCache.clipPlaneSet.getRangeOfAlignedPlanes()!), "Unbounded planes in AddPlaneSetParams will have undefined range");
    let idx = 0;
    for (const convexSet of clipCache.clipPlaneSet.convexSets) {
      const xPlane = convexSet.planes[0];
      const yPlane = convexSet.planes[1];
      convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndPoint(xPlane.inwardNormalRef.negate(), Point3d.create(values[idx] + sideLength, values[idx] - sideLength, 0)));
      convexSet.addPlaneToConvexSet(ClipPlane.createNormalAndPoint(yPlane.inwardNormalRef.negate(), Point3d.create(values[idx] + sideLength, values[idx] - sideLength, 0)));
      idx++;
    }
    const expectedRange = Range3d.createXYZXYZ(values[0], values[0] - sideLength, clipCache.zLow, values[values.length - 1] + sideLength, values[values.length - 1], clipCache.zHigh);
    const range = clipCache.clipPlaneSet.getRangeOfAlignedPlanes();
    ck.testTrue(isFiniteRange(range!), "After closing unbounded planes in AddPlaneSetParams, expect range to form");
    ck.testRange3d(range!, expectedRange, "After closing unbounded planes in AddPlaneSetParams, expected range to match with the array extremities");

    // Loop through and check that each convex set correctly formed an enclosed box of expected size
    const expectedDiagonal = Math.sqrt(3 * (sideLength * sideLength));
    for (const convexSet of clipCache.clipPlaneSet.convexSets) {
      const setRange = convexSet.getRangeOfAlignedPlanes();
      ck.testTrue(setRange !== undefined, "Convex set representing box should have defined range");
      const diagonal = setRange!.diagonal().magnitude();
      ck.testTrue(Geometry.isAlmostEqualNumber(diagonal, expectedDiagonal), "Diagonals of convex set boxes should match expected value");
    }

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });

  it("Plane set additions using PlaneSetParamsCache", () => {
    const minZ = -10;
    const maxZ = 10;
    const clipCache = new PlaneSetParamsCache(minZ, maxZ);
    ClipPrimitive.addShapeToParams(octogonalPoints, [], clipCache);

    const midpoint = Point3d.create((min2D.x + max2D.x) / 2, (min2D.y + max2D.y) / 2, (minZ + maxZ) / 2);    // Is midpoint of polygon

    // check corners
    const planeSet = clipCache.clipPlaneSet;
    for (const point of octogonalPoints) {
      ck.testTrue(planeSet.isPointOnOrInside(point, Geometry.smallMetricDistanceSquared), "Corner point should be on plane");
      ck.testFalse(planeSet.isPointInside(point), "Corner points should not be inside of clipped region");
    }
    // check midpoint and 3 extremities (one from each axis)
    ck.testTrue(planeSet.isPointInside(midpoint), "Midpoint should be inside of clipped region");
    const testPoint = Point3d.create(midpoint.x, midpoint.y, midpoint.z + maxZ);
    ck.testTrue(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "Extremity should fall on object");
    testPoint.z += 0.0001;
    ck.testFalse(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "External point should be outside object");
    testPoint.set(min2D.x - 5, midpoint.y, 0);
    ck.testTrue(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "Extremity should fall on object");
    testPoint.x -= 0.0001;
    ck.testFalse(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "External point should be outside object");
    testPoint.set(midpoint.x, max2D.y, 0);
    ck.testTrue(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "Extremity should fall on object");
    testPoint.y += 0.0001;
    ck.testFalse(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "External point should be outside object");
    // Angled edge case
    testPoint.set((min2D.x + octogonalPoints[octogonalPoints.length - 1].x) / 2, (min2D.y + octogonalPoints[octogonalPoints.length - 1].y) / 2, 0);
    ck.testTrue(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "Midpoint of angled edge should fall on object");
    testPoint.x -= .0001;
    ck.testFalse(planeSet.isPointOnOrInside(testPoint, Geometry.smallMetricDistanceSquared), "External point should be outside object");

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClipShape creation (linear) and point classification", () => {
    // Create a ClipShape from a linear set of 3 points
    const clipShape = ClipShape.createShape([Point3d.create(-5, 0, 0), Point3d.create(5, 0, 0), Point3d.create(-5, 0, 0)],
      -3, 3, undefined, false, false)!;
    ck.testTrue(clipShape !== undefined, "Can create ClipShape that will be parsed into a linear set of planes");
    clipShape!.fetchClipPlanesRef();
    ck.testExactNumber(clipShape!.classifyPointContainment([Point3d.create(-5.00001, 0, 0)], true), 3, "Point does not fall on line outside of sides - strongly outside");
    ck.testExactNumber(clipShape!.classifyPointContainment([Point3d.create(0, 3, 0), Point3d.create(2, -5, 0)], true), 2, "Points cross line and within sides - ambiguous");
    ck.testExactNumber(clipShape!.classifyPointContainment([Point3d.create(0, -0.00001, 0), Point3d.create(0, 0.00001, 0)], true), 2, "Points cross line and within sides - ambiguous");
    ck.testExactNumber(clipShape!.classifyPointContainment([Point3d.create(4.999, 0, 2.999), Point3d.create(0, 0, 0)], true), 1, "Points fall on line and is within sides - strongly inside");

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClipShape creation (polygonal) and point proximity", () => {
    const minZ = -5;
    const maxZ = 5;
    // Test point location
    const clipPrimitive0 = ClipShape.createEmpty();
    ck.testFalse(clipPrimitive0.isXYPolygon(), "ClipShape does not contain polygon when no points are present");
    ck.testTrue(ClipShape.createShape(octogonalPoints, minZ, maxZ, undefined, true, true, clipPrimitive0) !== undefined);
    const midpoint = Point3d.create((min2D.x + max2D.x) / 2, (min2D.y + max2D.y) / 2, (minZ + maxZ) / 2);    // Is midpoint of polygon
    ck.testFalse(clipPrimitive0.pointInside(midpoint, 0), "Midpoint of polygon is not inside due to mask.");
    ck.testExactNumber(clipPrimitive0.classifyPointContainment([midpoint], false), 3, "Midpoint is completely outside when ClipShape is a mask");
    const clipPrimitive1 = ClipShape.createShape(octogonalPoints, minZ, maxZ, undefined, false, false);
    ck.testTrue(clipPrimitive1!.pointInside(midpoint, 0), "Midpoint of polygon is inside.");

    // Test createFrom method
    ClipShape.createFrom(clipPrimitive0, clipPrimitive1!);
    ck.testTrue(clipShapesAreEqual(clipPrimitive0, clipPrimitive1!), "createfrom() method should clone the ClipShape");

    // Test JSON parsing
    const jsonValue = clipPrimitive1!.toJSON();
    ck.testTrue(jsonValue.shape.points !== undefined && jsonValue.shape.points.length === clipPrimitive1!.polygon.length, "Points prop created in toJSON");
    ck.testTrue(jsonValue.shape.invisible !== undefined && jsonValue.shape.invisible === true, "Invisible prop created in toJSON");
    ck.testUndefined(jsonValue.shape.trans, "Transform is undefined prop in toJSON having not given one to original ClipShape");
    ck.testTrue(jsonValue.shape.mask !== undefined && jsonValue.shape.mask === true, "Mask prop created in toJSON");
    ck.testTrue(jsonValue.shape.zlow !== undefined && jsonValue.shape.zlow === clipPrimitive1!.zLow, "ZLow prop created in toJSON");
    ck.testTrue(jsonValue.shape.zhigh !== undefined && jsonValue.shape.zhigh === clipPrimitive1!.zHigh, "ZHigh prop is set in toJSON");

    const clipPrimitive1Copy = ClipShape.fromJSON(jsonValue);
    ck.testTrue(clipPrimitive1Copy !== undefined);
    ck.testTrue(clipShapesAreEqual(clipPrimitive1!, clipPrimitive1Copy!), "to and from JSON yields same ClipPrimitive");

    // Test clone method
    const clipPrimitive2 = clipPrimitive1Copy!.clone();
    ck.testTrue(clipShapesAreEqual(clipPrimitive2, clipPrimitive1!), "clone method produces a copy of ClipShape");

    ck.checkpoint();
    expect(ck.getNumErrors()).equals(0);
  });
});
