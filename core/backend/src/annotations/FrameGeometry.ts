/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */


import { Id64 } from "@itwin/core-bentley";
import { BackgroundFill, ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotationFrameShape, TextFrameStyleProps } from "@itwin/core-common";
import { Angle, AngleSweep, Arc3d, LineString3d, Loop, Point3d, Range2d, Transform, Vector2d, XYAndZ } from "@itwin/core-geometry";

export namespace FrameGeometry {
  export const appendFrameToBuilder = (builder: ElementGeometry.Builder, frame: TextFrameStyleProps, range: Range2d, transform: Transform): boolean => {

    // TODO: I need to clean this up. The geom param changes are straddled between this stroker and ElementGeometry.Builder.
    const params = new GeometryParams(Id64.invalid);
    params.elmPriority = 0;

    if (frame.fill === undefined) {
      params.fillDisplay = FillDisplay.Never;
    } else if (frame.fill === "background") {
      params.backgroundFill = BackgroundFill.Outline;
      params.fillDisplay = FillDisplay.Always;
    } else if (frame.fill !== "subcategory") {
      params.fillColor = ColorDef.fromJSON(frame.fill);
      params.lineColor = params.fillColor;
      params.fillDisplay = FillDisplay.Always;
    }

    if (frame.border !== "subcategory") {
      params.lineColor = ColorDef.fromJSON(frame.border);
      params.weight = frame.borderWeight;
    }

    const frameGeometry = computeFrame(frame.shape, range, transform);
    return builder.appendGeometryParamsChange(params) && builder.appendGeometryQuery(frameGeometry);
  }

  export const computeFrame = (frame: TextAnnotationFrameShape, range: Range2d, transform: Transform): Loop => {
    const defaultLoop = Loop.create();
    switch (frame) {
      case "line": return defaultLoop;
      case "rectangle": return FrameGeometry.computeRectangle(range, transform);
      case "circle": return FrameGeometry.computeCircle(range, transform);
      case "equilateralTriangle": return FrameGeometry.computeTriangle(range, transform);
      case "diamond": return FrameGeometry.computeDiamond(range, transform);
      case "square": return FrameGeometry.computeSquare(range, transform);
      case "pentagon": return FrameGeometry.computePolygon(5, range, transform, 90);
      case "hexagon": return FrameGeometry.computePolygon(6, range, transform);
      case "octagon": return FrameGeometry.computePolygon(8, range, transform, 180 / 8); // or pi/8 in radians
      case "capsule": return FrameGeometry.computeCapsule(range, transform);
      case "roundedRectangle": return FrameGeometry.computeRoundedRectangle(range, transform);
      default: return defaultLoop;
    }
  }

  // Options: vertices, midpoints, closest point, circle: pi/4 intervals; which side are we connecting to?
  // terminator point; possibly elbow length or no elbow length

  export interface ComputeLeaderStartPointOptions {
    terminatorPoint: XYAndZ;
    elbowLength?: number;
    /** interval = 1, just vertices, interval > 1, number of times to break up each edge */
    lineIntervals?: number;
    arcIntervals?: number;
  }

  export const computeIntervalPoints = (frame: TextAnnotationFrameShape, range: Range2d, transform: Transform, lineInterval: number = 0.5, arcInterval: number = 0.25): Point3d[] | undefined => {
    const points: Point3d[] = [];
    const curves = FrameGeometry.computeFrame(frame, range, transform).collectCurvePrimitives(undefined, false, true);

    curves.forEach((curve) => {
      const end = curve instanceof Arc3d ? arcInterval : lineInterval;
      for (let interval = 0; interval <= 1; interval += end) {
        points.push(curve.fractionToPoint(interval));
      }
    });
    return points;
  }
  /** Returns the closest point on the text frame where a leader can attach to */
  export const computeLeaderStartPoint = (frame: TextAnnotationFrameShape, range: Range2d, transform: Transform, terminatorPoint: XYAndZ, options: ComputeLeaderStartPointOptions): Point3d | undefined => {
    if (options.lineIntervals === undefined || options.arcIntervals === undefined) {
      const curve = FrameGeometry.computeFrame(frame, range, transform);
      return curve.closestPoint(Point3d.createFrom(terminatorPoint))?.point;
    }

    const intervalPoints = FrameGeometry.computeIntervalPoints(frame, range, transform, options.lineIntervals, options.arcIntervals);
    const terminatorPoint3d = Point3d.createFrom(terminatorPoint);

    const closestPoint = intervalPoints?.reduce((point: Point3d | undefined, intervalPoint: Point3d) => {
      if (point && terminatorPoint3d.distance(intervalPoint) < terminatorPoint3d.distance(point))
        return intervalPoint;
      return point;
    }, undefined);

    return closestPoint;
  }

