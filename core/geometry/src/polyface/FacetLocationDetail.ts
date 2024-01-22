/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { TriangleLocationDetail } from "../geometry3d/BarycentricTriangle";
import { Geometry, PolygonLocation } from "../Geometry";
import { PolyfaceVisitor } from "./Polyface";
import { PolygonLocationDetail, PolygonOps } from "../geometry3d/PolygonOps";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { IndexedXYCollection } from "../geometry3d/IndexedXYCollection";
import { NumberArray } from "../geometry3d/PointHelpers";

/** Callback for processing the detail for an intersected facet.
 * @param detail reference to the intersection data, with `detail.IsInsideOn === true`. Note that `detail` is owned by the caller; to persist, use `detail.clone`.
 * @param visitor at currently intersected facet
 * @returns true to accept this intersection and stop processing; false to continue to the next facet
 * @public
 */
export type FacetIntersectCallback = (detail: FacetLocationDetail, visitor: PolyfaceVisitor) => boolean;

/** Options for computing and processing facet intersection methods.
 * @see PolyfaceQuery.intersectRay3d
 * @public
 */
export class FacetIntersectOptions {
  /** distance tolerance for testing coincidence with facet boundary */
  public distanceTolerance: number;
  /** fractional tolerance for snapping barycentric coordinates to a triangular facet edge */
  public parameterTolerance: number;
  /** whether to compute the normal at the intersection point */
  public needNormal?: boolean;
  /** whether to compute the uv parameter at the intersection point */
  public needParam?: boolean;
  /** whether to compute the color at the intersection point */
  public needColor?: boolean;
  /** whether to compute the barycentric coordinates of the point for a convex facet */
  public needBarycentricCoordinates?: boolean;
  /** optional callback to accept an intersected facet */
  public acceptIntersection?: FacetIntersectCallback;
  /** constructor with defaults */
  public constructor() {
    this.distanceTolerance = Geometry.smallMetricDistance;
    this.parameterTolerance = Geometry.smallFraction;
  }
}
/**
 * Carries data about a point in the plane of a facet of a mesh.
 * @see PolyfaceQuery.intersectRay3d
 * @public
 */
export interface FacetLocationDetail {
  /** Get the index of the referenced facet. */
  get facetIndex(): number;
  /** Get the number of edges of this facet. */
  get edgeCount(): number;
  /** Get the world coordinates of the point. */
  get point(): Point3d;
  /** Get the application-specific number. */
  get a(): number;
  /** Get the projection of the point onto the closest facet edge. */
  get closestEdge(): { startVertexIndex: number, edgeParam: number };
  /** Whether this instance specifies a valid location. */
  get isValid(): boolean;
  /** Whether the facet is convex. */
  get isConvex(): boolean;
  /** Whether the point is inside or on the facet. */
  get isInsideOrOn(): boolean;
  /** Get the code that classifies the location of the point with respect to the facet. */
  get classify(): PolygonLocation;
  /** Clone the instance */
  clone(): FacetLocationDetail;
  /** Set the instance contents from the other detail */
  copyContentsFrom(other: FacetLocationDetail): void;
  /** Get reference to cached normal interpolated from facet data. Inputs may be used to compute the cache. */
  getNormal(facetNormals?: IndexedXYZCollection, facetVertices?: IndexedXYZCollection, distanceTolerance?: number): Vector3d | undefined;
  /** Get reference to cached uv parameter interpolated from facet data. Inputs may be used to compute the cache. */
  getParam(facetParams?: IndexedXYCollection, facetVertices?: IndexedXYZCollection, distanceTolerance?: number): Point2d | undefined;
  /** Get cached color interpolated from facet data. Inputs may be used to compute the cache. */
  getColor(facetColors?: number[], facetVertices?: IndexedXYZCollection, distanceTolerance?: number): number | undefined;
  /** Get reference to cached barycentric coordinates of the point. Inputs may be used to compute the cache. */
  getBarycentricCoordinates(facetVertices?: IndexedXYZCollection, distanceTolerance?: number): number[] | undefined;
}

