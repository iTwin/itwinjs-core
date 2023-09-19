/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

/* eslint-disable @typescript-eslint/naming-convention, no-empty */
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
import { IndexedEdgeMatcher, SortableEdgeCluster } from "./IndexedEdgeMatcher";
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
  protected constructor(data: PolyfaceData) {
    super();
    this.data = data;
  }
  /** create and return a visitor for this concrete polyface. */
  public abstract createVisitor(_numWrap: number): PolyfaceVisitor;
  /** Flag indicating if the mesh display must assume both sides are visible. */
  public get twoSided() { return this.data.twoSided; }
  public set twoSided(value: boolean) { this.data.twoSided = value; }
  /** Flag indicating if the mesh closure is unknown (0), open sheet (1), closed (2) */
  public get expectedClosure(): number { return this.data.expectedClosure; }
  public set expectedClosure(value: number) { this.data.expectedClosure = value; }
  /**
     * Check validity of indices into a data array.
     * * It is valid to have  both indices and data undefined.
     * * It is NOT valid for just one to be defined.
     * * Index values at indices[indexPositionA <= i < indexPositionB] must be valid indices to the data array.
     * @param indices array of indices.
     * @param indexPositionA first index to test
     * @param indexPositionB one past final index to test
     * @param data data array
     * @param dataLength length of data array
     */
  public static areIndicesValid(indices: number[] | undefined, indexPositionA: number, indexPositionB: number, data: any | undefined, dataLength: number): boolean {
    if (indices === undefined && data === undefined)
      return true;
    if (!indices || !data)
      return false;
    if (indexPositionA < 0 || indexPositionA >= indices.length)
      return false;
    if (indexPositionB < indexPositionA || indexPositionB > indices.length)
      return false;
    for (let i = indexPositionA; i < indexPositionB; i++)
      if (indices[i] < 0 || indices[i] >= dataLength)
        return false;
    return true;
  }
  /**
   * Returns true if this polyface has no facets.
   */
  public abstract get isEmpty(): boolean;
  /**
   * Returns the number of facets of this polyface. Subclasses should override.
   */
  public get facetCount(): number | undefined {
    return undefined;
  }
}
/**
 * An `IndexedPolyface` is a set of facets which can have normal, param, and color arrays with independent point, normal, param, and color indices.
 * @public
 */
export class IndexedPolyface extends Polyface {
  /** Test if other is an instance of `IndexedPolyface` */
  public isSameGeometryClass(other: any): boolean { return other instanceof IndexedPolyface; }
  /** Tests for equivalence between two IndexedPolyfaces. */
  public override isAlmostEqual(other: any): boolean {
    if (other instanceof IndexedPolyface) {
      return this.data.isAlmostEqual(other.data) && NumberArray.isExactEqual(this._facetStart, other._facetStart) &&
        NumberArray.isExactEqual(this._facetToFaceData, other._facetToFaceData);
    }
    return false;
  }
  /**
   * Returns true if either the point array or the point index array is empty.
   */
  public get isEmpty(): boolean { return this.data.pointCount === 0 || this.data.pointIndex.length === 0; }
  /**
   * * apply the transform to points
   * * apply the (inverse transpose of) the matrix part to normals
   * * If determinant is negative, also
   *   * negate normals
   *   * reverse index order around each facet.
   * @param transform
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
  /** Return a deep clone with transformed points and normals */
  public cloneTransformed(transform: Transform): IndexedPolyface {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }
  /** Reverse the order of indices around all facets. */
  public reverseIndices() { this.data.reverseIndices(this._facetStart); }
  /** Reverse the direction of all normal vectors. */
  public reverseNormals() { this.data.reverseNormals(); }
  /**
   * * index to the index array entries for a specific facet.
   * * the facet count is facetStart.length - 1
   * * facet [f] indices run from facetStart[f] to upper limit facetStart[f+1].
   * * Note the array is initialized with one entry.
   */
  protected _facetStart: number[];

