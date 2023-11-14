/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
/**
 * Carrier structure for a pair of objects dataA and dataB of types DataTypeA and DataTypeB with optional parameterized-type tags (also with suffixes A and B) of type TagType.
 * * Note that the (public!) constructor captures its parameters.
 * @public
 */
export class TaggedDataPair<DataTypeA, DataTypeB, TagType> {
  /** first of the two data items */
  public dataA: DataTypeA;
  /** second of the two data items */
  public dataB: DataTypeB;
  /** first tag */
  public tagA?: TagType;
  /** second tag */
  public tagB?: TagType;
  /** Constructor, inputs captured. */
  public constructor(dataA: DataTypeA, dataB: DataTypeB, tagA?: TagType, tagB?: TagType) {
    this.dataA = dataA;
    this.dataB = dataB;
    this.tagA = tagA;
    this.tagB = tagB;
  }
  /** Set the tags of this instance. */
  public setTags(tagA?: TagType, tagB?: TagType) {
    this.tagA = tagA;
    this.tagB = tagB;
  }
  /** Set the data of this instance. */
  public setData(dataA: DataTypeA, dataB: DataTypeB) {
    this.dataA = dataA;
    this.dataB = dataB;
  }
  /** Set the data and tags of this instance. */
  public setAll(dataA: DataTypeA, dataB: DataTypeB, tagA?: TagType, tagB?: TagType) {
    this.dataA = dataA;
    this.dataB = dataB;
    this.tagA = tagA;
    this.tagB = tagB;
  }
}
