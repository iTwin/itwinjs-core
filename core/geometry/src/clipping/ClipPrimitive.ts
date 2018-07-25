/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { ClipPlane } from "./ClipPlane";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { ClipPlaneContainment } from "./ClipUtils";
import { Point3d, Vector2d, Vector3d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { Geometry } from "../Geometry";
import { PolygonOps } from "../PointHelpers";
import { Matrix4d } from "../numerics/Geometry4d";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { UnionOfConvexClipPlaneSets } from "./UnionOfConvexClipPlaneSets";

/**
 * Bit mask type for easily keeping track of defined vs undefined values and which parts of a clipping shape
 * should or should not be used.
 */
export const enum ClipMask {
  None = 0x00,
  XLow = 0x01,
  XHigh = 0x02,
  YLow = 0x04,
  YHigh = 0x08,
  ZLow = 0x10,
  ZHigh = 0x20,
  XAndY = 0x0f,
  All = 0x3f,
}

/** Internal helper class holding XYZ components that serves as a representation of polygon edges defined by clip planes */
class PolyEdge {
  public origin: Point3d;
  public next: Point3d;
  public normal: Vector2d;

  public constructor(origin: Point3d, next: Point3d, normal: Vector2d, z: number) {
    this.origin = Point3d.create(origin.x, origin.y, z);
    this.next = Point3d.create(next.x, next.y, z);
    this.normal = normal;
  }
}

/**
 * Cache structure that holds a ClipPlaneSet and various parameters for adding new ClipPlanes to the set. This structure
 * will typically be fed to an additive function that will append new ClipPlanes to the cache based on these parameters.
 */
export class PlaneSetParamsCache {
  public clipPlaneSet: UnionOfConvexClipPlaneSets;
  public zLow: number;
  public zHigh: number;
  public isMask: boolean;
  public invisible: boolean;
  public limitValue: number;
  public localOrigin: Point3d;
  public focalLength: number;

  public constructor(zLow: number, zHigh: number, localOrigin?: Point3d, isMask: boolean = false, isInvisible: boolean = false, focalLength: number = 0.0) {
    this.clipPlaneSet = UnionOfConvexClipPlaneSets.createEmpty();
    this.zLow = zLow;
    this.zHigh = zHigh;
    this.isMask = isMask;
    this.invisible = isInvisible;
    this.focalLength = focalLength;
    this.limitValue = 0;
    this.localOrigin = localOrigin ? localOrigin : Point3d.create();
  }
}

/** Base class for clipping implementations that use
 *
 * * A ClipPlaneSet designated "clipPlanes"
 * * A ClipPlaneSet designated "maskPlanes"
 * * an "invisible" flag
 */
export abstract class ClipPrimitive {
  protected _clipPlanes?: UnionOfConvexClipPlaneSets;
  protected _maskPlanes?: UnionOfConvexClipPlaneSets;
  protected _invisible: boolean;

  public abstract fetchClipPlanesRef(): UnionOfConvexClipPlaneSets | undefined;
  public abstract fetchMaskPlanesRef(): UnionOfConvexClipPlaneSets | undefined;
  public abstract get invisible(): boolean;

  protected constructor(planeSet?: UnionOfConvexClipPlaneSets | undefined, isInvisible: boolean = false) {
    this._clipPlanes = planeSet;
    this._invisible = isInvisible;
  }

  public abstract toJSON(): any;

  /**
   * Return (if possible) the range box around the clipper after a transform.
   * Note that well formed clippers can have unbounded volumes -- having a bounded range is only possible for special
   * clippers such as polygons swept through a volume with front and back planes.
   */
  public abstract getRange(returnMaskRange: boolean, transform: Transform, result?: Range3d): Range3d | undefined;
  /** Apply a transform to the clipper (e.g. transform all planes) */
  public abstract transformInPlace(transform: Transform): boolean;
  public abstract multiplyPlanesTimesMatrix(matrix: Matrix4d): boolean;

  protected transformInPlaceSuper(transform: Transform): boolean {
    if (this._clipPlanes)
      this._clipPlanes.transformInPlace(transform);
    if (this._maskPlanes)
      this._maskPlanes.transformInPlace(transform);

    return true;
  }

  /** Sets both the clip plane set and the mask set visibility */
  public setInvisible(invisible: boolean) {
    this._invisible = invisible;
    if (this._clipPlanes)
      this._clipPlanes.setInvisible(invisible);
    if (this._maskPlanes)
      this._maskPlanes.setInvisible(invisible);
  }

  public containsZClip(): boolean {
    if (this.fetchClipPlanesRef() !== undefined)
      for (const convexSet of this._clipPlanes!.convexSets)
        for (const plane of convexSet.planes)
          if (Math.abs(plane.inwardNormalRef.z) > 1.0e-6 && Math.abs(plane.distance) !== Number.MAX_VALUE)
            return true;
    return false;
  }

  /**
   * Determines whether the given points fall inside or outside the set. If this set is defined by masking planes,
   * will check the mask planes only, provided that ignoreMasks is false. Otherwise, will check the clipplanes member.
   */
  public classifyPointContainment(points: Point3d[], ignoreMasks: boolean): ClipPlaneContainment {
    if (this.fetchMaskPlanesRef() !== undefined) {
      if (ignoreMasks)
        return ClipPlaneContainment.StronglyInside;

      switch (this._maskPlanes!.classifyPointContainment(points, true)) {
        case ClipPlaneContainment.StronglyInside:
          return ClipPlaneContainment.StronglyOutside;
        case ClipPlaneContainment.StronglyOutside:
          return ClipPlaneContainment.StronglyInside;
        case ClipPlaneContainment.Ambiguous:
          return ClipPlaneContainment.Ambiguous;
      }
    }
    return (this.fetchClipPlanesRef() === undefined) ? ClipPlaneContainment.StronglyInside : this._clipPlanes!.classifyPointContainment(points, false);
  }

  public static isLimitEdge(limitValue: number, point0: Point3d, point1: Point3d): boolean {
    const tol = 1.0e-5 * limitValue;
    // High x-limit...
    if (Math.abs(point0.x - limitValue) < tol && Math.abs(point1.x - limitValue) < tol)
      return true;
    // Low x-limit...
    if (Math.abs(point0.x + limitValue) < tol && Math.abs(point1.x + limitValue) < tol)
      return true;

    // high y limit ...
    if (Math.abs(point0.y - limitValue) < tol && Math.abs(point1.y - limitValue) < tol)
      return true;
    // low y limit ...
    if (Math.abs(point0.y + limitValue) < tol && Math.abs(point1.y + limitValue) < tol)
      return true;

    return false;
  }

  /** Add an unbounded plane set (a) to the right of the line defined by two points, and (b) "ahead" of
   *  the start point (set is pushed to the set located within the PlaneSetParamsCache object given). This method can be used
   *  in the development of ClipShapes, by ClipShapes.
   */
  public static addOutsideEdgeSetToParams(x0: number, y0: number, x1: number, y1: number, pParams: PlaneSetParamsCache, isInvisible: boolean = false) {
    const unit0 = Vector3d.create();
    const vec0 = Vector3d.create(x1 - x0, y1 - y0, 0.0);
    const point0 = Point3d.create(x0 + pParams.localOrigin.x, y0 + pParams.localOrigin.y, 0.0);
    vec0.normalize(unit0);
    const unit1 = Vector3d.create(unit0.y, -unit0.x, 0.0);

    const convexSet = ConvexClipPlaneSet.createEmpty();
    convexSet.planes.push(ClipPlane.createNormalAndPoint(unit1, point0, isInvisible)!);
    convexSet.planes.push(ClipPlane.createNormalAndPoint(unit0, point0, isInvisible)!);
    convexSet.addZClipPlanes(isInvisible, pParams.zLow, pParams.zHigh);
    pParams.clipPlaneSet.convexSets.push(convexSet);
  }

  /**
   * Add a plane set representative of a 3d object based on the given array of 2d points and 3d parameters of the PlaneSetParamsCache,
   * where the returned value is stored in the params object given. The original points array given is not modified. This method
   * can be used in the development of ClipShapes, by ClipShapes.
   */
  public static addShapeToParams(shape: Point3d[], pFlags: number[], pParams: PlaneSetParamsCache) {
    const pPoints = shape.slice(0);
    // Add the closure point
    if (!pPoints[0].isExactEqual(pPoints[pPoints.length - 1]))
      pPoints.push(pPoints[0].clone());

    const area = PolygonOps.areaXY(pPoints);
    const n = pPoints.length;

    const point0 = Point3d.create();
    const point1 = Point3d.create();
    const vector0 = Vector3d.create();
    const vector1 = Vector3d.create();
    const point0Local = Point3d.create();
    let point1Local = Point3d.create();
    const zVector = Vector3d.create(0, 0, 1);
    let normal: Vector3d;
    let tangent: Vector3d;
    const convexSet = ConvexClipPlaneSet.createEmpty();
    const reverse = area < 0.0;

    for (let i = 0; i < n; i++ , point0.setFrom(point1), point0Local.setFrom(point1Local)) {
      point1Local = pPoints[i % n];
      point1Local.plus(pParams.localOrigin, point1);

      if (i && !point1.isAlmostEqual(point0!, 1.0e-8)) {
        const bIsLimitPlane = ClipPrimitive.isLimitEdge(pParams.limitValue, point0Local!, point1Local);
        const isInterior = (0 === (pFlags[i - 1] & 1)) || bIsLimitPlane;

        if (!pParams.focalLength) {
          tangent = Vector3d.createFrom(point1.minus(point0));
          normal = zVector.crossProduct(tangent).normalize()!;  // Assumes that cross product is never zero vector

          if (reverse)
            normal.negate(normal);

          convexSet.planes.push(ClipPlane.createNormalAndPoint(normal, point0, pParams.invisible, isInterior)!);
        } else {
          vector1.setFrom(point1);
          vector0.setFrom(point0);
          normal = vector1.crossProduct(vector0).normalize()!;
          if (reverse)
            normal.negate();
          convexSet.planes.push(ClipPlane.createNormalAndDistance(normal, 0.0, pParams.invisible, isInterior)!);
        }
      }
    }

    convexSet.addZClipPlanes(pParams.invisible, pParams.zLow, pParams.zHigh);

    if (convexSet.planes.length !== 0)
      pParams.clipPlaneSet.convexSets.push(convexSet);
  }
}

/**
 * A clipping volume defined by a shape (an array of 3d points using only x and y dimensions).
 * May be given either a ClipPlaneSet to store directly, or an array of polygon points as well as other parameters
 * for parsing clipplanes from the shape later.
 */
export class ClipShape extends ClipPrimitive {
  protected _polygon: Point3d[];
  protected _zLow: number | undefined;
  protected _zHigh: number | undefined;
  protected _isMask: boolean;
  protected _zLowValid: boolean;
  protected _zHighValid: boolean;
  // GPArrayP _gpa
  protected _bCurve: BSplineCurve3d | undefined;
  protected _transformValid: boolean;
  protected _transformFromClip: Transform | undefined;
  protected _transformToClip: Transform | undefined;

  protected constructor(polygon: Point3d[] = [], zLow?: number, zHigh?: number,
    transform?: Transform, isMask: boolean = false, invisible: boolean = false) {

    super(undefined, invisible);  // ClipPlaneSets will be set up later after storing points
    this._isMask = false;
    this._zLowValid = false;
    this._zHighValid = false;
    this._transformValid = false;

    this._polygon = polygon;
    this.initSecondaryProps(isMask, zLow, zHigh, transform);

  }

  /** Returns true if this ClipShape is marked as invisible. */
  public get invisible(): boolean { return this._invisible; }
  /** Return this transformFromClip, which may be undefined. */
  public get transformFromClip(): Transform | undefined { return this._transformFromClip; }
  /** Return this transformToClip, which may be undefined. */
  public get transformToClip(): Transform | undefined { return this._transformToClip; }
  /** Returns true if this ClipShape's transforms are currently set. */
  public get transformValid(): boolean { return this._transformValid; }
  /** Returns true if this ClipShape's lower z boundary is set. */
  public get zLowValid(): boolean { return this._zLowValid; }
  /** Returns true if this ClipShape's upper z boundary is set. */
  public get zHighValid(): boolean { return this._zHighValid; }
  /** Return this zLow, which may be undefined. */
  public get zLow(): number | undefined { return this._zLow; }
  /** Return this zHigh, which may be undefined. */
  public get zHigh(): number | undefined { return this._zHigh; }
  /** Returns a reference to this ClipShape's polygon array. */
  public get polygon(): Point3d[] { return this._polygon; }
  /** Return this bspline curve, which may be undefined. */
  public get bCurve(): BSplineCurve3d | undefined { return this._bCurve; }
  /** Returns true if this ClipShape is a masking set. */
  public get isMask(): boolean { return this._isMask; }

  /**
   * Returns true if this ClipShape has been parsed, and currently contains a ClipPlaneSet in its cache.
   * This does not take into account validity of the ClipPlanes, given that the polygon array might have changed.
   */
  public arePlanesDefined(): boolean {
    if (this._isMask)
      return this._maskPlanes !== undefined;
    return this._clipPlanes !== undefined;
  }

  /** Sets the polygon points array of this ClipShape to the array given (by reference). */
  public setPolygon(polygon: Point3d[]) {
    // Add closure point
    if (!polygon[0].isAlmostEqual(polygon[polygon.length - 1]))
      polygon.push(polygon[0].clone());
    this._polygon = polygon;
  }

  /**
   * If the clip plane set is already stored, return it. Otherwise, parse the clip planes out of the shape
   * defined by the set of polygon points.
   */
  public fetchClipPlanesRef(): UnionOfConvexClipPlaneSets {
    if (this._clipPlanes !== undefined)
      return this._clipPlanes;

    this._clipPlanes = UnionOfConvexClipPlaneSets.createEmpty();
    this.parseClipPlanes(this._clipPlanes);

    if (this._transformValid)
      this._clipPlanes!.transformInPlace(this._transformFromClip!);
    return this._clipPlanes;
  }

  /**
   * If the masking clip plane set is already stored, return it. Otherwise, parse the mask clip planes out of the shape
   * defined by the set of polygon points.
   */
  public fetchMaskPlanesRef(): UnionOfConvexClipPlaneSets | undefined {
    if (!this._isMask)
      return undefined;

    if (this._maskPlanes !== undefined)
      return this._maskPlanes;

    this._maskPlanes = UnionOfConvexClipPlaneSets.createEmpty();
    this.parseClipPlanes(this._maskPlanes);

    if (this._transformValid)
      this._maskPlanes.transformInPlace(this._transformFromClip!);
    return this._maskPlanes;
  }

  /**
   * Initialize the members of the ClipShape class that may at times be undefined.
   * zLow and zHigh default to Number.MAX_VALUE, and the transform defaults to an identity transform
   */
  public initSecondaryProps(isMask: boolean, zLow?: number, zHigh?: number, transform?: Transform) {
    this._isMask = isMask;

    this._zLowValid = (zLow !== undefined);
    if (false !== this._zLowValid)
      this._zLow = zLow!;
    else
      this._zLow = -Number.MAX_VALUE;

    this._zHighValid = (zHigh !== undefined);
    if (false !== this._zHighValid)
      this._zHigh = zHigh!;
    else
      this._zHigh = Number.MAX_VALUE;

    this._transformValid = (transform !== undefined);
    if (false !== this._transformValid) {
      this._transformFromClip = transform!;
      this._transformToClip = transform!.inverse();   // could be undefined
    } else {
      this._transformFromClip = Transform.createIdentity();
      this._transformToClip = Transform.createIdentity();
    }
  }

  public toJSON(): any {
    const val: any = {};
    val.shape = {};

    val.shape.points = [];
    for (const pt of this._polygon)
      val.shape.points.push(pt.toJSON());

    if (this.invisible)
      val.shape.invisible = true;

    if (this._transformFromClip && !this._transformFromClip.isIdentity())
      val.shape.trans = this._transformFromClip.toJSON();

    if (this.isMask)
      val.shape.mask = true;

    if (typeof (this.zLow) !== "undefined" && this.zLow !== -Number.MAX_VALUE)
      val.shape.zlow = this.zLow;

    if (typeof (this.zHigh) !== "undefined" && this.zHigh !== Number.MAX_VALUE)
      val.shape.zhigh = this.zHigh;

    return val;
  }

  public static fromJSON(json: any, result?: ClipShape): ClipShape | undefined {
    if (!json.shape) return undefined;

    const points: Point3d[] = [];
    if (json.shape.points)
      for (const pt of json.shape.points)
        points.push(Point3d.fromJSON(pt));

    let trans: Transform | undefined;
    if (json.shape.trans)
      trans = Transform.fromJSON(json.shape.trans);

    let zLow: number | undefined;
    if (json.shape.zlow)
      zLow = json.shape.zlow as number;

    let zHigh: number | undefined;
    if (json.shape.zhigh)
      zHigh = json.shape.zhigh as number;

    let isMask = false;
    if (json.shape.mask)
      isMask = json.shape.mask as boolean;

    let invisible = false;
    if (json.shape.invisible)
      invisible = true;

    return ClipShape.createShape(points, zLow, zHigh, trans, isMask, invisible, result);
  }

  /** Returns a new ClipShape that is a deep copy of the ClipShape given */
  public static createFrom(other: ClipShape, result?: ClipShape): ClipShape {
    const retVal = ClipShape.createEmpty(false, false, undefined, result);
    retVal._invisible = other._invisible;

    for (const point of other._polygon) {
      retVal._polygon.push(point.clone());
    }
    retVal._isMask = other._isMask;
    retVal._zLow = other._zLow;
    retVal._zHigh = other._zHigh;
    retVal._zLowValid = other._zLowValid;
    retVal._zHighValid = other._zHighValid;
    retVal._transformValid = other._transformValid;
    retVal._transformToClip = other._transformToClip ? other._transformToClip.clone() : undefined;
    retVal._transformFromClip = other._transformFromClip ? other._transformFromClip.clone() : undefined;
    retVal._bCurve = other._bCurve ? other._bCurve.clone() : undefined;
    // TODO: COPY _gpa AS WELL, ONCE IT IS IMPLEMENTED

    return retVal;
  }

  /** Create a new ClipShape from an array of points that make up a 2d shape (stores a deep copy of these points). */
  public static createShape(polygon: Point3d[] = [], zLow?: number, zHigh?: number,
    transform?: Transform, isMask: boolean = false, invisible: boolean = false, result?: ClipShape): ClipShape | undefined {
    if (polygon.length < 3)
      return undefined;

    const pPoints = polygon.slice(0);
    // Add closure point
    if (!pPoints[0].isExactEqual(pPoints[pPoints.length - 1]))
      pPoints.push(pPoints[0]);

    if (result) {
      result._clipPlanes = undefined;   // Start as undefined
      result._maskPlanes = undefined;   // Start as undefined
      result._invisible = invisible;
      result._polygon = pPoints;
      result.initSecondaryProps(isMask, zLow, zHigh, transform);
      return result;
    } else {
      return new ClipShape(pPoints, zLow, zHigh, transform, isMask, invisible);
    }
  }

  /**
   * Create a ClipShape that exists as a 3 dimensional box of the range given. Optionally choose to
   * also store this shape's zLow and zHigh members from the range through the use of a ClipMask.
   */
  public static createBlock(extremities: Range3d, clipMask: ClipMask, isMask: boolean = false, invisible: boolean = false, transform?: Transform, result?: ClipShape): ClipShape {
    const low = extremities.low;
    const high = extremities.high;
    const blockPoints: Point3d[] = [];

    for (let i = 0; i < 5; i++)
      blockPoints.push(Point3d.create());

    blockPoints[0].x = blockPoints[3].x = blockPoints[4].x = low.x;
    blockPoints[1].x = blockPoints[2].x = high.x;

    blockPoints[0].y = blockPoints[1].y = blockPoints[4].y = low.y;
    blockPoints[2].y = blockPoints[3].y = high.y;

    return ClipShape.createShape(blockPoints, (ClipMask.None !== (clipMask & ClipMask.ZLow)) ? low.z : undefined,
      ClipMask.None !== (clipMask & ClipMask.ZHigh) ? high.z : undefined, transform, isMask, invisible, result)!;
  }

  /** Creates a new ClipShape with undefined members and a polygon points array of zero length. */
  public static createEmpty(isMask = false, invisible: boolean = false, transform?: Transform, result?: ClipShape): ClipShape {
    if (result) {
      result._clipPlanes = undefined;
      result._maskPlanes = undefined;
      result._invisible = invisible;
      result._bCurve = undefined;
      result._polygon.length = 0;
      result.initSecondaryProps(isMask, undefined, undefined, transform);
      return result;
    }
    return new ClipShape([], undefined, undefined, transform, isMask, invisible);
  }

  /** Checks to ensure that the member polygon has an area, and that the polygon is closed. */
  public isValidPolygon(): boolean {
    if (this._polygon.length < 3)
      return false;
    if (!this._polygon[0].isExactEqual(this._polygon[this._polygon.length - 1]))
      return false;
    return true;
  }

  /** Returns a deep copy of this instance of ClipShape, storing in an optional result */
  public clone(result?: ClipShape): ClipShape {
    return ClipShape.createFrom(this, result);
  }

  /** Given the current polygon data, parses clip planes that together form an object, storing the result in the set given, either clipplanes or maskplanes. */
  private parseClipPlanes(set: UnionOfConvexClipPlaneSets) {
    const points = this._polygon;
    if (points.length === 3 && !this._isMask && points[0].isExactEqual(points[points.length - 1])) {
      this.parseLinearPlanes(set, this._polygon[0], this._polygon[1]);
      return true;
    }

    const direction = PolygonOps.testXYPolygonTurningDirections(points);
    if (0 !== direction) {
      this.parseConvexPolygonPlanes(set, direction);
      return true;
    } else {
      // TODO: HANDLE CONCAVE POLYGONS
      return false;
    }
  }

  private parseLinearPlanes(set: UnionOfConvexClipPlaneSets, start: Point3d, end: Point3d, cameraFocalLength?: number): boolean {
    // Handles the degenerate case of 2 distinct points (used by select by line).
    const normal = start.vectorTo(end);

    if (normal.magnitude() === 0.0)
      return false;
    normal.normalize(normal);

    const convexSet = ConvexClipPlaneSet.createEmpty();

    if (cameraFocalLength === undefined) {
      const perpendicular = Vector2d.create(-normal.y, normal.x);

      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(normal.x, normal.y), Point3d.createFrom(start), this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(-normal.x, -normal.y), Point3d.createFrom(end), this._invisible)!);

      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(perpendicular.x, perpendicular.y), Point3d.createFrom(start), this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(-perpendicular.x, -perpendicular.y), Point3d.createFrom(start), this._invisible)!);
    } else {
      const start3d = Point3d.create(start.x, start.y, -cameraFocalLength);
      const end3d = Point3d.create(end.x, end.y, -cameraFocalLength);
      const vecEnd3d = Vector3d.createFrom(end3d);
      const perpendicular = vecEnd3d.crossProduct(Vector3d.createFrom(start3d)).normalize();
      let endNormal = Vector3d.createFrom(start3d).crossProduct(perpendicular!).normalize();

      convexSet.planes.push(ClipPlane.createNormalAndDistance(perpendicular!, 0.0, this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndDistance(endNormal!, 0.0, this._invisible)!);

      perpendicular!.negate();
      endNormal = vecEnd3d.crossProduct(perpendicular!).normalize();
      convexSet.planes.push(ClipPlane.createNormalAndDistance(perpendicular!, 0.0, this._invisible)!);
      convexSet.planes.push(ClipPlane.createNormalAndDistance(endNormal!, 0.0, this._invisible)!);
    }

    convexSet.addZClipPlanes(this._invisible, this._zLow, this._zHigh);
    set.addConvexSet(convexSet);
    return true;
  }

  private parseConvexPolygonPlanes(set: UnionOfConvexClipPlaneSets, direction: number, cameraFocalLength?: number): boolean {
    const samePointTolerance = 1.0e-8;    // This could possibly be replaced with more widely used constants
    const edges: PolyEdge[] = [];
    const reverse = (direction < 0) !== this._isMask;
    const polygon = this._polygon;
    const numVerts = this._polygon.length;

    for (let i = 0; i < numVerts - 1; i++) {
      const z = (cameraFocalLength === undefined) ? 0.0 : -cameraFocalLength;
      const dir = Vector2d.createFrom((polygon[i + 1].minus(polygon[i])));
      const magnitude = dir.magnitude();
      dir.normalize(dir);

      if (magnitude > samePointTolerance) {
        const normal = Vector2d.create(reverse ? dir.y : -dir.y, reverse ? -dir.x : dir.x);
        edges.push(new PolyEdge(polygon[i], polygon[i + 1], normal, z));
      }
    }
    if (edges.length < 3) {
      return false;
    }
    if (this._isMask) {
      const last = edges.length - 1;
      for (let i = 0; i <= last; i++) {
        const edge = edges[i];
        const prevEdge = edges[i ? (i - 1) : last];
        const nextEdge = edges[(i === last) ? 0 : (i + 1)];
        const convexSet = ConvexClipPlaneSet.createEmpty();

        const prevNormal = edge.normal.minus(prevEdge.normal);
        const nextNormal = edge.normal.minus(nextEdge.normal);

        prevNormal.normalize(prevNormal);
        nextNormal.normalize(nextNormal);

        // Create three-sided fans from each edge.   Note we could define the correct region
        // with only two planes for edge, but cannot then designate the "interior" status of the edges accurately.
        convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(prevNormal.x, prevNormal.y), edge.origin, this._invisible, true)!);
        convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(edge.normal.x, edge.normal.y), edge.origin, this._invisible, false)!);
        convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(nextNormal.x, nextNormal.y), nextEdge.origin, this._invisible, true)!);

        convexSet.addZClipPlanes(this._invisible, this._zLow, this._zHigh);
        set.addConvexSet(convexSet);
      }
      set.addOutsideZClipSets(this._invisible, this._zLow, this._zHigh);
    } else {
      const convexSet = ConvexClipPlaneSet.createEmpty();

      if (cameraFocalLength === undefined) {
        for (const edge of edges)
          convexSet.planes.push(ClipPlane.createNormalAndPoint(Vector3d.create(edge.normal.x, edge.normal.y), edge.origin)!);
      } else {
        if (reverse)
          for (const edge of edges)
            convexSet.planes.push(ClipPlane.createNormalAndDistance(
              Vector3d.createFrom(edge.origin).crossProduct(Vector3d.createFrom(edge.next)).normalize()!, 0.0)!);
        else
          for (const edge of edges)
            convexSet.planes.push(ClipPlane.createNormalAndDistance(
              Vector3d.createFrom(edge.next).crossProduct(Vector3d.createFrom(edge.origin)).normalize()!, 0.0)!);
      }

      convexSet.addZClipPlanes(this._invisible, this._zLow, this._zHigh);
      set.addConvexSet(convexSet);
    }

    return true;
  }

  /** Get the 3-dimensional range that this combination of ClipPlanes bounds in space. Returns the range/result
   *  if successful, otherwise, returns undefined. Transform will only be used for transforming the polygon points if clipplanes/maskplanes
   *  have not yet been set. Otherwise, we return the range of the planes without an applied transform.
   */
  public getRange(returnMaskRange: boolean = false, transform?: Transform, result?: Range3d): Range3d | undefined {
    let zHigh = Number.MAX_VALUE;
    let zLow = -Number.MAX_VALUE;
    transform = (transform === undefined) ? Transform.createIdentity() : transform;

    if (this._transformToClip !== undefined)
      transform.setMultiplyTransformTransform(transform, this._transformFromClip!);

    if ((!returnMaskRange && this._isMask) || this._polygon === undefined)
      return undefined;

    if (this._zLowValid)
      zLow = this._zLow!;
    if (this._zHighValid)
      zHigh = this._zHigh!;

    const range = Range3d.createNull(result);

    for (const point of this._polygon) {
      const shapePts: Point3d[] = [
        Point3d.create(point.x, point.y, zLow),
        Point3d.create(point.x, point.y, zHigh),
      ];
      transform.multiplyPoint3dArray(shapePts, shapePts);

      range.extend(shapePts[0], shapePts[1]);
    }
    if (range.isNull()) {
      return undefined;
    }
    return range;
  }

  /** Return true if the point lies inside/on this polygon (or not inside/on if this polygon is a mask). Otherwise, return false. */
  public pointInside(point: Point3d, onTolerance: number = Geometry.smallMetricDistanceSquared): boolean {
    if (this.fetchMaskPlanesRef() !== undefined)
      return !this._maskPlanes!.isPointOnOrInside(point, onTolerance);

    return this.fetchClipPlanesRef().isPointOnOrInside(point, onTolerance);
  }

  public transformInPlace(transform: Transform): boolean {
    if (transform.isIdentity())
      return true;

    this.transformInPlaceSuper(transform);

    if (this._transformValid)
      transform.multiplyTransformTransform(this._transformFromClip!, this._transformFromClip);
    else
      this._transformFromClip = transform;

    this._transformToClip = this._transformFromClip!.inverse(); // could be undefined
    this._transformValid = true;
    return true;
  }

  public multiplyPlanesTimesMatrix(matrix: Matrix4d): boolean {
    if (this._isMask)
      return false;

    this._clipPlanes = UnionOfConvexClipPlaneSets.createEmpty();
    this._maskPlanes = undefined;
    this.parseClipPlanes(this._clipPlanes);
    this._clipPlanes.multiplyPlanesByMatrix(matrix);

    return true;
  }

  public isXYPolygon(): boolean {
    if (this._polygon.length === 0)   // Note: This is a lenient check, as points array could also contain less than 3 points (not a polygon)
      return false;
    if (this._transformFromClip === undefined)
      return true;

    const testPoint = Vector3d.create(0.0, 0.0, 1.0);
    this._transformFromClip.multiplyVectorXYZ(testPoint.x, testPoint.y, testPoint.z, testPoint);

    return testPoint.magnitudeXY() < 1.0e-8;
  }

  /** Transform the input point using this instance's transformToClip member */
  public performTransformToClip(point: Point3d) {
    if (this._transformToClip !== undefined)
      this._transformToClip.multiplyPoint3d(point);
  }

  /** Transform the input point using this instance's transformFromClip member */
  public performTransformFromClip(point: Point3d) {
    if (this._transformFromClip !== undefined)
      this._transformFromClip.multiplyPoint3d(point);
  }
}
