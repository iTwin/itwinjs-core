/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Geometry } from "./Geometry";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d, Range2d, Range1d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { NumberArray } from "../geometry3d/PointHelpers";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
import { GeometryQuery } from "../curve/GeometryQuery";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { PolyfaceData } from "./PolyfaceData";

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
function allDefined(valueA: any, valueB: any, valueC: any): boolean {
  return valueA !== undefined && valueB !== undefined && valueC !== undefined;
}

/**
 * Data for a face in a polyface containing facets.
 * This is built up cooperatively by the PolyfaceBuilder and its
 * callers, and stored as a FaceData array in PolyfaceData.
 */
export class FacetFaceData {
  private _paramDistanceRange: Range2d;
  private _paramRange: Range2d;

  public get paramDistanceRange(): Range2d { return this._paramDistanceRange; }
  public get paramRange(): Range2d { return this._paramRange; }

  private constructor(distanceRange: Range2d, paramRange: Range2d) {
    this._paramDistanceRange = distanceRange;
    this._paramRange = paramRange;
  }

  /** Create a FacetFaceData with null ranges. */
  public static createNull(): FacetFaceData {
    return new FacetFaceData(Range2d.createNull(), Range2d.createNull());
  }

  /** Create a deep copy of this FacetFaceData object. */
  public clone(result?: FacetFaceData): FacetFaceData {
    if (result) {
      this._paramDistanceRange.clone(result._paramDistanceRange);
      this._paramRange.clone(result._paramRange);
      return result;
    }
    return new FacetFaceData(this._paramDistanceRange.clone(), this._paramRange.clone());
  }

  /** Restore this FacetFaceData to its null constructor state. */
  public null() {
    this._paramDistanceRange.setNull();
    this._paramRange.setNull();
  }

  /** Return distance-based parameter from stored parameter value. */
  public convertParamToDistance(param: Point2d, result?: Point2d): Point2d {
    result = result ? result : Point2d.create();
    const paramDelta = this._paramRange.high.minus(this._paramRange.low);
    result.x = (0 === paramDelta.x) ? param.x : (this._paramDistanceRange.low.x + (param.x - this._paramRange.low.x)
      * (this._paramDistanceRange.high.x - this._paramDistanceRange.low.x) / paramDelta.x);
    result.y = (0.0 === paramDelta.y) ? param.y : (this.paramDistanceRange.low.y + (param.y - this._paramRange.low.y)
      * (this._paramDistanceRange.high.y - this._paramDistanceRange.low.y) / paramDelta.y);
    return result;
  }

  /** Return normalized (0-1) parameter from stored parameter value. */
  public convertParamToNormalized(param: Point2d, result?: Point2d): Point2d {
    result = result ? result : Point2d.create();
    const paramDelta = this._paramRange.high.minus(this._paramRange.low);
    result.x = (0.0 === paramDelta.x) ? param.x : ((param.x - this._paramRange.low.x) / paramDelta.x);
    result.y = (0.0 === paramDelta.y) ? param.y : ((param.y - this._paramRange.low.y) / paramDelta.y);
    return result;
  }

  /** Scale distance paramaters. */
  public scaleDistances(distanceScale: number) {
    this._paramDistanceRange.low.x *= distanceScale;
    this._paramDistanceRange.low.y *= distanceScale;
    this._paramDistanceRange.high.x *= distanceScale;
    this._paramDistanceRange.high.y *= distanceScale;
  }

