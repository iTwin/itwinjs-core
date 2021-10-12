/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */
import { LineString3d } from "../curve/LineString3d";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { EllipsoidPatch } from "./Ellipsoid";
import { UVSurface } from "./GeometryHandler";
import { Plane3dByOriginAndVectors } from "./Plane3dByOriginAndVectors";
import { Point3d } from "./Point3dVector3d";
import { Range3d } from "./Range";
/**
 * Support methods to act on surfaces with 0..1 uv fractional parameterization
 * @public
 */
export class UVSurfaceOps {
  /** Return the range of sampled points at specified offset from the surface.
   * * point counts in each direction may be set in the optional `options` structure.
   * * numU and numV are clamped at (2,500).
   */
  public static sampledRangeOfOffsetPatch(patch: UVSurface, offsetDistance: number | undefined, numU: number, numV: number): Range3d {
    const range = Range3d.createNull();
    numU = Math.ceil(Geometry.clamp(numU, 2, 500));
    numV = Math.ceil(Geometry.clamp(numV, 2, 500));
    const du = 1.0 / numU;
    const dv = 1.0 / numV;
    const xyz = Point3d.create();
    const plane = Plane3dByOriginAndVectors.createXYPlane();

    let u, v;
    for (let j = 0; j <= numV; j++) {
      v = j * dv;
      for (let i = 0; i <= numU; i++) {
        u = i * du;
        if (offsetDistance !== undefined) {
          patch.uvFractionToPointAndTangents(u, v, plane);
          const unitNormal = plane.unitNormal();
          if (unitNormal !== undefined) {
            plane.origin.addScaledInPlace(unitNormal, offsetDistance);
            range.extend(plane.origin);
          }
        } else {
          patch.uvFractionToPoint(u, v, xyz);
          range.extendXYZ(xyz.x, xyz.y, xyz.z);
        }
      }
    }
    return range;
  }

  /** Return the range of sampled points at specified offset from the surface.
 * * point counts in each direction may be set in the optional `options` structure, with angle ranges from the ellipsoid.
 * * Default evaluation is at 5 degree intervals.
 */
  public static sampledRangeOfOffsetEllipsoidPatch(patch: EllipsoidPatch, offsetDistance: number | undefined, options?: StrokeOptions): Range3d {
    const numU = StrokeOptions.applyAngleTol(options, 2, patch.latitudeSweep.sweepRadians, Angle.degreesToRadians(5.0));
    const numV = StrokeOptions.applyAngleTol(options, 2, patch.longitudeSweep.sweepRadians, Angle.degreesToRadians(5.0));
    return this.sampledRangeOfOffsetPatch(patch, offsetDistance, numU, numV);
  }

  private constructor() { }  // private constructor -- no instances.
  /**
   * * evaluate `numEdge+1` points at surface uv parameters interpolated between (u0,v0) and (u1,v1)
   * * accumulate the xyz in a linestring.
   * * If xyzToUV is given, also accumulate transformed values as surfaceUV
   * * use xyzToUserUV transform to convert xyz to uv stored in the linestring (this uv is typically different from surface uv -- e.g. torus cap plane coordinates)
   * @param surface
   * @param u0 u coordinate at start of parameter space line
   * @param v0 v coordinate at end of parameter space line
   * @param u1 u coordinate at start of parameter space line
   * @param v1 v coordinate at end of parameter space line
   * @param numEdge number of edges.   (`numEdge+1` points are evaluated)
   * @param saveUV if true, save each surface uv fractions with `linestring.addUVParamsAsUV (u,v)`
   * @param saveFraction if true, save each fractional coordinate (along the u,v line) with `linestring.addFraction (fraction)`
   *
   * @param xyzToUV
   */
  public static createLinestringOnUVLine(
    surface: UVSurface,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    numEdge: number,
    saveUV: boolean = false,
    saveFraction: boolean = false): LineString3d {

    const ls = LineString3d.create();
    const xyz = Point3d.create();
    let fraction, u, v;
    const numEvaluate = numEdge + 1;
    for (let i = 0; i < numEvaluate; i++) {
      fraction = i / numEdge;
      u = Geometry.interpolate(u0, fraction, u1);
      v = Geometry.interpolate(v0, fraction, v1);
      surface.uvFractionToPoint(u, v, xyz);
      ls.addPoint(xyz);
      if (saveUV)
        ls.addUVParamAsUV(u, v);
      if (saveFraction)
        ls.addFraction(fraction);
    }
    return ls;
  }
}