  // TODO: I'm not sure if we need these to be exported or not.
  // Rectangle
  export const computeRectangle = (range: Range2d, transform: Transform): Loop => {
    const points = range.corners3d(true);
    const frame = LineString3d.createPoints(points);

    return Loop.create(frame.cloneTransformed(transform));
  }

  // RoundedRectangle
  export const computeRoundedRectangle = (range: Range2d, transform: Transform, radiusFactor: number = 0.25): Loop => {
    const radius = range.yLength() * radiusFactor * Math.sqrt(2);
    // We're going to circumscribe the range with our rounded edges. The corners of the range will fall on 45 degree angles.
    const radiusOffsetFactor = range.yLength() * radiusFactor;

    // These values are the origins of the circles
    const inLeft = range.low.x + radiusOffsetFactor;
    const inRight = range.high.x - radiusOffsetFactor;
    const inBottom = range.low.y + radiusOffsetFactor;
    const inTop = range.high.y - radiusOffsetFactor

    // These values exist on the circles
    const exLeft = inLeft - radius;
    const exRight = inRight + radius;
    const exBottom = inBottom - radius;
    const exTop = inTop + radius;

    const q1 = AngleSweep.createStartEndDegrees(0, 90);
    const q2 = AngleSweep.createStartEndDegrees(90, 180);
    const q3 = AngleSweep.createStartEndDegrees(180, 270);
    const q4 = AngleSweep.createStartEndDegrees(270, 360);


    const curves = [
      LineString3d.create([Point3d.create(inLeft, exTop), Point3d.create(inRight, exTop)]), // top
      Arc3d.createXY(Point3d.create(inLeft, inTop), radius, q2), // top left
      LineString3d.create([Point3d.create(exLeft, inBottom), Point3d.create(exLeft, inTop)]), // left
      Arc3d.createXY(Point3d.create(inLeft, inBottom), radius, q3), // bottom left
      LineString3d.create([Point3d.create(inLeft, exBottom), Point3d.create(inRight, exBottom)]), // bottom
      Arc3d.createXY(Point3d.create(inRight, inBottom), radius, q4), // bottom right
      LineString3d.create([Point3d.create(exRight, inBottom), Point3d.create(exRight, inTop)]), // right
      Arc3d.createXY(Point3d.create(inRight, inTop), radius, q1), // top right
    ];

    return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)))
  }


  // Circle
  export const computeCircle = (range: Range2d, transform: Transform): Loop => {
    const radius = range.low.distance(range.high) / 2;
    const frame = Arc3d.createXY(Point3d.createFrom(range.center), radius);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // Equilateral Triangle
  export const computeTriangle = (range: Range2d, transform: Transform): Loop => {

    const xLength = range.xLength();
    const yLength = range.yLength();
    const center = range.center;
    const points: Point3d[] = [];

    const magnitude = (xLength > yLength) ? (xLength * Math.sqrt(3) + yLength) / 2 : (yLength * Math.sqrt(3) + xLength) / 2;

    const v1 = Vector2d.create(0, magnitude);
    const vectors = [
      v1, // top
      v1.rotateXY(Angle.createDegrees(120)), // left
      v1.rotateXY(Angle.createDegrees(240)), // right
      v1 // top
    ];

    vectors.forEach((v) => {
      points.push(Point3d.create(center.x + v.x, center.y + v.y));
    });

    const frame = LineString3d.createPoints(points);

    return Loop.create(frame.cloneTransformed(transform));
  }

  // Diamond
  export const computeDiamond = (range: Range2d, transform: Transform): Loop => {
    const offset = (range.xLength() + range.yLength()) / 2;
    const center = range.center;

    const points = [
      Point3d.createFrom({ x: center.x, y: center.y + offset }), // top
      Point3d.createFrom({ x: center.x + offset, y: center.y }), // right
      Point3d.createFrom({ x: center.x, y: center.y - offset }), // bottom
      Point3d.createFrom({ x: center.x - offset, y: center.y }), // left
      Point3d.createFrom({ x: center.x, y: center.y + offset }), // top
    ];

    const frame = LineString3d.createPoints(points);

    return Loop.create(frame.cloneTransformed(transform));
  }

  // Square
  export const computeSquare = (range: Range2d, transform: Transform): Loop => {

    // Extend range
    const xLength = range.xLength() / 2;
    const yLength = range.yLength() / 2;
    const center = range.center;
    if (xLength > yLength) {
      range.extendPoint({ x: center.x, y: center.y + xLength });
      range.extendPoint({ x: center.x, y: center.y - xLength });
    } else {
      range.extendPoint({ x: center.x + yLength, y: center.y });
      range.extendPoint({ x: center.x - yLength, y: center.y });
    }

    const points = range.corners3d(true);
    const frame = LineString3d.createPoints(points);

    return Loop.create(frame.cloneTransformed(transform));
  }

  // Capsule
  export const computeCapsule = (range: Range2d, transform: Transform): Loop => {
    const height = range.yLength();
    const radius = height * (Math.sqrt(2) / 2);

    // We're going to circumscribe the range with our rounded edges. The corners of the range will fall on 45 degree angles.
    const radiusOffsetFactor = height / 2;

    // These values are the origins of the circles
    const inLeft = range.low.x + radiusOffsetFactor;
    const inRight = range.high.x - radiusOffsetFactor;
    const inBottom = range.low.y + radiusOffsetFactor;
    const inTop = range.high.y - radiusOffsetFactor

    // These values exist on the circles
    const exBottom = inBottom - radius;
    const exTop = inTop + radius;

    const leftHalfCircle = AngleSweep.createStartEndDegrees(90, 270);
    const rightHalfCircle = AngleSweep.createStartEndDegrees(-90, 90);

    const curves = [
      LineString3d.create([Point3d.create(inLeft, exTop), Point3d.create(inRight, exTop)]), // top
      Arc3d.createXY(Point3d.create(inLeft, range.center.y), radius, leftHalfCircle), // left
      LineString3d.create([Point3d.create(inLeft, exBottom), Point3d.create(inRight, exBottom)]), // bottom
      Arc3d.createXY(Point3d.create(inRight, range.center.y), radius, rightHalfCircle), // right
    ];

    return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)))
  }

  // Polygon with n sides
  export const computePolygon = (n: number, range: Range2d, transform: Transform, angleOffset: number = 0): Loop => {
    // These are math terms: cspell:ignore inradius circumradius
    if (n < 3) throw new Error("A polygon must have at least 3 sides.");

    // We're assuming the polygon is a regular polygon with `n` sides.
    // The center of the polygon is the center of the range.
    const center = range.center;
    // The inradius is the distance from the center to the midpoint of each side of the polygon. On our range, this coincides with the distance from the center to one of its corners.
    const inradius = range.low.distance(range.high) / 2;
    // The circumradius is the distance from the center to each vertex of the polygon.
    const circumradius = inradius / Math.cos(Math.PI / n);

    // The exterior angles add up to 360 degrees.
    const angleIncrement = 360 / n;
    const vertices: Point3d[] = [];

    // Add a point for each vertex
    for (let i = 0; i < n; i++) {
      const angle = Angle.createDegrees(i * angleIncrement + angleOffset);
      const vector = Vector2d.createPolar(circumradius, angle);
      vertices.push(Point3d.create(center.x + vector.x, center.y + vector.y));
    }

    // Close the polygon
    vertices.push(vertices[0]);

    // Finally compute the loop!
    const frame = LineString3d.createPoints(vertices);
    return Loop.create(frame.cloneTransformed(transform));
  };
}