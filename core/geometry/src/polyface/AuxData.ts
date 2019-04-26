/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Geometry } from "./Geometry";
import { Range1d } from "../geometry3d/Range";
import { NumberArray } from "../geometry3d/PointHelpers";

/** The data types of [[AuxChannel]].  The scalar types are used to produce thematic  vertex colors.
 * @public
*/
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
/**  Represents the [[AuxChannel]] data at a single input value.
 * @public
*/
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
/**  Represents a single [[PolyfaceAuxData]] channel. A channel  may represent a single scalar value such as stress or temperature or may represent displacements from vertex position or replacements for normals.
 * @public
*/
export class AuxChannel {
  /** An array of [[AuxChannelData]] that represents the vertex data at one or more input values. */
  public data: AuxChannelData[];
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
 * @public
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
