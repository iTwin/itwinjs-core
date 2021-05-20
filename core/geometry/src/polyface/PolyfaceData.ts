/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

import { Geometry } from "../Geometry";
import { GrowableXYArray } from "../geometry3d/GrowableXYArray";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { NumberArray } from "../geometry3d/PointHelpers";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { ClusterableArray } from "../numerics/ClusterableArray";
import { PolyfaceAuxData } from "./AuxData";
import { FacetFaceData } from "./FacetFaceData";
import { TaggedNumericData } from "./TaggedNumericData";

/**
 * PolyfaceData carries data arrays for point, normal, param, color and their indices.
 *
 * * IndexedPolyface carries a PolyfaceData as a member. (NOT as a base class -- it already has GeometryQuery as base)
 * * IndexedPolyfaceVisitor uses PolyfaceData as a base class.  In this use there is only a single facet in the polyfaceData.
 * * PolyfaceData does not know (!!!) what indices range constitute a facet.  That is managed by derived class or carrier class.
 * @public
 */
export class PolyfaceData {
  // <ul
  // <li>optional arrays (normal, uv, color) must be indicated at constructor time.
  // <li>all arrays are (independently) indexed.
  // <li>with regret, the point, param, normal, and color arrays are exposed publicly.
  // <li>getX methods are "trusting" -- no bounds check
  // <li>getX methods return references to X.
  // <li> EXCEPT -- for optional arrays, the return 000.
  // <li>copyX methods move data to caller-supplied result..
  // </ul>
  /** Relative tolerance used in tests for planar facets
   * @internal
   */
  public static readonly planarityLocalRelTol = 1.0e-13;
  /** Coordinate data for points in the facets, packed as numbers in a contiguous array. */
  public point: GrowableXYZArray;
  /** Indices of points at facet vertices. */
  public pointIndex: number[];
  /** booleans indicating visibility of corresponding edges */
  public edgeVisible: boolean[];
  /** Coordinates of normal vectors, packed as numbers in a contiguous array */
  public normal: GrowableXYZArray | undefined;
  /** indices of normals at facet vertices. */
  public normalIndex: number[] | undefined;
  /** Coordinates of uv parameters, packed as numbers in a contiguous array. */
  public param?: GrowableXYArray;
  /** Indics of params at facet vertices. */
  public paramIndex: number[] | undefined;
  /** Color values.  These are carried around as simple numbers, but are probably
   * required (by display systems) map exactly to 32 bit integers.
   */
  public color: number[] | undefined;
  /** Indices of colors at facet vertices. */
  public colorIndex: number[] | undefined;
  /** Face data will remain empty until a face is specified. */
  public face: FacetFaceData[];
  /** Auxiliary data */
  public auxData: PolyfaceAuxData | undefined;
  /** Tagged geometry data */
  public taggedNumericData: TaggedNumericData | undefined;
  private _twoSided: boolean;
  /** boolean tag indicating if the facets are viewable from the back */
  public get twoSided(): boolean { return this._twoSided; }
  public set twoSided(value: boolean) { this._twoSided = value; }

