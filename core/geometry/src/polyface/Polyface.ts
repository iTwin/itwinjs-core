/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Geometry } from "./Geometry";
import { Point3d, Vector3d, Point2d } from "../PointVector";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { NumberArray, Vector3dArray, Point2dArray } from "../PointHelpers";
import { GrowableFloat64Array, GrowableXYZArray } from "../GrowableArray";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { GeometryHandler } from "../GeometryHandler";
import { ClusterableArray } from "../numerics/ClusterableArray";
/**
 * Check validity of indices into a data array.
 * * It is valid to have  both indices and data undeinfed.
 * * It is NOT valid for just one to be defined.
 * * Index values at indices[indexPositionA <= i < indexPositionB] must be valid indices to the data array.
 * @param indices array of indices.
 * @param indexPositionA first index to test
 * @param indexPositionB one past final index to test
 * @param data data array.  Only its length is referenced.
 */
function areIndicesValid(indices: number[] | undefined, indexPositionA: number, indexPositionB: number, data: any[] | undefined): boolean {
  if (indices === undefined && data === undefined)
    return true;
  if (!indices || !data)
    return false;
  const dataLength = data.length;
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
 * Test if facetStartIndex is (minimally!) valid:
 * * length must be nonzero (recall that for "no facets" the facetStartIndexArray still must contain a 0)
 * * Each entry must be strictly smaller than the one that follows.
 * @param facetStartIndex array of facetStart data.  facet `i` has indices at `facetsStartIndex[i]` to (one before) `facetStartIndex[i+1]`
 */
function isValidFacetStartIndexArray(facetStartIndex: number[]): boolean {
  // facetStartIndex for empty facets has a single entry "0" -- empty array is not allowed
  if (facetStartIndex.length === 0)
    return false;
  for (let i = 0; i + 1 < facetStartIndex.length; i++)
    if (facetStartIndex[i] >= facetStartIndex[i + 1])
      return false;
  return true;
}
function reverseIndices<T>(facetStartIndex: number[], indices: T[] | undefined, preserveStart: boolean): boolean {
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

/** PolyfaceData carries data arrays for point, normal, param, color and their indices.
 *
 * * IndexedPolyface carries a PolyfaceData as a member. (NOT as a base class -- it already has GeometryQuery as base)
 * * IndexedPolyfaceVisitor uses PolyfaceData as a base class.
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

  public static readonly planarityLocalRelTol = 1.0e-13;
  public point: GrowableXYZArray;
  public pointIndex: number[];
  // edgeVisible[i] = true if the edge following pointIndex[i] is visible
  public edgeVisible: boolean[];

  public normal: Vector3d[] | undefined;
  public normalIndex: number[] | undefined;
  public param: Point2d[] | undefined;
  public paramIndex: number[] | undefined;
  public color: number[] | undefined;
  public colorIndex: number[] | undefined;

  public constructor(needNormals: boolean = false, needParams: boolean = false, needColors: boolean = false) {
    this.point = new GrowableXYZArray();
    this.pointIndex = []; this.edgeVisible = [];
    if (needNormals) { this.normal = []; this.normalIndex = []; }
    if (needParams) { this.param = []; this.paramIndex = []; }
    if (needColors) { this.color = []; this.colorIndex = []; }
  }

  public clone(): PolyfaceData {
    const result = new PolyfaceData();
    result.point = this.point.clone();
    result.pointIndex = this.pointIndex.slice();
    result.edgeVisible = this.edgeVisible.slice();

    if (this.normal)
      result.normal = Vector3dArray.cloneVector3dArray(this.normal);
    if (this.param)
      result.param = Point2dArray.clonePoint2dArray(this.param);
    if (this.color)
      result.color = this.color.slice();

    if (this.normalIndex)
      result.normalIndex = this.normalIndex.slice();
    if (this.paramIndex)
      result.paramIndex = this.paramIndex.slice();
    if (this.colorIndex)
      result.colorIndex = this.colorIndex.slice();
    return result;
  }

  public isAlmostEqual(other: PolyfaceData): boolean {
    if (!GrowableXYZArray.isAlmostEqual(this.point, other.point)) return false;
    if (!NumberArray.isExactEqual(this.pointIndex, other.pointIndex)) return false;

    if (!Vector3dArray.isAlmostEqual(this.normal, other.normal)) return false;
    if (!NumberArray.isExactEqual(this.normalIndex, other.normalIndex)) return false;

    if (!Point2dArray.isAlmostEqual(this.param, other.param)) return false;
    if (!NumberArray.isExactEqual(this.paramIndex, other.paramIndex)) return false;

    if (!NumberArray.isExactEqual(this.color, other.color)) return false;
    if (!NumberArray.isExactEqual(this.colorIndex, other.colorIndex)) return false;

    if (!NumberArray.isExactEqual(this.edgeVisible, other.edgeVisible)) return false;
    return true;
  }
  public get pointCount() { return this.point.length; }
  public get normalCount() { return this.normal ? this.normal.length : 0; }
  public get paramCount() { return this.param ? this.param.length : 0; }
  public get colorCount() { return this.color ? this.color.length : 0; }
  public get indexCount() { return this.pointIndex.length; }  // ALWAYS INDEXED ... all index vectors must have same length.

  /** return indexed point. This is a copy of the coordinates, not a referenc. */
  public getPoint(i: number): Point3d { return this.point.getPoint3dAt(i); }
  /** return indexed normal. This is the REFERENCE to the normal, not a copy. */
  public getNormal(i: number): Vector3d { return this.normal ? this.normal[i] : Vector3d.create(); }
  /** return indexed param. This is the REFERENCE to the param, not a copy. */
  public getParam(i: number): Point2d { return this.param ? this.param[i] : Point2d.create(); }
  /** return indexed color */
  public getColor(i: number): number { return this.color ? this.color[i] : 0; }
  /** return indexed visibility */
  public getEdgeVisible(i: number): boolean { return this.edgeVisible[i]; }
  /** Copy the contents (not pointer) of point[i] into dest. */
  public copyPointTo(i: number, dest: Point3d): void { this.point.getPoint3dAt(i, dest); }
  /** Copy the contents (not pointer) of normal[i] into dest. */
  public copyNormalTo(i: number, dest: Vector3d): void { if (this.normal) dest.setFrom(this.normal[i]); }
  /** Copy the contents (not pointer) of param[i] into dest. */
  public copyParamTo(i: number, dest: Point2d): void { if (this.param) dest.setFrom(this.param[i]); }
  /**
   * * Copy data from other to this.
   * * This is the essense of transfering coordinates spread throughout a large polyface into a visitor's single facet.
   * * "other" is the large polyface
   * * "this" is the visitor
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
        this.normal[i].setFrom(other.normal[other.normalIndex[index0 + i]]);
      for (let i = 0; i < numWrap; i++)
        this.normal[numEdge + i].setFrom(this.normal[i]);

      for (let i = 0; i < numEdge; i++)
        this.normalIndex[i] = other.normalIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.normalIndex[numEdge + i] = this.normalIndex[i];
    }

    if (this.param && this.paramIndex && other.param && other.paramIndex) {
      for (let i = 0; i < numEdge; i++)
        this.param[i].setFrom(other.param[other.paramIndex[index0 + i]]);
      for (let i = 0; i < numWrap; i++)
        this.param[numEdge + i].setFrom(this.param[i]);

      for (let i = 0; i < numEdge; i++)
        this.paramIndex[i] = other.paramIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.paramIndex[numEdge + i] = this.paramIndex[i];
    }

    if (this.color && this.colorIndex && other.color && other.colorIndex) {
      for (let i = 0; i < numEdge; i++)
        this.color[i] = other.color[this.colorIndex[index0 + i]];
      for (let i = 0; i < numWrap; i++)
        this.color[numEdge + i] = this.color[i];

      for (let i = 0; i < numEdge; i++)
        this.colorIndex[i] = other.colorIndex[index0 + i];
      for (let i = 0; i < numWrap; i++)
        this.colorIndex[numEdge + i] = this.colorIndex[i];
    }
  }
  private static trimArray(data: any[] | undefined, length: number) { if (data && length < data.length) data.length = length; }

  public trimAllIndexArrays(length: number): void {
    PolyfaceData.trimArray(this.pointIndex, length);
    PolyfaceData.trimArray(this.paramIndex, length);
    PolyfaceData.trimArray(this.normalIndex, length);
    PolyfaceData.trimArray(this.colorIndex, length);
    PolyfaceData.trimArray(this.edgeVisible, length);
  }

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
    } else if (length < this.point.length) {
      this.point.resize(length);
      this.edgeVisible.length = length;
      this.pointIndex.length = length;
      if (this.normal) this.normal.length = length;
      if (this.param) this.param.length = length;
      if (this.color) this.color.length = length;
    }
  }
  public range(result?: Range3d, transform?: Transform): Range3d {
    result = result ? result : Range3d.createNull();
    result.extendArray(this.point, transform);
    return result;
  }
  /** reverse indices face-by-facet, with the given facetStartIndex array delimiting faces.
   *
   * * facetStartIndex[0] == 0 always -- start of facet zero.
   * * facet k has indices from facetStartIndex[k] <= i < facetStartIndex[k+1]
   * * hence for "internal" k, facetStartIndex[k] is both the upper limit of facet k-1 and the start of facet k.
   * *
   */
  public reverseIndices(facetStartIndex?: number[]) {
    if (facetStartIndex && isValidFacetStartIndexArray(facetStartIndex)) {
      reverseIndices(facetStartIndex, this.pointIndex, true);
      reverseIndices(facetStartIndex, this.normalIndex, true);
      reverseIndices(facetStartIndex, this.paramIndex, true);
      reverseIndices(facetStartIndex, this.colorIndex, true);
      reverseIndices(facetStartIndex, this.edgeVisible, false);
    }
  }
  public reverseNormals() {
    if (this.normal)
      for (const normal of this.normal)
        normal.scaleInPlace(-1.0);
  }
  // This base class is just a data carrier.  It does not know if the index order and normal directions have special meaning.
  // 1) Caller must reverse normals if semanitically needed.
  // 2) Caller must reverse indices if semantically needed.
  public tryTransformInPlace(
    transform: Transform): boolean {
    const inverseTranspose = transform.matrix.inverse();
    this.point.transformInPlace(transform);

    if (inverseTranspose) {
      // apply simple RotMatrix to normals ...
      if (this.normal) {
        inverseTranspose.multiplyVectorArrayInPlace(this.normal);
      }
    }
    return true;
  }

  public compress() {
    const packedData = ClusterableArray.clusterGrowablePoint3dArray(this.point);
    this.point = packedData.growablePackedPoints!;
    packedData.updateIndices(this.pointIndex);
  }
}

/** A Polyface is n abstract mesh structure (of unspecified implementation) that provides a PolyfaceVisitor
 * to iterate over its facets.
 */
export abstract class Polyface extends GeometryQuery {
  public data: PolyfaceData;
  protected constructor(data: PolyfaceData) {
    super();
    this._twoSided = false;
    this.data = data;
  }
  /** create and return a visitor for this concrete polyface. */
  public abstract createVisitor(_numWrap: number): PolyfaceVisitor;
  private _twoSided: boolean;
  public get twoSided() { return this._twoSided; }
  public set twoSided(value: boolean) { this._twoSided = value; }

}
export class IndexedPolyface extends Polyface {
  public isSameGeometryClass(other: any): boolean { return other instanceof IndexedPolyface; }
  public isAlmostEqual(other: any): boolean {
    if (other instanceof IndexedPolyface) {
      return this.data.isAlmostEqual(other.data) && NumberArray.isExactEqual(this.facetStart, other.facetStart);
    }
    return false;
  }
  public tryTransformInPlace(transform: Transform) {
    if (this.data.tryTransformInPlace(transform)) {
      const determinant = transform.matrix.determinant();
      if (determinant < 0) {
        this.reverseIndices();
        this.reverseNormals();
      }
    }
    return false;
  }

  public clone(): IndexedPolyface {
    return new IndexedPolyface(this.data.clone(), this.facetStart.slice());
  }

  public cloneTransformed(transform: Transform): IndexedPolyface {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }

  public reverseIndices() { this.data.reverseIndices(this.facetStart); }
  public reverseNormals() { this.data.reverseNormals(); }
  //
  // index to the index array entries for a specific facet.
  // the facet count is facetStart.length - 1
  // facet [f] indices run from facetStart[f] to upper limit facetStart[f+1].
  // Note thet the array is initialized with one entry.
  protected facetStart: number[];

  protected constructor(data: PolyfaceData, facetStart?: number[]) {
    super(data);
    if (facetStart)
      this.facetStart = facetStart;
    else {
      this.facetStart = [];
      this.facetStart.push(0);
    }
  }
  /**
   * *  Add facets from source to this polyface.
   * * optionally reverse the facets.
   * * optionally apply a transform to points.
*/
  public addIndexedPolyface(source: IndexedPolyface, reversed: boolean, transform: Transform | undefined) {
    const sourceToDestPointIndex = new GrowableFloat64Array();
    sourceToDestPointIndex.ensureCapacity(source.data.pointCount);
    const sourcePoints = source.data.point;
    const xyz = Point3d.create();
    for (let i = 0, n = source.data.point.length; i < n; i++) {
      sourcePoints.getPoint3dAt(i, xyz);
      if (transform) {
        transform.multiplyPoint(xyz, xyz);
        sourceToDestPointIndex.push(this.addPoint(xyz));
      } else
        sourceToDestPointIndex.push(this.addPoint(xyz));
    }

    const numSourceFacets = source.facetStart.length - 1;
    for (let i = 0; i < numSourceFacets; i++) {
      const i0 = source.facetStart[i];
      const i1 = source.facetStart[i + 1];
      if (reversed) {
        for (let j = i1; j-- > i0;) {
          this.addPointIndex(sourceToDestPointIndex.at(source.data.pointIndex[j]), source.data.edgeVisible[j]);
        }
      } else {
        for (let j = i0; j < i1; j++) {
          this.addPointIndex(sourceToDestPointIndex.at(source.data.pointIndex[j]), source.data.edgeVisible[j]);
        }
      }
      this.terminateFacet();
    }
  }

  /** @returns Return the total number of param indices in zero-terminated style, which includes
   * * all the indices in the packed zero-based table
   * * one additional index for the zero-terminator of each facet.
   * @note Note that all index arrays (point, normal, param, color) have the same counts, so there
   * is not a separate query for each of them.
   */
  public get zeroTerminatedIndexCount(): number { return this.data.pointIndex.length + this.facetStart.length - 1; }

  public static create(needNormals: boolean = false, needParams: boolean = false, needColors: boolean = false): IndexedPolyface {
    return new IndexedPolyface(new PolyfaceData(needNormals, needParams, needColors));
  }
  /** add (a clone of ) a point. return its 0 based index.
   * @returns Returns the zero-based index of the added point.
   */
  public addPoint(point: Point3d): number { this.data.point.pushXYZ(point.x, point.y, point.z); return this.data.point.length - 1; }

  /** add a point.
   * @returns Returns the zero-based index of the added point.
   */
  public addPointXYZ(x: number, y: number, z: number): number { this.data.point.push(Point3d.create(x, y, z)); return this.data.point.length - 1; }
  public addParam(param: Point2d): number {
    if (!this.data.param) this.data.param = [];
    this.data.param.push(param.clone());
    return this.data.param.length - 1;
  }
  public addParamXY(x: number, y: number): number {
    if (!this.data.param) this.data.param = [];
    this.data.param.push(Point2d.create(x, y));
    return this.data.param.length - 1;
  }

  public addNormal(normal: Vector3d): number {
    if (!this.data.normal) this.data.normal = [];
    this.data.normal.push(normal.clone());
    return this.data.normal.length - 1;
  }

  public addNormalXYZ(x: number, y: number, z: number): number {
    if (!this.data.normal) this.data.normal = [];
    this.data.normal.push(Vector3d.create(x, y, z));
    return this.data.normal.length - 1;
  }

  public addColor(color: number): number {
    if (!this.data.color) this.data.color = [];
    this.data.color.push(color);
    return this.data.color.length - 1;
  }

  public addPointIndex(index: number, visible: boolean = true): void { this.data.pointIndex.push(index); this.data.edgeVisible.push(visible); }
  public addNormalIndex(index: number): void {
    if (!this.data.normalIndex)
      this.data.normalIndex = [];
    this.data.normalIndex.push(index);
  }
  public addParamIndex(index: number): void {
    if (!this.data.paramIndex)
      this.data.paramIndex = [];
    this.data.paramIndex.push(index);
  }
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
    const numFacets = this.facetStart.length - 1;
    const lengthA = this.facetStart[numFacets];  // number of indices in accepted facets
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

      if (!areIndicesValid(this.data.normalIndex, lengthA, lengthB, this.data.normal))
        messages.push("invalid normal indices in open facet");
      if (messages.length > 0) {
        this.cleanupOpenFacet();
        return messages;
      }
    }
    // appending to facetStart accepts the facet !!!
    this.facetStart.push(lengthB);
    return undefined;
  }
  /** (read-only property) number of facets */
  public get facetCount(): number { return this.facetStart.length - 1; }
  /** (read-only property) number of points */
  public get pointCount(): number { return this.data.pointCount; }
  /** (read-only property) number of colors */
  public get colorCount(): number { return this.data.colorCount; }
  /** (read-only property) number of parameters */
  public get paramCount(): number { return this.data.paramCount; }
  /** (read-only property) number of normals */
  public get normalCount(): number { return this.data.normalCount; }

  public numEdgeInFacet(facetIndex: number): number {
    if (this.isValidFacetIndex(facetIndex))
      return this.facetStart[facetIndex + 1] - this.facetStart[facetIndex];
    return 0;
  }
  public isValidFacetIndex(index: number): boolean { return index >= 0 && index + 1 < this.facetStart.length; }
  /** ASSUME valid facet index . .. return its start index in index arrays. */
  public facetIndex0(index: number): number { return this.facetStart[index]; }
  /** ASSUME valid facet index . .. return its end index in index arrays. */
  public facetIndex1(index: number): number { return this.facetStart[index + 1]; }
  /** create a visitor for this polyface */
  public createVisitor(numWrap: number = 0): PolyfaceVisitor { return IndxedPolyfaceVisitor.create(this, numWrap); }

  public range(transform?: Transform, result?: Range3d): Range3d { return this.data.range(result, transform); }
  public extendRange(range: Range3d, transform?: Transform): void { this.data.range(range, transform); }

  /** TODO: IMPLEMENT */
  public isClosedByEdgePairing(): boolean {
    return false;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleIndexedPolyface(this);
  }
}

