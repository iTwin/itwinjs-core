/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { BezierCurve3dH } from "../../../bspline/BezierCurve3dH";
import { Vector2d } from "../../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../../geometry3d/Point3dVector3d";
import { Point4d } from "../../../geometry4d/Point4d";
import { Arc3d } from "../../Arc3d";
import { CurvePrimitive } from "../../CurvePrimitive";
import { LineSegment3d } from "../../LineSegment3d";
import { ImplicitCurve2d } from "./ImplicitCurve2d";
import { UnboundedCircle2dByCenterAndRadius } from "./UnboundedCircle2d";
import { UnboundedEllipse2d } from "./UnboundedEllipse2d";
import { UnboundedHyperbola2d } from "./UnboundedHyperbola2d";
import { UnboundedLine2dByPointAndNormal } from "./UnboundedLine2d";
import { UnboundedParabola2d } from "./UnboundedParabola2d";

/**
 * Class to convert between `CurvePrimitive` and `ImplicitCurve2d`.
 * @internal
 */
export class ImplicitCurve2dConverter {
  /**
   * Return an implicit curve for the XY parts of the given curve3d.
   * * z components of the input curve are completely ignored
   * * input Arc3d can convert to UnboundedEllipse2d or circle
   * * Returned curves are untrimmed, i.e. lines do not record endpoints and arcs have no angle range.
   * @param curve3d curve to convert. Must be a LineSegment3d or Arc3d. Other curve types return `undefined`.
   */
  public static createImplicitCurve2dFromCurvePrimitiveXY(curve3d: CurvePrimitive):
    ImplicitCurve2d | ImplicitCurve2d[] | undefined {
    if (curve3d instanceof LineSegment3d) {
      const pointA = curve3d.startPoint();
      const pointB = curve3d.endPoint();
      return UnboundedLine2dByPointAndNormal.createPointXYPointXY(pointA.x, pointA.y, pointB.x, pointB.y);
    } else if (curve3d instanceof Arc3d) {
      const center = curve3d.center;
      const columnX = curve3d.matrixRef.columnX()
      const columnY = curve3d.matrixRef.columnY()
      if (curve3d.isCircularXY || curve3d.isDegenerateCircle) {
        return UnboundedCircle2dByCenterAndRadius.createXYRadius(
          center.x, center.y, columnX.magnitudeXY(),
        );
      } else {
        return UnboundedEllipse2d.createCenterAndAxisVectors(
          center, Vector2d.createFrom(columnX), Vector2d.createFrom(columnY),
        );
      }
    }
    return undefined;
  }
  /**
   *  Create a curve primitive from an implicit curve.
   * @param source the implicit curve(s) to convert.
   * @param sizeHint for unbounded curves, the size hint is used when creating a curve primitive. Larger values create a
   * longer curve primitive. Ignored for bounded curves. Default is 10.
   */
  public static createCurvePrimitiveFromImplicitCurve(
    source: ImplicitCurve2d | ImplicitCurve2d[], sizeHint: number = 10,
  ): CurvePrimitive | CurvePrimitive[] | undefined {
    if (Array.isArray(source)) {
      const result: CurvePrimitive[] = [];
      for (const s of source) {
        const c = this.createCurvePrimitiveFromImplicitCurve(s);
        if (c === undefined) {
          // ignore it
        } else if (c instanceof CurvePrimitive) {
          result.push(c);
        } else if (Array.isArray(c)) {
          for (const c1 of c)
            result.push(c1);
        }
      }
      return result;
    }
    // source is a single curve
    if (source instanceof UnboundedCircle2dByCenterAndRadius) {
      return Arc3d.createXY(Point3d.createFrom(source.center), source.radius);
    } else if (source instanceof UnboundedLine2dByPointAndNormal) {
      const vectorAlong = source.vectorAlongLine();
      return LineSegment3d.createXYXY(
        source.point.x - sizeHint * vectorAlong.x, source.point.y - sizeHint * vectorAlong.y,
        source.point.x + sizeHint * vectorAlong.x, source.point.y + sizeHint * vectorAlong.y,
      );
    } else if (source instanceof UnboundedHyperbola2d) {
      const result: CurvePrimitive[] = [];
      /* COMMENTED CODE FOR LINESTRING APPROXIMATION
      const degreeStep = 10.0;
      const degreeLimit = 80.0;
      for (const signX of [1, -1]) {
        const strokes = [];
        for (const theta = Angle.createDegrees(-degreeLimit);
          theta.degrees < degreeLimit + 1;
          theta.setDegrees(theta.degrees + degreeStep)) {
          const c = signX * theta.cos();
          const s = theta.sin();
          const xy = Point3d.createFrom(source.pointA.plus2Scaled(source.vectorU, 1.0 / c, source.vectorV, s / c));
          strokes.push(Point3d.createFrom(xy));
        }
        result.push(LineString3d.create(strokes));
      }
      */
      // The bezier branches open on plus and minus u axes, with asymptotes at 45 degree angles in local space
      // Construct a bezier for 180 degrees of unit circle from negative y to plus 1 with (c,s,w)
      // Reverse c and w so its normalized form is (sec, tan, 1)
      // Map those so bezier 0 maps to U-V asymptote, bezier 1 maps to U+v, and bezier 0.5 maps to A
      // but the secants have 0 weight and evaluate at infinity
      // so subdivide to safely within 0..1
      // Repeat with negated sign for U to get the other branch.
      for (const signU of [1, -1]) {
        const poles = [
          Point4d.create(signU * source.vectorU.x + source.vectorV.x, signU * source.vectorU.y + source.vectorV.y, 0, 0),
          Point4d.create(source.center.x, source.center.y, 0, 1),
          Point4d.create(signU * source.vectorU.x - source.vectorV.x, signU * source.vectorU.y - source.vectorV.y, 0, 0),
        ];
        const fullBezier = BezierCurve3dH.create(poles);
        if (fullBezier) {
          const branch = fullBezier?.clonePartialCurve(0.05, 0.95);
          result.push(branch);
        }
      }
      return result;
    } else if (source instanceof UnboundedEllipse2d) {
      return Arc3d.create(
        Point3d.createFrom(source.center),
        Vector3d.createFrom(source.vectorU),
        Vector3d.createFrom(source.vectorV),
      );
    } else if (source instanceof UnboundedParabola2d) {
      /*
      const halfParabolaPoles = [
        Point4d.create (2 * source.pointA.x, 2 *source.pointA.y, 0, 2),
        Point4d.create (source.vectorU.x, source.vectorU.y, 0, 0),
        Point4d.create (2 * source.vectorV.x, 2 * source.vectorV.y, 0, 0),
      ];
      */
      const point0 = source.center.plus2Scaled(source.vectorU, 1, source.vectorV, 1);
      const point1 = source.center.minus(source.vectorV);
      const point2 = source.center.plus2Scaled(source.vectorU, -1, source.vectorV, 1);
      const poles = [
        Point4d.create(point0.x, point0.y, 0, 1),
        Point4d.create(point1.x, point1.y, 0, 1),
        Point4d.create(point2.x, point2.y, 0, 1),
      ];

      const centerBezier = BezierCurve3dH.create(poles);
      if (centerBezier !== undefined)
        return centerBezier.clonePartialCurve(-2, 3);
    }
    return undefined;
  }
}
