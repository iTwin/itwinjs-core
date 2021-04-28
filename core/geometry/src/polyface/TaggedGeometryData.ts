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
 * Structure with 2 integer tags and optional arrays of integers, doubles, points, vectors, and geometry.
 * * In typescript/javascript, all integer numbers that can be non-integer.  Please do not insert non-integers in the integer array.
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
