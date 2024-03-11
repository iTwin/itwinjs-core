/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

/* eslint-disable @typescript-eslint/naming-convention, no-empty */
// cspell:word internaldocs

import { GeometryQuery } from "../curve/GeometryQuery";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { GrowableXYArray } from "../geometry3d/GrowableXYArray";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { NumberArray } from "../geometry3d/PointHelpers";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { FacetFaceData } from "./FacetFaceData";
import { IndexedPolyfaceVisitor } from "./IndexedPolyfaceVisitor";
import { PolyfaceData } from "./PolyfaceData";

/**
 * A Polyface is an abstract mesh structure (of unspecified implementation) that provides a PolyfaceVisitor
 * to iterate over its facets.
 * @public
 */
export abstract class Polyface extends GeometryQuery {
  /** String name for schema properties */
  public readonly geometryCategory = "polyface";
  /** Underlying polyface data. */
  public data: PolyfaceData;
  /** Constructor */
  protected constructor(data: PolyfaceData) {
    super();
    this.data = data;
  }
  /**
   * Create and return a visitor for this concrete polyface.
   * @param numWrap the number of vertices to replicate in visitor arrays.
   */
  public abstract createVisitor(numWrap: number): PolyfaceVisitor;
  /** Flag indicating if the mesh display must assume both sides are visible. */
  public get twoSided() {
    return this.data.twoSided;
  }
  public set twoSided(value: boolean) {
    this.data.twoSided = value;
  }
  /**
   * Flag indicating if the mesh closure is unknown (0), open sheet (1), closed solid (2).
   * * A boundary edge of a mesh is defined as an edge with only one connected facet.
   * * Closed solid is a mesh with no boundary edge. Open sheet is a mesh that has boundary edge(s).
   */
  public get expectedClosure(): number {
    return this.data.expectedClosure;
  }
  public set expectedClosure(value: number) {
    this.data.expectedClosure = value;
  }
  /**
   * Check validity of indices into a data array.
   * * It is valid to have both indices and data undefined.
   * * It is NOT valid for just one to be defined.
   * * Index values at indices[indexPositionA <= i < indexPositionB] must be valid indices to the data array.
   * @param indices array of indices.
   * @param indexPositionA first index to test.
   * @param indexPositionB one past final index to test.
   * @param data data array.
   * @param dataLength length of data array.
   */
  public static areIndicesValid(
    indices: number[] | undefined,
    indexPositionA: number,
    indexPositionB: number,
    data: any | undefined,
    dataLength: number,
  ): boolean {
    if (indices === undefined && data === undefined)
      return true;
    if (indices === undefined || data === undefined)
      return false;
    if (indexPositionA < 0 || indexPositionA >= indices.length)
      return false;
    if (indexPositionB <= indexPositionA || indexPositionB > indices.length)
      return false;
    for (let i = indexPositionA; i < indexPositionB; i++)
      if (indices[i] < 0 || indices[i] >= dataLength)
        return false;
    return true;
  }
  /** Returns true if this polyface has no facets. */
  public abstract get isEmpty(): boolean;
  /** Returns the number of facets of this polyface. Subclasses should override. */
  public get facetCount(): number | undefined {
    return undefined;
  }
}

/**
 * An `IndexedPolyface` is a set of facets which can have normal, param, and color arrays with independent point,
 * normal, param, and color indices.
 * @public
 */