  /** set the `taggedNumericData` member */
  public setTaggedNumericData(data: TaggedNumericData | undefined) {
    this.taggedNumericData = data;
  }
  private _expectedClosure: number;
  /** boolean tag indicating if the facets are viewable from the back */
  public get expectedClosure(): number { return this._expectedClosure; }
  public set expectedClosure(value: number) { this._expectedClosure = value; }
  /** Constructor for facets.
   *   * The various params control whether respective arrays are to be allocated.
   *   * If arrayData is provided, all other params are IGNORED.
   *   *
   */
  public constructor(needNormals: boolean = false, needParams: boolean = false, needColors: boolean = false, twoSided: boolean = false) {
    this.face = [];
    this.point = new GrowableXYZArray();
    this.pointIndex = []; this.edgeVisible = [];
    if (needNormals) { this.normal = new GrowableXYZArray(); this.normalIndex = []; }
    if (needParams) { this.param = new GrowableXYArray(); this.paramIndex = []; }
    if (needColors) { this.color = []; this.colorIndex = []; }
    this._twoSided = twoSided;
    this._expectedClosure = 0;
  }
  /** Return a depp clone. */
  public clone(): PolyfaceData {
    const result = new PolyfaceData();
    result.point = this.point.clone();
    result.pointIndex = this.pointIndex.slice();
    result.edgeVisible = this.edgeVisible.slice();
    result.face = this.face.slice();
    result.twoSided = this.twoSided;
    result.expectedClosure = this.expectedClosure;
    if (this.normal)
      result.normal = this.normal.clone();
    if (this.param)
      result.param = this.param.clone();
    if (this.color)
      result.color = this.color.slice();

    if (this.normalIndex)
      result.normalIndex = this.normalIndex.slice();
    if (this.paramIndex)
      result.paramIndex = this.paramIndex.slice();
    if (this.colorIndex)
      result.colorIndex = this.colorIndex.slice();
    if (this.auxData)
      result.auxData = this.auxData.clone();
    if (this.taggedNumericData){
      result.taggedNumericData = this.taggedNumericData.clone();
    }
    return result;
  }
  /** Test for equal indices and nearly equal coordinates */
  public isAlmostEqual(other: PolyfaceData): boolean {
    if (!GrowableXYZArray.isAlmostEqual(this.point, other.point))
      return false;
    if (!NumberArray.isExactEqual(this.pointIndex, other.pointIndex))
      return false;

    if (!GrowableXYZArray.isAlmostEqual(this.normal, other.normal)) return false;
    if (!NumberArray.isExactEqual(this.normalIndex, other.normalIndex)) return false;

    if (!GrowableXYArray.isAlmostEqual(this.param, other.param)) return false;
    if (!NumberArray.isExactEqual(this.paramIndex, other.paramIndex)) return false;

    if (!NumberArray.isExactEqual(this.color, other.color)) return false;
    if (!NumberArray.isExactEqual(this.colorIndex, other.colorIndex)) return false;

    if (!NumberArray.isExactEqual(this.edgeVisible, other.edgeVisible)) return false;
    if (!PolyfaceAuxData.isAlmostEqual(this.auxData, other.auxData)) return false;

    if (this.twoSided !== other.twoSided)
      return false;

    if (this.expectedClosure !== other.expectedClosure)
      return false;
    if (!TaggedNumericData.areAlmostEqual(this.taggedNumericData, other.taggedNumericData))
      return false;
    return true;
  }
  /** Ask if normals are required in this mesh. */
  public get requireNormals(): boolean { return undefined !== this.normal; }
  /** Get the point count */
  public get pointCount() { return this.point.length; }
  /** Get the normal count */
  public get normalCount() { return this.normal ? this.normal.length : 0; }
  /** Get the param count */
  public get paramCount() { return this.param ? this.param.length : 0; }
  /** Get the color count */
  public get colorCount() { return this.color ? this.color.length : 0; }
  /** Get the index count.  Note that there is one count, and all index arrays (point, normal, param, color) must match */
  public get indexCount() { return this.pointIndex.length; }  // ALWAYS INDEXED ... all index vectors must have same length.
  /** Get the number of faces.
   * * Note that a "face" is not a facet.
   * * A "face" is a subset of facets grouped for application purposes.
   */
  public get faceCount() { return this.face.length; }