  /** Given a edgeIndex (index into pointIndex array of PolyfaceData):
   * * return the first edgeIndex for block of indices for that facet.
   * * i.e. search the _facetStart array for the closest facet start index not exceeding k.
   */
  public edgeIndexToFirstEdgeIndexInFacet(k: number): number | undefined {
    const q = this.edgeIndexToFacetIndex(k);
    if (q !== undefined)
      return this._facetStart[q];
    return undefined;
  }
  /** Given a edgeIndex (index into pointIndex array of PolyfaceData):
   * * return the first edgeIndex for AFTER the block of indices for this facet.
   * * i.e. search the _facetStart array for the closest facet start index not exceeding k, and the index just beyond its block.
   * * Use to step edgeIndex through this facet.
   *    ```
   *     upperK = polyface.edgeIndexToLastEdgeInFacet(k);
   *     for (let movingK = polyface.edgeIndexToUpperEdgeIndexInFacet (k);
   *               k < upperK; k++){
   *          ... process edgeIndex movingK
   *          }
   *    ```
   */
  public edgeIndexToUpperEdgeIndexInFacet(k: number): number | undefined {
    const q = this.edgeIndexToFacetIndex(k);
    if (q !== undefined)
      return this._facetStart[q + 1];
    return undefined;
  }
  /** Given an array of strictly increasing numbers, find the index of the largest number that is less than or equal to `value`.
   * * Get an initial estimate by proportions of `value` and the first and last entries.
   * * linear search from there for final value.
   * * For regular spaced numbers (e.g. _facetStart indices for a triangulated mesh) the proportional estimate will be immediately correct.
   */
  public static searchMonotoneNumbers(data: number[], value: number): number | undefined {
    // _facetStart is monotone increasing.
    // It is commonly entirely steps of 3, 4, or 3 and 4.
    // Hence jump to a start by simple proportion, and move incrementally
    const lastQ = data.length - 1;

    if (lastQ <= 0 || value < 0 || value >= data[lastQ])
      return undefined;
    let q = Math.floor((value * lastQ) / data[lastQ]);
    while (data[q] > value)
      q--;
    while (data[q + 1] <= value)
      q++;
    return q;

  }

  /** Given a edgeIndex `k` (index into pointIndex array of PolyfaceData):
   * * return the edgeIndex of its successor around its facet.
   * * this is `k+1 for all but the last of its index block, which wraps back to edgeIndexToFacetStartIndex.
   */
  public edgeIndexToSuccessorAroundFacet(k: number | undefined): number | undefined {
    if (k === undefined)
      return undefined;
    const facetIndex = IndexedPolyface.searchMonotoneNumbers(this._facetStart, k);
    if (facetIndex === undefined)
      return undefined;
    const kNextFacet = this._facetStart[facetIndex + 1];
    const kNext = k + 1;
    if (kNext < kNextFacet)
      return kNext;
    return this._facetStart[facetIndex];
  }
  /** Given a edgeIndex `k` (index into pointIndex array of PolyfaceData):
   * * return the edgeIndex of its predecessor around its facet.
   * * this is `k-1 for all but the last of its index block, which wraps forward to the last of its block.
   */
  public edgeIndexToPredecessorAroundFacet(k: number | undefined): number | undefined {
    if (k === undefined)
      return undefined;
    const facetIndex = IndexedPolyface.searchMonotoneNumbers(this._facetStart, k);
    if (facetIndex === undefined)
      return undefined;
    if (k === this._facetStart[facetIndex])
      return this._facetStart[facetIndex + 1] - 1;
    return k - 1;
  }
  /** Given a edgeIndex `k` (index into pointIndex array of PolyfaceData):
   * * return the edgeIndex of its successor around its VERTEX
   * * if the PolyfaceData has an edgeMateIndex array, this is reached via its edgeMate and then a successor around the neighbor facet.
   * * If that array is missing, return undefined.
   */
  public edgeIndexToSuccessorAroundVertex(k: number | undefined): number | undefined {
    if (k === undefined)
      return undefined;
    let k1: number | undefined;
    if (this.data.edgeMateIndex !== undefined && k < this.data.edgeMateIndex.length
      && undefined !== (k1 = this.edgeIndexToPredecessorAroundFacet(k)))
      return this.data.edgeMateIndex[k1];
    return undefined;
  }
  /** Given a edgeIndex `k` (index into pointIndex array of PolyfaceData):
   * * return the edgeIndex of the place on the adjacent facet but on the other end of the edge from edgeIndex.
   * * This is reached via the edgeMateIndex array in the PolyfaceData.
   * * If that array is missing, return undefined.
   */
  public edgeIndexToEdgeMate(k: number | undefined): number | undefined {
    if (k === undefined)
      return undefined;
    if (this.data.edgeMateIndex !== undefined
      && k >= 0
      && k < this.data.edgeMateIndex.length)
      return this.data.edgeMateIndex[k];
    return undefined;
  }
  /** Given a edgeIndex `k` (index into pointIndex array of PolyfaceData):
   * * return the edgeIndex of the place on the adjacent facet moving "backwards" around the vertex loop.
   * * If that array is missing, return undefined.
   */
  public edgeIndexToPredecessorAroundVertex(k: number | undefined): number | undefined {
    if (k === undefined)
      return undefined; let k1: number | undefined;
    if (undefined !== (k1 = this.edgeIndexToEdgeMate(k)))
      return this.edgeIndexToSuccessorAroundFacet(k1);
    return undefined;
  }