  /**
   * Sets the paramDistance range of this FacetFaceData based on the newly terminated facets that make it up.
   * Takes the polyface itself, the first and last indexes of the facets to be included in the face.
   * Returns true on success, false otherwise.
   */
  public setParamDistanceRangeFromNewFaceData(polyface: IndexedPolyface, facetStart: number, facetEnd: number): boolean {
    const dSTotal = Point2d.create();
    const dSSquaredTotal = Point2d.create();
    let aveTotal = 0;

    const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
    if (!visitor.moveToReadIndex(facetStart))
      return false;

    do {
      const numPointsInFacet = visitor.numEdgesThisFacet;
      const visitorPoints = visitor.point;
      const trianglePointIndexes: number[] = [];
      const visitorParams = visitor.param;
      const triangleParamIndexes: number[] = [];

      if (!visitorParams)
        return false;

      for (let k = 0; k < numPointsInFacet; k++) {
        trianglePointIndexes[2] = k;
        triangleParamIndexes[2] = k;

        if (k > 1) {
          const dUV0 = visitorParams[triangleParamIndexes[0]].minus(visitorParams[triangleParamIndexes[1]]);
          const dUV1 = visitorParams[triangleParamIndexes[1]].minus(visitorParams[triangleParamIndexes[2]]);
          const delta0 = visitorPoints.getPoint3dAt(trianglePointIndexes[0]).minus(visitorPoints.getPoint3dAt(trianglePointIndexes[1]));
          const delta1 = visitorPoints.getPoint3dAt(trianglePointIndexes[1]).minus(visitorPoints.getPoint3dAt(trianglePointIndexes[2]));

          const uvCross = Math.abs(dUV0.x * dUV1.y - dUV1.x * dUV0.y);
          if (uvCross) {
            const dwDu = Point3d.createFrom(delta0);
            dwDu.scaleInPlace(dUV1.y);
            dwDu.addScaledInPlace(delta1, -dUV0.y);
            const dwDv = Point3d.createFrom(delta1);
            dwDv.scaleInPlace(dUV0.x);
            dwDv.addScaledInPlace(delta0, -dUV1.x);

            const dS = Point2d.create(dwDu.magnitude() / uvCross, dwDv.magnitude() / uvCross);

            dSTotal.x += dS.x;
            dSTotal.y += dS.y;
            dSSquaredTotal.x += dS.x * dS.x;
            dSSquaredTotal.y += dS.y * dS.y;
            aveTotal++;
          }
        }

        triangleParamIndexes[0] = triangleParamIndexes[1];
        triangleParamIndexes[1] = triangleParamIndexes[2];
        trianglePointIndexes[0] = trianglePointIndexes[1];
        trianglePointIndexes[1] = trianglePointIndexes[2];
      }
    } while (visitor.moveToNextFacet() && visitor.currentReadIndex() < facetEnd);

    if (aveTotal !== 0) {
      const dS = Point2d.create(dSTotal.x / aveTotal, dSTotal.y / aveTotal);
      const standardDeviation = Point2d.create(
        Math.sqrt(Math.abs((dSSquaredTotal.x / aveTotal) - dS.x * dS.x)),
        Math.sqrt(Math.abs((dSSquaredTotal.y / aveTotal) - dS.y * dS.y)),
      );

      // TR# 268980 - Add standard deviation to match QV....
      this._paramDistanceRange.low.set(0, 0);
      this._paramDistanceRange.high.set(
        (dS.x + standardDeviation.x) * (this._paramRange.high.x - this._paramRange.low.x),
        (dS.y + standardDeviation.y) * (this._paramRange.high.y - this._paramRange.low.y),
      );
    }
    return true;
  }
}
/** The data types of [[AuxChannel]].  The scalar types are used to produce thematic  vertex colors. */
export enum AuxChannelDataType {
  /** General scalar type - no scaling is applied if associated [[Polyface]] is transformed. */
  Scalar = 0,
  /** Distance (scalar) scaling is applied if associated [[Polyface]] is scaled. 3 Data values (x,y.z) per entry. */
  Distance = 1,
  /** Displacement added to  vertex position.  Transformed and scaled with associated [[Polyface]]. 3 Data values (x,y.z) per entry.,*/
  Vector = 2,
  /** Normal -- replaces vertex normal.  Rotated with associated [[Polyface]] transformation. 3 Data values (x,y.z) per entry. */
  Normal = 3,
}
/**  Represents the [[AuxChannel]] data at a single input value. */
export class AuxChannelData {
  /** The input value for this data. */
  public input: number;
  /** The vertex values for this data.  A single value per vertex for scalar types and 3 values (x,y,z) for normal or vector channels. */
  public values: number[];
  /** Construct a new [[AuxChannelData]] from input value and vertex values. */
  constructor(input: number, values: number[]) {
    this.input = input;
    this.values = values;
  }
  public copyValues(other: AuxChannelData, thisIndex: number, otherIndex: number, blockSize: number) {
    for (let i = 0; i < blockSize; i++)
      this.values[thisIndex * blockSize + i] = other.values[otherIndex * blockSize + i];
  }
  public clone() {
    return new AuxChannelData(this.input, this.values.slice());
  }
  public isAlmostEqual(other: AuxChannelData, tol?: number) {
    const tolerance = tol ? tol : 1.0E-8;
    return Math.abs(this.input - other.input) < tolerance && NumberArray.isAlmostEqual(this.values, other.values, tolerance);
  }
}
/**  Represents a single [[PolyfaceAuxData]] channel. A channel  may represent a single scalar value such as stress or temperature or may represent displacements from vertex position or replacements for normals. */
export class AuxChannel {
  /** An array of [[AuxChannelData]] that represents the vertex data at one or more input values. */
  public data: AuxChannelData[];
  public dataType: AuxChannelDataType;
  /** The channel name. This is used to present the [[AuxChannel]] to the user and also to select the [[AuxChannel]] for display from [[AnalysisStyle]] */
  public name?: string;
  /** The input name. */
  public inputName?: string;
  /** create a [[AuxChannel]] */
  public constructor(data: AuxChannelData[], dataType: AuxChannelDataType, name?: string, inputName?: string) {
    this.data = data;
    this.dataType = dataType;
    this.name = name;
    this.inputName = inputName;
  }
  public clone() {
    const clonedData = [];
    for (const data of this.data) clonedData.push(data.clone());
    return new AuxChannel(clonedData, this.dataType, this.name, this.inputName);
  }
  public isAlmostEqual(other: AuxChannel, tol?: number) {
    if (this.dataType !== other.dataType ||
      this.name !== other.name ||
      this.inputName !== other.inputName ||
      this.data.length !== other.data.length)
      return false;

    for (let i = 0; i < this.data.length; i++)
      if (!this.data[i].isAlmostEqual(other.data[i], tol))
        return false;

    return true;
  }
  /** return true if the data for this channel is of scalar type (single data entry per value) */
  get isScalar(): boolean { return this.dataType === AuxChannelDataType.Distance || this.dataType === AuxChannelDataType.Scalar; }
  /** return the number of data values per entry (1 for scalar, 3 for point or vector */
  get entriesPerValue(): number { return this.isScalar ? 1 : 3; }
  /** return value count */
  get valueCount(): number { return 0 === this.data.length ? 0 : this.data[0].values.length / this.entriesPerValue; }
  /** return the range of the scalar data. (undefined if not scalar) */
  get scalarRange(): Range1d | undefined {
    if (!this.isScalar) return undefined;
    const range = Range1d.createNull();
    for (const data of this.data) {
      range.extendArray(data.values);
    }
    return range;
  }
}
/**  The `PolyfaceAuxData` structure contains one or more analytical data channels for each vertex of a `Polyface`.
 * Typically a `Polyface` will contain only vertex data required for its basic display,the vertex position, normal
 * and possibly texture parameter.  The `PolyfaceAuxData` structure contains supplemental data that is generally computed
 *  in an analysis program or other external data source.  This can be scalar data used to either overide the vertex colors through *Thematic Colorization* or
 *  XYZ data used to deform the mesh by adjusting the vertex postions or normals.
 */