  /** return indexed point. This is a copy of the coordinates, not a reference. */
  public getPoint(i: number): Point3d | undefined { return this.point.getPoint3dAtCheckedPointIndex(i); }
  /** return indexed normal. This is the COPY to the normal, not a reference. */
  public getNormal(i: number): Vector3d | undefined { return this.normal ? this.normal.getVector3dAtCheckedVectorIndex(i) : undefined; }
  /** return indexed param. This is the COPY of the coordinates, not a reference. */
  public getParam(i: number): Point2d | undefined { return this.param ? this.param.getPoint2dAtCheckedPointIndex(i) : undefined; }
  /** return indexed color */
  public getColor(i: number): number { return this.color ? this.color[i] : 0; }
  /** return indexed visibility */
  public getEdgeVisible(i: number): boolean { return this.edgeVisible[i]; }
  /** Copy the contents (not pointer) of point[i] into dest. */
  public copyPointTo(i: number, dest: Point3d): void { this.point.getPoint3dAtUncheckedPointIndex(i, dest); }
  /** Copy the contents (not pointer) of normal[i] into dest. */
  public copyNormalTo(i: number, dest: Vector3d): void { if (this.normal) this.normal.getVector3dAtCheckedVectorIndex(i, dest); }
  /** Copy the contents (not pointer) of param[i] into dest. */
  public copyParamTo(i: number, dest: Point2d): void { if (this.param) this.param.getPoint2dAtCheckedPointIndex(i, dest); }
  /** test if normal at a specified index matches uv */
  public isAlmostEqualParamIndexUV(index: number, u: number, v: number): boolean {
    if (this.param !== undefined && index >= 0 && index < this.param.length)
      return Geometry.isSameCoordinate(u, this.param.getXAtUncheckedPointIndex(index))
        && Geometry.isSameCoordinate(v, this.param.getYAtUncheckedPointIndex(index));
    return false;
  }
  /**
   * * Copy data from other to this.
   * * This is the essence of transferring coordinates spread throughout a large polyface into a visitor's single facet.
   * * "other" is the large polyface
   * * "this" is the visitor
   * * does NOT copy face data - visitors reference the FacetFaceData array for the whole polyface!!
   * @param other polyface data being mined.
   * @param index0 start index in other's index arrays
   * @param index1 end index (one beyond last data accessed0 in other's index arrays
   * @param numWrap number of points to replicate as wraparound.
   */
  public gatherIndexedData(other: PolyfaceData, index0: number, index1: number, numWrap: number) {
    const numEdge = index1 - index0;
    const numTotal = numEdge + numWrap;
    this.resizeAllDataArrays(numTotal);
    // copy wrapped points
    for (let i = 0; i < numEdge; i++)
      this.point.transferFromGrowableXYZArray(i, other.point, other.pointIndex[index0 + i]);
    for (let i = 0; i < numWrap; i++)
      this.point.transferFromGrowableXYZArray(numEdge + i, this.point, i);

    // copy wrapped pointIndex
    for (let i = 0; i < numEdge; i++)
      this.pointIndex[i] = other.pointIndex[index0 + i];
    for (let i = 0; i < numWrap; i++)
      this.pointIndex[numEdge + i] = this.pointIndex[i];
    // copy wrapped edge visibility
    for (let i = 0; i < numEdge; i++)
      this.edgeVisible[i] = other.edgeVisible[index0 + i];
    for (let i = 0; i < numWrap; i++)
      this.edgeVisible[numEdge + i] = this.edgeVisible[i];

    if (this.normal && this.normalIndex && other.normal && other.normalIndex) {
      for (let i = 0; i < numEdge; i++)
        this.normal.transferFromGrowableXYZArray(i, other.normal, other.normalIndex[index0 + i]);
      for (let i = 0; i < numWrap; i++)
        this.normal.transferFromGrowableXYZArray(numEdge + i, this.normal, i);

      for (let i = 0; i < numEdge; i++)
        this.normalIndex[i] = other.normalIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.normalIndex[numEdge + i] = this.normalIndex[i];
    }

    if (this.param && this.paramIndex && other.param && other.paramIndex) {
      for (let i = 0; i < numEdge; i++)
        this.param.transferFromGrowableXYArray(i, other.param, other.paramIndex[index0 + i]);
      for (let i = 0; i < numWrap; i++)
        this.param.transferFromGrowableXYArray(numEdge + i, this.param, i);

      for (let i = 0; i < numEdge; i++)
        this.paramIndex[i] = other.paramIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.paramIndex[numEdge + i] = this.paramIndex[i];
    }

    if (this.color && this.colorIndex && other.color && other.colorIndex) {
      for (let i = 0; i < numEdge; i++)
        this.color[i] = other.color[other.colorIndex[index0 + i]];
      for (let i = 0; i < numWrap; i++)
        this.color[numEdge + i] = this.color[i];

      for (let i = 0; i < numEdge; i++)
        this.colorIndex[i] = other.colorIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.colorIndex[numEdge + i] = this.colorIndex[i];
    }
    if (this.auxData && other.auxData && this.auxData.channels.length === other.auxData.channels.length) {
      for (let iChannel = 0; iChannel < this.auxData.channels.length; iChannel++) {
        const thisChannel = this.auxData.channels[iChannel];
        const otherChannel = other.auxData.channels[iChannel];
        const blockSize = thisChannel.entriesPerValue;
        if (thisChannel.data.length === otherChannel.data.length) {
          for (let iData = 0; iData < thisChannel.data.length; iData++) {
            const thisData = thisChannel.data[iData];
            const otherData = otherChannel.data[iData];
            for (let i = 0; i < numEdge; i++)
              thisData.copyValues(otherData, i, index0 + i, blockSize);
            for (let i = 0; i < numWrap; i++)
              thisData.copyValues(thisData, numEdge + i, i, blockSize);
          }
        }
      }
      for (let i = 0; i < numEdge; i++)
        this.auxData.indices[i] = other.auxData.indices[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.auxData.indices[numEdge + i] = this.auxData.indices[i];
    }
  }
  private static trimArray(data: any[] | undefined, length: number) { if (data && length < data.length) data.length = length; }
  /** Trim all index arrays to stated length.
   * * This is called by PolyfaceBuilder to clean up after an aborted construction sequence.
   */
  public trimAllIndexArrays(length: number): void {
    PolyfaceData.trimArray(this.pointIndex, length);
    PolyfaceData.trimArray(this.paramIndex, length);
    PolyfaceData.trimArray(this.normalIndex, length);
    PolyfaceData.trimArray(this.colorIndex, length);
    PolyfaceData.trimArray(this.edgeVisible, length);
    if (this.auxData) {
      PolyfaceData.trimArray(this.auxData.indices, length);
      for (const channel of this.auxData.channels) {
        for (const data of channel.data)
          PolyfaceData.trimArray(data.values, channel.entriesPerValue * length);
      }
    }
  }
  /** Resize all data arrays to specified length */
  public resizeAllDataArrays(length: number): void {
    if (length > this.point.length) {
      while (this.point.length < length) this.point.push(Point3d.create());
      while (this.pointIndex.length < length) this.pointIndex.push(-1);
      while (this.edgeVisible.length < length) this.edgeVisible.push(false);
      if (this.normal)
        while (this.normal.length < length) this.normal.push(Vector3d.create());
      if (this.param)
        while (this.param.length < length) this.param.push(Point2d.create());
      if (this.color)
        while (this.color.length < length) this.color.push(0);
      if (this.auxData) {
        for (const channel of this.auxData.channels) {
          for (const channelData of channel.data) {
            while (channelData.values.length < length * channel.entriesPerValue) channelData.values.push(0);
          }
        }
      }
    } else if (length < this.point.length) {
      this.point.resize(length);
      this.edgeVisible.length = length;
      this.pointIndex.length = length;
      if (this.normal) this.normal.resize(length);
      if (this.param) this.param.resize(length);
      if (this.color) this.color.length = length;
      if (this.auxData) {
        for (const channel of this.auxData.channels) {
          for (const channelData of channel.data) {
            channelData.values.length = length * channel.entriesPerValue;
          }
        }
      }
    }
  }
  /** Return the range of the point array (optionally transformed) */
  public range(result?: Range3d, transform?: Transform): Range3d {
    result = result ? result : Range3d.createNull();
    result.extendArray(this.point, transform);
    return result;
  }
  /** reverse indices facet-by-facet, with the given facetStartIndex array delimiting faces.
   *
   * * facetStartIndex[0] == 0 always -- start of facet zero.
   * * facet k has indices from facetStartIndex[k] <= i < facetStartIndex[k+1]
   * * hence for "internal" k, facetStartIndex[k] is both the upper limit of facet k-1 and the start of facet k.
   * *
   */
  public reverseIndices(facetStartIndex?: number[]) {
    if (facetStartIndex && PolyfaceData.isValidFacetStartIndexArray(facetStartIndex)) {
      PolyfaceData.reverseIndices(facetStartIndex, this.pointIndex, true);
      if (this.normalIndex !== this.pointIndex)
        PolyfaceData.reverseIndices(facetStartIndex, this.normalIndex, true);
      if (this.paramIndex !== this.pointIndex)
        PolyfaceData.reverseIndices(facetStartIndex, this.paramIndex, true);
      if (this.colorIndex !== this.pointIndex)
        PolyfaceData.reverseIndices(facetStartIndex, this.colorIndex, true);
      PolyfaceData.reverseIndices(facetStartIndex, this.edgeVisible, false);
    }
  }
  /** reverse indices facet-by-facet, with the given facetStartIndex array delimiting faces.
   *
   * * facetStartIndex[0] == 0 always -- start of facet zero.
   * * facet k has indices from facetStartIndex[k] <= i < facetStartIndex[k+1]
   * * hence for "internal" k, facetStartIndex[k] is both the upper limit of facet k-1 and the start of facet k.
   * *
   */
  public reverseIndicesSingleFacet(facetId: number, facetStartIndex: number[]) {
    PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, this.pointIndex, true);
    if (this.normalIndex !== this.pointIndex)
      PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, this.normalIndex, true);
    if (this.paramIndex !== this.pointIndex)
      PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, this.paramIndex, true);
    if (this.colorIndex !== this.pointIndex)
      PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, this.colorIndex, true);
    PolyfaceData.reverseIndicesSingleFacet(facetId, facetStartIndex, this.edgeVisible, false);
  }

  /** Scale all the normals by -1 */
  public reverseNormals() {
    if (this.normal)
      this.normal.scaleInPlace(-1.0);
  }
  /** Apply `transform` to point and normal arrays.
   * * IMPORTANT This base class is just a data carrier.  It does not know if the index order and normal directions have special meaning.
   * * i.e. caller must separately reverse index order and normal direction if needed.
   */
  public tryTransformInPlace(
    transform: Transform): boolean {
    this.point.multiplyTransformInPlace(transform);

    if (this.normal && !transform.matrix.isIdentity)
      this.normal.multiplyAndRenormalizeMatrix3dInverseTransposeInPlace(transform.matrix);
    return true;
  }
  /**
   * * Search for duplication of coordinates within points, normals, and params.
   * * compress the coordinate arrays.
   * * revise all indexing for the relocated coordinates
   */
  public compress() {
    const packedPoints = ClusterableArray.clusterGrowablePoint3dArray(this.point);
    this.point = packedPoints.growablePackedPoints!;
    packedPoints.updateIndices(this.pointIndex);
    //  compressUnusedGrowableXYZArray(this.point, this.pointIndex);

    if (this.normalIndex && this.normal) {
      const packedNormals = ClusterableArray.clusterGrowablePoint3dArray(this.normal);
      this.normal = packedNormals.growablePackedPoints!;
      packedNormals.updateIndices(this.normalIndex);
    }

    if (this.paramIndex && this.param) {
      const packedParams = ClusterableArray.clusterGrowablePoint2dArray(this.param);
      this.param = packedParams.growablePackedPoints;
      packedParams.updateIndices(this.paramIndex);
    }
  }

  /**
   * Test if facetStartIndex is (minimally!) valid:
   * * length must be nonzero (recall that for "no facets" the facetStartIndexArray still must contain a 0)
   * * Each entry must be strictly smaller than the one that follows.
   * @param facetStartIndex array of facetStart data.  facet `i` has indices at `facetsStartIndex[i]` to (one before) `facetStartIndex[i+1]`
   */
  public static isValidFacetStartIndexArray(facetStartIndex: number[]): boolean {
    // facetStartIndex for empty facets has a single entry "0" -- empty array is not allowed
    if (facetStartIndex.length === 0)
      return false;
    for (let i = 0; i + 1 < facetStartIndex.length; i++)
      if (facetStartIndex[i] >= facetStartIndex[i + 1])
        return false;
    return true;
  }
  /** Reverse data in entire facet indexing arrays.
   * * parameterized over type T so non-number data -- e.g. boolean visibility flags -- can be reversed.
   */
  public static reverseIndices<T>(facetStartIndex: number[], indices: T[] | undefined, preserveStart: boolean): boolean {
    if (!indices || indices.length === 0)
      return true;  // empty case
    if (indices.length > 0) {
      if (facetStartIndex[facetStartIndex.length - 1] === indices.length) {
        for (let i = 0; i + 1 < facetStartIndex.length; i++) {
          let index0 = facetStartIndex[i];
          let index1 = facetStartIndex[i + 1];
          if (preserveStart) {
            // leave [index0] as is so reversed facet starts at same vertex
            while (index1 > index0 + 2) {
              index1--; index0++;
              const a = indices[index0];
              indices[index0] = indices[index1];
              indices[index1] = a;
            }
          } else {
            // reverse all
            while (index1 > index0 + 1) {
              index1--;
              const a = indices[index0];
              indices[index0] = indices[index1];
              indices[index1] = a;
              index0++;
            }
          }
        }
        return true;
      }
    }
    return false;
  }

  /** Reverse data in entire facet indexing arrays.
   * * parameterized over type T so non-number data -- e.g. boolean visibility flags -- can be reversed.
   */
  public static reverseIndicesSingleFacet<T>(facetId: number, facetStartIndex: number[], indices: T[] | undefined, preserveStart: boolean): boolean {
    if (!indices || indices.length === 0)
      return true;  // empty case
    if (indices.length > 0) {
      if (facetStartIndex[facetStartIndex.length - 1] === indices.length
        && facetId >= 0 && facetId + 1 < facetStartIndex.length) {
        let index0 = facetStartIndex[facetId];
        let index1 = facetStartIndex[facetId + 1];
        if (preserveStart) {
          // leave [index0] as is so reversed facet starts at same vertex
          while (index1 > index0 + 2) {
            index1--; index0++;
            const a = indices[index0];
            indices[index0] = indices[index1];
            indices[index1] = a;
          }
        } else {
          // reverse all
          while (index1 > index0 + 1) {
            index1--;
            const a = indices[index0];
            indices[index0] = indices[index1];
            indices[index1] = a;
            index0++;
          }
        }
        return true;
      }
    }
    return false;
  }
}

/*
 * pack out data entries that are unreferenced.
 * @param data data to pack
 * @param indices indices into the data.

function compressUnusedGrowableXYZArray(data: GrowableXYZArray, indices: number[]): boolean {
  // 1 entry per data[i]
  // pass 0: number of references
  // pass 1: post-compression index (or -1)
  const n0 = data.length;
  const work = new Int32Array(data.length);
  for (const k of indices) {
    if (k < 0 || k >= n0)
      return false;
    work[k]++;
  }
  let n1 = 0;
  for (let i = 0; i < n0; i++) {
    if (work[i] === 0)
      work[i] = -1;
    else
      work[i] = n1++;
  }
  const numIndex = indices.length;
  for (let i = 0; i < numIndex; i++) {
    indices[i] = work[indices[i]];
  }
  for (let i = 0; i < n0; i++) {
    const j = work[i];
    if (j >= 0)
      data.moveIndexToIndex(i, j);
  }
  data.length = n1;
  return true;
}
*/
