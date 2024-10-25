/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Vector3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { IndexedPolyface, PolyfaceVisitor } from "./Polyface";
import { PolyfaceData } from "./PolyfaceData";

/**
 * An `IndexedPolyfaceVisitor` is an iterator-like object that "visits" facets of a mesh.
 * * The visitor extends `PolyfaceData`, so it can at any time hold all the data of a single facet.
 * @public
 */
export class IndexedPolyfaceVisitor extends PolyfaceData implements PolyfaceVisitor {
  private _currentFacetIndex: number;
  private _nextFacetIndex: number;
  private _numWrap: number;
  private _numEdges: number;
  private _polyface: IndexedPolyface;
  // to be called from static factory method that validates the polyface
  protected constructor(polyface: IndexedPolyface, numWrap: number) {
    super(polyface.data.normalCount > 0, polyface.data.paramCount > 0, polyface.data.colorCount > 0, polyface.twoSided);
    this._polyface = polyface;
    this._numWrap = numWrap;
    if (polyface.data.auxData)
      this.auxData = polyface.data.auxData.createForVisitor();
    this.reset();
    this._numEdges = 0;
    this._nextFacetIndex = 0;
    this._currentFacetIndex = -1;

  }
  /** Return the client polyface object. */
  public clientPolyface(): IndexedPolyface {
    return this._polyface;
  }
  /** Return the number of facets this visitor is able to visit. */
  public getVisitableFacetCount(): number {
    return this._polyface.facetCount;
  }
  /**
   * Set the number of vertices replicated in visitor arrays (both data and index arrays).
   * * 0,1,2 are the most common as numWrap.
   * * Example: suppose `[6,7,8]` is the pointIndex array representing a triangle. First edge would be `6,7`. Second
   * edge is `7,8`. Third edge is `8,6`. To access `6` for the third edge, we have to go back to the start of array.
   * Therefore, it is useful to store `6` at the end of pointIndex array, i.e., `[6,7,8,6]` meaning `numWrap = 1`.
   * Continuing this example, `numWrap = 2` (i.e., `[6,7,8,6,7]`) is useful when each vertex visit requires the next
   * two points, e.g., to form two adjacent vectors for a cross product.
   */
  public setNumWrap(numWrap: number) {
    this._numWrap = numWrap;
  }
  /**
   * Return the number of edges in the current facet.
   * * If `numWrap > 0` for this visitor, the number of edges is smaller than the number of points.
   */
  public get numEdgesThisFacet(): number {
    return this._numEdges;
  }
  /** Create a visitor for iterating the facets of `polyface`. */
  public static create(polyface: IndexedPolyface, numWrap: number): IndexedPolyfaceVisitor {
    return new IndexedPolyfaceVisitor(polyface, numWrap);
  }
  /** Advance the iterator to a particular facet in the client polyface. */
  public moveToReadIndex(facetIndex: number): boolean {
    if (!this._polyface.isValidFacetIndex(facetIndex))
      return false;
    this._currentFacetIndex = facetIndex;
    this._nextFacetIndex = facetIndex + 1;
    this._numEdges = this._polyface.numEdgeInFacet(facetIndex);
    this.resizeAllArrays(this._numEdges + this._numWrap);
    this.gatherIndexedData(
      this._polyface.data,
      this._polyface.facetIndex0(this._currentFacetIndex),
      this._polyface.facetIndex1(this._currentFacetIndex),
      this._numWrap,
    );
    return true;
  }
  /** Advance the iterator to a the 'next' facet in the client polyface. */
  public moveToNextFacet(): boolean {
    if (this._nextFacetIndex !== this._currentFacetIndex)
      return this.moveToReadIndex(this._nextFacetIndex);
    this._nextFacetIndex++;
    return true;
  }
  /** Reset the iterator to start at the first facet of the polyface. */
  public reset(): void {
    this.moveToReadIndex(0);
    this._nextFacetIndex = 0; // so immediate moveToNextFacet stays here.
  }
  /**
   * Attempts to extract the distance parameter for the given vertex `index` on the current facet.
   * Returns the distance parameter as a point. Returns `undefined` on failure.
   */
  public tryGetDistanceParameter(index: number, result?: Point2d): Point2d | undefined {
    if (index < 0 || index >= this.numEdgesThisFacet)
      return undefined;
    if (this.param === undefined || this._polyface.data.face.length === 0)
      return undefined;
    const faceData = this._polyface.tryGetFaceData(this._currentFacetIndex);
    if (!faceData)
      return undefined;
    return faceData.convertParamXYToDistance(
      this.param.getXAtUncheckedPointIndex(index),
      this.param.getYAtUncheckedPointIndex(index),
      result,
    );
  }
  /**
   * Attempts to extract the normalized parameter (0,1) for the given vertex `index` on the current facet.
   * Returns the normalized parameter as a point. Returns `undefined` on failure.
   */
  public tryGetNormalizedParameter(index: number, result?: Point2d): Point2d | undefined {
    if (index < 0 || index >= this.numEdgesThisFacet)
      return undefined;
    if (this.param === undefined || this._polyface.data.face.length === 0)
      return undefined;
    const faceData = this._polyface.tryGetFaceData(this._currentFacetIndex);
    if (!faceData)
      return undefined;
    return faceData.convertParamXYToNormalized(
      this.param.getXAtUncheckedPointIndex(index),
      this.param.getYAtUncheckedPointIndex(index),
      result,
    );
  }
  /** Return the index (in the client polyface) of the current facet. */
  public currentReadIndex(): number {
    return this._currentFacetIndex;
  }
  /** Return the point index of vertex `i` within the currently loaded facet. */
  public clientPointIndex(i: number): number {
    return this.pointIndex[i];
  }
  /** Return the param index of vertex `i` within the currently loaded facet. */
  public clientParamIndex(i: number): number {
    return this.paramIndex ? this.paramIndex[i] : -1;
  }
  /** Return the normal index of vertex `i` within the currently loaded facet. */
  public clientNormalIndex(i: number): number {
    return this.normalIndex ? this.normalIndex[i] : -1;
  }
  /** Return the color index of vertex `i` within the currently loaded facet. */
  public clientColorIndex(i: number): number {
    return this.colorIndex ? this.colorIndex[i] : -1;
  }
  /** Return the aux data index of vertex `i` within the currently loaded facet. */
  public clientAuxIndex(i: number): number {
    return this.auxData ? this.auxData.indices[i] : -1;
  }
  /** Clear the contents of all arrays. */
  public clearArrays(): void {
    this.point.length = 0;
    this.edgeVisible.length = 0;
    if (this.param !== undefined)
      this.param.length = 0;
    if (this.normal !== undefined)
      this.normal.length = 0;
    if (this.color !== undefined)
      this.color.length = 0;
    // TODO: indices? auxData? taggedNumericData?
  }
  /** Transfer data from a specified `index` of the `other` visitor as new data in this visitor. */
  public pushDataFrom(other: PolyfaceVisitor, index: number): void {
    this.point.pushFromGrowableXYZArray(other.point, index);
    this.edgeVisible.push(other.edgeVisible[index]);
    if (this.param && other.param && index < other.param.length)
      this.param.pushFromGrowableXYArray(other.param, index);
    if (this.normal && other.normal && index < other.normal.length)
      this.normal.pushFromGrowableXYZArray(other.normal, index);
    if (this.color && other.color && index < other.color.length)
      this.color.push(other.color[index]);
    // TODO: indices? auxData? taggedNumericData?
  }
  /**
   * Transfer interpolated data from the other visitor.
   * * All data values are interpolated at `fraction` between `other` values at `index0` and `index1`.
   */
  public pushInterpolatedDataFrom(other: PolyfaceVisitor, index0: number, fraction: number, index1: number): void {
    if (index0 > index1)
      this.pushInterpolatedDataFrom(other, index1, 1.0 - fraction, index0);
    this.point.pushInterpolatedFromGrowableXYZArray(other.point, index0, fraction, index1);
    const newVisibility = (((index0 + 1) % other.edgeVisible.length) === index1) ? other.edgeVisible[index0] : false;
    this.edgeVisible.push(newVisibility); // interpolation along an edge preserves visibility of original edge
    if (this.param && other.param && index0 < other.param.length && index1 < other.param.length)
      this.param.pushInterpolatedFromGrowableXYArray(other.param, index0, fraction, index1);
    if (this.normal && other.normal && index0 < other.normal.length && index1 < other.normal.length)
      this.normal.pushInterpolatedFromGrowableXYZArray(other.normal, index0, fraction, index1);
    if (this.color && other.color && index0 < other.color.length && index1 < other.color.length)
      this.color.push(Geometry.interpolateColor(other.color[index0], fraction, other.color[index1]));
    // TODO: auxData? taggedNumericData?
  }
}
/**
 * An `IndexedPolyfaceSubsetVisitor` is an `IndexedPolyfaceVisitor` which only visits a subset of facets in the polyface.
 * * The subset is defined by an array of facet indices provided when this visitor is created.
 * * Input indices (e.g., for `moveToReadIndex`) are understood to be indices into the subset array.
 * @public
 */