/**
 * A PolyfaceVisitor manages data while walking through facets.
 *
 * * The polyface visitor holds data for one facet at a time.
 * * The caller can request the position in the addressed facets as a "readIndex."
 * * The readIndex value (as a number) is not promised to be sequential. (I.e. it might be a simple facet count or might be
 */
export abstract class PolyfaceVisitor extends PolyfaceData {
  public abstract moveToReadIndex(index: number): boolean;
  public abstract currentReadIndex(): number;
  public abstract moveToNextFacet(): boolean;
  public abstract reset(): void;

  public abstract clientPointIndex(i: number): number;
  public abstract clientParamIndex(i: number): number;
  public abstract clientNormalIndex(i: number): number;
  public abstract clientColorIndex(i: number): number;
}

class IndxedPolyfaceVisitor extends PolyfaceData implements PolyfaceVisitor {
  private currentFacetIndex: number;
  private nextFacetIndex: number;
  private numWrap: number;
  private numEdges: number;
  private polyface: IndexedPolyface;
  // to be called from static factory method that validates the polyface ...
  private constructor(facets: IndexedPolyface, numWrap: number) {
    super(facets.data.normalCount > 0, facets.data.paramCount > 0, facets.data.colorCount > 0);
    this.polyface = facets;
    this.numWrap = numWrap;
    this.reset();
    this.numEdges = 0;
    this.nextFacetIndex = 0;
    this.currentFacetIndex = -1;
  }

