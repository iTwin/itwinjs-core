/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GeometryQuery } from "../curve/GeometryQuery";
import { Geometry } from "../Geometry";
import { Point3d, Vector3d, XYZ } from "../geometry3d/Point3dVector3d";

/** @packageDocumentation
 * @module Polyface
 */

/**
 * TaggedGeometryConstants defines enums with constant values for use in tags of TaggedGeometryData
 * @public
 */
namespace TaggedGeometryConstants {
  /**  Reserved values for the "tagA" member of TaggedGeometryData
   *
  */
  const enum TaggedGeometryDataTagType {
    SubdivisionSurface = -1000
  }
  /**
   * Supported types of subdivision surfaces
   */
  const enum SubdivisionMethod {
    ChooseBasedOnFacets = 0,
    CatmullClark = 1,
    Loop = 2,
    DooSabin = 3
  }
  /**
   * numeric values for subdivision control.  These are entered in the intData array as first of a pair.
   */
  const enum SubdivisionControlCode {
    /** pair (FixedDepth, d) indicates subdivision to depth d */
    FixedDepth = -100,
    /** pair (FixedDepth, index) indicates absolute tolerance with value in doubleData[index] */
    AbsoluteTolerance = -101,
    /** pair (FixedDepth, index) indicates tolerance as a fraction of base mesh range is found in doubleData[index] */
    FractionOfRangeBoxTolerance = -102
  }
}
/**
 * Structure with 2 integer tags and optional arrays of integers, doubles, points, vectors, and geometry.
 * * In typescript/javascript, all integer numbers that can be non-integer.  Please do not insert non-integers in the integer array.
 * @public
 */
export class TaggedGeometryData {
  public tagA: number;
  public tagB: number;

  public constructor(tagA: number = 0, tagB: number = 0,
    intData?: number[], doubleData?: number[],
    pointData?: Point3d[], vectorData?: Vector3d[],
    geometryData?: GeometryQuery[]
  ) {
    this.tagA = tagA;
    this.tagB = tagB;
    if (intData) this.intData = intData;
    if (doubleData) this.doubleData = doubleData;
    if (pointData) this.pointData = pointData;
    if (vectorData) this.vectorData = vectorData;
    if (geometryData) this.geometry = geometryData;
  }

  public intData?: number[];
  public doubleData?: number[];
  public pointData?: Point3d[];
  public vectorData?: Vector3d[];
  public geometry?: GeometryQuery[];
  /**
   * push a pair of int values on the intData array.
   * @param intA
   * @param intB
   */
  public pushIntPair(intA: number, intB: number) {
    if (!this.intData) this.intData = [];
    this.intData.push(intA);
    this.intData.push(intB);
  }
  /**
   * push a pair of int values on the intData array.
   * @param intA int to push on the intData array, followed by index of valueB in the doubleData array.
   * @param valueB value to push on the doubleData array.
   */
   public pushIndexedDouble(intA: number, valueB: number) {
      if (!this.intData) this.intData = [];
      if (!this.doubleData) this.doubleData = [];
      this.intData.push(intA);
      this.intData.push(this.doubleData.length);
      this.doubleData.push(valueB);
  }
  /**
   * Search pairs in the intData array for a pair (targetTag, value).  Return the value, possibly restricted to (minValue,maxValue)
   * @param targetTag
   * @param minValue
   * @param maxValue
   * @param defaultValue
   */
  public tagToInt(targetTag: number, minValue: number, maxValue: number, defaultValue: number) : number {
  if (this.intData) {
    for (let i = 0; i + 1 < this.intData.length; i += 2){
      if (this.intData[i] == targetTag)
        return Math.min(Math.max(this.intData[i + 1], minValue), maxValue);
      }
    }
    return defaultValue;
  }

  /**
   * Search pairs in the intData array for a pair (targetTag, index).  Return getDoubleData[index] value, possibly restricted to (minValue,maxValue)
   * @param targetTag
   * @param minValue
   * @param maxValue
   * @param defaultValue
   */
  public tagToIndexedDouble(targetTag: number, minValue: number, maxValue: number, defaultValue: number) : number {
  if (this.intData) {
    for (let i = 0; i + 1 < this.intData.length; i += 2){
      if (this.intData[i] == targetTag) {
        return Geometry.clamp(this.getDoubleData (this.intData[i + 1], defaultValue), minValue, maxValue);
        }
      }
    }
    return defaultValue;
  }
  /**
   * get doubleData[index], or indicated default if the index is out of range
   * @param index
   * @param defaultValue
   */
  public getDoubleData(index: number, defaultValue: number): number{
    if (this.doubleData && 0 <= index && index < this.doubleData.length)
      return this.doubleData[index];
    return defaultValue;
  }
public isAlmostEqual(other: TaggedGeometryData): boolean{
    if (other === undefined)
      return false;
    if (this.tagA !== other.tagA)
      return false;
    if (this.tagB !== other.tagB)
    return false;
  return Geometry.exactEqualNumberArrays(this.intData, other.intData)
    && Geometry.almostEqualArrays<number>(this.doubleData, other.doubleData, Geometry.isAlmostEqualNumber)
    && Geometry.almostEqualArrays<XYZ>(this.pointData, other.pointData, Geometry.isSameXYZ)
    && Geometry.almostEqualArrays<XYZ>(this.vectorData, other.vectorData, Geometry.isSameXYZ)
    && Geometry.almostEqualArrays<GeometryQuery>(this.geometry, other.geometry, GeometryQuery.areAlmostEqual);
  }
  public static areAlmostEqualArrays(dataA: TaggedGeometryData[] | undefined, dataB: TaggedGeometryData[] | undefined): boolean{
    const lengthA = dataA === undefined ? 0 : dataA.length;
    const lengthB = dataB === undefined ? 0 : dataB.length;
    if (lengthA !== lengthB)
      return false;
    for (let i = 0; i < lengthA; i++){
      if (!dataA![i].isAlmostEqual(dataB![i]))
        return false;
    }
    return true;
  }

  public clone(result?: TaggedGeometryData): TaggedGeometryData {
    if (!result)
      result = new TaggedGeometryData(this.tagA, this.tagB);
    if (this.intData)
      result.intData = this.intData.slice();
    if (this.doubleData)
      result.doubleData = this.doubleData.slice();
    if (this.pointData)
      result.pointData = Geometry.cloneMembers(this.pointData);
    if (this.vectorData)
      result.vectorData = Geometry.cloneMembers(this.vectorData);
    if (this.geometry)
      result.geometry = Geometry.cloneMembers<GeometryQuery>(this.geometry);
    return result;
  }
}