export class IndexedPolyfaceSubsetVisitor extends IndexedPolyfaceVisitor {
  private _parentFacetIndices?: number[]; // only undefined during super constructor!
  private _currentActiveIndex: number;    // index within _parentFacetIndices, or -1 after construction
  private _nextActiveIndex: number;       // index within _parentFacetIndices

  private constructor(polyface: IndexedPolyface, activeFacetIndices: number[], numWrap: number) {
    super(polyface, numWrap);
    this._parentFacetIndices = activeFacetIndices.slice();
    this._currentActiveIndex = -1;
    this._nextActiveIndex = 0;
  }
  private isValidSubsetIndex(index: number): boolean {
    return (undefined !== this._parentFacetIndices) && index >= 0 && index < this._parentFacetIndices.length;
  }
  /**
   * Create a visitor for iterating a subset of the facets of `polyface`.
   * @param polyface reference to the client polyface, supplying facets
   * @param activeFacetIndices array of indices of facets in the client polyface to visit. This array is cloned.
   * @param numWrap number of vertices replicated in the visitor arrays to facilitate simpler caller code. Default is zero.
   */
  public static createSubsetVisitor(polyface: IndexedPolyface, activeFacetIndices: number[], numWrap: number = 0): IndexedPolyfaceSubsetVisitor {
    return new IndexedPolyfaceSubsetVisitor(polyface, activeFacetIndices, numWrap);
  }
  /**
   * Advance the iterator to a particular facet in the subset of client polyface facets.
   * @param activeIndex the index of the facet within the subset, not to be confused with the index of the facet within the client polyface.
   * @return whether the iterator was successfully moved.
   */
  public override moveToReadIndex(activeIndex: number): boolean {
    if (this.isValidSubsetIndex(activeIndex)) {
      this._currentActiveIndex = activeIndex;
      this._nextActiveIndex = activeIndex + 1;
      return super.moveToReadIndex(this._parentFacetIndices![activeIndex]);
    }
    return false;
  }
  /**
   * Advance the iterator to the next facet in the subset of client polyface facets.
   * @return whether the iterator was successfully moved.
   */
  public override moveToNextFacet(): boolean {
    if (this._nextActiveIndex !== this._currentActiveIndex)
      return this.moveToReadIndex(this._nextActiveIndex);
    this._nextActiveIndex++;
    return true;
  }
  /** Reset the iterator to start at the first active facet in the subset of client polyface facets. */
  public override reset(): void {
    this.moveToReadIndex(0);
    this._nextActiveIndex = 0; // so immediate moveToNextFacet stays here.
  }
  /**
   * Return the parent facet index of the indicated index within the subset of client polyface facets.
   * @param activeIndex index of the facet within the subset. Default is the active facet.
   * @return valid client polyface facet index, or `undefined` if invalid input index.
   */
  public parentFacetIndex(activeIndex?: number): number | undefined {
    if (undefined === activeIndex)
      activeIndex = this._currentActiveIndex;
    return this.isValidSubsetIndex(activeIndex) ? this._parentFacetIndices![activeIndex] : undefined;
  }
  /** Return the number of facets this visitor is able to visit. */
  public override getVisitableFacetCount(): number {
    return this._parentFacetIndices ? this._parentFacetIndices.length : 0;
  }
  /**
   * Create a visitor for those mesh facets with normal in the same half-space as the given vector.
   * * For example, to visit the top facets of a tiled terrain mesh but skip the "skirt" facets, pass
   * `compareVector = Vector3d.unitZ()` and a suitable `sideAngle` tolerance. Note that this will also
   * filter out *interior* facets that are nearly vertical, not just the "skirt" facets on the boundary.
   * @param mesh the mesh from which to select facets
   * @param compareVector vector to which to compare facet normals. The visitor will visit only those facets
   * with normals in the same half-space as this vector. Default is 001.
   * @param sideAngle optional angular tolerance to filter the facets near the border between half-spaces.
   * The visitor will *not* visit facets whose normals are nearly perpendicular to `compareVector`.
   * Default is [[Geometry.smallAngleRadians]].
   * @param numWrap optional number of entries replicated in visitor arrays. Default is 0.
  */
  public static createNormalComparison(mesh: IndexedPolyface | IndexedPolyfaceVisitor, compareVector: Vector3d = Vector3d.unitZ(), sideAngle: Angle = Angle.createSmallAngle(), numWrap: number = 0): IndexedPolyfaceSubsetVisitor {
    if (mesh instanceof IndexedPolyface)
      return this.createNormalComparison(mesh.createVisitor(), compareVector, sideAngle, numWrap);
    const visitor = mesh;
    const facets: number[] = [];
    const facetNormal = Vector3d.createZero();
    for (visitor.reset(); visitor.moveToNextFacet(); ) {
      if (!PolygonOps.unitNormal(visitor.point, facetNormal))
        continue; // degenerate facet
      if (facetNormal.dotProduct(compareVector) < 0.0)
        continue; // ignore facet facing other half-space
      if (facetNormal.angleFromPerpendicular(compareVector).isMagnitudeLessThanOrEqual(sideAngle))
        continue; // ignore side facet
      facets.push(visitor.currentReadIndex());
    }
    return IndexedPolyfaceSubsetVisitor.createSubsetVisitor(visitor.clientPolyface(), facets, numWrap);
  }
}
