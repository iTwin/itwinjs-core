/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

import * as ec from "../EC";
import { ValuesDictionary } from "../Utils";
import { Value, DisplayValue } from "./Value";

/**
 * Serialized [[Item]] JSON representation.
 */
export interface ItemJSON {
  primaryKeys: ec.InstanceKeyJSON[];
  label: string;
  imageId: string;
  classInfo?: ec.ClassInfoJSON;
  values: ValuesDictionary<Value>;
  displayValues: ValuesDictionary<DisplayValue>;
  mergedFieldNames: string[];
}

/**
 * A data structure that represents a single content record.
 */
export default class Item {
  /** Keys of instances whose data is contained in this item */
  public primaryKeys: Array<Readonly<ec.InstanceKey>>;
  /** Display label of the item */
  public label: string;
  /** ID of the image associated with this item */
  public imageId: string;
  /** For cases when item consists only of same class instances, information about the ECClass */
  public classInfo?: Readonly<ec.ClassInfo>;
  /** Raw values dictionary */
  public values: Readonly<ValuesDictionary<Value>>;
  /** Display values dictionary */
  public displayValues: Readonly<ValuesDictionary<DisplayValue>>;
  /** List of field names whose values are merged (see [Merging values]($docs/learning/content/Terminology#value-merging)) */
  public mergedFieldNames: string[];

  /**
   * Creates an instance of Item.
   * @param primaryKeys Keys of instances whose data is contained in this item
   * @param label Display label of the item
   * @param imageId ID of the image associated with this item
   * @param classInfo For cases when item consists only of same class instances, information about the ECClass
   * @param values Raw values dictionary
   * @param displayValues Display values dictionary
   * @param mergedFieldNames List of field names whose values are merged (see [Merging values]($docs/learning/content/Terminology#value-merging))
   */
  public constructor(primaryKeys: ec.InstanceKey[], label: string, imageId: string, classInfo: ec.ClassInfo | undefined,
    values: ValuesDictionary<Value>, displayValues: ValuesDictionary<DisplayValue>, mergedFieldNames: string[]) {
    this.primaryKeys = primaryKeys;
    this.label = label;
    this.imageId = imageId;
    this.classInfo = classInfo;
    this.values = values;
    this.displayValues = displayValues;
    this.mergedFieldNames = mergedFieldNames;
  }

  /**
   * Is value of field with the specified name merged in this record.
   */
  public isFieldMerged(fieldName: string): boolean {
    return -1 !== this.mergedFieldNames.indexOf(fieldName);
  }

  /*public toJSON(): ItemJSON {
    return Object.assign({}, this);
  }*/

  /**
   * Deserialize Item from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized item or undefined if deserialization failed
   */
  public static fromJSON(json: ItemJSON | string | undefined): Item | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Item.reviver);
    const item = Object.create(Item.prototype);
    return Object.assign(item, json, {
      primaryKeys: json.primaryKeys.map((pk) => ec.instanceKeyFromJSON(pk)),
      classInfo: json.classInfo ? ec.classInfoFromJSON(json.classInfo) : undefined,
    } as Partial<Item>);
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing Item objects.
   */
  public static reviver(key: string, value: any): any {
    return key === "" ? Item.fromJSON(value) : value;
  }
}
