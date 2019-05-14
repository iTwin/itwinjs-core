/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { assert } from "@bentley/bentleyjs-core";
import {
  ValuesDictionary, PresentationError, PresentationStatus,
  Field, Item, DisplayValue, Value, PropertyValueFormat,
  NestedContentValue, NestedContentField,
  TypeDescription, StructTypeDescription, ArrayTypeDescription,
} from "@bentley/presentation-common";
import { Omit } from "@bentley/ui-core";
import {
  PropertyRecord, PropertyValue, PropertyValueFormat as UiPropertyValueFormat,
  ArrayValue, StructValue, PrimitiveValue,
  PropertyDescription, PropertyEditorInfo, EnumerationChoicesInfo,
} from "@bentley/imodeljs-frontend";

const createArrayValue = (propertyDescription: PropertyDescription, arrayDescription: ArrayTypeDescription, values: Value[], displayValues: DisplayValue[]): ArrayValue => {
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
    valueFormat: UiPropertyValueFormat.Array,
    items: records,
    itemsTypeName: arrayDescription.memberType.typeName,
  };
};

const createStructValue = (description: StructTypeDescription, valueObj: ValuesDictionary<Value>, displayValueObj: ValuesDictionary<DisplayValue>): StructValue => {
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
    valueFormat: UiPropertyValueFormat.Struct,
    members,
  } as StructValue;
};

const createPrimitiveValue = (value: Value, displayValue: DisplayValue): PrimitiveValue => {
  return {
    valueFormat: UiPropertyValueFormat.Primitive,
    value,
    displayValue,
  } as PrimitiveValue;
};

const createValue = (propertyDescription: PropertyDescription, typeDescription: TypeDescription, isMerged: boolean, value: Value, displayValue: DisplayValue): PropertyValue => {
  if (undefined === value && undefined === displayValue) {
    return {
      valueFormat: UiPropertyValueFormat.Primitive,
      value,
      displayValue: "",
    };
  }
  if (!isMerged) {
    if (typeDescription.valueFormat === PropertyValueFormat.Array) {
      if (!Value.isArray(value) || !DisplayValue.isArray(displayValue))
        throw new PresentationError(PresentationStatus.InvalidArgument, "value and displayValue should both be arrays");
      return createArrayValue(propertyDescription, typeDescription, value, displayValue);
    }
    if (typeDescription.valueFormat === PropertyValueFormat.Struct) {
      if (!Value.isMap(value) || !DisplayValue.isMap(displayValue))
        throw new PresentationError(PresentationStatus.InvalidArgument, "value and displayValue should both be of map type");
      return createStructValue(typeDescription, value, displayValue);
    }
  }
  return createPrimitiveValue(value, displayValue);
};

const createRecordDescription = (typeDescription: TypeDescription, displayValue: Omit<DisplayValue, "undefined">): string | undefined => {
  if (PropertyValueFormat.Array === typeDescription.valueFormat || PropertyValueFormat.Struct === typeDescription.valueFormat)
    return undefined;
  if (PropertyValueFormat.Primitive !== typeDescription.valueFormat || !DisplayValue.isPrimitive(displayValue))
    throw new PresentationError(PresentationStatus.InvalidArgument, "displayValue is of wrong type");
  return displayValue.toString();
};

const createRecord = (propertyDescription: PropertyDescription, typeDescription: TypeDescription,
  value: Value, displayValue: DisplayValue, isReadOnly: boolean, isMerged: boolean): PropertyRecord => {
  const valueObj = createValue(propertyDescription, typeDescription, isMerged, value, displayValue);
  const record = new PropertyRecord(valueObj, propertyDescription);
  if (displayValue)
    record.description = createRecordDescription(typeDescription, displayValue);
  if (isMerged)
    record.isMerged = true;
  if (isReadOnly)
    record.isReadonly = true;
  return record;
};

const createNestedStructRecord = (field: NestedContentField, nestedContent: NestedContentValue, path?: Field[]): PropertyRecord => {
  path = path ? [...path] : undefined;
  let pathField: Field | undefined;
  if (path && 0 !== path.length) {
    pathField = path.shift();
  }

  const item = new Item(nestedContent.primaryKeys, "", "",
    field.contentClassInfo, nestedContent.values, nestedContent.displayValues, nestedContent.mergedFieldNames);

  const members: { [name: string]: PropertyRecord } = {};
  for (const nestedField of field.nestedFields) {
    if (pathField && pathField !== nestedField)
      continue;
    members[nestedField.name] = ContentBuilder.createPropertyRecord(nestedField, item, path);
  }
  const value: StructValue = {
    valueFormat: UiPropertyValueFormat.Struct,
    members,
  };
  const record = new PropertyRecord(value, ContentBuilder.createPropertyDescription(field));
  record.isReadonly = field.isReadonly;
  record.isMerged = false;
  return record;
};

const createNestedContentRecord = (field: NestedContentField, item: Item, path?: Field[]): PropertyRecord => {
  const isMerged = item.isFieldMerged(field.name);
  let value: PropertyValue;

  if (isMerged) {
    const displayValue = item.displayValues[field.name];
    if (!DisplayValue.isPrimitive(displayValue))
      throw new PresentationError(PresentationStatus.Error, "displayValue should be primitive");
    // if the value is merged, just take the display value
    value = {
      valueFormat: UiPropertyValueFormat.Primitive,
      value: undefined,
      displayValue: (undefined !== displayValue) ? displayValue.toString() : "",
    };
  } else {
    const dictionaryValue = item.values[field.name];
    if (!Value.isNestedContent(dictionaryValue))
      throw new PresentationError(PresentationStatus.Error, "value should be nested content");
    // nested content value is in NestedContent[] format
    const nestedContentArray: NestedContentValue[] = dictionaryValue;
    value = {
      valueFormat: UiPropertyValueFormat.Array,
      items: nestedContentArray.map((r) => createNestedStructRecord(field, r, path)),
      itemsTypeName: field.type.typeName,
    };
    // if array contains just one value, replace it with the value
    if (1 === value.items.length)
      value = value.items[0].value!;
  }

  const record = new PropertyRecord(value, ContentBuilder.createPropertyDescription(field));
  if (isMerged)
    record.isMerged = true;
  if (field.isReadonly || isMerged)
    record.isReadonly = true;
  return record;
};

/**
 * A helper class which creates `ui-components` objects from `presentation` objects.
 * @internal
 */
export class ContentBuilder {
  /**
   * Create a property record for specified field and item
   * @param field Content field to create the record for
   * @param item Content item containing the values for `field`
   * @param path Optional path that specifies a path of fields to be
   * included in the record. Only makes sense if `field` is `NestedContentField`.
   * Should start from the first nested field inside `field`.
   */
  public static createPropertyRecord(field: Field, item: Item, path?: Field[]): PropertyRecord {
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
  public static createPropertyDescription(field: Field): PropertyDescription {
    const descr: PropertyDescription = {
      name: field.name,
      displayLabel: field.label,
      typename: field.type.typeName,
    };
    if (field.editor) {
      descr.editor = { name: field.editor.name, params: [] } as PropertyEditorInfo;
    }
    if (field.type.valueFormat === PropertyValueFormat.Primitive && "enum" === field.type.typeName && field.isPropertiesField()) {
      const enumInfo = field.properties[0].property.enumerationInfo!;
      descr.enum = {
        choices: enumInfo.choices,
        isStrict: enumInfo.isStrict,
      } as EnumerationChoicesInfo;
    }
    return descr;
  }
}
