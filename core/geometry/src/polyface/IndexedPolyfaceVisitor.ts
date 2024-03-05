/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

import { Geometry } from "../Geometry";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { IndexedPolyface, Polyface, PolyfaceVisitor } from "./Polyface";
import { PolyfaceData } from "./PolyfaceData";

/* eslint-disable @itwin/prefer-get */

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
  public clientPolyface(): Polyface {
    return this._polyface;
  }
  /**
   * Set the number of vertices replicated in visitor arrays (both data and index arrays).
   * * 0,1,2 are the most common as numWrap.
   * * Example: suppose `[6,7,8]` is the pointIndex array representing a triangle. First edge would be `6,7`. Second
   * edge is `7,8`. Third edge is `8,6`. To access `6` for the third edge, we have to go back to the start of array.
   * Therefore, it is useful to store `6` at the end of pointIndex array, i.e., `[6,7,8,6]` meaning `numWrap = 1`.
   * * `numWrap = 2` is useful when vertex visit requires two adjacent vectors, e.g. for cross products.
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
    if (this.point !== undefined)
      this.point.length = 0;
    if (this.param !== undefined)
      this.param.length = 0;
    if (this.normal !== undefined)
      this.normal.length = 0;
    if (this.color !== undefined)
      this.color.length = 0;
  }
  /** Transfer data from a specified `index` of the `other` visitor as new data in this visitor. */
  public pushDataFrom(other: PolyfaceVisitor, index: number): void {
    this.point.pushFromGrowableXYZArray(other.point, index);
    if (this.param && other.param && index < other.param.length)
      this.param.pushFromGrowableXYArray(other.param, index);
    if (this.normal && other.normal && index < other.normal.length)
      this.normal.pushFromGrowableXYZArray(other.normal, index);
    if (this.color && other.color && index < other.color.length)
      this.color.push(other.color[index]);
  }
  /**
   * Transfer interpolated data from the other visitor.
   * * All data values are interpolated at `fraction` between `other` values at `index0` and `index1`.
   */
  public pushInterpolatedDataFrom(other: PolyfaceVisitor, index0: number, fraction: number, index1: number): void {
    this.point.pushInterpolatedFromGrowableXYZArray(other.point, index0, fraction, index1);
    if (this.param && other.param && index0 < other.param.length && index1 < other.param.length)
      this.param.pushInterpolatedFromGrowableXYArray(other.param, index0, fraction, index1);
    if (this.normal && other.normal && index0 < other.normal.length && index1 < other.normal.length)
      this.normal.pushInterpolatedFromGrowableXYZArray(other.normal, index0, fraction, index1);
    if (this.color && other.color && index0 < other.color.length && index1 < other.color.length)
      this.color.push(Geometry.interpolateColor(other.color[index0], fraction, other.color[index1]));
  }
}
/**
 * An `IndexedPolyfaceSubsetVisitor` is an `IndexedPolyfaceVisitor` which only visits a subset of facets in the polyface.
 * * The subset is defined by an array of facet indices provided when this visitor is created.
 * * Within the subset visitor, `facetIndex` is understood as index within the subset array:
 *   * `moveToNextFacet` moves only within the subset.
 *   * `moveToReadIndex(i)` moves underlying visitor's `parentFacetIndex(i)`.
 * @public
 */
export class IndexedPolyfaceSubsetVisitor extends IndexedPolyfaceVisitor {
  private _parentFacetIndices: number[];
  private _nextActiveIndex: number; // index WITHIN _parentFacetIndices array
  private constructor(polyface: IndexedPolyface, activeFacetIndices: number[], numWrap: number) {
    super(polyface, numWrap);
    this._parentFacetIndices = activeFacetIndices.slice();
    this._nextActiveIndex = 0;
  }
  /**
   * Create a visitor for iterating a subset of the facets of `polyface`.
   * * The `activeFacetIndices` array indicates all facets to be visited.
   */
  public static createSubsetVisitor(
    polyface: IndexedPolyface, activeFacetIndices: number[], numWrap: number,
  ): IndexedPolyfaceSubsetVisitor {
    return new IndexedPolyfaceSubsetVisitor(polyface, activeFacetIndices, numWrap);
  }
  /** Advance the iterator to a particular facet in the client polyface. */
  public override moveToReadIndex(activeIndex: number): boolean {
    if (activeIndex >= 0 && activeIndex <= this._parentFacetIndices.length) {
      this._nextActiveIndex = activeIndex;
      return super.moveToReadIndex(this._parentFacetIndices[activeIndex++]);
    }
    return false;
  }
  /** Advance the iterator to the next facet in the client polyface. */
  public override moveToNextFacet(): boolean {
    if (this._nextActiveIndex < this._parentFacetIndices.length) {
      const result = this.moveToReadIndex(this._nextActiveIndex);
      if (result) {
        this._nextActiveIndex++;
        return true;
      }
    }
    return false;
  }
  /** Reset the iterator to start at the first active facet in the polyface. */
  public override reset(): void {
    this._nextActiveIndex = 0;
  }
  /** Return the parent facet index of the indicated index within the active facets. */
  public parentFacetIndex(activeIndex: number): number | undefined {
    if (activeIndex >= 0 && activeIndex <= this._nextActiveIndex) {
      return this._parentFacetIndices[activeIndex];
    }
    return undefined;
  }
}