export class PolyfaceAuxData {
  /** @param channels Array with one or more channels of auxilliary data for the associated polyface.
   * @param indices The indices (shared by all data in all channels) mapping the data to the mesh facets.
   */
  public channels: AuxChannel[];
  public indices: number[];

  public constructor(channels: AuxChannel[], indices: number[]) {
    this.channels = channels;
    this.indices = indices;
  }
  public clone() {
    const clonedChannels = [];
    for (const channel of this.channels) clonedChannels.push(channel.clone());
    return new PolyfaceAuxData(clonedChannels, this.indices.slice());
  }
  public isAlmostEqual(other: PolyfaceAuxData, tol?: number) {
    if (!NumberArray.isExactEqual(this.indices, other.indices) || this.channels.length !== other.channels.length)
      return false;

    for (let i = 0; i < this.channels.length; i++)
      if (!this.channels[i].isAlmostEqual(other.channels[i], tol))
        return false;

    return true;
  }
  public createForVisitor() {
    const visitorChannels: AuxChannel[] = [];

    for (const parentChannel of this.channels) {
      const visitorChannelData: AuxChannelData[] = [];
      for (const parentChannelData of parentChannel.data) {
        visitorChannelData.push(new AuxChannelData(parentChannelData.input, []));
      }
      visitorChannels.push(new AuxChannel(visitorChannelData, parentChannel.dataType, parentChannel.name, parentChannel.inputName));
    }

    return new PolyfaceAuxData(visitorChannels, []);
  }

}

