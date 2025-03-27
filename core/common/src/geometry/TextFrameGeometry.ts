/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AngleSweep, AnyCurvePrimitive, Arc3d, LineString3d, Point3d, Range2d, Range2dProps, Transform, TransformProps } from "@itwin/core-geometry";

// I don't love where this is.

export namespace FrameGeometry {
  // Rectangle
  export const computeRectangle = (rangeProps: Range2dProps, transformProps: TransformProps): AnyCurvePrimitive[] => {
    const range = Range2d.fromJSON(rangeProps);
    const points = range.corners3d(true);
    const frame = LineString3d.createPoints(points);

    const transform = Transform.fromJSON(transformProps);
    return [frame.cloneTransformed(transform)];
  }

  // RoundedRectangle
  export const computeRoundedRectangle = (rangeProps: Range2dProps, transformProps: TransformProps, radiusFactor: number = 0.5): AnyCurvePrimitive[] => {
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
      LineString3d.create([Point3d.create(inLeft, exBottom), Point3d.create(inRight, exBottom)]), // bottom
      LineString3d.create([Point3d.create(exLeft, inBottom), Point3d.create(exLeft, inTop)]), // left
      LineString3d.create([Point3d.create(exRight, inBottom), Point3d.create(exRight, inTop)]), // right
      Arc3d.createXY(Point3d.create(inRight, inTop), radius, q1), // top right
      Arc3d.createXY(Point3d.create(inLeft, inTop), radius, q2), // top left
      Arc3d.createXY(Point3d.create(inLeft, inBottom), radius, q3), // bottom left
      Arc3d.createXY(Point3d.create(inRight, inBottom), radius, q4), // bottom right
    ];

    const transform = Transform.fromJSON(transformProps);
    return curves.map((curve) => curve.cloneTransformed(transform));
  }


  // Circle
  export const computeCircle = (rangeProps: Range2dProps, transformProps: TransformProps): AnyCurvePrimitive[] => {
    const range = Range2d.fromJSON(rangeProps);
    const radius = range.low.distance(range.high) / 2;
    const frame = Arc3d.createXY(Point3d.createFrom(range.center), radius);
    const transform = Transform.fromJSON(transformProps);
    return [frame.cloneTransformed(transform)];
  }

  // Equilateral Triangle

  // Diamond

  // Square
  export const computeSquare = (rangeProps: Range2dProps, transformProps: TransformProps): AnyCurvePrimitive[] => {
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
    return [frame.cloneTransformed(transform)];
  }

  // Pentagon

  // Hexagon

  // Capsule
  export const computeCapsule = (rangeProps: Range2dProps, transformProps: TransformProps): AnyCurvePrimitive[] => {
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
      LineString3d.create([Point3d.create(inLeft, exBottom), Point3d.create(inRight, exBottom)]), // bottom
      Arc3d.createXY(Point3d.create(inLeft, range.center.y), radius, leftHalfCircle), // top right
      Arc3d.createXY(Point3d.create(inRight, range.center.y), radius, rightHalfCircle), // top right
    ];

    const transform = Transform.fromJSON(transformProps);
    return curves.map((curve) => curve.cloneTransformed(transform));
  }
}