export class IndexedPolyface extends Polyface { // more info can be found at geometry/internaldocs/Polyface.md
  /**
   * Start indices of all facets of the polyface.
   * * Each element is an index to the `this.data.pointIndex` array entry for a specific facet.
   * * The facet count is `_facetStart.length - 1`.
   * * The face loop for the i_th facet consists of the entries in `this.data.pointIndex` at indices `_facetStart[i]`
   * up to (but not including) `_facetStart[i + 1]`.
   * * Note the array is initialized with one entry (value 0).
   */
  protected _facetStart: number[];
  /**
   * Index to the `this.data.face` array entry for a specific facet.
   * * `_facetToFaceData` has one entry per facet.
   */
  protected _facetToFaceData: number[];
  /**
   * Constructor for a new polyface.
   * @param data PolyfaceData arrays to capture.
   * @param facetStart optional array of facet start indices (e.g. known during clone)
   * @param facetToFacetData optional array of face identifiers (e.g. known during clone)
   */
  protected constructor(data: PolyfaceData, facetStart?: number[], facetToFaceData?: number[]) {
    super(data);
    if (facetStart)
      this._facetStart = facetStart.slice(); // deep copy
    else {
      this._facetStart = [];
      this._facetStart.push(0);
    }
    if (facetToFaceData)
      this._facetToFaceData = facetToFaceData.slice(); // deep copy
    else
      this._facetToFaceData = [];
  }
  /** Test if other is an instance of `IndexedPolyface` */
  public isSameGeometryClass(other: any): boolean {
    return other instanceof IndexedPolyface;
  }
  /** Tests for equivalence between two IndexedPolyfaces. */
  public override isAlmostEqual(other: any): boolean {
    if (other instanceof IndexedPolyface) {
      return this.data.isAlmostEqual(other.data) &&
        NumberArray.isExactEqual(this._facetStart, other._facetStart) &&
        NumberArray.isExactEqual(this._facetToFaceData, other._facetToFaceData);
    }
    return false;
  }
  /** Returns true if either the point array or the point index array is empty. */
  public get isEmpty(): boolean {
    return this.data.pointCount === 0 || this.data.pointIndex.length === 0;
  }
  /**
   * Transform the mesh.
   * * Apply the transform to points.
   * * Apply the (inverse transpose of the) matrix part to normals.
   * * If determinant of the transform matrix is negative, also
   *   * negate normals
   *   * reverse index order around each facet.
   */
  public tryTransformInPlace(transform: Transform) {
    if (!this.data.tryTransformInPlace(transform))
      return false;
    const determinant = transform.matrix.determinant();
    if (determinant < 0) {
      this.reverseIndices();
      this.reverseNormals();
    }
    return true;
  }
  /** Reverse indices for a single facet. */
  public reverseSingleFacet(facetId: number) {
    this.data.reverseIndicesSingleFacet(facetId, this._facetStart);
  }
  /** Return a deep clone. */
  public clone(): IndexedPolyface {
    const result = new IndexedPolyface(this.data.clone(), this._facetStart.slice(), this._facetToFaceData.slice());
    return result;
  }
  /**
   * Return a deep clone with transformed points and normals.
   * @see [[IndexedPolyface.tryTransformInPlace]] for details of how transform is done.
   */
  public cloneTransformed(transform: Transform): IndexedPolyface {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  /** Reverse the order of indices around all facets. */
  public reverseIndices() {
    this.data.reverseIndices(this._facetStart);
  }
  /** Reverse the direction of all normal vectors. */
  public reverseNormals() {
    this.data.reverseNormals();
  }
  /**
   * Return face data using a facet index.
   * * Returns `undefined` if none found.
   * * This is the REFERENCE to the FacetFaceData not a copy.
   */
  public tryGetFaceData(i: number): FacetFaceData | undefined {
    if (i < 0 || i >= this._facetToFaceData.length)
      return undefined;
    const faceIndex = this._facetToFaceData[i];
    if (faceIndex < 0 || faceIndex >= this.data.face.length)
      return undefined;
    return this.data.face[faceIndex];
  }
  /**
   * Add facets from `source` to `this` polyface.
   * * Optionally reverse facet indices as per `PolyfaceData.reverseIndicesSingleFacet()` with `preserveStart = false` and
   * invert source normals.
   * * Optionally apply a `transform` to points and normals.
   * * Will only copy param, normal, color, and face data if we are already tracking them AND/OR the source contains them.
   */
  public addIndexedPolyface(source: IndexedPolyface, reversed: boolean, transform: Transform | undefined) {
    const numSourceFacets = source.facetCount;
    // add point, point index, and edge visibility data
    // note that there is no need to build an intermediate index map since all points are added
    const startOfNewPoints = this.data.point.length;
    const xyz = Point3d.create();
    for (let i = 0; i < source.data.point.length; i++) {
      source.data.point.getPoint3dAtUncheckedPointIndex(i, xyz);
      if (transform) {
        transform.multiplyPoint3d(xyz, xyz);
        this.addPoint(xyz);
      } else
        this.addPoint(xyz);
    }
    for (let i = 0; i < numSourceFacets; i++) {
      const i0 = source._facetStart[i];
      const i1 = source._facetStart[i + 1];
      if (reversed) {
        for (let j = i1; j-- > i0;) { // visibility is transferred from far vertex, e.g., -abc-d => dc-b-a
          this.addPointIndex(
            startOfNewPoints + source.data.pointIndex[j],
            source.data.edgeVisible[j > i0 ? j - 1 : i1 - 1],
          );
        }
      } else {
        for (let j = i0; j < i1; j++) {
          this.addPointIndex(
            startOfNewPoints + source.data.pointIndex[j],
            source.data.edgeVisible[j],
          );
        }
      }
      this.terminateFacet(false);
    }
    // add param and param index data
    if (undefined !== this.data.param && undefined !== source.data.param && undefined !== source.data.paramIndex) {
      const startOfNewParams = this.data.param.length;
      this.data.param.pushFromGrowableXYArray(source.data.param);
      for (let i = 0; i < numSourceFacets; i++) { // expect facet start and ends for points to match normals
        const i0 = source._facetStart[i];
        const i1 = source._facetStart[i + 1];
        if (reversed) {
          for (let j = i1; j-- > i0;)
            this.addParamIndex(startOfNewParams + source.data.paramIndex[j]);
        } else {
          for (let j = i0; j < i1; j++)
            this.addParamIndex(startOfNewParams + source.data.paramIndex[j]);
        }
      }
    }
    // add normal and normal index data
    if (undefined !== this.data.normal && undefined !== source.data.normal && undefined !== source.data.normalIndex) {
      const startOfNewNormals = this.data.normal.length;
      for (let i = 0; i < source.data.normal.length; i++) {
        const sourceNormal = source.data.normal.getVector3dAtCheckedVectorIndex(i)!;
        if (transform)
          transform.multiplyVector(sourceNormal, sourceNormal);
        if (reversed)
          sourceNormal.scaleInPlace(-1.0);
        this.addNormal(sourceNormal);
      }
      for (let i = 0; i < numSourceFacets; i++) { // expect facet start and ends for points to match normals
        const i0 = source._facetStart[i];
        const i1 = source._facetStart[i + 1];
        if (reversed) {
          for (let j = i1; j-- > i0;)
            this.addNormalIndex(startOfNewNormals + source.data.normalIndex[j]);
        } else {
          for (let j = i0; j < i1; j++)
            this.addNormalIndex(startOfNewNormals + source.data.normalIndex[j]);
        }
      }
    }
    // add color and color index data
    if (undefined !== this.data.color && undefined !== source.data.color && undefined !== source.data.colorIndex) {
      const startOfNewColors = this.data.color.length;
      for (const sourceColor of source.data.color)
        this.addColor(sourceColor);
      for (let i = 0; i < numSourceFacets; i++) { // expect facet start and ends for points to match colors
        const i0 = source._facetStart[i];
        const i1 = source._facetStart[i + 1];
        if (reversed) {
          for (let j = i1; j-- > i0;)
            this.addColorIndex(startOfNewColors + source.data.colorIndex[j]);
        } else {
          for (let j = i0; j < i1; j++)
            this.addColorIndex(startOfNewColors + source.data.colorIndex[j]);
        }
      }
    }
    // add face and facetToFace index data
    if (source.data.face.length !== 0) {
      const startOfNewFaceData = this.data.face.length;
      for (const face of source.data.face) {
        const sourceFaceData = face.clone();
        this.data.face.push(sourceFaceData);
      }
      for (const facetToFaceIdx of source._facetToFaceData) {
        this._facetToFaceData.push(startOfNewFaceData + facetToFaceIdx);
      }
    }
  }
  /**
   * Return the total number of indices in zero-terminated style, which includes
   * * all the indices in the packed zero-based table.
   * * one additional index for the zero-terminator of each facet.
   * @note Note that all index arrays (pointIndex, normalIndex, paramIndex, colorIndex) have the same counts, so there
   * is not a separate query for each of them.
   */
  public get zeroTerminatedIndexCount(): number {
    return this.data.pointIndex.length + this._facetStart.length - 1;
  }
  /**
   * Create an empty facet set with coordinate and index data to be supplied later.
   * @param needNormals `true` to allocate empty normal data and index arrays; `false` (default) to leave undefined.
   * @param needParams `true` to allocate empty uv parameter data and index arrays; `false` (default) to leave undefined.
   * @param needColors `true` to allocate empty color data and index arrays; `false` (default) to leave undefined.
   * @param twoSided `true` if the facets are to be considered viewable from the back; `false` (default) if not.
   */
  public static create(
    needNormals: boolean = false,
    needParams: boolean = false,
    needColors: boolean = false,
    twoSided: boolean = false,
  ): IndexedPolyface {
    return new IndexedPolyface(new PolyfaceData(needNormals, needParams, needColors, twoSided));
  }
  /**
   * Add (a clone of) a point to point array.
   * @param point the point.
   * @param priorIndex (optional) index of prior point to check for possible duplicate value.
   * @returns the zero-based index of the added or duplicate point.
   */
  public addPoint(point: Point3d, priorIndex?: number): number {
    if (priorIndex !== undefined) {
      const distance = this.data.point.distanceIndexToPoint(priorIndex, point);
      if (distance !== undefined && Geometry.isSmallMetricDistance(distance))
        return priorIndex;
    }
    this.data.point.pushXYZ(point.x, point.y, point.z);
    return this.data.point.length - 1;
  }
  /**
   * Add a point to point array.
   * @param x the x coordinate of point.
   * @param y the y coordinate of point.
   * @param z the z coordinate of point.
   * @returns the zero-based index of the added point.
   */
  public addPointXYZ(x: number, y: number, z: number): number {
    this.data.point.pushXYZ(x, y, z);
    return this.data.point.length - 1;
  }
  /**
   * Add (a clone of) a uv parameter to the parameter array.
   * @param param the parameter.
   * @returns zero-based index of the added param.
   */
  public addParam(param: Point2d): number {
    if (!this.data.param)
      this.data.param = new GrowableXYArray();
    this.data.param.push(param);
    return this.data.param.length - 1;
  }
  /**
   * Add a uv parameter to the parameter array.
   * @param u the u part of parameter.
   * @param v the v part of parameter.
   * @param priorIndexA first index to check for possible duplicate value.
   * @param priorIndexB second index to check for possible duplicate value.
   * @returns zero-based index of the added or duplicate parameter.
   */
  public addParamUV(u: number, v: number, priorIndexA?: number, priorIndexB?: number): number {
    if (!this.data.param)
      this.data.param = new GrowableXYArray();
    if (priorIndexA !== undefined && this.data.isAlmostEqualParamIndexUV(priorIndexA, u, v))
      return priorIndexA;
    if (priorIndexB !== undefined && this.data.isAlmostEqualParamIndexUV(priorIndexB, u, v))
      return priorIndexB;
    this.data.param.pushXY(u, v);
    return this.data.param.length - 1;
  }
  /**
   * Add (a clone of) a normal vector to the normal array.
   * @param normal the normal vector.
   * @param priorIndexA first index to check for possible duplicate value.
   * @param priorIndexB second index to check for possible duplicate value.
   * @returns zero-based index of the added or duplicate normal.
   */
  public addNormal(normal: Vector3d, priorIndexA?: number, priorIndexB?: number): number {
    // check if `normal` is duplicate of `dataNormal` at index `i`
    const normalIsDuplicate = (i: number) => {
      const distance = this.data.normal!.distanceIndexToPoint(i, normal);
      return distance !== undefined && Geometry.isSmallMetricDistance(distance);
    };
    if (this.data.normal !== undefined) {
      if (priorIndexA !== undefined && normalIsDuplicate(priorIndexA))
        return priorIndexA;
      if (priorIndexB !== undefined && normalIsDuplicate(priorIndexB))
        return priorIndexB;
      // check the tail index for possible duplicate
      if (priorIndexA !== undefined || priorIndexB !== undefined) {
        const tailIndex = this.data.normal.length - 1;
        if (normalIsDuplicate(tailIndex))
          return tailIndex;
      }
    }
    return this.addNormalXYZ(normal.x, normal.y, normal.z);
  }
  /**
   * Add a normal vector to the normal array.
   * @param x the x coordinate of normal.
   * @param y the y coordinate of normal.
   * @param z the z coordinate of normal.
   * @returns zero-based index of the added normal vector.
   */
  public addNormalXYZ(x: number, y: number, z: number): number {
    if (!this.data.normal)
      this.data.normal = new GrowableXYZArray();
    this.data.normal.pushXYZ(x, y, z);
    return this.data.normal.length - 1;
  }
  /**
   * Add a color to the color array
   * @param color the color.
   * @returns zero-based index of the added color.
   */
  public addColor(color: number): number {
    if (!this.data.color)
      this.data.color = [];
    this.data.color.push(color);
    return this.data.color.length - 1;
  }
  /** Add a point index with edge visibility flag. */
  public addPointIndex(index: number, visible: boolean = true): void {
    this.data.pointIndex.push(index);
    this.data.edgeVisible.push(visible);
  }
  /** Add a normal index. */
  public addNormalIndex(index: number): void {
    if (!this.data.normalIndex)
      this.data.normalIndex = [];
    this.data.normalIndex.push(index);
  }
  /** Add a param index. */
  public addParamIndex(index: number): void {
    if (!this.data.paramIndex)
      this.data.paramIndex = [];
    this.data.paramIndex.push(index);
  }
  /** Add a color index. */
  public addColorIndex(index: number): void {
    if (!this.data.colorIndex)
      this.data.colorIndex = [];
    this.data.colorIndex.push(index);
  }
  /**
   * Clean up the open facet.
   * @deprecated in 4.x to remove nebulous "open facet" concept from the API. Call [[PolyfaceData.trimAllIndexArrays]]
   * instead.
   */
  public cleanupOpenFacet(): void {
    this.data.trimAllIndexArrays(this.data.pointIndex.length);
  }
  /**
   * Announce the end of construction of a facet.
   * * Optionally check for:
   *   * Same number of indices among all active index arrays -- point, normal, param, color
   *   * All indices are within bounds of the respective data arrays.
   * * In error cases, all index arrays are trimmed back to the size when previous facet was terminated.
   * * A return value of `undefined` is normal. Otherwise, a string array of error messages is returned.
   */
  public terminateFacet(validateAllIndices: boolean = true): String[] | undefined {
    const numFacets = this._facetStart.length - 1;
    // number of indices in accepted facets
    const lengthA = this._facetStart[numFacets];
    // number of indices in all facets (accepted facet plus the last facet to be accepted)
    const lengthB = this.data.pointIndex.length;
    if (validateAllIndices) {
      const messages: String[] = [];
      if (lengthB < lengthA + 2)
        messages.push("Less than 3 indices in the last facet");
      if (this.data.normalIndex && this.data.normalIndex.length !== lengthB)
        messages.push("normalIndex count must match pointIndex count");
      if (this.data.paramIndex && this.data.paramIndex.length !== lengthB)
        messages.push("paramIndex count must equal pointIndex count");
      if (this.data.colorIndex && this.data.colorIndex.length !== lengthB)
        messages.push("colorIndex count must equal pointIndex count");
      if (this.data.edgeVisible.length !== lengthB)
        messages.push("visibleIndex count must equal pointIndex count");
      if (!Polyface.areIndicesValid(
        this.data.pointIndex, lengthA, lengthB, this.data.point, this.data.point ? this.data.point.length : 0,
      ))
        messages.push("invalid point indices in the last facet");
      if (!Polyface.areIndicesValid(
        this.data.normalIndex, lengthA, lengthB, this.data.normal, this.data.normal ? this.data.normal.length : 0,
      ))
        messages.push("invalid normal indices in the last facet");
      if (!Polyface.areIndicesValid(
        this.data.paramIndex, lengthA, lengthB, this.data.param, this.data.param ? this.data.param.length : 0,
      ))
        messages.push("invalid param indices in the last facet");
      if (!Polyface.areIndicesValid(
        this.data.colorIndex, lengthA, lengthB, this.data.color, this.data.color ? this.data.color.length : 0,
      ))
        messages.push("invalid color indices in the last facet");
      if (messages.length > 0) {
        this.data.trimAllIndexArrays(lengthA);
        return messages;
      }
    }
    this._facetStart.push(lengthB); // append start index of the future facet
    return undefined;
  }
  /** Number of facets (read-only property). */
  public override get facetCount(): number {
    return this._facetStart.length - 1;
  }
  /** Number of faces (read-only property). */
  public get faceCount(): number {
    return this.data.faceCount;
  }
  /** Number of points (read-only property). */
  public get pointCount(): number {
    return this.data.pointCount;
  }
  /** Number of colors (read-only property). */
  public get colorCount(): number {
    return this.data.colorCount;
  }
  /** Number of parameters (read-only property). */
  public get paramCount(): number {
    return this.data.paramCount;
  }
  /** Number of normals (read-only property). */
  public get normalCount(): number {
    return this.data.normalCount;
  }
  /** Test if `index` is a valid facet index. */
  public isValidFacetIndex(index: number): boolean {
    return index >= 0 && index < this.facetCount;
  }
  /** Return the number of edges in a particular facet. */
  public numEdgeInFacet(facetIndex: number): number {
    if (this.isValidFacetIndex(facetIndex))
      return this._facetStart[facetIndex + 1] - this._facetStart[facetIndex];
    return 0;
  }
  /** ASSUME valid facet index. Return start index of facet in pointIndex arrays. */
  public facetIndex0(index: number): number {
    return this._facetStart[index];
  }
  /** ASSUME valid facet index. Return one past end index of facet in pointIndex arrays. */
  public facetIndex1(index: number): number {
    return this._facetStart[index + 1];
  }
  /** Create a visitor for this polyface */
  public createVisitor(numWrap: number = 0): IndexedPolyfaceVisitor {
    return IndexedPolyfaceVisitor.create(this, numWrap);
  }
  /** Return the range of (optionally transformed) points in this mesh. */
  public override range(transform?: Transform, result?: Range3d): Range3d {
    return this.data.range(result, transform);
  }
  /** Extend `range` with coordinates from this mesh. */
  public extendRange(range: Range3d, transform?: Transform): void {
    this.data.range(range, transform);
  }
  /**
   * Given the index of a facet, return the data pertaining to the face it is a part of.
   * @deprecated in 4.x. Use [[IndexedPolyface.tryGetFaceData]], which verifies the index is in range.
   */
  public getFaceDataByFacetIndex(facetIndex: number): FacetFaceData {
    return this.data.face[this._facetToFaceData[facetIndex]];
  }
  /**
   * Set new FacetFaceData.
   * * All terminated facets since the last face declaration will be mapped to a single new FacetFaceData object using
   * facetToFaceData[]. FacetFaceData holds the 2D range of the face. Returns `true` if successful, `false` otherwise.
   */
  public setNewFaceData(endFacetIndex: number = 0): boolean {
    const facetStart = this._facetToFaceData.length;
    if (facetStart >= this._facetStart.length)
      return false;
    if (0 === endFacetIndex) // the default for endFacetIndex is really the last facet
      endFacetIndex = this._facetStart.length; // last facet index corresponds to the future facet
    const faceData = FacetFaceData.createNull();
    const visitor = IndexedPolyfaceVisitor.create(this, 0);
    if (!visitor.moveToReadIndex(facetStart)) { // move visitor to first facet of new face
      return false;
    }
    // if parameter range is provided (by the polyface planeSet clipper) then use it
    const paramDefined = this.data.param !== undefined;
    const setParamRange: boolean = faceData.paramRange.isNull && paramDefined;
    do {
      if (setParamRange && visitor.param !== undefined)
        visitor.param.extendRange(faceData.paramRange);
    } while (visitor.moveToNextFacet() && visitor.currentReadIndex() < endFacetIndex);
    if (paramDefined && !(this.data.param!.length === 0) && faceData.paramDistanceRange.isNull)
      faceData.setParamDistanceRangeFromNewFaceData(this, facetStart, endFacetIndex);
    this.data.face.push(faceData);
    const faceDataIndex = this.data.face.length - 1;
    for (let i = this._facetToFaceData.length; i < endFacetIndex; i++)
      this._facetToFaceData.push(0 === this._facetStart[i] ? 0 : faceDataIndex);
    return true;
  }
  /** Second step of double dispatch: call `handler.handleIndexedPolyface(this)`. */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleIndexedPolyface(this);
  }
}

