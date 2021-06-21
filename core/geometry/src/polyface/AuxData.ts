/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

// import { Point2d } from "./Geometry2d";
/* eslint-disable @typescript-eslint/naming-convention, no-empty */
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { NumberArray } from "../geometry3d/PointHelpers";
// import { Geometry } from "./Geometry";
import { Range1d } from "../geometry3d/Range";

/** The data types of [[AuxChannel]].  The scalar types are used to produce thematic  vertex colors.
 * @public
*/
export enum AuxChannelDataType {
  /** General scalar type - no scaling is applied if associated [[Polyface]] is transformed. */
  Scalar = 0,
  /** Distance (scalar) scaling is applied if associated [[Polyface]] is scaled. 3 Data values (x,y.z) per entry. */
  Distance = 1,
  /** Displacement added to  vertex position.  Rotated and scaled with associated [[Polyface]]. 3 Data values (x,y.z) per entry.,*/
  Vector = 2,
  /** Normal -- replaces vertex normal.  Rotated with associated [[Polyface]] transformation. 3 Data values (x,y.z) per entry. */
  Normal = 3,
}
/**  Represents the [[AuxChannel]] data at a single input value.
 * @public
*/
export class AuxChannelData {
  /** The input value for this data. */
  public input: number;
  /** The vertex values for this data.  A single value per vertex for scalar types and 3 values (x,y,z) for normal or vector channels. */
  public values: number[];
  /** Construct a new [[AuxChannelData]] from input value and vertex values. */
  constructor(input: number, values: number[] | Float64Array) {
    this.input = input;
    if (values instanceof Float64Array) {
      this.values = [];
      for (const v of values) this.values.push(v);
    } else
      this.values = values;
  }
  /** Copy blocks of size `blockSize` from (blocked index) `thisIndex` in this AuxChannelData to (blockIndex) `otherIndex` of `other` */
  public copyValues(other: AuxChannelData, thisIndex: number, otherIndex: number, blockSize: number) {
    for (let i = 0; i < blockSize; i++)
      this.values[thisIndex * blockSize + i] = other.values[otherIndex * blockSize + i];
  }
  /** return a deep copy */
  public clone() {
    return new AuxChannelData(this.input, this.values.slice());
  }
  /** toleranced comparison of the `input` and `value` fields.
   * * Default tolerance is 1.0e-8
   */
  public isAlmostEqual(other: AuxChannelData, tol?: number) {
    const tolerance = tol ? tol : 1.0E-8;
    return Math.abs(this.input - other.input) < tolerance && NumberArray.isAlmostEqual(this.values, other.values, tolerance);
  }
}
/**  Represents a single [[PolyfaceAuxData]] channel. A channel  may represent a single scalar value such as stress or temperature or may represent displacements from vertex position or replacements for normals.
 * @public
*/
export class AuxChannel {
  /** An array of [[AuxChannelData]] that represents the vertex data at one or more input values. */
  public data: AuxChannelData[];
  /** type indicator for this channel.  Setting this causes later transformations to be applied to point, vector, and surface normal data in appropriate ways. */
  public dataType: AuxChannelDataType;
  /** The channel name. This is used to present the [[AuxChannel]] to the user and also to select the [[AuxChannel]] for display from AnalysisStyle */
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
  /** Return a deep clone */
  public clone() {
    const clonedData = [];
    for (const data of this.data) clonedData.push(data.clone());
    return new AuxChannel(clonedData, this.dataType, this.name, this.inputName);
  }
  /** toleranced comparison of contents. */
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
  public get isScalar(): boolean { return this.dataType === AuxChannelDataType.Distance || this.dataType === AuxChannelDataType.Scalar; }
  /** return the number of data values per entry (1 for scalar, 3 for point or vector */
  public get entriesPerValue(): number { return this.isScalar ? 1 : 3; }
  /** return value count */
  public get valueCount(): number { return 0 === this.data.length ? 0 : this.data[0].values.length / this.entriesPerValue; }
  /** return the range of the scalar data. (undefined if not scalar) */
  public get scalarRange(): Range1d | undefined {
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
 *  in an analysis program or other external data source.  This can be scalar data used to either override the vertex colors through *Thematic Colorization* or
 *  XYZ data used to deform the mesh by adjusting the vertex positions or normals.
 * @public
 */
export class PolyfaceAuxData {
  /** Array with one or more channels of auxiliary data for the associated polyface. */
  public channels: AuxChannel[];
  /** indices The indices (shared by all data in all channels) mapping the data to the mesh facets. */
  public indices: number[];

  public constructor(channels: AuxChannel[], indices: number[]) {
    this.channels = channels;
    this.indices = indices;
  }
  /** return a deep clone */
  public clone() {
    const clonedChannels = [];
    for (const channel of this.channels) clonedChannels.push(channel.clone());
    return new PolyfaceAuxData(clonedChannels, this.indices.slice());
  }
  /** deep test for equality.
   * * Exact equality for discrete number arrays.
   * * approximate test for coordinate data.
   */
  public isAlmostEqual(other: PolyfaceAuxData, tol?: number): boolean {
    if (!NumberArray.isExactEqual(this.indices, other.indices) || this.channels.length !== other.channels.length)
      return false;

    for (let i = 0; i < this.channels.length; i++)
      if (!this.channels[i].isAlmostEqual(other.channels[i], tol))
        return false;

    return true;
  }
  /**
   * class level almostEqual test, allowing either or both to be undefined at point of call.
   * @param left
   * @param right
   * @param tol
   */
  public static isAlmostEqual(left: PolyfaceAuxData | undefined, right: PolyfaceAuxData | undefined, tol?: number): boolean {
    if (left === right) // This catches double undefined !!!
      return true;
    if (left && right)
      return left.isAlmostEqual(right, tol);
    return false;
  }
  /** Create a PolyfaceAuxData for use by a facet iterator  */
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

  /** Apply `transform` to the data in each channel.
   * @see [[AuxChannelDataType]] for details regarding how each data type is affected by the transform.
   * @note This method may fail if a channel of [[AuxChannelDataType.Normal]] exists and `transform.matrix` is non-invertible.
   * @returns true if the channels were all successfully transformed.
   */
  public tryTransformInPlace(transform: Transform): boolean {
    let inverseRot: Matrix3d | undefined;
    const rot = transform.matrix;
    const det = rot.determinant();
    const scale = Math.pow(Math.abs(det), 1 / 3) * (det >= 0 ? 1 : -1);

    for (const channel of this.channels) {
      for (const data of channel.data) {
        switch (channel.dataType) {
          case AuxChannelDataType.Scalar:
            continue;
          case AuxChannelDataType.Distance: {
            for (let i = 0; i < data.values.length; i++)
              data.values[i] *= scale;

            break;
          }
          case AuxChannelDataType.Normal: {
            inverseRot = inverseRot ?? rot.inverse();
            if (!inverseRot)
                return false;

            transformPoints(data.values, (point) => inverseRot!.multiplyTransposeVectorInPlace(point));
            break;
          }
          case AuxChannelDataType.Vector: {
            transformPoints(data.values, (point) => rot.multiplyVectorInPlace(point));
            break;
          }
        }
      }
    }

    return true;
  }
}

function transformPoints(coords: number[], transform: (point: Point3d) => void): void {
  const point = new Point3d();
  for (let i = 0; i < coords.length; i += 3) {
    point.set(coords[i], coords[i + 1], coords[i + 2]);
    transform(point);
    coords[i] = point.x;
    coords[i + 1] = point.y;
    coords[i + 2] = point.z;
  }
}
