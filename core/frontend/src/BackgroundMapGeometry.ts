/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import {
  Angle,
  ClipPlaneContainment,
  Constant,
  CurvePrimitive,
  Ellipsoid,
  Plane3dByOriginAndUnitNormal,
  Point2d,
  Point3d,
  Point4d,
  Range1d,
  Range3d,
  Ray3d,
  Transform,
  Vector3d,
  Matrix3d,
  XYAndZ,
  Arc3d,
} from "@bentley/geometry-core";
import { Cartographic, GlobeMode, Frustum, ColorDef } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { MapTile, WebMercatorTilingScheme } from "./tile/internal";
import { GraphicBuilder } from "./render/GraphicBuilder";

const scratchRange = Range3d.createNull();
const scratchZeroPoint = Point3d.createZero();
const scratchPoint = Point3d.create();
const scratchCenterPoint = Point3d.createZero();
const scratchIntersectRay = Ray3d.create(Point3d.create(), Vector3d.create());
const scratchEyePoint = Point3d.createZero();
const scratchViewRotation = Matrix3d.createIdentity();

/** Geometry of background map. An ellipsoid if GlobeMode is 3D.   A plane if GlobeMode is Columbus.
 * @internal
 */
export class BackgroundMapGeometry {
  public readonly globeMode: GlobeMode;
  public readonly geometry: Plane3dByOriginAndUnitNormal | Ellipsoid;
  public readonly globeOrigin: Point3d;
  public readonly globeMatrix: Matrix3d;
  public readonly cartesianRange: Range3d;
  public readonly cartesianPlane: Plane3dByOriginAndUnitNormal;
  public readonly cartesianDiagonal: number;
  public readonly cartesianChordHeight: number;
  public readonly maxGeometryChordHeight: number;
  private _mercatorFractionToDb: Transform;
  private _mercatorTilingScheme: WebMercatorTilingScheme;
  public static maxCartesianDistance = 1E4;        // If globe is 3D we still consider the map geometry flat within this distance of the project extents.

  private static _scratchRayFractions = new Array<number>();
  private static _scratchRayAngles = new Array<Point2d>();
  private static _scratchPoint = Point3d.createZero();

  constructor(private _ecefToDb: Transform, private _bimElevationBias: number, globeMode: GlobeMode, iModel: IModelConnection) {
    this.globeMode = globeMode;
    this.cartesianRange = BackgroundMapGeometry.getCartesianRange(iModel);
    this.cartesianDiagonal = this.cartesianRange.diagonal().magnitudeXY();
    const earthRadius = Constant.earthRadiusWGS84.equator;
    this.globeOrigin = _ecefToDb.origin.cloneAsPoint3d();
    this.globeMatrix = _ecefToDb.matrix.clone();
    this.cartesianChordHeight = Math.sqrt(this.cartesianDiagonal * this.cartesianDiagonal + earthRadius * earthRadius) - earthRadius; // Maximum chord height deviation of the cartesian area.
    const halfChordAngle = Angle.piOver2Radians / MapTile.globeMeshDimension;
    this.maxGeometryChordHeight = (1 - Math.cos(halfChordAngle)) * earthRadius;
    this.cartesianPlane = this.getPlane();
    this.geometry = (globeMode === GlobeMode.ThreeD) ? this.getEarthEllipsoid() : this.cartesianPlane;
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._mercatorFractionToDb = this._mercatorTilingScheme.computeMercatorFractionToDb(_ecefToDb, _bimElevationBias, iModel);
  }
  public static getCartesianRange(iModel: IModelConnection, result?: Range3d): Range3d {
    const cartesianRange = Range3d.createFrom(iModel.projectExtents, result);
    cartesianRange.expandInPlace(BackgroundMapGeometry.maxCartesianDistance);
    return cartesianRange;
  }

  public dbToCartographic(db: XYAndZ, result?: Cartographic): Cartographic {
    if (undefined === result)
      result = Cartographic.fromRadians(0, 0, 0);

    if (this.globeMode === GlobeMode.Columbus) {
      const mercatorFraction = this._mercatorFractionToDb.multiplyInversePoint3d(db)!;
      return this._mercatorTilingScheme.fractionToCartographic(mercatorFraction.x, mercatorFraction.y, result, mercatorFraction.z);
    } else {
      const ecef = this._ecefToDb.multiplyInversePoint3d(db)!;
      return Cartographic.fromEcef(ecef, result)!;
    }
  }