/**
 * A Polyface is n abstract mesh structure (of unspecified implementation) that provides a PolyfaceVisitor
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
  /** Tests for equivalence between two IndexedPolyfaces. */
  public isAlmostEqual(other: any): boolean {
    if (other instanceof IndexedPolyface) {
      return this.data.isAlmostEqual(other.data) && NumberArray.isExactEqual(this._facetStart, other._facetStart) &&
        NumberArray.isExactEqual(this._facetToFaceData, other._facetToFaceData);
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
    return new IndexedPolyface(this.data.clone(), this._facetStart.slice(), this._facetToFaceData.slice());
  }

  public cloneTransformed(transform: Transform): IndexedPolyface {
    const result = this.clone();
    result.tryTransformInPlace(transform);
    return result;
  }

  public reverseIndices() { this.data.reverseIndices(this._facetStart); }
  public reverseNormals() { this.data.reverseNormals(); }
  //
  // index to the index array entries for a specific facet.
  // the facet count is facetStart.length - 1
  // facet [f] indices run from facetStart[f] to upper limit facetStart[f+1].
  // Note thet the array is initialized with one entry.
  protected _facetStart: number[];

  //
  // index to the index array entries for a specific face.
  // the face count is determined by how many faces were specified
  // during construction, otherwise, the array won't exist.
  // We index into this using a facet index, where multiple facets may
  // be part of a single face.
  protected _facetToFaceData: number[];

  /** return face data using a facet index. This is the REFERENCE to the FacetFaceData, not a copy. Returns undefined if none found. */
  public tryGetFaceData(i: number): FacetFaceData | undefined {
    const faceIndex = this._facetToFaceData[i];
    if (faceIndex >= this.data.face.length)
      return undefined;
    return this.data.face[faceIndex];
  }

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
   * * optionally reverse the facets.
   * * optionally apply a transform to points.
   * * will only copy param, normal, color, and face data if we are already tracking them AND/OR the source contains them
   */
  public addIndexedPolyface(source: IndexedPolyface, reversed: boolean, transform: Transform | undefined) {
    const copyParams = allDefined(this.data.param, source.data.param, source.data.paramIndex);
    const copyNormals = allDefined(this.data.normal, source.data.normal, source.data.normalIndex);
    // Add point data
    const sourceToDestPointIndex = new GrowableFloat64Array();
    sourceToDestPointIndex.ensureCapacity(source.data.pointCount);
    const sourcePoints = source.data.point;
    const xyz = Point3d.create();
    for (let i = 0, n = source.data.point.length; i < n; i++) {
      sourcePoints.getPoint3dAt(i, xyz);
      if (transform) {
        transform.multiplyPoint3d(xyz, xyz);
        sourceToDestPointIndex.push(this.addPoint(xyz));
      } else
        sourceToDestPointIndex.push(this.addPoint(xyz));
    }

    // Add point index and facet data
    const numSourceFacets = source._facetStart.length - 1;
    for (let i = 0; i < numSourceFacets; i++) {
      const i0 = source._facetStart[i];
      const i1 = source._facetStart[i + 1];
      if (reversed) {
        for (let j = i1; j-- > i0;) {
          this.addPointIndex(sourceToDestPointIndex.at(source.data.pointIndex[j]), source.data.edgeVisible[j]);
        }
      } else {
        for (let j = i0; j < i1; j++) {
          this.addPointIndex(sourceToDestPointIndex.at(source.data.pointIndex[j]), source.data.edgeVisible[j]);
        }
      }
      this.terminateFacet(false);
    }

    // Add param and param index data
    if (copyParams) {
      const startOfNewParams = this.data.param!.length;
      for (const param of source.data.param!) {
        const sourceParam = param.clone();
        if (transform) {
          // TODO: Perform transformation
          this.addParam(sourceParam);
        } else {
          this.addParam(sourceParam);
        }
      }
      for (let i = 0; i < source._facetStart.length; i++) {  // Expect facet start and ends for points to match normals
        const i0 = source._facetStart[i];
        const i1 = source._facetStart[i + 1];
        if (reversed) {
          for (let j = i1; j-- > i0;)
            this.addParamIndex(startOfNewParams + source.data.paramIndex![j - 1]);
        } else {
          for (let j = i0; j < i1; j++)
            this.addParamIndex(startOfNewParams + source.data.paramIndex![j]);
        }
      }
    }

    // Add normal and normal index data
    if (copyNormals) {
      const startOfNewNormals = this.data.normal!.length;
      for (const normal of source.data.normal!) {
        const sourceNormal = normal.clone();
        if (transform) {
          transform.multiplyVector(sourceNormal, sourceNormal);
          this.addNormal(sourceNormal);
        } else {
          this.addNormal(sourceNormal);
        }
      }
      for (let i = 0; i < source._facetStart.length; i++) {  // Expect facet start and ends for points to match normals
        const i0 = source._facetStart[i];
        const i1 = source._facetStart[i + 1];
        if (reversed) {
          for (let j = i1; j-- > i0;)
            this.addNormalIndex(startOfNewNormals + source.data.normalIndex![j - 1]);
        } else {
          for (let j = i0; j < i1; j++)
            this.addNormalIndex(startOfNewNormals + source.data.normalIndex![j]);
        }
      }
    }

    // Add color and color index data
    if (this.data.color && source.data.color && source.data.colorIndex) {
      const startOfNewColors = this.data.color.length;
      for (const sourceColor of source.data.color) {
        this.addColor(sourceColor);
      }
      for (let i = 0; i < source._facetStart.length; i++) {  // Expect facet start and ends for points to match colors
        const i0 = source._facetStart[i];
        const i1 = source._facetStart[i + 1];
        if (reversed) {
          for (let j = i1; j-- > i0;)
            this.addColorIndex(startOfNewColors + source.data.colorIndex[j - 1]);
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

  /** @returns Return the total number of param indices in zero-terminated style, which includes
   * * all the indices in the packed zero-based table
   * * one additional index for the zero-terminator of each facet.
   * @note Note that all index arrays (point, normal, param, color) have the same counts, so there
   * is not a separate query for each of them.
   */
  public get zeroTerminatedIndexCount(): number { return this.data.pointIndex.length + this._facetStart.length - 1; }

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

      if (!areIndicesValid(this.data.normalIndex, lengthA, lengthB, this.data.normal))
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
  public get facetCount(): number { return this._facetStart.length - 1; }
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

  public numEdgeInFacet(facetIndex: number): number {
    if (this.isValidFacetIndex(facetIndex))
      return this._facetStart[facetIndex + 1] - this._facetStart[facetIndex];
    return 0;
  }
  public isValidFacetIndex(index: number): boolean { return index >= 0 && index + 1 < this._facetStart.length; }
  /** ASSUME valid facet index . .. return its start index in index arrays. */
  public facetIndex0(index: number): number { return this._facetStart[index]; }
  /** ASSUME valid facet index . .. return its end index in index arrays. */
  public facetIndex1(index: number): number { return this._facetStart[index + 1]; }
  /** create a visitor for this polyface */
  public createVisitor(numWrap: number = 0): PolyfaceVisitor { return IndexedPolyfaceVisitor.create(this, numWrap); }

  public range(transform?: Transform, result?: Range3d): Range3d { return this.data.range(result, transform); }
  public extendRange(range: Range3d, transform?: Transform): void { this.data.range(range, transform); }

  /** Given the index of a facet, return the data pertaining to the face it is a part of. */
  public getFaceDataByFacetIndex(facetIndex: number): FacetFaceData {
    return this.data.face[this._facetToFaceData[facetIndex]];
  }

  /** Given the index of a face, return the range of that face. */
  public getFaceDataByFaceIndex(faceIndex: number): FacetFaceData {
    return this.data.face[faceIndex];
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

    // If parameter range is provided (by the polyface planeset clipper) then use it
    const paramDefined = this.data.param !== undefined;
    const setParamRange: boolean = faceData.paramRange.isNull && paramDefined;

    do {
      for (let i = 0; i < visitor.numEdgesThisFacet; i++) {
        if (setParamRange && visitor.param !== undefined)
          faceData.paramRange.extendPoint(visitor.param[i]);
      }
    } while (visitor.moveToNextFacet() && visitor.currentReadIndex() < endFacetIndex);

    if (paramDefined && !(this.data.param!.length === 0) && faceData.paramDistanceRange.isNull)
      faceData.setParamDistanceRangeFromNewFaceData(this, facetStart, endFacetIndex);

    this.data.face.push(faceData);
    const faceDataIndex = this.data.face.length - 1;
    for (let i = this._facetToFaceData.length; i < endFacetIndex; i++)
      this._facetToFaceData.push(0 === this._facetStart[i] ? 0 : faceDataIndex);

    return true;
  }

  /** TODO: IMPLEMENT */
  public checkIfClosedByEdgePairing(): boolean {
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
export interface PolyfaceVisitor extends PolyfaceData {
  moveToReadIndex(index: number): boolean;
  currentReadIndex(): number;
  moveToNextFacet(): boolean;
  reset(): void;
  clientPointIndex(i: number): number;
  clientParamIndex(i: number): number;
  clientNormalIndex(i: number): number;
  clientColorIndex(i: number): number;
  clientAuxIndex(i: number): number;
}

export class IndexedPolyfaceVisitor extends PolyfaceData implements PolyfaceVisitor {
  private _currentFacetIndex: number;
  private _nextFacetIndex: number;
  private _numWrap: number;
  private _numEdges: number;
  private _polyface: IndexedPolyface;
  // to be called from static factory method that validates the polyface ...
  private constructor(facets: IndexedPolyface, numWrap: number) {
    super(facets.data.normalCount > 0, facets.data.paramCount > 0, facets.data.colorCount > 0);
    this._polyface = facets;
    this._numWrap = numWrap;
    if (facets.data.auxData)
      this.auxData = facets.data.auxData.createForVisitor();

    this.reset();
    this._numEdges = 0;
    this._nextFacetIndex = 0;
    this._currentFacetIndex = -1;

  }

  public get numEdgesThisFacet(): number { return this._numEdges; }

  public static create(polyface: IndexedPolyface, numWrap: number): IndexedPolyfaceVisitor {
    return new IndexedPolyfaceVisitor(polyface, numWrap);
  }
  public moveToReadIndex(facetIndex: number): boolean {
    if (!this._polyface.isValidFacetIndex(facetIndex)) return false;
    this._currentFacetIndex = facetIndex;
    this._nextFacetIndex = facetIndex + 1;
    this._numEdges = this._polyface.numEdgeInFacet(facetIndex);
    this.resizeAllDataArrays(this._numEdges + this._numWrap);
    this.gatherIndexedData(this._polyface.data, this._polyface.facetIndex0(this._currentFacetIndex), this._polyface.facetIndex1(this._currentFacetIndex), this._numWrap);
    return true;
  }
  public moveToNextFacet(): boolean {
    if (this._nextFacetIndex !== this._currentFacetIndex)
      return this.moveToReadIndex(this._nextFacetIndex);
    this._nextFacetIndex++;
    return true;
  }
  public reset(): void {
    this.moveToReadIndex(0);
    this._nextFacetIndex = 0; // so immediate moveToNextFacet stays here.
  }

  /**
   * Attempts to extract the distance parameter for the face of a given point index.
   * Returns the distance parameter as a point. Returns undefined on failure.
   */
  public tryGetDistanceParameter(index: number, result?: Point2d): Point2d | undefined {
    if (index >= this.numEdgesThisFacet)
      return undefined;

    if (this.param === undefined || this._polyface.data.face.length === 0)
      return undefined;

    const faceData = this._polyface.tryGetFaceData(this._currentFacetIndex);
    if (!faceData)
      return undefined;
    return faceData.convertParamToDistance(this.param[index], result);
  }

  /**
   * Attempts to extract the normalized parameter (0,1) for the face of a given point index.
   * Returns the normalized parameter as a point. Returns undefined on failure.
   */
  public tryGetNormalizedParameter(index: number, result?: Point2d): Point2d | undefined {
    if (index >= this.numEdgesThisFacet)
      return undefined;

    if (this.param === undefined || this._polyface.data.face.length === 0)
      return undefined;

    const faceData = this._polyface.tryGetFaceData(this._currentFacetIndex);
    if (!faceData)
      return undefined;
    return faceData.convertParamToNormalized(this.param[index], result);
  }

  public currentReadIndex(): number { return this._currentFacetIndex; }
  public clientPointIndex(i: number): number { return this.pointIndex[i]; }
  public clientParamIndex(i: number): number { return this.paramIndex ? this.paramIndex[i] : -1; }
  public clientNormalIndex(i: number): number { return this.normalIndex ? this.normalIndex[i] : -1; }
  public clientColorIndex(i: number): number { return this.colorIndex ? this.colorIndex[i] : -1; }
  public clientAuxIndex(i: number): number { return this.auxData ? this.auxData.indices[i] : -1; }
}