/**
 * A pair of FacetLocationDetail.
 * @public
 */
export class FacetLocationDetailPair {
  /** The first of the two details. */
  public detailA: FacetLocationDetail;
  /** The second of the two details. */
  public detailB: FacetLocationDetail;

  /** Constructor, captures inputs */
  private constructor(detailA: FacetLocationDetail, detailB: FacetLocationDetail) {
    this.detailA = detailA;
    this.detailB = detailB;
  }
  /** Create a facet detail pair, capturing inputs. */
  public static create(detailA: FacetLocationDetail, detailB: FacetLocationDetail): FacetLocationDetailPair {
    return new FacetLocationDetailPair(detailA, detailB);
  }
}

/**
 * Implementation of `FacetLocationDetail` for a triangular facet.
 * @public
 */
export class TriangularFacetLocationDetail implements FacetLocationDetail {
  private _facetIndex: number;
  private _detail: TriangleLocationDetail;
  private _normal?: Vector3d;
  private _param?: Point2d;
  private _color?: number;

  /** captures the detail if provided */
  private constructor(facetIndex: number = -1, detail?: TriangleLocationDetail) {
    this._facetIndex = facetIndex;
    this._detail = detail ? detail : TriangleLocationDetail.create();
  }
  /** Invalidate this detail. */
  public invalidate(deep: boolean = true) {
    this._facetIndex = -1;
    if (deep)
      this._detail.invalidate();
    this._normal = undefined;
    this._param = undefined;
    this._color = undefined;
  }
  /** Create a detail.
   * @param detail optional, copied if given
   * @param result optional pre-allocated object to fill and return
   */
  public static create(facetIndex: number = -1, detail?: TriangleLocationDetail, result?: TriangularFacetLocationDetail): TriangularFacetLocationDetail {
    if (!result)
      result = new TriangularFacetLocationDetail();
    else
      result.invalidate(false);   // shallow: detail might be owned by result!
    result._facetIndex = facetIndex;
    if (undefined !== detail && result._detail !== detail)
      result._detail.copyContentsFrom(detail);
    return result;
  }
  /** Create a detail, capturing inputs. */
  public static createCapture(facetIndex: number, detail: TriangleLocationDetail): TriangularFacetLocationDetail {
    return new TriangularFacetLocationDetail(facetIndex, detail);
  }
  /** Get the facet index. */
  public get facetIndex(): number {
    return this._facetIndex;
  }
  /** Get the edge count of this facet. */
  public get edgeCount(): number {
    return 3;
  }
  /** Get the world coordinates of the point. */
  public get point(): Point3d {
    return this._detail.world;
  }
  /** Get the application-specific number. */
  public get a(): number {
    return this._detail.a;
  }
  /** Get the projection of the point onto the closest facet edge. */
  public get closestEdge(): { startVertexIndex: number, edgeParam: number } {
    return { startVertexIndex: this._detail.closestEdgeIndex, edgeParam: this._detail.closestEdgeParam };
  }
  /** Test validity of fields other than _detail. */
  private get _isValid(): boolean {
    return this._facetIndex >= 0;
  }
  /** Whether this instance specifies a valid location. */
  public get isValid(): boolean {
    return this._isValid && this._detail.isValid;
  }
  /** Whether the facet is convex. */
  public get isConvex(): boolean {
    return true;
  }
  /** Whether the point is inside or on the polygon. */
  public get isInsideOrOn(): boolean {
    return this._isValid && this._detail.isInsideOrOn;
  }
  /** Get the code that classifies the location of the point with respect to the facet. */
  public get classify(): PolygonLocation {
    return this._detail.classify;
  }
  /** Clone the instance */
  public clone(): TriangularFacetLocationDetail {
    const detail = new TriangularFacetLocationDetail();
    detail.copyContentsFrom(this);
    return detail;
  }
  /** Set the instance contents from the other detail.
   * @param other detail to clone
   */
  public copyContentsFrom(other: TriangularFacetLocationDetail) {
    this._facetIndex = other._facetIndex;
    this._detail.copyContentsFrom(other._detail);
    this._normal = other._normal?.clone();
    this._param = other._param?.clone();
    this._color = other._color;
  }
  /** Get normal interpolated from facet data.
   * @param facetNormals used to compute the normal cache
   * @returns reference to cached normal
   */
  public getNormal(facetNormals?: IndexedXYZCollection): Vector3d | undefined {
    if (this._detail.isValid && undefined === this._normal && undefined !== facetNormals) {
      this._normal = Vector3d.create();
      const scales = [this._detail.local.x, this._detail.local.y, this._detail.local.z];
      facetNormals.linearCombination(scales, this._normal);
    }
    return this._normal;
  }
  /** Get uv parameter interpolated from facet data.
   * @param facetParams used to compute the uv parameter cache
   * @returns reference to cached uv parameter
   */
  public getParam(facetParams?: IndexedXYCollection): Point2d | undefined {
    if (this._detail.isValid && undefined === this._param && undefined !== facetParams) {
      this._param = Point2d.create();
      const scales = [this._detail.local.x, this._detail.local.y, this._detail.local.z];
      facetParams.linearCombination(scales, this._param);
    }
    return this._param;
  }
  /** Get color interpolated from facet data.
   * * Assumes barycentric coordinates are already computed in the TriangleLocationDetail member.
   * @param facetColors used to compute the color cache
   * @returns cached color
   */
  public getColor(facetColors?: number[]): number | undefined {
    if (this._detail.isValid && undefined === this._color && undefined !== facetColors) {
      const scales = [this._detail.local.x, this._detail.local.y, this._detail.local.z];
      this._color = NumberArray.linearCombinationOfColors(facetColors, scales);
    }
    return this._color;
  }
  /** Get the barycentric coordinates of this location.
   * @returns cached barycentric coordinates
  */
  public getBarycentricCoordinates(): number[] {
    return [this._detail.local.x, this._detail.local.y, this._detail.local.z];
  }
}
/**
 * Implementation of `FacetLocationDetail` for a general facet, which may or may not be convex.
 * * Facet vertex data interpolation is not available.
 * @public
 */
