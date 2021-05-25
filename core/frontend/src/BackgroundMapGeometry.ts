/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert } from "@bentley/bentleyjs-core";
import { Angle, Arc3d, ClipPlane, ClipPlaneContainment, Constant, CurvePrimitive, Ellipsoid, GrowableXYZArray, LongitudeLatitudeNumber, Matrix3d, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Point4d, Range1d, Range3d, Ray3d, Transform, Vector3d, XYAndZ } from "@bentley/geometry-core";
import { Cartographic, ColorByName, ColorDef, EcefLocation, Frustum, GeoCoordStatus, GlobeMode } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { BingElevationProvider, WebMercatorTilingScheme } from "./tile/internal";

const scratchRange = Range3d.createNull();
const scratchZeroPoint = Point3d.createZero();
const scratchPoint = Point3d.create();
const scratchVector = Vector3d.create();
const scratchCenterPoint = Point3d.createZero();
const scratchIntersectRay = Ray3d.create(Point3d.create(), Vector3d.create());
const scratchEyePoint = Point3d.createZero();
const scratchViewRotation = Matrix3d.createIdentity();
const scratchSilhouetteNormal = Vector3d.create();
const scratchCartoRectangle = new GrowableXYZArray();
const scratchWorkArray = new GrowableXYZArray();

function accumulateDepthRange(point: Point3d, viewRotation: Matrix3d, range: Range3d) {
  viewRotation.multiplyXYZtoXYZ(point, scratchPoint);
  range.extend(scratchPoint);
}

function accumulateFrustumPlaneDepthRange(frustum: Frustum, plane: Plane3dByOriginAndUnitNormal, viewRotation: Matrix3d, range: Range3d, eyePoint?: Point3d) {
  let includeHorizon = false;
  for (let i = 0; i < 4; i++) {
    const frustumRay = Ray3d.createStartEnd(eyePoint ? eyePoint : frustum.points[i + 4], frustum.points[i]);
    const thisFraction = frustumRay.intersectionWithPlane(plane, scratchPoint);
    if (undefined !== thisFraction && (!eyePoint || thisFraction > 0))
      accumulateDepthRange(scratchPoint, viewRotation, range);
    else
      includeHorizon = true;
  }
  if (includeHorizon) {
    if (eyePoint !== undefined) {
      const eyeHeight = plane.altitude(eyePoint);
      if (eyeHeight < 0)
        accumulateDepthRange(eyePoint, viewRotation, range);
      else {
        const viewZ = viewRotation.getRow(2);
        const horizonDistance = Math.sqrt(eyeHeight * eyeHeight + 2 * eyeHeight * Constant.earthRadiusWGS84.equator);
        accumulateDepthRange(eyePoint.plusScaled(viewZ, -horizonDistance, scratchPoint), viewRotation, range);
      }
    }
  }
}

/** @internal */
export function getFrustumPlaneIntersectionDepthRange(frustum: Frustum, plane: Plane3dByOriginAndUnitNormal): Range1d {
  const eyePoint = frustum.getEyePoint(scratchEyePoint);
  const viewRotation = frustum.getRotation(scratchViewRotation)!;
  const intersectRange = Range3d.createNull();
  accumulateFrustumPlaneDepthRange(frustum, plane, viewRotation, intersectRange, eyePoint);

  return intersectRange.isNull ? Range1d.createNull(): Range1d.createXX(intersectRange.low.z, intersectRange.high.z);
}

/** Geometry of background map - either an ellipsoid or a plane as defined by GlobeMode.
 * @internal
 */
export class BackgroundMapGeometry {
  public readonly globeMode: GlobeMode;
  public readonly geometry: Plane3dByOriginAndUnitNormal | Ellipsoid;
  public readonly globeOrigin: Point3d;
  public readonly globeMatrix: Matrix3d;
  public readonly cartesianRange: Range3d;
  public readonly cartesianTransitionRange: Range3d;
  public readonly cartesianPlane: Plane3dByOriginAndUnitNormal;
  public readonly cartesianDiagonal: number;
  public readonly cartesianChordHeight: number;
  public readonly maxGeometryChordHeight: number;
  private _mercatorFractionToDb: Transform;
  private _mercatorTilingScheme: WebMercatorTilingScheme;
  private _ecefToDb: Transform;
  public static maxCartesianDistance = 1E4;           // If globe is 3D we still consider the map geometry flat within this distance of the project extents.
  private static _transitionDistanceMultiplier = .25;  // In the transition range which extends beyond the cartesian range we interpolate between cartesian and ellipsoid.