  public static create(polyface: IndexedPolyface, numWrap: number): PolyfaceVisitor {
    return new IndxedPolyfaceVisitor(polyface, numWrap);
  }
  public moveToReadIndex(facetIndex: number): boolean {
    if (!this.polyface.isValidFacetIndex(facetIndex)) return false;
    this.currentFacetIndex = facetIndex;
    this.nextFacetIndex = facetIndex + 1;
    this.numEdges = this.polyface.numEdgeInFacet(facetIndex);
    this.resizeAllDataArrays(this.numEdges + this.numWrap);
    this.gatherIndexedData(this.polyface.data, this.polyface.facetIndex0(this.currentFacetIndex), this.polyface.facetIndex1(this.currentFacetIndex), this.numWrap);
    return true;
  }
  public moveToNextFacet(): boolean {
    if (this.nextFacetIndex !== this.currentFacetIndex)
      return this.moveToReadIndex(this.nextFacetIndex);
    this.nextFacetIndex++;
    return true;
  }
  public reset(): void {
    this.moveToReadIndex(0);
    this.nextFacetIndex = 0; // so immediate moveToNextFacet stays here.
  }
  public currentReadIndex(): number { return this.currentFacetIndex; }
  public clientPointIndex(i: number): number { return this.pointIndex[i]; }
  public clientParamIndex(i: number): number { return this.paramIndex ? this.paramIndex[i] : -1; }
  public clientNormalIndex(i: number): number { return this.normalIndex ? this.normalIndex[i] : -1; }
  public clientColorIndex(i: number): number { return this.colorIndex ? this.colorIndex[i] : -1; }
}