export class NonConvexFacetLocationDetail implements FacetLocationDetail {
  private _facetIndex: number;
  private _edgeCount: number;
  protected _detail: PolygonLocationDetail;

  /** captures the detail if provided */
  protected constructor(facetIndex: number = -1, edgeCount: number = 0, detail?: PolygonLocationDetail) {
    this._facetIndex = facetIndex;
    this._edgeCount = edgeCount;
    this._detail = detail ? detail : PolygonLocationDetail.create();
  }
  /** Invalidate this detail. */
  public invalidate(deep: boolean = true) {
    this._facetIndex = -1;
    this._edgeCount = 0;
    if (deep)
      this._detail.invalidate();
  }
  /** Create a detail.
   * @param detail optional, copied if given
   * @param result optional pre-allocated object to fill and return
   */
  public static create(facetIndex: number = -1, edgeCount: number = 0, detail?: PolygonLocationDetail, result?: NonConvexFacetLocationDetail): NonConvexFacetLocationDetail {
    if (!result)
      result = new NonConvexFacetLocationDetail();
    else
      result.invalidate(false);   // shallow: detail might be owned by result!
    result._facetIndex = facetIndex;
    result._edgeCount = edgeCount;
    if (undefined !== detail && result._detail !== detail)
      result._detail.copyContentsFrom(detail);
    return result;
  }
  /** Create a detail, capturing inputs. */
  public static createCapture(facetIndex: number, edgeCount: number, detail: PolygonLocationDetail): NonConvexFacetLocationDetail {
    return new NonConvexFacetLocationDetail(facetIndex, edgeCount, detail);
  }
  /** Get the facet index. */
  public get facetIndex(): number {
    return this._facetIndex;
  }
  /** Get the edge count of this facet. */
  public get edgeCount(): number {
    return this._edgeCount;
  }
  /** Get the world coordinates of the point. */
  public get point(): Point3d {
    return this._detail.point;
  }
  /** Get the application-specific number. */
  public get a(): number {
    return this._detail.a;
  }
  /** Get the projection of the point onto the closest facet edge. */
  public get closestEdge(): { startVertexIndex: number, edgeParam: number } {
    return { startVertexIndex: this._detail.closestEdgeIndex, edgeParam: this._detail.closestEdgeParam };
  }
  /** Test validity of fields other than _detail. */
  private get _isValid(): boolean {
    return this._facetIndex >= 0 && this._edgeCount >= 3;
  }
  /** Whether this instance specifies a valid location. */
  public get isValid(): boolean {
    return this._isValid && this._detail.isValid;
  }
  /** Whether the facet is convex. Always returns false, as convexity is unknown to this detail. */
  public get isConvex(): boolean {
    return false;
  }
  /** Whether the point is inside or on the polygon. */
  public get isInsideOrOn(): boolean {
    return this._isValid && this._detail.isInsideOrOn;
  }
  /** Get the code that classifies the location of the point with respect to the facet. */
  public get classify(): PolygonLocation {
    return this._detail.code;
  }
  /** Clone the instance */
  public clone(): NonConvexFacetLocationDetail {
    const detail = new NonConvexFacetLocationDetail();
    detail.copyContentsFrom(this);
    return detail;
  }
  /** Set the instance contents from the other detail.
   * @param other detail to clone
   */
  public copyContentsFrom(other: NonConvexFacetLocationDetail) {
    this._facetIndex = other._facetIndex;
    this._edgeCount = other._edgeCount;
    this._detail.copyContentsFrom(other._detail);
  }
  /** Interpolated data is not defined for a non-convex facet.
   * @returns undefined
  */
  public getNormal(): Vector3d | undefined {
    return undefined;
  }
  /** Interpolated data is not defined for a non-convex facet.
   * @returns undefined
  */
  public getParam(): Point2d | undefined {
    return undefined;
  }
  /** Interpolated data is not defined for a non-convex facet.
   * @returns undefined
  */
  public getColor(): number | undefined {
    return undefined;
  }
  /** Barycentric coordinates are not defined for a non-convex facet.
   * @returns undefined
   */
  public getBarycentricCoordinates(): number[] | undefined {
    return undefined;
  }
}
/**
 * Implementation of `FacetLocationDetail` for a convex facet.
 * * If `edgeCount` is 3, `TriangularFacetLocationDetail` is more efficient.
 * @public
 */