  private static _scratchRayFractions = new Array<number>();
  private static _scratchRayAngles = new Array<LongitudeLatitudeNumber>();
  private static _scratchPoint = Point3d.createZero();

  constructor(private _bimElevationBias: number, globeMode: GlobeMode, private _iModel: IModelConnection) {
    this._ecefToDb = _iModel.backgroundMapLocation.getMapEcefToDb(_bimElevationBias);
    this.globeMode = globeMode;
    this.cartesianRange = BackgroundMapGeometry.getCartesianRange(_iModel);
    this.cartesianTransitionRange = this.cartesianRange.clone();
    this.cartesianTransitionRange.expandInPlace(BackgroundMapGeometry.getCartesianTransitionDistance(_iModel));
    this.cartesianDiagonal = this.cartesianRange.diagonal().magnitudeXY();
    const earthRadius = Constant.earthRadiusWGS84.equator;
    this.globeOrigin = this._ecefToDb.origin.cloneAsPoint3d();
    this.globeMatrix = this._ecefToDb.matrix.clone();
    this.cartesianChordHeight = Math.sqrt(this.cartesianDiagonal * this.cartesianDiagonal + earthRadius * earthRadius) - earthRadius; // Maximum chord height deviation of the cartesian area.
    const halfChordAngle = Angle.piOver2Radians / 10;
    this.maxGeometryChordHeight = (1 - Math.cos(halfChordAngle)) * earthRadius;
    this.cartesianPlane = this.getPlane();
    this.geometry = (globeMode === GlobeMode.Ellipsoid) ? this.getEarthEllipsoid() : this.cartesianPlane;
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._mercatorFractionToDb = this._mercatorTilingScheme.computeMercatorFractionToDb(this._ecefToDb, _bimElevationBias, _iModel, false);
  }
  public static getCartesianRange(iModel: IModelConnection, result?: Range3d): Range3d {
    const cartesianRange = Range3d.createFrom(iModel.projectExtents, result);
    cartesianRange.expandInPlace(BackgroundMapGeometry.maxCartesianDistance);
    return cartesianRange;
  }
  public static getCartesianTransitionDistance(iModel: IModelConnection): number {
    return BackgroundMapGeometry.getCartesianRange(iModel, scratchRange).diagonal().magnitudeXY() * BackgroundMapGeometry._transitionDistanceMultiplier;
  }

  public async dbToCartographicFromGcs(db: XYAndZ, result?: Cartographic): Promise<Cartographic> {
    return this.cartesianRange.containsPoint(Point3d.createFrom(db)) ? this._iModel.spatialToCartographic(db, result) : this.dbToCartographic(db, result);
  }

  public dbToCartographic(db: XYAndZ, result?: Cartographic): Cartographic {
    if (undefined === result)
      result = Cartographic.fromRadians(0, 0, 0);

    if (this.globeMode === GlobeMode.Plane) {
      const mercatorFraction = this._mercatorFractionToDb.multiplyInversePoint3d(db)!;
      return this._mercatorTilingScheme.fractionToCartographic(mercatorFraction.x, mercatorFraction.y, result, mercatorFraction.z);
    } else {
      const ecef = this._ecefToDb.multiplyInversePoint3d(db)!;
      return Cartographic.fromEcef(ecef, result)!;
    }
  }