/**
 * A PolyfaceVisitor manages data while walking through facets.
 * * The polyface visitor holds data for one facet at a time.
 * * The caller can request the position in the addressed polyfaceData as a "readIndex".
 * * The readIndex values (as numbers) are not promised to be sequential (i.e., it might be a simple facet count
 * or might have "gaps" at the whim of the particular PolyfaceVisitor implementation).
 * @public
 */
export interface PolyfaceVisitor extends PolyfaceData {
  /** Load data for the facet with given index. */
  moveToReadIndex(index: number): boolean;
  /** Return the readIndex of the currently loaded facet. */
  currentReadIndex(): number;
  /** Load data for the next facet. */
  moveToNextFacet(): boolean;
  /** Reset to initial state for reading all facets sequentially with moveToNextFacet. */
  reset(): void;
  /** Return the point index of vertex i within the currently loaded facet. */
  clientPointIndex(i: number): number;
  /** Return the param index of vertex i within the currently loaded facet. */
  clientParamIndex(i: number): number;
  /** Return the normal index of vertex i within the currently loaded facet. */
  clientNormalIndex(i: number): number;
  /** Return the color index of vertex i within the currently loaded facet. */
  clientColorIndex(i: number): number;
  /** Return the aux data index of vertex i within the currently loaded facet. */
  clientAuxIndex(i: number): number;
  /** Return the client polyface. */
  clientPolyface(): Polyface | undefined;
  /**
   * Set the number of vertices replicated in visitor arrays (both data and index arrays).
   * * 0,1,2 are the most common as numWrap.
   * * Example: suppose `[6,7,8]` is the pointIndex array representing a triangle. First edge would be `6,7`. Second
   * edge is `7,8`. Third edge is `8,6`. To access `6` for the third edge, we have to go back to the start of array.
   * Therefore, it is useful to store `6` at the end of pointIndex array, i.e., `[6,7,8,6]` meaning `numWrap = 1`.
   * * `numWrap = 2` is useful when vertex visit requires two adjacent vectors, e.g. for cross products.
   */
  setNumWrap(numWrap: number): void;
  /** Clear the contents of all arrays. Use this along with `pushDataFrom` to build up new facets. */
  clearArrays(): void;
  /** Transfer data from a specified index of the other visitor as new data in this visitor. */
  pushDataFrom(other: PolyfaceVisitor, index: number): void;
  /**
   * Transfer interpolated data from the other visitor.
   * * All data values are interpolated at `fraction` between `other` values at `index0` and `index1`.
   */
  pushInterpolatedDataFrom(other: PolyfaceVisitor, index0: number, fraction: number, index1: number): void;
}