export class ConvexFacetLocationDetail extends NonConvexFacetLocationDetail {
  private _normal?: Vector3d;
  private _param?: Point2d;
  private _color?: number;
  private _barycentricCoordinates?: number[];

  /** captures the detail if provided */
  private constructor(facetIndex: number = -1, edgeCount: number = 0, detail?: PolygonLocationDetail) {
    super(facetIndex, edgeCount, detail);
  }
  /** Invalidate this detail. */
  public override invalidate(deep: boolean = true) {
    super.invalidate(deep);
    this._normal = undefined;
    this._param = undefined;
    this._color = undefined;
    this._barycentricCoordinates = undefined;
  }
  /** Create a detail.
   * @param detail optional, copied if given
   * @param result optional pre-allocated object to fill and return
   */
  public static override create(facetIndex: number = -1, edgeCount: number = 0, detail?: PolygonLocationDetail, result?: ConvexFacetLocationDetail): ConvexFacetLocationDetail {
    if (!result)
      result = new ConvexFacetLocationDetail();
    else
      result.invalidate(false);   // shallow: detail might be owned by result!
    return super.create(facetIndex, edgeCount, detail, result);
  }
  /** Create a detail, capturing inputs. */
  public static override createCapture(facetIndex: number, edgeCount: number, detail: PolygonLocationDetail): ConvexFacetLocationDetail {
    return new ConvexFacetLocationDetail(facetIndex, edgeCount, detail);
  }
  /** Whether the facet is convex. */
  public override get isConvex(): boolean {
    return true;
  }
  /** Clone the instance */
  public override clone(): ConvexFacetLocationDetail {
    const detail = new ConvexFacetLocationDetail();
    detail.copyContentsFrom(this);
    return detail;
  }
  /** Set the instance contents from the other detail.
   * @param other detail to clone
   */
  public override copyContentsFrom(other: ConvexFacetLocationDetail) {
    super.copyContentsFrom(other);
    this._normal = other._normal?.clone();
    this._param = other._param?.clone();
    this._color = other._color;
    this._barycentricCoordinates = other._barycentricCoordinates?.slice();
  }
  /** Get normal interpolated from facet data.
   * @param facetNormals used to compute the normal cache
   * @param facetVertices used to compute the barycentric coordinate cache
   * @param distanceTolerance used to compute the barycentric coordinate cache
   * @returns reference to cached normal
   */
  public override getNormal(facetNormals?: IndexedXYZCollection, facetVertices?: IndexedXYZCollection, distanceTolerance: number = Geometry.smallMetricDistance): Vector3d | undefined {
    if (this._detail.isValid && undefined === this._normal && undefined !== facetNormals) {
      const scales = this.getBarycentricCoordinates(facetVertices, distanceTolerance);
      if (undefined !== scales) {
        this._normal = Vector3d.create();
        facetNormals.linearCombination(scales, this._normal);
      }
    }
    return this._normal;
  }
  /** Get uv parameter interpolated from facet data.
   * @param facetParams used to compute the uv parameter cache
   * @param facetVertices used to compute the barycentric coordinate cache
   * @param distanceTolerance used to compute the barycentric coordinate cache
   * @returns reference to cached uv parameter
   */
  public override getParam(facetParams?: IndexedXYCollection, facetVertices?: IndexedXYZCollection, distanceTolerance: number = Geometry.smallMetricDistance): Point2d | undefined {
    if (this._detail.isValid && undefined === this._param && undefined !== facetParams) {
      const scales = this.getBarycentricCoordinates(facetVertices, distanceTolerance);
      if (undefined !== scales) {
        this._param = Point2d.create();
        facetParams.linearCombination(scales, this._param);
      }
    }
    return this._param;
  }
  /** Get color interpolated from facet data.
   * @param facetColors used to compute the color cache
   * @param facetVertices used to compute the barycentric coordinate cache
   * @param distanceTolerance used to compute the barycentric coordinate cache
   * @returns cached color
   */
  public override getColor(facetColors?: number[], facetVertices?: IndexedXYZCollection, distanceTolerance: number = Geometry.smallMetricDistance): number | undefined {
    if (this._detail.isValid && undefined === this._color && undefined !== facetColors) {
      const scales = this.getBarycentricCoordinates(facetVertices, distanceTolerance);
      if (undefined !== scales)
        this._color = NumberArray.linearCombinationOfColors(facetColors, scales);
    }
    return this._color;
  }
  /** Get the barycentric coordinates of this location, if they have been computed.
   * @param facetVertices used to compute the barycentric coordinate cache
   * @param distanceTolerance used to compute the barycentric coordinate cache
   * @returns cached barycentric coordinates
  */
  public override getBarycentricCoordinates(facetVertices?: IndexedXYZCollection, distanceTolerance: number = Geometry.smallMetricDistance): number[] | undefined {
    if (this._detail.isValid && undefined === this._barycentricCoordinates && undefined !== facetVertices) {
      this._barycentricCoordinates = PolygonOps.convexBarycentricCoordinates(facetVertices, this._detail.point, distanceTolerance);
    }
    return this._barycentricCoordinates;
  }
}
