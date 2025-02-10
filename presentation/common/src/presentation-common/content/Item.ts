/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { ClassInfo, InstanceKey } from "../EC";
import { LabelDefinition } from "../LabelDefinition";
import { omitUndefined, ValuesDictionary } from "../Utils";
import { DisplayValue, Value } from "./Value";

/**
 * Serialized [[Item]] JSON representation.
 * @public
 */
export interface ItemJSON {
  inputKeys?: InstanceKey[];
  primaryKeys: InstanceKey[];
  /** @deprecated in 5.x. Use [[label]] instead. */
  labelDefinition: LabelDefinition;
  label?: LabelDefinition;
  classInfo?: ClassInfo;
  values: ValuesDictionary<Value>;
  displayValues: ValuesDictionary<DisplayValue>;
  mergedFieldNames: string[];
  extendedData?: { [key: string]: any };
}

/**
 * Props for creating [[Item]].
 * @public
 */
interface ItemProps {
  inputKeys?: InstanceKey[];
  primaryKeys: InstanceKey[];
  label: LabelDefinition;
  classInfo?: ClassInfo;
  values: ValuesDictionary<Value>;
  displayValues: ValuesDictionary<DisplayValue>;
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
   * @deprecated in 5.0. Use an overload with `ItemProps` instead.
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
  );
  public constructor(props: ItemProps);
  public constructor(
    primaryKeysOrProps: ItemProps | InstanceKey[],
    label?: string | LabelDefinition,
    imageId?: string,
    classInfo?: ClassInfo | undefined,
    values?: ValuesDictionary<Value>,
    displayValues?: ValuesDictionary<DisplayValue>,
    mergedFieldNames?: string[],
    extendedData?: { [key: string]: any },
  ) {
    /* istanbul ignore next */
    const props = Array.isArray(primaryKeysOrProps)
      ? {
          primaryKeys: primaryKeysOrProps,
          label: typeof label === "string" ? LabelDefinition.fromLabelString(label) : label!,
          imageId: imageId!,
          classInfo,
          values: values!,
          displayValues: displayValues!,
          mergedFieldNames: mergedFieldNames!,
          extendedData,
        }
      : primaryKeysOrProps;

    if ("inputKeys" in props) {
      this.inputKeys = props.inputKeys;
    }
    this.primaryKeys = props.primaryKeys;
    this.classInfo = props.classInfo;
    this.values = props.values;
    this.displayValues = props.displayValues;
    this.mergedFieldNames = props.mergedFieldNames;
    this.extendedData = props.extendedData;
    this.label = props.label;
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
    return omitUndefined({
      ...baseItem,
      labelDefinition: label,
      label,
    });
  }

  /** Deserialize [[Item]] from JSON */
  public static fromJSON(json: ItemJSON | string | undefined): Item | undefined {
    if (!json) {
      return undefined;
    }

    if (typeof json === "string") {
      return Item.fromJSON(JSON.parse(json));
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const { labelDefinition, label, ...baseJson } = json;
    return new Item({
      ...baseJson,
      label: label ?? labelDefinition,
    });
  }
}
