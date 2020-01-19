/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import {
  ClassInfo, ClassInfoJSON,
  InstanceKey, InstanceKeyJSON,
} from "../EC";
import { ValuesDictionary } from "../Utils";
import {
  Value, DisplayValue,
  DisplayValueJSON, ValueJSON,
  ValuesMapJSON, DisplayValuesMapJSON,
} from "./Value";
import { LabelDefinition, LabelDefinitionJSON } from "../LabelDefinition";

/**
 * Serialized [[Item]] JSON representation.
 * @internal
 */
export interface ItemJSON {
  primaryKeys: InstanceKeyJSON[];
  /** @deprecated use labelDefinition instead */
  label?: string;
  labelDefinition: LabelDefinitionJSON;
  imageId: string;
  classInfo?: ClassInfoJSON;
  values: ValuesDictionary<ValueJSON>;
  displayValues: ValuesDictionary<DisplayValueJSON>;
  mergedFieldNames: string[];
  extendedData?: { [key: string]: any };
}

/**
 * A data structure that represents a single content record.
 * @public
 */
export class Item {
  /** Keys of instances whose data is contained in this item */
  public primaryKeys: InstanceKey[];
  /** Display label of the item
   * @deprecated use 'labelDefinition' instead
   */
  public label: string;
  /** Definition of item display label */
  public labelDefinition: LabelDefinition;
  /** ID of the image associated with this item */
  public imageId: string;
  /** For cases when item consists only of same class instances, information about the ECClass */
  public classInfo?: ClassInfo;
  /** Raw values dictionary */
  public values: ValuesDictionary<Value>;
  /** Display values dictionary */
  public displayValues: ValuesDictionary<DisplayValue>;
  /** List of field names whose values are merged (see [Merging values]($docs/learning/presentation/Content/Terminology#value-merging)) */
  public mergedFieldNames: string[];
  /** Extended data injected into this content item */
  public extendedData?: { [key: string]: any };

  /**
   * Creates an instance of Item.
   * @param primaryKeys Keys of instances whose data is contained in this item
   * @param label Display label of the item
   * @param imageId ID of the image associated with this item
   * @param classInfo For cases when item consists only of same class instances, information about the ECClass
   * @param values Raw values dictionary
   * @param displayValues Display values dictionary
   * @param mergedFieldNames List of field names whose values are merged (see [Merging values]($docs/learning/presentation/Content/Terminology#value-merging))
   * @param extendedData Extended data injected into this content item
   */
  public constructor(primaryKeys: InstanceKey[], label: string | LabelDefinition, imageId: string, classInfo: ClassInfo | undefined,
    values: ValuesDictionary<Value>, displayValues: ValuesDictionary<DisplayValue>, mergedFieldNames: string[], extendedData?: { [key: string]: any }) {
    this.primaryKeys = primaryKeys;
    this.imageId = imageId;
    this.classInfo = classInfo;
    this.values = values;
    this.displayValues = displayValues;
    this.mergedFieldNames = mergedFieldNames;
    this.extendedData = extendedData;
    this.label = typeof label === "string" ? label : label.displayValue;
    this.labelDefinition = typeof label === "string" ? LabelDefinition.fromLabelString(label) : label;
  }

  /**
   * Is value of field with the specified name merged in this record.
   */
  public isFieldMerged(fieldName: string): boolean {
    return -1 !== this.mergedFieldNames.indexOf(fieldName);
  }

  /** @internal */
  public toJSON(): ItemJSON {
    const { labelDefinition, ...content } = this;
    return Object.assign({}, content, {
      classInfo: this.classInfo ? ClassInfo.toJSON(this.classInfo) : undefined,
      values: Value.toJSON(this.values) as ValuesMapJSON,
      displayValues: DisplayValue.toJSON(this.displayValues) as DisplayValuesMapJSON,
      labelDefinition: LabelDefinition.toJSON(labelDefinition),
      label: labelDefinition.displayValue,
    });
  }

  /**
   * Deserialize Item from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized item or undefined if deserialization failed
   *
   * @internal
   */
  public static fromJSON(json: ItemJSON | string | undefined): Item | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Item.reviver);
    const item = Object.create(Item.prototype);
    return Object.assign(item, json, {
      primaryKeys: json.primaryKeys.map((pk) => InstanceKey.fromJSON(pk)),
      classInfo: json.classInfo ? ClassInfo.fromJSON(json.classInfo) : undefined,
      values: Value.fromJSON(json.values),
      displayValues: DisplayValue.fromJSON(json.displayValues),
      labelDefinition: LabelDefinition.fromJSON(json.labelDefinition),
      label: json.labelDefinition.displayValue,
    } as Partial<Item>);
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing Item objects.
   *
   * @internal
   */
  public static reviver(key: string, value: any): any {
    return key === "" ? Item.fromJSON(value) : value;
  }
}