  public cartographicToDb(cartographic: Cartographic, result?: Point3d): Point3d {
    if (this.globeMode === GlobeMode.Columbus) {
      const fraction = Point2d.create(0, 0);
      this._mercatorTilingScheme.cartographicToFraction(cartographic.latitude, cartographic.longitude, fraction);
      return this._mercatorFractionToDb.multiplyXYZ(fraction.x, fraction.y, cartographic.height, result);
    } else {
      return this._ecefToDb.multiplyPoint3d(cartographic.toEcef())!;
    }
  }

  public getEarthEllipsoid(radiusOffset = 0): Ellipsoid {
    const equatorRadius = Constant.earthRadiusWGS84.equator + radiusOffset, polarRadius = Constant.earthRadiusWGS84.polar + radiusOffset;
    return Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.globeMatrix, equatorRadius, equatorRadius, polarRadius);
  }
  public getPlane(offset = 0) {
    return Plane3dByOriginAndUnitNormal.create(Point3d.create(0, 0, this._bimElevationBias + offset), Vector3d.create(0, 0, 1))!;
  }

  public getRayIntersection(ray: Ray3d, positiveOnly: boolean): Ray3d | undefined {
    let intersect;
    if (this.globeMode === GlobeMode.ThreeD) {
      const ellipsoid = this.geometry as Ellipsoid;
      BackgroundMapGeometry._scratchRayAngles.length = 0;
      BackgroundMapGeometry._scratchRayFractions.length = 0;

      const count = ellipsoid.intersectRay(ray, BackgroundMapGeometry._scratchRayFractions, undefined, BackgroundMapGeometry._scratchRayAngles);
      let intersectDistance;
      for (let i = 0; i < count; i++) {
        const thisFraction = BackgroundMapGeometry._scratchRayFractions[i];
        if ((!positiveOnly || thisFraction > 0) && (undefined === intersectDistance || thisFraction < intersectDistance)) {
          intersectDistance = thisFraction;
          intersect = scratchIntersectRay;
          ellipsoid.radiansToUnitNormalRay(BackgroundMapGeometry._scratchRayAngles[i].x, BackgroundMapGeometry._scratchRayAngles[i].y, intersect);
          if (intersect.direction.dotProduct(ray.direction) < 0) {
            if (this.cartesianRange.containsPoint(intersect.origin)) {    // If we're in the cartesian range, correct to planar intersection.
              const planeFraction = ray.intersectionWithPlane(this.cartesianPlane, scratchIntersectRay.origin);
              if (undefined !== planeFraction && (!positiveOnly || planeFraction > 0)) {
                intersect.direction.setFromVector3d(this.cartesianPlane.getNormalRef());
              }
            }
          }
        }
      }
    } else {
      const plane = this.geometry as Plane3dByOriginAndUnitNormal;
      const thisFraction = ray.intersectionWithPlane(plane, scratchIntersectRay.origin);
      if (undefined !== thisFraction && (!positiveOnly || thisFraction > 0)) {
        intersect = scratchIntersectRay;
        intersect.direction.setFromVector3d(plane.getNormalRef());
      }
    }
    return intersect;
  }
  public getPointHeight(point: Point3d): number | undefined {
    if (this.globeMode === GlobeMode.ThreeD) {
      const ellipsoid = this.geometry as Ellipsoid;
      const projected = ellipsoid.projectPointToSurface(point);
      if (undefined === projected)
        return undefined;

      const distance = ellipsoid.radiansToPoint(projected.longitudeRadians, projected.latitudeRadians).distance(point);
      const ellipsePoint = ellipsoid.transformRef.multiplyInversePoint3d(point, BackgroundMapGeometry._scratchPoint)!;
      return ellipsePoint.magnitude() < 1 ? -distance : distance;
    } else {
      const plane = this.geometry as Plane3dByOriginAndUnitNormal;
      return plane.altitude(point);
    }
  }

  public getFrustumIntersectionDepthRange(frustum: Frustum, heightRange?: Range1d): Range1d {
    const clipPlanes = frustum.getRangePlanes(false, false, 0);
    const eyePoint = frustum.getEyePoint(scratchEyePoint);
    const viewRotation = frustum.getRotation(scratchViewRotation)!;
    const viewZ = viewRotation.getRow(2);
    const depthRange = Range1d.createNull();
    const eyeDepth = eyePoint ? viewZ.dotProduct(eyePoint) : 0;

    if (this.geometry instanceof Plane3dByOriginAndUnitNormal) {
      let includeHorizon = false;
      const heights = heightRange ? [heightRange.low, heightRange.high] : [0];
      for (const height of heights) {
        const plane = this.getPlane(height);
        for (let i = 0; i < 4; i++) {
          const frustumRay = Ray3d.createStartEnd(eyePoint ? eyePoint : frustum.points[i + 4], frustum.points[i]);
          const thisFraction = frustumRay.intersectionWithPlane(plane, scratchPoint);
          if (undefined !== thisFraction && (!eyePoint || thisFraction > 0))
            depthRange.extendX(viewZ.dotProduct(scratchPoint));
          else
            includeHorizon = true;
        }
        if (includeHorizon) {
          if (eyePoint !== undefined) {
            const eyeHeight = plane.altitude(eyePoint);
            if (eyeHeight < 0)
              depthRange.extendX(eyeDepth);
            else {
              const horizonDistance = Math.sqrt(eyeHeight * eyeHeight + 2 * eyeHeight * Constant.earthRadiusWGS84.equator);
              depthRange.extendX(eyeDepth - horizonDistance);
            }
          }
        }
      }
    } else {
      const minOffset = heightRange ? heightRange.low : 0, maxOffset = (heightRange ? heightRange.high : 0) + this.cartesianChordHeight;
      const radiusOffsets = [minOffset, maxOffset];
      const toView = Transform.createRefs(Point3d.createZero(), viewRotation);
      const eyePoint4d = eyePoint ? Point4d.createFromPointAndWeight(eyePoint, 1) : Point4d.createFromPointAndWeight(viewZ, 0);
      for (const radiusOffset of radiusOffsets) {
        const ellipsoid = this.getEarthEllipsoid(radiusOffset);
        const isInside = eyePoint && ellipsoid.worldToLocal(eyePoint)!.magnitude() < 1.0;
        const center = ellipsoid.localToWorld(scratchZeroPoint, scratchCenterPoint);

        // Extrema...
        let angles, extremaPoint;
        if (undefined !== (angles = ellipsoid.surfaceNormalToRadians(viewZ)) &&
          undefined !== (extremaPoint = ellipsoid.radiansToPoint(angles.x, angles.y)) &&
          (eyePoint === undefined || viewZ.dotProductStartEnd(extremaPoint, eyePoint) > 0) &&
          clipPlanes.classifyPointContainment([extremaPoint], false) !== ClipPlaneContainment.StronglyOutside)
          depthRange.extendX(viewZ.dotProduct(extremaPoint));

        // Silhouettes
        if (isInside)
          depthRange.extendX(eyeDepth);
        else {
          const silhouette = ellipsoid.silhouetteArc(eyePoint4d);
          if (silhouette !== undefined) {
            silhouette.announceClipIntervals(clipPlanes, (a0: number, _a1: number, cp: CurvePrimitive) => {
              depthRange.extendX(viewZ.dotProduct(cp.fractionToPoint(a0)));
            });
          }
        }

        // Intersections with frustum planes...
        const viewingInside = eyePoint !== undefined && viewZ.dotProduct(Vector3d.createStartEnd(center, eyePoint)) < 0;
        if (eyePoint === undefined || !isInside || viewingInside) {
          for (const clipPlane of clipPlanes.planes) {
            const plane = clipPlane.getPlane3d();
            const arc = ellipsoid.createPlaneSection(plane);

            if (undefined !== arc) {
              const closeRange = Range1d.createNull();
              arc.announceClipIntervals(clipPlanes, (a0: number, a1: number, cp: CurvePrimitive) => {
                const segment = cp.clonePartialCurve(a0, a1);
                if (segment !== undefined) {
                  scratchRange.setNull();
                  segment.extendRange(scratchRange, toView);
                  if (closeRange.isNull || scratchRange.low.z > closeRange.low) {
                    closeRange.low = scratchRange.low.z;
                    closeRange.high = scratchRange.high.z;
                  }
                }
              });
              if (!closeRange.isNull) {
                depthRange.extendX(closeRange.low);
                depthRange.extendX(closeRange.high);
              }
            }
          }
        }
      }
    }
    return depthRange;
  }
  public addFrustumDecorations(builder: GraphicBuilder, frustum: Frustum) {
    if (this.geometry instanceof Ellipsoid) {
      const ellipsoid = this.geometry as Ellipsoid;
      const clipPlanes = frustum.getRangePlanes(false, false, 0);
      for (const clipPlane of clipPlanes.planes) {
        const plane = clipPlane.getPlane3d();
        const arc = ellipsoid.createPlaneSection(plane);

        if (undefined !== arc) {
          builder.setSymbology(ColorDef.white, ColorDef.white, 1, 1);
          builder.addArc(arc as Arc3d, false, false);
          arc.announceClipIntervals(clipPlanes, (a0: number, a1: number, cp: CurvePrimitive) => {
            builder.setSymbology(ColorDef.white, ColorDef.white, 2, 0);
            const segment = cp.clonePartialCurve(a0, a1);
            if (undefined !== segment)
              builder.addArc(segment as Arc3d, false, false);
          });
        }
      }
    }
  }
}