  /** Given a edgeIndex (index into pointIndex array of PolyfaceData):
   * * return the edgeIndex of the 0'th vertex of the block of indices for that facet.
   * * i.e. search the _facetStart array for the closest facet start index not exceeding k.
   */
  public edgeIndexToFacetIndex(k: number | undefined): number | undefined {
    if (k === undefined)
      return undefined;
    return IndexedPolyface.searchMonotoneNumbers(this._facetStart, k);
  }
  /**
   * In the PolyfaceData object, build the edgeMate data array.
   * After this method:
   * * The array data.edgeMateIndex be present with the same length as the other index arrays.
   * * For each facet edge with a unique "edge mate", the query polyface.edgeIndexToEdgeMate will navigate to the edge mate on the an adjacent facet.
   * * The conditions for edgeMate matching are:
   *    * pointIndices pointIndex[kA] and pointIndex[kB] are at "read index" kA and kB in the pointIndexArray, with
   *       kA and kB being consecutive indices "around the facet" (either kB===kA+1 or kA is the highest read index for the facet and kB is "wrapped" to the first of the facet)
   *    * there is another facet in which pointIndex[kC] and pointIndex[kD] are an edge with pointIndex value in reversed order, i.e.
   *       * pointIndex[kA] = pointIndex[kD]
   *       * pointIndex[kB] = pointIndex[kC]
   * * All pointIndex values that do not have this matching property are undefined.  This includes
   *    * "boundary" edges that have no mates at all
   *    * "non manifold" edges that have more than one mate, or a single mate that is in the wrong direction.
   * * These conditions are "just" the usual convention that each edge in a mesh has at most one partner with opposite orientation.
   * * Following this setup step, this polyface will support the queries to reach the various neighbors of any given edgeIndex k into the pointIndex array.
   *   * polyface.edgeIndexToEdgeMate = (possibly undefined) edgeIndex of the edge mate
   *   * polyface.edgeIndexToSuccessorAroundFacet = edgeIndex of the next vertex around the facet.
   *   * polyface.edgeIndexToPredecessorAroundFacet = edgeIndex of the previous vertex around the facet
   *   * polyface.edgeIndexToSuccessorAroundVertex = (possibly undefined) edgeIndex of the next vertex around the facet.
   *   * polyface.edgeIndexToPredecessorAroundVertex = (possibly undefined) edgeIndex of the previous vertex around the facet
   */
  public buildEdgeMateIndices() {
    const matcher = new IndexedEdgeMatcher();
    for (let facetIndex = 0; facetIndex + 1 < this._facetStart.length; facetIndex++) {
      const kStart = this._facetStart[facetIndex];
      const kEnd = this._facetStart[facetIndex + 1];
      let k0 = kEnd - 1;
      for (let k1 = kStart; k1 < kEnd; k0 = k1, k1++) {
        matcher.addEdge(this.data.pointIndex[k0], this.data.pointIndex[k1], k0);
      }
    }
    const matchedPairs: SortableEdgeCluster[] = [];
    const singletons: SortableEdgeCluster[] = [];
    const nullEdges: SortableEdgeCluster[] = [];
    const allOtherClusters: SortableEdgeCluster[] = [];
    matcher.sortAndCollectClusters(matchedPairs, singletons, nullEdges, allOtherClusters);

    const numIndex = this.data.pointIndex.length;
    this.data.edgeMateIndex = new Array<number>(numIndex);
    for (let i = 0; i < numIndex; i++)
      this.data.edgeMateIndex[i] = undefined;
    for (const pair of matchedPairs) {
      if (Array.isArray(pair) && pair.length === 2) {
        const k0 = pair[0].facetIndex;
        const k1 = pair[1].facetIndex;
        this.data.edgeMateIndex[k0] = k1;
        this.data.edgeMateIndex[k1] = k0;
      }
    }
  }
  /**
   * * For facet i, _facetToFaceData[i] is the index of the faceData entry for the facet.
   * * _facetToFaceData has one entry per facet.
   */
  protected _facetToFaceData: number[];

