/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { ClassInfo, InstanceKey } from "../EC";
import { LabelDefinition, LabelDefinitionJSON } from "../LabelDefinition";
import { ValuesDictionary } from "../Utils";
import { DisplayValue, DisplayValueJSON, DisplayValuesMapJSON, Value, ValueJSON, ValuesMapJSON } from "./Value";

/**
 * Serialized [[Item]] JSON representation.
 * @public
 */
export interface ItemJSON {
  inputKeys?: InstanceKey[];
  primaryKeys: InstanceKey[];
  // TODO: rename to `label`
  // eslint-disable-next-line deprecation/deprecation
  labelDefinition: LabelDefinitionJSON;
  /** @deprecated in 3.x. Use [[extendedData]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details. */
  imageId: string;
  classInfo?: ClassInfo;
  // eslint-disable-next-line deprecation/deprecation
  values: ValuesDictionary<ValueJSON>;
  // eslint-disable-next-line deprecation/deprecation
  displayValues: ValuesDictionary<DisplayValueJSON>;
  mergedFieldNames: string[];
  extendedData?: { [key: string]: any };
}

/**
 * A data structure that represents a single content record.
 * @public
 */
export class Item {
  /**
   * Keys of input instances that caused this item to be included in content. Only set if the content is
   * created with [[ContentFlags.IncludeInputKeys]] flag.
   */
  public inputKeys?: InstanceKey[];
  /** Keys of instances whose data is contained in this item */
  public primaryKeys: InstanceKey[];
  /** Display label of the item */
  public label: LabelDefinition;
  /**
   * ID of the image associated with this item
   * @deprecated in 3.x. Use [[extendedData]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details.
   */
  public imageId: string;
  /** For cases when item consists only of same class instances, information about the ECClass */
  public classInfo?: ClassInfo;
  /** Raw values dictionary */
  public values: ValuesDictionary<Value>;
  /** Display values dictionary */
  public displayValues: ValuesDictionary<DisplayValue>;
  /** List of field names whose values are merged (see [Merging values]($docs/presentation/content/Terminology#value-merging)) */
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
   * @param mergedFieldNames List of field names whose values are merged (see [Merging values]($docs/presentation/content/Terminology#value-merging))
   * @param extendedData Extended data injected into this content item
   */
  public constructor(
    primaryKeys: InstanceKey[],
    label: string | LabelDefinition,
    imageId: string,
    classInfo: ClassInfo | undefined,
    values: ValuesDictionary<Value>,
    displayValues: ValuesDictionary<DisplayValue>,
    mergedFieldNames: string[],
    extendedData?: { [key: string]: any },
  ) {
    this.primaryKeys = primaryKeys;
    this.imageId = imageId; // eslint-disable-line deprecation/deprecation
    this.classInfo = classInfo;
    this.values = values;
    this.displayValues = displayValues;
    this.mergedFieldNames = mergedFieldNames;
    this.extendedData = extendedData;
    this.label = typeof label === "string" ? LabelDefinition.fromLabelString(label) : label;
  }

  /**
   * Is value of field with the specified name merged in this record.
   */
  public isFieldMerged(fieldName: string): boolean {
    return -1 !== this.mergedFieldNames.indexOf(fieldName);
  }

  /** Serialize this object to JSON */
  public toJSON(): ItemJSON {
    const { label, ...baseItem } = this;
    return {
      ...baseItem,
      // eslint-disable-next-line deprecation/deprecation
      values: Value.toJSON(this.values) as ValuesMapJSON,
      // eslint-disable-next-line deprecation/deprecation
      displayValues: DisplayValue.toJSON(this.displayValues) as DisplayValuesMapJSON,
      // eslint-disable-next-line deprecation/deprecation
      labelDefinition: LabelDefinition.toJSON(label),
    };
  }

  /** Deserialize [[Item]] from JSON */
  public static fromJSON(json: ItemJSON | string | undefined): Item | undefined {
    if (!json) {
      return undefined;
    }
    if (typeof json === "string") {
      return JSON.parse(json, (key, value) => Item.reviver(key, value));
    }
    const item = Object.create(Item.prototype);
    const { labelDefinition, ...baseJson } = json;
    return Object.assign(item, baseJson, {
      // eslint-disable-next-line deprecation/deprecation
      values: Value.fromJSON(json.values),
      // eslint-disable-next-line deprecation/deprecation
      displayValues: DisplayValue.fromJSON(json.displayValues),
      // eslint-disable-next-line deprecation/deprecation
      label: LabelDefinition.fromJSON(labelDefinition),
    } as Partial<Item>);
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing Item objects.
   * @internal
   */
  public static reviver(key: string, value: any): any {
    return key === "" ? Item.fromJSON(value) : value;
  }

  /**
   * Deserialize items list from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized items list
   * @internal
   */
  public static listFromJSON(json: ItemJSON[] | string): Item[] {
    if (typeof json === "string") {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      return JSON.parse(json, Item.listReviver);
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    return json.map(Item.fromJSON).filter((item): item is Item => !!item);
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing [[Item]][] objects.
   * @internal
   */
  public static listReviver(key: string, value: any): any {
    return key === "" ? Item.listFromJSON(value) : value;
  }
}
