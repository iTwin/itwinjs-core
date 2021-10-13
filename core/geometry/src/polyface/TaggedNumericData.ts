/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { Geometry } from "../Geometry";

/**
 * `TaggedNumericConstants` defines enums with constant values for use in tags of [[TaggedNumericData]]
 * @public
 */
export namespace TaggedNumericConstants {
  /**  Reserved values for the "tagA" member of [[TaggedNumericData]]
  * @public
   *
  */
export  enum TaggedNumericTagType {
    /** `tagA` value identifying a subdivision surface*/
    SubdivisionSurface = -1000
  }
  /**
   * `tagB` values for supported types of subdivision surfaces
   * @public
   */
export enum SubdivisionMethod {
    ChooseBasedOnFacets = 0,
    CatmullClark = 1,
    Loop = 2,
    DooSabin = 3
  }
  /**
   * numeric values for subdivision control.  These are entered in the intData array as first of a pair.
   * @public
   */
export  enum SubdivisionControlCode {
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
export class TaggedNumericData {
  /** Application specific primary tag.   See reserved values in  [[TaggedNumericConstants]] */
  public tagA: number;
  /** Application specific secondary tag.   See reserved values in  [[TaggedNumericConstants]] */
  public tagB: number;

  public constructor(tagA: number = 0, tagB: number = 0,
    intData?: number[], doubleData?: number[]
  ) {
    this.tagA = tagA;
    this.tagB = tagB;
    if (intData) this.intData = intData;
    if (doubleData) this.doubleData = doubleData;
  }
/** Integer data with application-specific meaning */
  public intData?: number[];
/** Double data with application-specific meaning */
public doubleData?: number[];

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
  public tagToInt(targetTag: number, minValue: number, maxValue: number, defaultValue: number): number {
  if (this.intData) {
    for (let i = 0; i + 1 < this.intData.length; i += 2){
      if (this.intData[i] === targetTag)
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
  public tagToIndexedDouble(targetTag: number, minValue: number, maxValue: number, defaultValue: number): number {
  if (this.intData) {
    for (let i = 0; i + 1 < this.intData.length; i += 2){
      if (this.intData[i] === targetTag) {
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
  /** Apply isAlmostEqual to all members. */
  public isAlmostEqual(other: TaggedNumericData): boolean{
    if (other === undefined)
      return false;
    if (this.tagA !== other.tagA)
      return false;
    if (this.tagB !== other.tagB)
    return false;
    return Geometry.exactEqualNumberArrays(this.intData, other.intData)
      && Geometry.almostEqualArrays<number>(this.doubleData, other.doubleData, Geometry.isAlmostEqualNumber);
  }

  public static areAlmostEqual(dataA: TaggedNumericData | undefined, dataB: TaggedNumericData | undefined): boolean{
    if (dataA === undefined && dataB === undefined)
      return true;
    if (dataA !== undefined && dataB !== undefined)
      return dataA.isAlmostEqual(dataB);
    return false;
  }
/** Return a deep clone.  */
  public clone(result?: TaggedNumericData): TaggedNumericData {
    if (!result)
      result = new TaggedNumericData(this.tagA, this.tagB);
    if (this.intData)
      result.intData = this.intData.slice();
    if (this.doubleData)
      result.doubleData = this.doubleData.slice();
    return result;
  }
}