  public async cartographicToDbFromGcs(cartographic: Cartographic, result?: Point3d): Promise<Point3d> {
    let db;
    if (this.globeMode === GlobeMode.Plane) {
      const fraction = Point2d.create(0, 0);
      this._mercatorTilingScheme.cartographicToFraction(cartographic.latitude, cartographic.longitude, fraction);
      db = this._mercatorFractionToDb.multiplyXYZ(fraction.x, fraction.y, cartographic.height, result);
    } else {
      db = this._ecefToDb.multiplyPoint3d(cartographic.toEcef())!;
    }
    return (!this._iModel.noGcsDefined && this.cartesianRange.containsPoint(db)) ? this._iModel.cartographicToSpatialFromGcs(cartographic) : db;
  }
  public cartographicToDb(cartographic: Cartographic, result?: Point3d): Point3d {
    if (this.globeMode === GlobeMode.Plane) {
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
    if (this.globeMode === GlobeMode.Ellipsoid) {
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
          ellipsoid.radiansToUnitNormalRay(BackgroundMapGeometry._scratchRayAngles[i].longitudeRadians, BackgroundMapGeometry._scratchRayAngles[i].latitudeRadians, intersect);
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
    if (this.globeMode === GlobeMode.Ellipsoid) {
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

  /** @internal */
  public getFrustumIntersectionDepthRange(frustum: Frustum, bimRange: Range3d, heightRange?: Range1d, gridPlane?: Plane3dByOriginAndUnitNormal, doGlobalScope?: boolean): Range1d {
    const clipPlanes = frustum.getRangePlanes(false, false, 0);
    const eyePoint = frustum.getEyePoint(scratchEyePoint);
    const viewRotation = frustum.getRotation(scratchViewRotation)!;
    const viewZ = viewRotation.getRow(2);
    const cartoRange = this.cartesianTransitionRange;
    const intersectRange = Range3d.createNull();
    const doAccumulate = ((point: Point3d) => accumulateDepthRange(point, viewRotation, intersectRange));

    if (gridPlane)
      accumulateFrustumPlaneDepthRange(frustum, gridPlane, viewRotation, intersectRange, eyePoint);
    if (this.geometry instanceof Plane3dByOriginAndUnitNormal) {
      // Intersection with a planar background projection...
      const heights = heightRange ? [heightRange.low, heightRange.high] : [0];
      for (const height of heights) {
        accumulateFrustumPlaneDepthRange(frustum, this.getPlane(height), viewRotation, intersectRange, eyePoint);
      }
    } else {
      const minOffset = heightRange ? heightRange.low : 0, maxOffset = (heightRange ? heightRange.high : 0) + this.cartesianChordHeight;
      const radiusOffsets = [minOffset, maxOffset];

      // If we are doing global scope then include minimum ellipsoid that represents the chordal approximation of the low level tiles.
      // this substantially expands the frustum so don't do it for non-global views, but this clipping out the low level tiles.
      if (doGlobalScope)
        radiusOffsets.push(minOffset - this.maxGeometryChordHeight);

      const toView = Transform.createRefs(Point3d.createZero(), viewRotation);
      const eyePoint4d = eyePoint ? Point4d.createFromPointAndWeight(eyePoint, 1) : Point4d.createFromPointAndWeight(viewZ, 0);

      for (const radiusOffset of radiusOffsets) {
        const ellipsoid = this.getEarthEllipsoid(radiusOffset);
        const isInside = eyePoint && ellipsoid.worldToLocal(eyePoint)!.magnitude() < 1.0;
        const center = ellipsoid.localToWorld(scratchZeroPoint, scratchCenterPoint);
        const clipPlaneCount = clipPlanes.planes.length;

        // Extrema...
        let angles, extremaPoint;
        if (undefined !== (angles = ellipsoid.surfaceNormalToAngles(viewZ)) &&
          undefined !== (extremaPoint = ellipsoid.radiansToPoint(angles.longitudeRadians, angles.latitudeRadians)) &&
          (eyePoint === undefined || viewZ.dotProductStartEnd(extremaPoint, eyePoint) > 0) &&
          clipPlanes.classifyPointContainment([extremaPoint], false) !== ClipPlaneContainment.StronglyOutside)
          doAccumulate(extremaPoint);

        if (isInside) {
          if (eyePoint) doAccumulate(eyePoint);
        } else {
          const silhouette = ellipsoid.silhouetteArc(eyePoint4d);
          if (silhouette !== undefined) {
            silhouette.perpendicularVector.clone(scratchSilhouetteNormal);
            // Push the silhouette plane as clip so that we do not include geometry at other side of ellipsoid.
            // First make sure that it is pointing in the right direction.
            if (eyePoint) {
              // Clip toward eye.
              if (scratchSilhouetteNormal.dotProduct(viewZ) < 0)
                scratchSilhouetteNormal.negate(scratchSilhouetteNormal);
            } else {
              /* If parallel projection - clip toward side of ellipsoid with BIM geometry */
              if (Vector3d.createStartEnd(silhouette.center, bimRange.center).dotProduct(scratchSilhouetteNormal) < 0)
                scratchSilhouetteNormal.negate(scratchSilhouetteNormal);
            }
            clipPlanes.planes.push(ClipPlane.createNormalAndDistance(scratchSilhouetteNormal, scratchSilhouetteNormal.dotProduct(silhouette.center))!);
          } else {
            clipPlanes.planes.push(ClipPlane.createNormalAndPoint(viewZ, center)!);
          }
        }
        if (!isInside || radiusOffset === radiusOffsets[0]) {
          // Intersections of ellipsoid with frustum planes...
          const viewingInside = eyePoint !== undefined && viewZ.dotProduct(Vector3d.createStartEnd(center, eyePoint)) < 0;
          if (eyePoint === undefined || !isInside || viewingInside) {
            for (const clipPlane of clipPlanes.planes) {
              const plane = clipPlane.getPlane3d();
              const arc = ellipsoid.createPlaneSection(plane);
              if (undefined !== arc) {
                arc.announceClipIntervals(clipPlanes, (a0: number, a1: number, cp: CurvePrimitive) => {
                  if (Math.abs(a1 - a0) < 1.0E-8) {
                    doAccumulate(cp.fractionToPoint(a0));   // Tiny sweep - avoid problem with rangeMethod (not worth doing anyway).
                  } else {
                    const segment = cp.clonePartialCurve(a0, a1);
                    if (segment !== undefined)
                      segment.extendRange(intersectRange, toView);

                  }
                });
              }
            }
          }
          // Intersections of the cartesian region with frustum planes.
          scratchCartoRectangle.resize(0);
          scratchCartoRectangle.push({ x: cartoRange.low.x, y: cartoRange.low.y, z: radiusOffset });
          scratchCartoRectangle.push({ x: cartoRange.high.x, y: cartoRange.low.y, z: radiusOffset });
          scratchCartoRectangle.push({ x: cartoRange.high.x, y: cartoRange.high.y, z: radiusOffset });
          scratchCartoRectangle.push({ x: cartoRange.low.x, y: cartoRange.high.y, z: radiusOffset });
          scratchCartoRectangle.push({ x: cartoRange.low.x, y: cartoRange.low.y, z: radiusOffset });

          clipPlanes.clipConvexPolygonInPlace(scratchCartoRectangle, scratchWorkArray);
          for (let i = 0; i < scratchCartoRectangle.length; i++)
            doAccumulate(scratchCartoRectangle.getPoint3dAtUncheckedPointIndex(i));
          while (clipPlanes.planes.length > clipPlaneCount)   // Remove pushed silhouette plane.
            clipPlanes.planes.pop();
        }
      }
    }

    if (intersectRange.zLength() < 5) {
      // For the case where the fitted depth is small (less than 5 meters) we must be viewing planar projection or the
      // planar portion of the iModel in plan view. In this case use a constant (arbitrarily 100 meters) depth so that the frustum
      // Z is doesn't change and cause nearly planar geometry to jitter in Z buffer.
      const zCenter = (intersectRange.low.z + intersectRange.high.z) / 2;
      const zExpand = 50;
      return Range1d.createXX(zCenter - zExpand, zCenter + zExpand);
    } else {
      const diagonal = intersectRange.diagonal(scratchVector).magnitudeXY();
      const expansion = diagonal * .01;
      return Range1d.createXX(intersectRange.low.z - expansion, intersectRange.high.z + expansion);
    }
  }

  public addFrustumDecorations(builder: GraphicBuilder, frustum: Frustum) {
    if (this.geometry instanceof Ellipsoid) {
      const ellipsoid = this.geometry;
      const clipPlanes = frustum.getRangePlanes(false, false, 0);
      const viewRotation = frustum.getRotation()!;
      const eyePoint = frustum.getEyePoint(scratchEyePoint);
      const viewZ = viewRotation.getRow(2);
      const eyePoint4d = eyePoint ? Point4d.createFromPointAndWeight(eyePoint, 1) : Point4d.createFromPointAndWeight(viewZ, 0);
      const isInside = eyePoint && ellipsoid.worldToLocal(eyePoint)!.magnitude() < 1.0;
      const center = ellipsoid.localToWorld(scratchZeroPoint, scratchCenterPoint);
      const cartoRange = this.cartesianTransitionRange;

      if (!isInside) {
        const silhouette = ellipsoid.silhouetteArc(eyePoint4d);
        if (silhouette !== undefined) {
          silhouette.perpendicularVector.clone(scratchSilhouetteNormal);
          if (scratchSilhouetteNormal.dotProduct(viewZ) < 0)
            scratchSilhouetteNormal.negate(scratchSilhouetteNormal);
          clipPlanes.planes.push(ClipPlane.createNormalAndDistance(scratchSilhouetteNormal, scratchSilhouetteNormal.dotProduct(silhouette.center))!);
        } else {
          clipPlanes.planes.push(ClipPlane.createNormalAndPoint(viewZ, center)!);
        }

        const ellipsoidColor = ColorDef.create(ColorByName.yellow);
        builder.setSymbology(ellipsoidColor, ellipsoidColor, 1, 2);
        for (const clipPlane of clipPlanes.planes) {
          const plane = clipPlane.getPlane3d();
          const arc = ellipsoid.createPlaneSection(plane);
          if (undefined !== arc) {
            arc.announceClipIntervals(clipPlanes, (a0: number, a1: number, cp: CurvePrimitive) => {
              const segment = cp.clonePartialCurve(a0, a1);
              if (segment !== undefined)
                builder.addArc(segment as Arc3d, false, false);
            });
          }

          // Intersections of the cartesian region with frustum planes.
          scratchCartoRectangle.resize(0);
          scratchCartoRectangle.push({ x: cartoRange.low.x, y: cartoRange.low.y, z: 0 });
          scratchCartoRectangle.push({ x: cartoRange.high.x, y: cartoRange.low.y, z: 0 });
          scratchCartoRectangle.push({ x: cartoRange.high.x, y: cartoRange.high.y, z: 0 });
          scratchCartoRectangle.push({ x: cartoRange.low.x, y: cartoRange.high.y, z: 0 });
          scratchCartoRectangle.push({ x: cartoRange.low.x, y: cartoRange.low.y, z: 0 });

          clipPlanes.clipConvexPolygonInPlace(scratchCartoRectangle, scratchWorkArray);
          if (scratchCartoRectangle.length > 0) {
            builder.addLineString(scratchCartoRectangle.getPoint3dArray());
          }
        }
      }
    }
  }
}

/** Calculate the ECEF to database (IModel) coordinate transform at a provided location, using the GCS of the iModel.
 *  The transform will exactly represent the GCS at the provided location.
 * @public
 */
export async function calculateEcefToDbTransformAtLocation(originIn: Point3d, iModel: IModelConnection): Promise<Transform | undefined> {
  const geoConverter = iModel.noGcsDefined ? undefined : iModel.geoServices.getConverter("WGS84");
  if (geoConverter === undefined)
    return undefined;

  const origin = Point3d.create(originIn.x, originIn.y, 0);   // Always Test at zero.
  const eastPoint = origin.plusXYZ(1, 0, 0);
  const northPoint = origin.plusXYZ(0, 1, 0);

  const response = await geoConverter.getGeoCoordinatesFromIModelCoordinates([origin, northPoint, eastPoint]);
  if (response.geoCoords[0].s !== GeoCoordStatus.Success || response.geoCoords[1].s !== GeoCoordStatus.Success || response.geoCoords[2].s !== GeoCoordStatus.Success)
    return undefined;

  const geoOrigin = Point3d.fromJSON(response.geoCoords[0].p);
  const geoNorth = Point3d.fromJSON(response.geoCoords[1].p);
  const geoEast = Point3d.fromJSON(response.geoCoords[2].p);
  const ecefOrigin = Cartographic.fromDegrees(geoOrigin.x, geoOrigin.y, geoOrigin.z).toEcef()!;
  const ecefNorth = Cartographic.fromDegrees(geoNorth.x, geoNorth.y, geoNorth.z).toEcef()!;
  const ecefEast = Cartographic.fromDegrees(geoEast.x, geoEast.y, geoEast.z).toEcef()!;

  const xVector = Vector3d.createStartEnd(ecefOrigin, ecefEast);
  const yVector = Vector3d.createStartEnd(ecefOrigin, ecefNorth);
  const zVector = xVector.unitCrossProduct(yVector);
  if (undefined === zVector) {
    assert(false);            // Should never occur.
    return undefined;
  }
  const matrix = Matrix3d.createColumns(xVector, yVector, zVector);
  if (matrix === undefined)
    return undefined;

  const inverse = matrix.inverse();
  if (inverse === undefined) {
    assert(false);               // Should never occur.
    return undefined;
  }

  return Transform.createMatrixPickupPutdown(matrix, origin, ecefOrigin).inverse()!;
}

/** @internal */
export class BackgroundMapLocation {
  private _ecefToDb?: Transform;
  private _ecefValidated = false;
  private _geodeticToSeaLevel?: number;
  private _projectCenterAltitude?: number;

  public onEcefChanged(ecefLocation: EcefLocation| undefined) {
    this._ecefToDb = ecefLocation?.getTransform().inverse();
    this._ecefValidated = false;
  }

  public async initialize(iModel: IModelConnection): Promise<void> {
    if (this._ecefToDb !== undefined && this._ecefValidated)
      return;

    if (!iModel.ecefLocation) {
      this._ecefToDb = Transform.createIdentity();
      this._geodeticToSeaLevel = 0;
      this._projectCenterAltitude = 0;
      return;
    }

    const ecefLocationDbToEcef = iModel.ecefLocation.getTransform();
    this._ecefToDb = ecefLocationDbToEcef.inverse();
    if (this._ecefToDb === undefined) {
      assert(false);
      this._ecefToDb = Transform.createIdentity();
      return;
    }
    const projectExtents = iModel.projectExtents;
    const origin = projectExtents.localXYZToWorld(.5, .5, .5);
    if (!origin) {
      this._ecefToDb = Transform.createIdentity();
      return;
    }

    origin.z = 0; // always use ground plane
    const ecefToDb = await calculateEcefToDbTransformAtLocation(origin, iModel);
    if (undefined !== ecefToDb)
      this._ecefToDb = ecefToDb;

    const elevationProvider = new BingElevationProvider();

    this._geodeticToSeaLevel = await elevationProvider.getGeodeticToSeaLevelOffset(iModel.projectExtents.center, iModel);
    this._projectCenterAltitude = await elevationProvider.getHeightValue(iModel.projectExtents.center, iModel, true);
    this._ecefValidated = true;
  }
  public getMapEcefToDb(bimElevationBias: number): Transform {
    if (undefined === this._ecefToDb) {
      assert(false);
      return Transform.createIdentity();
    }

    const mapEcefToDb = this._ecefToDb.clone();
    mapEcefToDb.origin.z += bimElevationBias;

    return mapEcefToDb;
  }

  public get geodeticToSeaLevel(): number {
    if (undefined === this._geodeticToSeaLevel) {
      assert (false);
      return 0.0;
    }
    return this._geodeticToSeaLevel;
  }
  public get projectCenterAltitude(): number {
    if (undefined === this._projectCenterAltitude) {
      assert (false);
      return 0.0;
    }
    return this._projectCenterAltitude;
  }
}
