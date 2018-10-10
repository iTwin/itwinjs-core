/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { assert } from "@bentley/bentleyjs-core";
import { ValuesDictionary, PresentationError, PresentationStatus } from "@bentley/presentation-common";
import * as content from "@bentley/presentation-common/lib/content";
import {
  PropertyDescription, PropertyRecord,
  PropertyValueFormat, PropertyEditorInfo, EnumerationChoicesInfo,
  PropertyValue, PrimitiveValue, ArrayValue, StructValue,
} from "@bentley/ui-components/lib/properties";

const isNestedContent = (v: content.Value): v is content.NestedContent[] => {
  // note: we don't guarantee by 100% that v is NestedContent[], but merely make compiler happy.
  // we have other means to determine the type of value.
  if (!v)
    return false;
  return Array.isArray(v);
};
const isArray = (v: content.Value | content.DisplayValue): v is content.ValuesArray | content.DisplayValuesArray => {
  // note: we don't guarantee by 100% that v is ValuesArray | DisplayValuesArray, but merely make compiler happy.
  // we have other means to determine the type of value.
  if (!v)
    return false;
  return Array.isArray(v);
};
const isMap = (v: content.Value | content.DisplayValue): v is content.ValuesMap | content.DisplayValuesMap => {
  if (!v)
    return false;
  return typeof v === "object";
};
const isPrimitive = (v: content.Value | content.DisplayValue): v is string | number | boolean | undefined => {
  return !isArray(v) && !isMap(v);
};

const createArrayValue = (propertyDescription: PropertyDescription, arrayDescription: content.ArrayTypeDescription, values: content.Value[], displayValues: content.DisplayValue[]): ArrayValue => {
  const records = new Array<PropertyRecord>();
  assert(values.length === displayValues.length);
  for (let i = 0; i < values.length; ++i) {
    const memberDescription = {
      name: propertyDescription.name,
      displayLabel: propertyDescription.displayLabel,
      typename: arrayDescription.memberType.typeName,
    } as PropertyDescription;
    const record = createRecord(memberDescription, arrayDescription.memberType,
      values[i], displayValues[i], true, false);
    records.push(record);
  }
  return {
    valueFormat: PropertyValueFormat.Array,
    items: records,
  };
};

const createStructValue = (description: content.StructTypeDescription, valueObj: ValuesDictionary<content.Value>, displayValueObj: ValuesDictionary<content.DisplayValue>): StructValue => {
  const members: { [name: string]: PropertyRecord } = {};
  for (const memberTypeDescription of description.members) {
    const memberPropertyDescription = {
      name: memberTypeDescription.name,
      displayLabel: memberTypeDescription.label,
      typename: memberTypeDescription.type.typeName,
    } as PropertyDescription;
    const record = createRecord(memberPropertyDescription, memberTypeDescription.type,
      valueObj[memberTypeDescription.name], displayValueObj[memberTypeDescription.name], true, false);
    members[memberTypeDescription.name] = record;
  }
  return {
    valueFormat: PropertyValueFormat.Struct,
    members,
  } as StructValue;
};

const createPrimitiveValue = (value: content.Value, displayValue: content.DisplayValue): PrimitiveValue => {
  return {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue,
  } as PrimitiveValue;
};

const createValue = (propertyDescription: PropertyDescription, typeDescription: content.TypeDescription, isMerged: boolean, value: content.Value, displayValue: content.DisplayValue): PropertyValue => {
  if (!isMerged) {
    if (typeDescription.valueFormat === content.PropertyValueFormat.Array) {
      if (!isArray(value) || !isArray(displayValue))
        throw new PresentationError(PresentationStatus.InvalidArgument, "value and displayValue should both be arrays");
      return createArrayValue(propertyDescription, typeDescription, value, displayValue);
    }
    if (typeDescription.valueFormat === content.PropertyValueFormat.Struct) {
      if (!isMap(value) || !isMap(displayValue))
        throw new PresentationError(PresentationStatus.InvalidArgument, "value and displayValue should both be of map type");
      return createStructValue(typeDescription, value, displayValue);
    }
  }
  return createPrimitiveValue(value, displayValue);
};

const createRecordDescription = (typeDescription: content.TypeDescription, displayValue: content.DisplayValue): string | undefined => {
  if (content.PropertyValueFormat.Array === typeDescription.valueFormat || content.PropertyValueFormat.Struct === typeDescription.valueFormat)
    return undefined;
  if (content.PropertyValueFormat.Primitive !== typeDescription.valueFormat || !isPrimitive(displayValue))
    throw new PresentationError(PresentationStatus.InvalidArgument, "displayValue is of wrong type");
  return displayValue;
};

