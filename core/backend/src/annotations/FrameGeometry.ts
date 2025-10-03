/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */


import { BackgroundFill, ColorDef, ElementGeometry, FillDisplay, GeometryParams, TextAnnotationFrameShape, TextFrameStyleProps } from "@itwin/core-common";
import { Angle, AngleSweep, Arc3d, LineString3d, Loop, Path, Point3d, Range2d, Transform, Vector2d } from "@itwin/core-geometry";

/**
 * Based on the frame style, this method will construct and append [[GeometryParams]] (for line style) and a [[Loop]] (for the frame shape) to the builder.
 * @param builder that will be appended to in place
 * @param frame
 * @param range to enclose with the frame
 * @param transform that transforms the range to world coordinates
 * @returns `true` if any geometry was appended to the builder
* @beta
 */
export function appendFrameToBuilder(builder: ElementGeometry.Builder, frame: TextFrameStyleProps, range: Range2d, transform: Transform, geomParams: GeometryParams): boolean {
  if (frame.shape === "none" || frame.shape === undefined) {
    return false;
  }

  const params = geomParams.clone();

  if (frame.fillColor === "none" || frame.fillColor === undefined) {
    params.fillDisplay = FillDisplay.Never;
  } else if (frame.fillColor === "background") {
    params.backgroundFill = BackgroundFill.Solid;
    params.fillDisplay = FillDisplay.Blanking;
  } else if (frame.fillColor !== "subcategory") {
    params.fillColor = ColorDef.fromJSON(frame.fillColor);
    params.lineColor = params.fillColor;
    params.fillDisplay = FillDisplay.Blanking;
  }

  if (frame.borderColor !== "subcategory") {
    params.lineColor = ColorDef.fromJSON(frame.borderColor);
    params.weight = frame.borderWeight;
  }

  const frameGeometry = computeFrame({ frame: frame.shape, range, transform });
  if (!builder.appendGeometryParamsChange(params) || !builder.appendGeometryQuery(frameGeometry)) {
    return false;
  }

  // The tile generator does not produce an outline for shapes with blanking fill. We must add the outline separately.
  if (params.fillDisplay === FillDisplay.Blanking) {
    const outlineParams = params.clone();
    outlineParams.fillDisplay = FillDisplay.Never;
    if (!builder.appendGeometryParamsChange(outlineParams) || !builder.appendGeometryQuery(frameGeometry)) {
      return false;
    }
  }

  return true;
}

/**
 * Arguments for the [[computeFrame]] method.
 * @beta
 */
export interface ComputeFrameArgs {
  /** Frame shape to be calculated */
  frame: Exclude<TextAnnotationFrameShape, "none">;
  /** Range to be enclosed */
  range: Range2d;
  /** Transform that translates and rotates the range to world coordinates */
  transform: Transform;
}

/**
 * Computes the frame geometry based on the provided frame shape and range.
 * @returns a [Loop]($geometry) or [Path]($geometry) (if it's just a line) that represents the frame geometry
 * @beta
 */
export function computeFrame(args: ComputeFrameArgs): Loop | Path {
  switch (args.frame) {
    case "line": return computeLine(args.range, args.transform);
    case "rectangle": return computeRectangle(args.range, args.transform);
    case "circle": return computeCircle(args.range, args.transform);
    case "equilateralTriangle": return computeTriangle(args.range, args.transform);
    case "diamond": return computeDiamond(args.range, args.transform);
    case "square": return computeSquare(args.range, args.transform);
    case "pentagon": return computePolygon(5, args.range, args.transform, 90);
    case "hexagon": return computePolygon(6, args.range, args.transform);
    case "octagon": return computePolygon(8, args.range, args.transform, 180 / 8); // or pi/8 in radians
    case "capsule": return computeCapsule(args.range, args.transform);
    case "roundedRectangle": return computeRoundedRectangle(args.range, args.transform);
    default: return computeRectangle(args.range, args.transform);
  }
}

/**
 * Arguments for the [[computeIntervalPoints]] method.
 * @beta
 */
export interface ComputeIntervalPointsArgs extends ComputeFrameArgs {
  /** A factor applied to divide each straight edge. A value of 1 will place a single point on each vertex. */
  lineIntervalFactor?: number;
  /** A factor applied to divide each straight edge. A value of 1 will place a single point on each vertex. */
  arcIntervalFactor?: number;
}