  /** return face data using a facet index. This is the REFERENCE to the FacetFaceData, not a copy. Returns undefined if none found. */
  public tryGetFaceData(i: number): FacetFaceData | undefined {
    const faceIndex = this._facetToFaceData[i];
    if (faceIndex >= this.data.face.length)
      return undefined;
    return this.data.face[faceIndex];
  }
  /**
   * Constructor for a new polyface.
   * @param data PolyfaceData arrays to capture.
   * @param facetStart optional array of facet start indices (e.g. known during clone)
   * @param facetToFacetData optional array of face identifiers (e.g. known during clone)
   */
  protected constructor(data: PolyfaceData, facetStart?: number[], facetToFaceData?: number[]) {
    super(data);
    if (facetStart)
      this._facetStart = facetStart.slice();
    else {
      this._facetStart = [];
      this._facetStart.push(0);
    }
    if (facetToFaceData)
      this._facetToFaceData = facetToFaceData.slice();
    else
      this._facetToFaceData = [];
  }
  /**
   * * Add facets from source to this polyface.
   * * Optionally reverse facet indices as per PolyfaceData.reverseIndicesSingleFacet() with preserveStart = false, and invert source normals.
   * * Optionally apply a transform to points and normals.
   * * Will only copy param, normal, color, and face data if we are already tracking them AND/OR the source contains them.
   */
  public addIndexedPolyface(source: IndexedPolyface, reversed: boolean, transform: Transform | undefined) {
    const numSourceFacets = source.facetCount;

    // Add point, point index, and edge visibility data
    // Note: there is no need to build an intermediate index map since all points are added
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
          this.addPointIndex(startOfNewPoints + source.data.pointIndex[j], source.data.edgeVisible[j > i0 ? j - 1 : i1 - 1]);
        }
      } else {
        for (let j = i0; j < i1; j++) {
          this.addPointIndex(startOfNewPoints + source.data.pointIndex[j], source.data.edgeVisible[j]);
        }
      }
      this.terminateFacet(false);
    }

    // Add param and param index data
    if (undefined !== this.data.param && undefined !== source.data.param && undefined !== source.data.paramIndex) {
      const startOfNewParams = this.data.param.length;
      this.data.param.pushFromGrowableXYArray(source.data.param);
      for (let i = 0; i < numSourceFacets; i++) {  // Expect facet start and ends for points to match normals
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

    // Add normal and normal index data
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
      for (let i = 0; i < numSourceFacets; i++) {  // Expect facet start and ends for points to match normals
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

    // Add color and color index data
    if (undefined !== this.data.color && undefined !== source.data.color && undefined !== source.data.colorIndex) {
      const startOfNewColors = this.data.color.length;
      for (const sourceColor of source.data.color)
        this.addColor(sourceColor);
      for (let i = 0; i < numSourceFacets; i++) {  // Expect facet start and ends for points to match colors
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

    // Add face and facetToFace index data
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

  /** Return the total number of param indices in zero-terminated style, which includes
   * * all the indices in the packed zero-based table
   * * one additional index for the zero-terminator of each facet.
   * @note Note that all index arrays (point, normal, param, color) have the same counts, so there
   * is not a separate query for each of them.
   */
  public get zeroTerminatedIndexCount(): number { return this.data.pointIndex.length + this._facetStart.length - 1; }
  /** Create an empty facet set, with coordinate and index data to be supplied later.
   * @param needNormals true if normals will be constructed
   * @param needParams true if uv parameters will be constructed
   * @param needColors true if colors will e constructed.
   */
  public static create(needNormals: boolean = false, needParams: boolean = false, needColors: boolean = false, twoSided: boolean = false): IndexedPolyface {
    return new IndexedPolyface(new PolyfaceData(needNormals, needParams, needColors, twoSided));
  }
  /** add (a clone of ) a point. return its 0 based index.
   * @param point point coordinates
   * @param priorIndex optional index of prior point to check for repeated coordinates
   * @returns Returns the zero-based index of the added or reused point.
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

  /** add a point.
   * @returns Returns the zero-based index of the added point.
   */
  public addPointXYZ(x: number, y: number, z: number): number { this.data.point.pushXYZ(x, y, z); return this.data.point.length - 1; }
  /** Add a uv param.
   * @returns 0-based index of the added param.
   */
  public addParam(param: Point2d): number {
    if (!this.data.param) this.data.param = new GrowableXYArray();
    this.data.param.push(param);
    return this.data.param.length - 1;
  }
  /** Add a uv parameter to the parameter array.
   * @param priorIndexA first index to check for possible duplicate value.
   * @param priorIndexB second index to check for possible duplicate value.
   * @returns 0-based index of the added or reused param.
   */
  public addParamUV(u: number, v: number, priorIndexA?: number, priorIndexB?: number): number {
    if (!this.data.param) this.data.param = new GrowableXYArray();
    if (priorIndexA !== undefined && this.data.isAlmostEqualParamIndexUV(priorIndexA, u, v))
      return priorIndexA;
    if (priorIndexB !== undefined && this.data.isAlmostEqualParamIndexUV(priorIndexB, u, v))
      return priorIndexB;
    this.data.param.pushXY(u, v);
    return this.data.param.length - 1;
  }

  /** Add a normal vector
   * @param priorIndexA first index to check for possible duplicate value.
   * @param priorIndexB second index to check for possible duplicate value.
   * @returns 0-based index of the added or reused normal.
   */
  public addNormal(normal: Vector3d, priorIndexA?: number, priorIndexB?: number): number {
    if (this.data.normal !== undefined) {
      let distance;

      if (priorIndexA !== undefined) {
        distance = this.data.normal.distanceIndexToPoint(priorIndexA, normal);
        if (distance !== undefined && Geometry.isSmallMetricDistance(distance))
          return priorIndexA;
      }
      if (priorIndexB !== undefined) {
        distance = this.data.normal.distanceIndexToPoint(priorIndexB, normal);
        if (distance !== undefined && Geometry.isSmallMetricDistance(distance))
          return priorIndexB;
      }
      // Note: Do NOT attempt to chain to tail if no prior indices given.
      // But if they are, look also to the tail.
      if (priorIndexA !== undefined || priorIndexB !== undefined) {
        const tailIndex = this.data.normal.length - 1;
        distance = this.data.normal.distanceIndexToPoint(tailIndex, normal);
        if (distance !== undefined && Geometry.isSmallMetricDistance(distance))
          return tailIndex;
      }
    }

    return this.addNormalXYZ(normal.x, normal.y, normal.z);
  }

  /** Add a normal vector given by direct coordinates
   * @returns 0-based index of the added or reused param.
   */
  public addNormalXYZ(x: number, y: number, z: number): number {
    if (!this.data.normal) this.data.normal = new GrowableXYZArray();
    this.data.normal.pushXYZ(x, y, z);
    return this.data.normal.length - 1;
  }

  /** Add a color
   * @returns 0-based index of the added or reused color.
   */
  public addColor(color: number): number {
    if (!this.data.color) this.data.color = [];
    this.data.color.push(color);
    return this.data.color.length - 1;
  }
  /** Add a point index with edge visibility flag. */
  public addPointIndex(index: number, visible: boolean = true): void { this.data.pointIndex.push(index); this.data.edgeVisible.push(visible); }
  /** Add a normal index */
  public addNormalIndex(index: number): void {
    if (!this.data.normalIndex)
      this.data.normalIndex = [];
    this.data.normalIndex.push(index);
  }
  /** Add a param index */
  public addParamIndex(index: number): void {
    if (!this.data.paramIndex)
      this.data.paramIndex = [];
    this.data.paramIndex.push(index);
  }
  /** Add a color index */
  public addColorIndex(index: number): void {
    if (!this.data.colorIndex)
      this.data.colorIndex = [];
    this.data.colorIndex.push(index);
  }

  /** clean up the open facet.  return the returnValue (so caller can easily return cleanupOpenFacet("message")) */
  public cleanupOpenFacet(): void {
    this.data.trimAllIndexArrays(this.data.pointIndex.length);
  }
  /** announce the end of construction of a facet.
   *
   * * The "open" facet is checked for:
   *
   * **  Same number of indices among all active index arrays --  point, normal, param, color
   * **  All indices are within bounds of the respective data arrays.
   * *  in error cases, all index arrays are trimmed back to the size when previous facet was terminated.
   * *  "undefined" return is normal.   Any other return is a description of an error.
   */
  public terminateFacet(validateAllIndices: boolean = true): any {
    const numFacets = this._facetStart.length - 1;
    const lengthA = this._facetStart[numFacets];  // number of indices in accepted facets
    const lengthB = this.data.pointIndex.length; // number of indices including the open facet
    if (validateAllIndices) {
      const messages: any[] = [];

      if (lengthB < lengthA + 2)
        messages.push("Less than 3 indices in open facet");
      if (this.data.normalIndex && this.data.normalIndex.length !== lengthB)
        messages.push("normalIndex count must match pointIndex count");
      if (this.data.paramIndex && this.data.paramIndex.length !== lengthB)
        messages.push("paramIndex count must equal pointIndex count");
      if (this.data.colorIndex && this.data.colorIndex.length !== lengthB)
        messages.push("colorIndex count must equal pointIndex count");
      if (this.data.edgeVisible.length !== lengthB)
        messages.push("visibleIndex count must equal pointIndex count");

      if (!Polyface.areIndicesValid(this.data.normalIndex, lengthA, lengthB, this.data.normal, this.data.normal ? this.data.normal.length : 0))
        messages.push("invalid normal indices in open facet");
      if (messages.length > 0) {
        this.cleanupOpenFacet();
        return messages;
      }
    }
    // appending to facetStart accepts the facet !!!
    this._facetStart.push(lengthB);
    return undefined;
  }
  /**
   * All terminated facets added since the declaration of the previous face
   * will be grouped into a new face with their own 2D range.
   */
  /** (read-only property) number of facets */
  public override get facetCount(): number { return this._facetStart.length - 1; }
  /** (read-only property) number of faces */
  public get faceCount(): number { return this.data.faceCount; }
  /** (read-only property) number of points */
  public get pointCount(): number { return this.data.pointCount; }
  /** (read-only property) number of colors */
  public get colorCount(): number { return this.data.colorCount; }
  /** (read-only property) number of parameters */
  public get paramCount(): number { return this.data.paramCount; }
  /** (read-only property) number of normals */
  public get normalCount(): number { return this.data.normalCount; }
  /** Return the number of edges in a particular facet. */
  public numEdgeInFacet(facetIndex: number): number {
    if (this.isValidFacetIndex(facetIndex))
      return this._facetStart[facetIndex + 1] - this._facetStart[facetIndex];
    return 0;
  }
  /** test if `facetIndex` is a valid facet index. */
  public isValidFacetIndex(facetIndex: number): boolean { return facetIndex >= 0 && facetIndex + 1 < this._facetStart.length; }
  /** ASSUME valid facetIndex . .. return its start index in index arrays. */
  public facetIndex0(facetIndex: number): number { return this._facetStart[facetIndex]; }
  /** ASSUME valid facet index . .. return its end index in index arrays. */
  public facetIndex1(facetIndex: number): number { return this._facetStart[facetIndex + 1]; }
  /** create a visitor for this polyface */
  public createVisitor(numWrap: number = 0): PolyfaceVisitor { return IndexedPolyfaceVisitor.create(this, numWrap); }
  /** Return the range of (optionally transformed) points in this mesh. */
  public override range(transform?: Transform, result?: Range3d): Range3d { return this.data.range(result, transform); }
  /** Extend `range` with coordinates from this mesh */
  public extendRange(range: Range3d, transform?: Transform): void { this.data.range(range, transform); }

  /** Given the index of a facet, return the data pertaining to the face it is a part of. */
  public getFaceDataByFacetIndex(facetIndex: number): FacetFaceData {
    return this.data.face[this._facetToFaceData[facetIndex]];
  }

  /**
   * All terminated facets since the last face declaration will be mapped to a single new FacetFaceData object
   * using facetToFaceData[]. FacetFaceData holds the 2D range of the face. Returns true if successful, false otherwise.
   */
  public setNewFaceData(endFacetIndex: number = 0): boolean {
    const facetStart = this._facetToFaceData.length;
    if (facetStart >= this._facetStart.length)
      return false;

    if (0 === endFacetIndex)  // The default for endFacetIndex is really the last facet
      endFacetIndex = this._facetStart.length; // Last facetStart index corresponds to the next facet if we were to create one

    const faceData = FacetFaceData.createNull();
    const visitor = IndexedPolyfaceVisitor.create(this, 0);

    if (!visitor.moveToReadIndex(facetStart)) {  // Move visitor to first facet of new face
      return false;
    }

    // If parameter range is provided (by the polyface planeSet clipper) then use it
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
  /** Second step of double dispatch:  call `handler.handleIndexedPolyface(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleIndexedPolyface(this);
  }
}

/**
 * A PolyfaceVisitor manages data while walking through facets.
 *
 * * The polyface visitor holds data for one facet at a time.
 * * The caller can request the position in the addressed polyfaceData as a "readIndex."
 * * The readIndex values (as numbers) are not promised to be sequential. (I.e. it might be a simple facet count or might have "gaps" at the whim of the
 *     particular PolyfaceVisitor implementation)
 * @public
 */
export interface PolyfaceVisitor extends PolyfaceData {
  /** Load data for the facet with given index. */
  moveToReadIndex(index: number): boolean;
  /** Return  the readIndex of the currently loaded facet */
  currentReadIndex(): number;
  /** Load data for the next facet. */
  moveToNextFacet(): boolean;
  /** Reset to initial state for reading all facets sequentially with moveToNextFacet */
  reset(): void;
  /** Return the point index of vertex i within the currently loaded facet */
  clientPointIndex(i: number): number;
  /** Return the param index of vertex i within the currently loaded facet */
  clientParamIndex(i: number): number;
  /** Return the normal index of vertex i within the currently loaded facet */
  clientNormalIndex(i: number): number;
  /** Return the color index of vertex i within the currently loaded facet */
  clientColorIndex(i: number): number;
  /** Return the aux data index of vertex i within the currently loaded facet */
  clientAuxIndex(i: number): number;
  /** return the client polyface */
  clientPolyface(): Polyface | undefined;
  /** Set the number of vertices to replicate in visitor arrays. */
  setNumWrap(numWrap: number): void;
  /** clear the contents of all arrays.  Use this along with `pushDataFrom` to build up new facets. */
  clearArrays(): void;
  /** transfer data from a specified index of the other visitor as new data in this visitor. */
  pushDataFrom(other: PolyfaceVisitor, index: number): void;
  /** transfer interpolated data from the other visitor.
   * * all data values are interpolated at `fraction` between `other` values at index0 and index1.
   */
  pushInterpolatedDataFrom(other: PolyfaceVisitor, index0: number, fraction: number, index1: number): void;
}