const createRecord = (propertyDescription: PropertyDescription, typeDescription: content.TypeDescription,
  value: content.Value, displayValue: content.DisplayValue, isReadOnly: boolean, isMerged: boolean): PropertyRecord => {
  const valueObj = createValue(propertyDescription, typeDescription, isMerged, value, displayValue);
  const record = new PropertyRecord(valueObj, propertyDescription);
  record.description = createRecordDescription(typeDescription, displayValue);
  record.isMerged = isMerged;
  record.isReadonly = isReadOnly;
  return record;
};

const createNestedStructRecord = (field: content.NestedContentField, nestedContent: content.NestedContent, path?: content.Field[]): PropertyRecord => {
  path = path ? [...path] : undefined;
  let pathField: content.Field | undefined;
  if (path && 0 !== path.length) {
    pathField = path.shift();
  }

  const item = new content.Item(nestedContent.primaryKeys, "", "",
    field.contentClassInfo, nestedContent.values, nestedContent.displayValues, nestedContent.mergedFieldNames);

  const members: { [name: string]: PropertyRecord } = {};
  for (const nestedField of field.nestedFields) {
    if (pathField && pathField !== nestedField)
      continue;
    members[nestedField.name] = ContentBuilder.createPropertyRecord(nestedField, item, path);
  }
  const value: StructValue = {
    valueFormat: PropertyValueFormat.Struct,
    members,
  };
  const record = new PropertyRecord(value, ContentBuilder.createPropertyDescription(field));
  record.isReadonly = field.isReadonly;
  record.isMerged = false;
  return record;
};

const createNestedContentRecord = (field: content.NestedContentField, item: content.Item, path?: content.Field[]): PropertyRecord => {
  const isMerged = item.isFieldMerged(field.name);
  let value: PropertyValue;

  if (isMerged) {
    const displayValue = item.displayValues[field.name];
    if (!isPrimitive(displayValue))
      throw new PresentationError(PresentationStatus.Error, "displayValue should be primitive");
    // if the value is merged, just take the display value
    value = {
      valueFormat: PropertyValueFormat.Primitive,
      value: undefined,
      displayValue: displayValue || "",
    };
  } else {
    const dictionaryValue = item.values[field.name];
    if (!isNestedContent(dictionaryValue))
      throw new PresentationError(PresentationStatus.Error, "value should be nested content");
    // nested content value is in NestedContent[] format
    const nestedContentArray: content.NestedContent[] = dictionaryValue;
    value = {
      valueFormat: PropertyValueFormat.Array,
      items: nestedContentArray.map((r) => createNestedStructRecord(field, r, path)),
    };
    // if array contains just one value, replace it with the value
    if (1 === value.items.length)
      value = value.items[0].value!;
  }

  const record = new PropertyRecord(value, ContentBuilder.createPropertyDescription(field));
  record.isMerged = isMerged;
  record.isReadonly = field.isReadonly || isMerged;
  return record;
};

/**
 * A helper class which creates `ui-components` objects from `presentation` objects.
 */
export default class ContentBuilder {
  /**
   * Create a property record for specified field and item
   * @param field Content field to create the record for
   * @param item Content item containing the values for `field`
   * @param path Optional path that specifies a path of fields to be
   * included in the record. Only makes sense if `field` is `NestedContentField`.
   * Should start from the first nested field inside `field`.
   */
  public static createPropertyRecord(field: content.Field, item: content.Item, path?: content.Field[]): PropertyRecord {
    if (field.isNestedContentField())
      return createNestedContentRecord(field, item, path);

    const isValueReadOnly = field.isReadonly || item.isFieldMerged(field.name);
    return createRecord(ContentBuilder.createPropertyDescription(field), field.type,
      item.values[field.name], item.displayValues[field.name],
      isValueReadOnly, item.isFieldMerged(field.name));
  }

  /**
   * Create a property description for the specified field
   * @param field Content field to create description for
   */
  public static createPropertyDescription(field: content.Field): PropertyDescription {
    const descr: PropertyDescription = {
      name: field.name,
      displayLabel: field.label,
      typename: field.type.typeName,
    };
    if (field.editor) {
      descr.editor = { name: field.editor.name, params: [] } as PropertyEditorInfo;
    }
    if (field.type.valueFormat === content.PropertyValueFormat.Primitive && "enum" === field.type.typeName && field.isPropertiesField()) {
      const enumInfo = field.properties[0].property.enumerationInfo!;
      descr.enum = {
        choices: enumInfo.choices,
        isStrict: enumInfo.isStrict,
      } as EnumerationChoicesInfo;
    }
    return descr;
  }
}