/**
 * Computes points along the edges of the frame geometry based on the provided frame shape, range, and interval factors.
 * These can be used for snapping or attaching leaders.
 * @returns an array of [[Point3d]] that represent the points along the edges of the frame geometry. Returns `undefined` if the loop created by `computeFrame` is empty.
 * @beta
 */
export function computeIntervalPoints({ frame, range, transform, lineIntervalFactor = 0.5, arcIntervalFactor = 0.25 }: ComputeIntervalPointsArgs): Point3d[] | undefined {
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

/** Line - currently just adds an underline. Once we have leaders, this method may change. */
const computeLine = (range: Range2d, transform: Transform): Path => {
  const points = [Point3d.create(range.low.x, range.low.y), Point3d.create(range.high.x, range.low.y)];
  const frame = LineString3d.createPoints(points);

  return Path.create(frame.cloneTransformed(transform));
}

/** Rectangle - simplest frame */
const computeRectangle = (range: Range2d, transform: Transform): Loop => {
  const points = range.corners3d(true);
  const frame = LineString3d.createPoints(points);

  return Loop.create(frame.cloneTransformed(transform));
}

/** Rounded Rectangle: each corner will be turned into an arc with the radius of the arc being the @param radiusFactor * the height (yLength) of the range */
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
    LineString3d.create([Point3d.create(inRight, exTop), Point3d.create(inLeft, exTop)]),         // top
    Arc3d.createXY(Point3d.create(inLeft, inTop), radius, q2),                                    // top left
    LineString3d.create([Point3d.create(exLeft, inTop), Point3d.create(exLeft, inBottom)]),       // left
    Arc3d.createXY(Point3d.create(inLeft, inBottom), radius, q3),                                 // bottom left
    LineString3d.create([Point3d.create(inLeft, exBottom), Point3d.create(inRight, exBottom)]),   // bottom
    Arc3d.createXY(Point3d.create(inRight, inBottom), radius, q4),                                // bottom right
    LineString3d.create([Point3d.create(exRight, inBottom), Point3d.create(exRight, inTop)]),     // right
    Arc3d.createXY(Point3d.create(inRight, inTop), radius, q1),                                   // top right
  ];

  return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)))
}


/** Circle */
const computeCircle = (range: Range2d, transform: Transform): Loop => {
  const radius = range.low.distance(range.high) / 2;
  const frame = Arc3d.createXY(Point3d.createFrom(range.center), radius);
  return Loop.create(frame.cloneTransformed(transform));
}

/** Equilateral Triangle */
const computeTriangle = (range: Range2d, transform: Transform): Loop => {

  const xLength = range.xLength();
  const yLength = range.yLength();
  const center = range.center;
  const points: Point3d[] = [];

  const magnitude = (xLength > yLength) ? (xLength * Math.sqrt(3) + yLength) / 2 : (yLength * Math.sqrt(3) + xLength) / 2;

  const v1 = Vector2d.create(0, magnitude);
  const vectors = [
    v1,                                     // top
    v1.rotateXY(Angle.createDegrees(120)),  // left
    v1.rotateXY(Angle.createDegrees(240)),  // right
    v1                                      // top
  ];

  vectors.forEach((v) => {
    points.push(Point3d.create(center.x + v.x, center.y + v.y));
  });

  const frame = LineString3d.createPoints(points);

  return Loop.create(frame.cloneTransformed(transform));
}

/** Diamond (square rotated 45 degrees) */
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

/** Square */
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

/** Capsule (or pill shape) */
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
    LineString3d.create([Point3d.create(inRight, exTop), Point3d.create(inLeft, exTop)]),       // top
    Arc3d.createXY(Point3d.create(inLeft, range.center.y), radius, leftHalfCircle),             // left
    LineString3d.create([Point3d.create(inLeft, exBottom), Point3d.create(inRight, exBottom)]), // bottom
    Arc3d.createXY(Point3d.create(inRight, range.center.y), radius, rightHalfCircle),           // right
  ];

  return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)));
}

/** Regular polygon with n sides: note, this a generic method that can be used to create any polygon, but the frame will not be as tightly encapsulating. */
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