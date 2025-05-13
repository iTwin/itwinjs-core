/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */


import { Id64 } from "@itwin/core-bentley";
import { BackgroundFill, ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotationFrameShape, TextFrameStyleProps } from "@itwin/core-common";
import { Angle, AngleSweep, Arc3d, LineString3d, Loop, Point3d, Range2d, Transform, Vector2d } from "@itwin/core-geometry";

export namespace FrameGeometry {

  /**
   * Based on the frame style, this method will construct and append [[GeometryParams]] (for line style) and a [[Loop]] (for the frame shape) to the builder.
   * @param builder that will be appended to in place
   * @param frame
   * @param range to enclose with the frame
   * @param transform that transform the range to world coordinates
   * @returns `true` if any geometry was appended to the builder
   */
  export const appendFrameToBuilder = (builder: ElementGeometry.Builder, frame: TextFrameStyleProps, range: Range2d, transform: Transform): boolean => {
    if (frame.shape === "none") {
      return false;
    }

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

    const frameGeometry = computeFrame({ frame: frame.shape, range, transform });
    return builder.appendGeometryParamsChange(params) && builder.appendGeometryQuery(frameGeometry);
  }


  export interface ComputeFrameArgs {
    frame: Exclude<TextAnnotationFrameShape, "none">;
    range: Range2d;
    transform: Transform;
  }
  export const computeFrame = ({ frame, range, transform }: ComputeFrameArgs): Loop => {
    switch (frame) {
      // case "line": return computeLine;
      case "rectangle": return computeRectangle(range, transform);
      case "circle": return computeCircle(range, transform);
      case "equilateralTriangle": return computeTriangle(range, transform);
      case "diamond": return computeDiamond(range, transform);
      case "square": return computeSquare(range, transform);
      case "pentagon": return computePolygon(5, range, transform, 90);
      case "hexagon": return computePolygon(6, range, transform);
      case "octagon": return computePolygon(8, range, transform, 180 / 8); // or pi/8 in radians
      case "capsule": return computeCapsule(range, transform);
      case "roundedRectangle": return computeRoundedRectangle(range, transform);
      default: return computeRectangle(range, transform);
    }
  }

  export interface ComputeIntervalPointsArgs extends ComputeFrameArgs {
    /** A factor applied to divide each straight edge. A value of 1 will place a single point on each vertex. */
    lineIntervalFactor?: number;
    /** A factor applied to divide each straight edge. A value of 1 will place a single point on each vertex. */
    arcIntervalFactor?: number;
  }

  export const computeIntervalPoints = ({ frame, range, transform, lineIntervalFactor = 0.5, arcIntervalFactor = 0.25 }: ComputeIntervalPointsArgs): Point3d[] | undefined => {
    const points: Point3d[] = [];
    const curves = computeFrame({ frame, range, transform }).collectCurvePrimitives(undefined, false, true);

    curves.forEach((curve) => {
      const end = curve instanceof Arc3d ? arcIntervalFactor : lineIntervalFactor;
      for (let interval = 0; interval <= 1; interval += end) {
        points.push(curve.fractionToPoint(interval));
      }
    });
    return points;
  }

  // Rectangle
  const computeRectangle = (range: Range2d, transform: Transform): Loop => {
    const points = range.corners3d(true);
    const frame = LineString3d.createPoints(points);

    return Loop.create(frame.cloneTransformed(transform));
  }

  // RoundedRectangle
  const computeRoundedRectangle = (range: Range2d, transform: Transform, radiusFactor: number = 0.25): Loop => {
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
  const computeCircle = (range: Range2d, transform: Transform): Loop => {
    const radius = range.low.distance(range.high) / 2;
    const frame = Arc3d.createXY(Point3d.createFrom(range.center), radius);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // Equilateral Triangle
  const computeTriangle = (range: Range2d, transform: Transform): Loop => {

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
  const computeDiamond = (range: Range2d, transform: Transform): Loop => {
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
  const computeSquare = (range: Range2d, transform: Transform): Loop => {

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

  // Capsule (or pill shape)
  const computeCapsule = (range: Range2d, transform: Transform): Loop => {
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

    return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)));
  }

  // Polygon with n sides: note, this a generic method that can be used to create any polygon, but the frame will not be as tightly encapsulating. 
  const computePolygon = (n: number, range: Range2d, transform: Transform, angleOffset: number = 0): Loop => {
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