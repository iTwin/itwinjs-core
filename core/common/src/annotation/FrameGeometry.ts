/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Angle, AngleSweep, Arc3d, CurveCurve, CurvePrimitive, LineSegment3d, LineString3d, Loop, Point3d, Range2d, Range2dProps, Transform, TransformProps, Vector2d, Vector3d, XYAndZ, XYZProps } from "@itwin/core-geometry";
import { TextAnnotationFrame, TextAnnotationLeaderProps } from "./TextAnnotation";
import { TextBlockLayoutResult } from "./TextBlockLayoutResult";

// I don't love where this is.

export namespace FrameGeometry {
  export const computeFrame = (frame: TextAnnotationFrame, rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const defaultLoop = Loop.create();
    switch (frame) {
      case "none": return defaultLoop;
      case "line": return defaultLoop;
      case "rectangle": return FrameGeometry.computeRectangle(rangeProps, transformProps);
      case "circle": return FrameGeometry.computeCircle(rangeProps, transformProps);
      case "equilateralTriangle": return FrameGeometry.computeTriangle(rangeProps, transformProps);
      case "diamond": return FrameGeometry.computeDiamond(rangeProps, transformProps);
      case "square": return FrameGeometry.computeSquare(rangeProps, transformProps);
      case "pentagon": return defaultLoop;
      case "hexagon": return defaultLoop;
      case "capsule": return FrameGeometry.computeCapsule(rangeProps, transformProps);
      case "roundedRectangle": return FrameGeometry.computeRoundedRectangle(rangeProps, transformProps);
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
    index?: number;
  }

  export const computeIntervalPoints = (frame: TextAnnotationFrame, rangeProps: Range2dProps, transformProps: TransformProps, lineInterval: number = 0.5, arcInterval: number = 0.25): Point3d[] | undefined => {
    const points: Point3d[] = [];
    const curves = FrameGeometry.computeFrame(frame, rangeProps, transformProps).collectCurvePrimitives(undefined, false, true);

    curves.forEach((curve) => {
      const end = curve instanceof Arc3d ? arcInterval : lineInterval;
      for (let interval = 0; interval <= 1; interval += end) {
        points.push(curve.fractionToPoint(interval));
      }
    });
    return points;
  }
  /** Returns the closest point on the text frame where a leader can attach to */
  export const computeLeaderStartPoint = (frame: TextAnnotationFrame, textLayout: TextBlockLayoutResult, transformProps: TransformProps, leaderProps: TextAnnotationLeaderProps): { endPoint?: Point3d, elbowDirection?: Vector3d } | undefined => {
    let closestPoint: Point3d | undefined;
    let curve: Loop;
    if (leaderProps.attachmentMode.mode === "Nearest") {
      curve = FrameGeometry.computeFrame(frame, textLayout.range, transformProps);
      closestPoint = curve.closestPoint(Point3d.fromJSON(leaderProps.startPoint))?.point;
    } else if (leaderProps.attachmentMode.mode === "KeyPoint") {
      curve = FrameGeometry.computeFrame(frame, textLayout.range, transformProps)
      const curves = curve.collectCurvePrimitives(undefined, false, true);
      const curveIndex = leaderProps.attachmentMode.curveIndex;
      const fraction = leaderProps.attachmentMode.fraction;
      if (curveIndex >= curves.length) {
        closestPoint = curves[curves.length - 1].fractionToPoint(fraction);
      } else {
        closestPoint = curves[curveIndex].fractionToPoint(fraction);
      }

    } else {
      const transform = Transform.fromJSON(transformProps);
      let lineRange = Range2d.createNull();
      let lineOffset: XYZProps;
      let scaleDirection = transform.matrix.getColumn(0).negate();
      if (leaderProps.attachmentMode.position.includes("Top")) {
        lineRange = Range2d.fromJSON(textLayout.lines[0].range);
        lineOffset = textLayout.lines[0].offsetFromDocument;
      } else {
        lineRange = Range2d.fromJSON(textLayout.lines[textLayout.lines.length - 1].range);
        lineOffset = textLayout.lines[textLayout.lines.length - 1].offsetFromDocument;
      }
      const origin = transform.multiplyPoint3d(Point3d.fromJSON(lineOffset));
      let attachmentPoint = origin.plusScaled(transform.matrix.getColumn(1), ((lineRange.yLength()) / 2));

      if (leaderProps.attachmentMode.position.includes("Right")) {
        attachmentPoint = attachmentPoint.plusScaled(transform.matrix.getColumn(0), lineRange.xLength());
        scaleDirection = scaleDirection.negate();
      }

      // Extend the direction vector to create a target point far along the direction
      const targetPoint = attachmentPoint.plusScaled(scaleDirection, 1e6); // Scale the direction vector to a large value
      const lineSegment = LineSegment3d.create(attachmentPoint, targetPoint);

      curve = FrameGeometry.computeFrame(frame, textLayout.range, transformProps);
      const closestPointDetail = CurveCurve.intersectionXYZPairs(lineSegment, false, curve, false);
      closestPoint = closestPointDetail[0]?.detailA.point;
    }
    let elbowDirection: Vector3d | undefined;
    if (closestPoint && leaderProps.styleOverrides?.wantElbow) {
      // Determine the direction based on the closest point's position relative to the frame
      const isCloserToLeft = Math.abs(closestPoint.x - curve.range().low.x) < Math.abs(closestPoint.x - curve.range().high.x);

      // Decide the direction: left (-X) or right (+X)
      elbowDirection = isCloserToLeft ? Vector3d.unitX().negate() : Vector3d.unitX();

      const elbowPoint = closestPoint.plusScaled(elbowDirection, leaderProps.styleOverrides.elbowLength ?? 0);
      const elbowLine = LineSegment3d.create(closestPoint, elbowPoint);

      const primitives = curve.collectCurvePrimitives();

      // Find the closest curve primitive to the closest point
      let closestPrimitive: CurvePrimitive | undefined;
      let minDistance = Number.MAX_VALUE;

      for (const primitive of primitives) {
        const detail = primitive.closestPoint(closestPoint, false);
        if (detail) {
          const distance = detail.point.distance(closestPoint);
          if (distance < minDistance) {
            minDistance = distance;
            closestPrimitive = primitive;
          }
        }
      }
      const closestPointDetail = closestPrimitive?.closestPoint(closestPoint, false);

      const fraction = closestPointDetail?.fraction;

      // Get the tangent vector of the curve at the closest point
      const derivative = closestPrimitive?.fractionToPointAndDerivative(fraction!);

      const tangentVector = derivative?.direction.normalize(); // Tangent vector at the closest point

      // Get the direction vector of the elbow line
      const elbowDirection1 = Vector3d.createStartEnd(elbowLine.point0Ref, elbowLine.point1Ref).normalize();
      // Check if the tangent vector and elbow direction vector are aligned
      const dotProduct = tangentVector?.dotProduct(elbowDirection1!);

      if (Math.abs(dotProduct!) > 0.999)
        elbowDirection = undefined;
    }


    return { endPoint: closestPoint, elbowDirection };
  }

  export const debugIntervals = (frame: TextAnnotationFrame, rangeProps: Range2dProps, transformProps: TransformProps, lineInterval: number = 0.25, arcInterval: number = 0.25): Arc3d[] | undefined => {
    const points = FrameGeometry.computeIntervalPoints(frame, rangeProps, transformProps, lineInterval, arcInterval);
    const vector = Vector3d.create(0, 0, 1);
    const radius = Range2d.fromJSON(rangeProps).yLength() / 30;

    return points?.map(point => Arc3d.createCenterNormalRadius(point, vector, radius));
  }


  // Rectangle
  export const computeRectangle = (rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const range = Range2d.fromJSON(rangeProps);
    const points = range.corners3d(true);
    const frame = LineString3d.createPoints(points);

    const transform = Transform.fromJSON(transformProps);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // RoundedRectangle
  export const computeRoundedRectangle = (rangeProps: Range2dProps, transformProps: TransformProps, radiusFactor: number = 0.25): Loop => {
    const range = Range2d.fromJSON(rangeProps);
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

    const transform = Transform.fromJSON(transformProps);
    return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)))
  }


  // Circle
  export const computeCircle = (rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const range = Range2d.fromJSON(rangeProps);
    const radius = range.low.distance(range.high) / 2;
    const frame = Arc3d.createXY(Point3d.createFrom(range.center), radius);
    const transform = Transform.fromJSON(transformProps);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // Equilateral Triangle
  export const computeTriangle = (rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const range = Range2d.fromJSON(rangeProps);

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

    const transform = Transform.fromJSON(transformProps);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // Diamond
  export const computeDiamond = (rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const range = Range2d.fromJSON(rangeProps);
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

    const transform = Transform.fromJSON(transformProps);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // Square
  export const computeSquare = (rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const range = Range2d.fromJSON(rangeProps);

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

    const transform = Transform.fromJSON(transformProps);
    return Loop.create(frame.cloneTransformed(transform));
  }

  // Pentagon

  // Hexagon

  // Capsule
  export const computeCapsule = (rangeProps: Range2dProps, transformProps: TransformProps): Loop => {
    const range = Range2d.fromJSON(rangeProps);
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

    const transform = Transform.fromJSON(transformProps);
    return Loop.createArray(curves.map((curve) => curve.cloneTransformed(transform)))
  }
}