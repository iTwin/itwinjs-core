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

// cspell:word internaldocs

/**
 * `PolyfaceData` carries data arrays for point, normal, uv-parameters, and color, and index arrays for each.
 * * Normal, uv-parameter, and color data are optional.
 * * A given data array is defined if and only if its corresponding index array is defined.
 * * All defined index arrays have parallel face loop order and structure, and thus the same length.
 * * `IndexedPolyface` carries a PolyfaceData as a member (NOT as a base class; it already has `GeometryQuery` as base).
 * * `IndexedPolyfaceVisitor` uses PolyfaceData as a base class. In this use, there is only a single facet in `PolyfaceData`.
 * * `PolyfaceData` does not know what index range constitutes a given facet. This is managed by a derived/carrier class.
 * @public
 */
export class PolyfaceData {
  /**
   * Relative tolerance used in tests for planar facets.
   * @internal
  */
  public static readonly planarityLocalRelTol = 1.0e-13;
  /** Coordinate data for points in the facets (packed as numbers in a contiguous array). */
  public point: GrowableXYZArray;
  /** Indices of points at facet vertices. */
  public pointIndex: number[];
  /** Coordinates of normal vectors (packed as numbers in a contiguous array). */
  public normal: GrowableXYZArray | undefined;
  /** Indices of normals at facet vertices. */
  public normalIndex: number[] | undefined;
  /** Coordinates of uv parameters (packed as numbers in a contiguous array). */
  public param?: GrowableXYArray;
  /** Indices of params at facet vertices. */
  public paramIndex: number[] | undefined;
  /**
   * Color values. These are carried around as simple numbers, but are probably required (by display systems) to map
   * exactly to 32-bit integers.
   */
  public color: number[] | undefined;
  /** Indices of colors at facet vertices. */
  public colorIndex: number[] | undefined;
  /**
   * Map from facet index to face data.
   * * A "face" is a logical grouping of connected facets in the mesh, e.g., the facets that resulted from faceting
   * a given face of a solid.
   * * Face data remains empty until a face is specified.
   */
  public face: FacetFaceData[];
  /** Auxiliary data. */
  public auxData: PolyfaceAuxData | undefined;
  /** Tagged geometry data. */
  public taggedNumericData: TaggedNumericData | undefined;
  /**
   * Booleans indicating visibility of corresponding edges.
   * * The `edgeVisible` array is parallel to the `pointIndex` array.
   * * The visibility flag applies to the edge whose start vertex index appears in the same place in the `pointIndex` array.
   * * For example, consider the mesh with 2 triangular facets given by `pointIndex = [1,0,2, 1,2,3]`. If the triangles'
   * shared edge is hidden, then the mesh has `edgeVisible = [true,true,false, false,true,true]`.
   */
  public edgeVisible: boolean[];
  /** Boolean tag indicating if the facets are viewable from the back. */
  private _twoSided: boolean;
  /**
   * Flag indicating if the mesh closure is unknown (0), open sheet (1), closed solid (2).
   * * A boundary edge of a mesh is defined as an edge with only one connected facet.
   * * Closed solid is a mesh with no boundary edge. Open sheet is a mesh that has boundary edge(s).
   */
  private _expectedClosure: number;
  /**
   * Constructor for facets.
   * @param needNormals `true` to allocate empty normal data and index arrays; `false` (default) to leave undefined.
   * @param needParams `true` to allocate empty uv parameter data and index arrays; `false` (default) to leave undefined.
   * @param needColors `true` to allocate empty color data and index arrays; `false` (default) to leave undefined.
   * @param twoSided `true` if the facets are to be considered viewable from the back; `false` (default) if not.
   */
  public constructor(
    needNormals: boolean = false, needParams: boolean = false, needColors: boolean = false, twoSided: boolean = false,
  ) {
    this.point = new GrowableXYZArray();
    this.pointIndex = [];
    if (needNormals) {
      this.normal = new GrowableXYZArray();
      this.normalIndex = [];
    }
    if (needParams) {
      this.param = new GrowableXYArray();
      this.paramIndex = [];
    }
    if (needColors) {
      this.color = [];
      this.colorIndex = [];
    }
    this.face = [];
    this.edgeVisible = [];
    this._twoSided = twoSided;
    this._expectedClosure = 0;
  }
  /** Return a deep clone. */
  public clone(): PolyfaceData {
    const result = new PolyfaceData();
    result.point = this.point.clone();
    result.pointIndex = this.pointIndex.slice();
    if (this.normal)
      result.normal = this.normal.clone();
    if (this.normalIndex)
      result.normalIndex = this.normalIndex.slice();
    if (this.param)
      result.param = this.param.clone();
    if (this.paramIndex)
      result.paramIndex = this.paramIndex.slice();
    if (this.color)
      result.color = this.color.slice();
    if (this.colorIndex)
      result.colorIndex = this.colorIndex.slice();
    result.face = this.face.slice();
    if (this.auxData)
      result.auxData = this.auxData.clone();
    if (this.taggedNumericData)
      result.taggedNumericData = this.taggedNumericData.clone();
    result.edgeVisible = this.edgeVisible.slice();
    result.twoSided = this.twoSided;
    result.expectedClosure = this.expectedClosure;
    return result;
  }
  /** Test for equal indices and nearly equal coordinates. */
  public isAlmostEqual(other: PolyfaceData): boolean {
    if (!GrowableXYZArray.isAlmostEqual(this.point, other.point))
      return false;
    if (!NumberArray.isExactEqual(this.pointIndex, other.pointIndex))
      return false;
    if (!GrowableXYZArray.isAlmostEqual(this.normal, other.normal))
      return false;
    if (!NumberArray.isExactEqual(this.normalIndex, other.normalIndex))
      return false;
    if (!GrowableXYArray.isAlmostEqual(this.param, other.param))
      return false;
    if (!NumberArray.isExactEqual(this.paramIndex, other.paramIndex))
      return false;
    if (!NumberArray.isExactEqual(this.color, other.color))
      return false;
    if (!NumberArray.isExactEqual(this.colorIndex, other.colorIndex))
      return false;
    if (!PolyfaceAuxData.isAlmostEqual(this.auxData, other.auxData))
      return false;
    if (!TaggedNumericData.areAlmostEqual(this.taggedNumericData, other.taggedNumericData))
      return false;
    if (!NumberArray.isExactEqual(this.edgeVisible, other.edgeVisible))
      return false;
    if (this.twoSided !== other.twoSided)
      return false;
    if (this.expectedClosure !== other.expectedClosure)
      return false;
    return true;
  }
  /** Ask if normals are required in this mesh. */
  public get requireNormals(): boolean {
    return undefined !== this.normal;
  }
  /** Ask if params are required in this mesh. */
  public get requireParams(): boolean {
    return undefined !== this.param;
  }
  /** Ask if colors are required in this mesh. */
  public get requireColors(): boolean {
    return undefined !== this.color;
  }
  /** Get the point count */
  public get pointCount() {
    return this.point.length;
  }
  /** Get the normal count */
  public get normalCount() {
    return this.normal ? this.normal.length : 0;
  }
  /** Get the param count */
  public get paramCount() {
    return this.param ? this.param.length : 0;
  }
  /** Get the color count */
  public get colorCount() {
    return this.color ? this.color.length : 0;
  }
  /** Get the index count. Note that the point array is always indexed, and index arrays all have the same length. */
  public get indexCount() {
    return this.pointIndex.length;
  }
  /**
   * Get the number of faces.
   * * Note that a "face" is not a facet.
   * * A face is a subset of the Polyface's facets grouped for application purposes.
   */
  public get faceCount() {
    return this.face.length;
  }
  /** Return indexed point at index `i`. This is a COPY of the coordinates, not a reference. */
  public getPoint(i: number, result?: Point3d): Point3d | undefined {
    return this.point.getPoint3dAtCheckedPointIndex(i, result);
  }
  /** Return indexed normal at index `i`. This is a COPY of the normal, not a reference. */
  public getNormal(i: number, result?: Vector3d): Vector3d | undefined {
    return this.normal ? this.normal.getVector3dAtCheckedVectorIndex(i, result) : undefined;
  }
  /** Return indexed param at index `i`. This is a COPY of the coordinates, not a reference. */
  public getParam(i: number, result?: Point2d): Point2d | undefined {
    return this.param ? this.param.getPoint2dAtCheckedPointIndex(i, result) : undefined;
  }
  /** Return indexed color at index `i`. Index `i` is not checked for validity. */
  public getColor(i: number): number {
    return this.color ? this.color[i] : 0;
  }
  /** Return indexed visibility. at index `i`. Index `i` is not checked for validity. */
  public getEdgeVisible(i: number): boolean {
    return this.edgeVisible[i];
  }
  /** Get boolean tag indicating if the facets are to be considered viewable from the back. */
  public get twoSided(): boolean {
    return this._twoSided;
  }
  public set twoSided(value: boolean) {
    this._twoSided = value;
  }
  /** Get flag indicating if the mesh closure is unknown (0), open sheet (1), closed solid (2). */
  public get expectedClosure(): number {
    return this._expectedClosure;
  }
  public set expectedClosure(value: number) {
    this._expectedClosure = value;
  }
  /** Set the tagged geometry data. */
  public setTaggedNumericData(data: TaggedNumericData | undefined) {
    this.taggedNumericData = data;
  }
  /** Copy the contents (not pointer) of `point[i]` into `dest`. Index `i` is not checked for validity. */
  public copyPointTo(i: number, dest: Point3d): void {
    this.point.getPoint3dAtUncheckedPointIndex(i, dest);
  }
  /** Copy the contents (not pointer) of `normal[i]` into `dest`. Index `i` is not checked for validity. */
  public copyNormalTo(i: number, dest: Vector3d): void {
    if (this.normal)
      this.normal.getVector3dAtUncheckedVectorIndex(i, dest);
  }
  /** Copy the contents (not pointer) of `param[i]` into `dest`. Index `i` is not checked for validity. */
  public copyParamTo(i: number, dest: Point2d): void {
    if (this.param)
      this.param.getPoint2dAtUncheckedPointIndex(i, dest);
  }
  /** Test if param at a index `i` matches the given uv */
  public isAlmostEqualParamIndexUV(i: number, u: number, v: number): boolean {
    if (this.param !== undefined && i >= 0 && i < this.param.length)
      return Geometry.isSameCoordinate(u, this.param.getXAtUncheckedPointIndex(i))
        && Geometry.isSameCoordinate(v, this.param.getYAtUncheckedPointIndex(i));
    return false;
  }
  /**
   * Copy data from `other` to `this`.
   * * This is the essence of transferring coordinates spread throughout a large polyface into a visitor's single facet.
   * * Common usage: "other" is a Polyface, "this" is a PolyfaceVisitor to receive data from a single facet of the Polyface.
   * * Does NOT copy face data - visitors reference the FacetFaceData array for the whole polyface.
   * @param other polyface data being mined.
   * @param index0 start index in other's index arrays.
   * @param index1 end index (one beyond last data accessed) in other's index arrays.
   * @param numWrap number of points to replicate as wraparound.
   */
  public gatherIndexedData(other: PolyfaceData, index0: number, index1: number, numWrap: number): void {
    const numEdge = index1 - index0;
    if (numWrap > numEdge)
      numWrap = numEdge;
    const numTotal = numEdge + numWrap;
    this.resizeAllArrays(numTotal);
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
    // copy wrapped normals
    if (this.normal && this.normalIndex && other.normal && other.normalIndex) {
      for (let i = 0; i < numEdge; i++)
        this.normal.transferFromGrowableXYZArray(i, other.normal, other.normalIndex[index0 + i]);
      for (let i = 0; i < numWrap; i++)
        this.normal.transferFromGrowableXYZArray(numEdge + i, this.normal, i);
      // copy wrapped normalIndex
      for (let i = 0; i < numEdge; i++)
        this.normalIndex[i] = other.normalIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.normalIndex[numEdge + i] = this.normalIndex[i];
    }
    // copy wrapped params
    if (this.param && this.paramIndex && other.param && other.paramIndex) {
      for (let i = 0; i < numEdge; i++)
        this.param.transferFromGrowableXYArray(i, other.param, other.paramIndex[index0 + i]);
      for (let i = 0; i < numWrap; i++)
        this.param.transferFromGrowableXYArray(numEdge + i, this.param, i);
      // copy wrapped paramIndex
      for (let i = 0; i < numEdge; i++)
        this.paramIndex[i] = other.paramIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.paramIndex[numEdge + i] = this.paramIndex[i];
    }
    // copy wrapped colors
    if (this.color && this.colorIndex && other.color && other.colorIndex) {
      for (let i = 0; i < numEdge; i++)
        this.color[i] = other.color[other.colorIndex[index0 + i]];
      for (let i = 0; i < numWrap; i++)
        this.color[numEdge + i] = this.color[i];
      // copy wrapped colorIndex
      for (let i = 0; i < numEdge; i++)
        this.colorIndex[i] = other.colorIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.colorIndex[numEdge + i] = this.colorIndex[i];
    }
    // copy wrapped edge visibility
    for (let i = 0; i < numEdge; i++)
      this.edgeVisible[i] = other.edgeVisible[index0 + i];
    for (let i = 0; i < numWrap; i++)
      this.edgeVisible[numEdge + i] = this.edgeVisible[i];
    // copy wrapped auxData
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
              thisData.copyValues(otherData, i, other.auxData.indices[index0 + i], blockSize);
            for (let i = 0; i < numWrap; i++)
              thisData.copyValues(thisData, other.auxData.indices[numEdge + i], i, blockSize);
          }
        }
      }
      // copy wrapped auxData index
      for (let i = 0; i < numEdge; i++)
        this.auxData.indices[i] = other.auxData.indices[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.auxData.indices[numEdge + i] = this.auxData.indices[i];
    }
  }
  /** Trim the `data` arrays to the stated `length`. */
  private static trimArray(data: any[] | undefined, length: number) {
    if (data && length < data.length)
      data.length = length;
  }
  /**
   * Trim all index arrays to the stated `length`.
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
  /**
   * Resize all data and index arrays to the specified `length`.
   * * This is used by visitors, whose data and index arrays are all parallel.
   */
  public resizeAllArrays(length: number): void {
    if (length > this.point.length) {
      while (this.point.length < length)
        this.point.push(Point3d.create());
      while (this.pointIndex.length < length)
        this.pointIndex.push(-1);
      if (this.normal)
        while (this.normal.length < length)
          this.normal.push(Vector3d.create());
      if (this.normalIndex)
        while (this.normalIndex.length < length)
          this.normalIndex.push(-1);
      if (this.param)
        while (this.param.length < length)
          this.param.push(Point2d.create());
      if (this.paramIndex)
        while (this.paramIndex.length < length)
          this.paramIndex.push(-1);
      if (this.color)
        while (this.color.length < length)
          this.color.push(0);
      if (this.colorIndex)
        while (this.colorIndex.length < length)
          this.colorIndex.push(-1);
      while (this.edgeVisible.length < length)
        this.edgeVisible.push(false);
      if (this.auxData) {
        for (const channel of this.auxData.channels) {
          for (const channelData of channel.data) {
            while (channelData.values.length < length * channel.entriesPerValue) channelData.values.push(0);
          }
        }
        if (this.auxData.indices)
          this.auxData.indices.push(-1);
      }
    } else if (length < this.point.length) {
      this.point.resize(length);
      this.pointIndex.length = length;
      if (this.normal)
        this.normal.resize(length);
      if (this.normalIndex)
        this.normalIndex.length = length;
      if (this.param)
        this.param.resize(length);
      if (this.paramIndex)
        this.paramIndex.length = length;
      if (this.color)
        this.color.length = length;
      if (this.colorIndex)
        this.colorIndex.length = length;
      this.edgeVisible.length = length;
      if (this.auxData) {
        for (const channel of this.auxData.channels) {
          for (const channelData of channel.data) {
            channelData.values.length = length * channel.entriesPerValue;
          }
        }
        if (this.auxData.indices)
          this.auxData.indices.length = length;
      }
    }
  }
  /**
   * Resize all data arrays to the specified `length`.
   * @deprecated in 4.x because name is misleading. Call [[PolyfaceData.resizeAllArrays]] instead.
   */
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
  /** Return the range of the point array (optionally transformed). */
  public range(result?: Range3d, transform?: Transform): Range3d {
    result = result ? result : Range3d.createNull();
    result.extendArray(this.point, transform);
    return result;
  }
  /**
   * Apply `transform` to point and normal arrays and to auxData.
   * * IMPORTANT This base class is just a data carrier. It does not know if the index order and normal directions
   * have special meaning, i.e., caller must separately reverse index order and normal direction if needed.
   */
  public tryTransformInPlace(transform: Transform): boolean {
    this.point.multiplyTransformInPlace(transform);
    if (this.normal && !transform.matrix.isIdentity)
      this.normal.multiplyAndRenormalizeMatrix3dInverseTransposeInPlace(transform.matrix);
    return undefined === this.auxData || this.auxData.tryTransformInPlace(transform);
  }
  /**
   * Compress the instance by equating duplicate data.
   * * Search for duplicates within points, normals, params, and colors.
   * * Compress each data array.
   * * Revise all indexing for the relocated data.
   * @param tolerance (optional) tolerance for clustering mesh vertices. Default is [[Geometry.smallMetricDistance]].
   */
  public compress(tolerance: number = Geometry.smallMetricDistance): void {
    // more info can be found at geometry/internaldocs/Polyface.md
    const packedPoints = ClusterableArray.clusterGrowablePoint3dArray(this.point, tolerance);
    this.point = packedPoints.growablePackedPoints!;
    packedPoints.updateIndices(this.pointIndex);
    // for now, normals, params, and colors use the default tolerance for clustering
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
    if (this.colorIndex && this.color) {
      const packedColors = ClusterableArray.clusterNumberArray(this.color);
      this.color = packedColors.packedNumbers;
      packedColors.updateIndices(this.colorIndex);
    }
  }
  /**
   * Test if `facetStartIndex` is (minimally) valid.
   * * Length must be nonzero (recall that for "no facets", the `facetStartIndex` array still must contain a 0).
   * * Each entry must be strictly smaller than the one that follows.
   * @param facetStartIndex start indices of all facets. Facet k starts at facetStartIndex[k] up to (but not including)
   * `facetStartIndex[k + 1]`
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
  /**
   * Reverse the indices for the specified facets in the given index array.
   * * Parameterized over type T so non-number data (e.g., boolean visibility flags) can be reversed.
   * @param facetStartIndex start indices of *consecutive* facets to be reversed, e.g., an IndexedPolyface's _facetStart
   * array. See the non-static [[reverseIndices]].
   * @param indices the index array, e.g., pointIndex, normalIndex, etc.
   * @param preserveStart `true` to preserve the start index of each facet (e.g., facet [1,2,3,4] becomes [1,4,3,2]);
   * `false` to reverse all indices (e.g., facet [1,2,3,4] becomes [4,3,2,1]).
   */
  public static reverseIndices<T>(facetStartIndex: number[], indices: T[] | undefined, preserveStart: boolean): boolean {
    if (!indices || indices.length === 0)
      return true; // empty case
    if (indices.length > 0) {
      if (facetStartIndex[facetStartIndex.length - 1] === indices.length) {
        for (let i = 0; i + 1 < facetStartIndex.length; i++) {
          let index0 = facetStartIndex[i];
          let index1 = facetStartIndex[i + 1];
          if (preserveStart) { // leave "index0" as is so reversed facet starts at same vertex
            while (index1 > index0 + 2) {
              index1--;
              index0++;
              const a = indices[index0];
              indices[index0] = indices[index1];
              indices[index1] = a;
            }
          } else { // reverse all
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

  /**
   * Reverse the indices for the specified facet in the specified index array.
   * * Parameterized over type T so non-number data (e.g., boolean visibility flags) can be reversed.
   * @param facetIndex index of the facet to reverse. The entries of `indices` to be reversed are found at
   * `facetStartIndex[facetIndex] <= i < facetStartIndex[facetIndex + 1]`.
   * @param facetStartIndex start indices of *consecutive* facets, e.g., an IndexedPolyface's _facetStart array.
   * See [[reverseIndices]].
   * @param indices the index array, e.g., pointIndex, normalIndex, etc.
   * @param preserveStart `true` to preserve the start index of each facet (e.g., facet [1,2,3,4] becomes [1,4,3,2]);
   * `false` to reverse all indices (e.g., facet [1,2,3,4] becomes [4,3,2,1]).
   */
  public static reverseIndicesSingleFacet<T>(
    facetIndex: number, facetStartIndex: number[], indices: T[] | undefined, preserveStart: boolean,
  ): boolean {
    if (!indices || indices.length === 0)
      return true; // empty case
    if (indices.length > 0) {
      if (facetStartIndex[facetStartIndex.length - 1] === indices.length
        && facetIndex >= 0 && facetIndex + 1 < facetStartIndex.length) {
        let index0 = facetStartIndex[facetIndex];
        let index1 = facetStartIndex[facetIndex + 1];
        if (preserveStart) { // leave "index0" as is so reversed facet starts at same vertex
          while (index1 > index0 + 2) {
            index1--;
            index0++;
            const a = indices[index0];
            indices[index0] = indices[index1];
            indices[index1] = a;
          }
        } else { // reverse all
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
  /**
   * Reverse the indices for the specified facets in the index arrays (pointIndex, normalIndex, paramIndex, colorIndex,
   * and edgeVisible).
   * @param facetStartIndex start indices of *consecutive* facets to be reversed.
   * * Consecutive indices in this array define where a given facet is represented in each of the parallel index arrays.
   * * The indices for facet k are `facetStartIndex[k]` up to (but not including) `facetStartIndex[k + 1]`.
   * * This implies `facetStartIndex[k + 1]` is both the upper limit of facet k's indices, and the start index of facet k+1.
   * * For example, passing an IndexedPolyface's _facetStart array into this method reverses every facet.
  */
  public reverseIndices(facetStartIndex?: number[]): void {
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
  /**
   * Reverse the indices for the specified facet in the index arrays (pointIndex, normalIndex, paramIndex, colorIndex,
   * and edgeVisible).
   * @param facetIndex index of the facet to reverse. The entries of each index array to be reversed are found at
   * `facetStartIndex[facetIndex] <= i < facetStartIndex[facetIndex + 1]`.
   * @param facetStartIndex start indices of *consecutive* facets, e.g., an IndexedPolyface's _facetStart array.
   * See [[reverseIndices]].
   */
  public reverseIndicesSingleFacet(facetIndex: number, facetStartIndex: number[]): void {
    PolyfaceData.reverseIndicesSingleFacet(facetIndex, facetStartIndex, this.pointIndex, true);
    if (this.normalIndex !== this.pointIndex)
      PolyfaceData.reverseIndicesSingleFacet(facetIndex, facetStartIndex, this.normalIndex, true);
    if (this.paramIndex !== this.pointIndex)
      PolyfaceData.reverseIndicesSingleFacet(facetIndex, facetStartIndex, this.paramIndex, true);
    if (this.colorIndex !== this.pointIndex)
      PolyfaceData.reverseIndicesSingleFacet(facetIndex, facetStartIndex, this.colorIndex, true);
    PolyfaceData.reverseIndicesSingleFacet(facetIndex, facetStartIndex, this.edgeVisible, false);
  }
  /** Scale all the normals by -1. */
  public reverseNormals() {
    if (this.normal)
      this.normal.scaleInPlace(-1.0);
  }
}
