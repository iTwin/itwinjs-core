/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import { assert } from "@bentley/bentleyjs-core";
import * as content from "@bentley/ecpresentation-common/lib/content";
import {
  PropertyDescription, PropertyRecord,
  PropertyValueFormat, PropertyEditorInfo, EnumerationChoicesInfo,
  PropertyValue, PrimitiveValue, ArrayValue, StructValue,
} from "@bentley/ui-components";

const createArrayValue = (propertyDescription: PropertyDescription, arrayDescription: content.ArrayTypeDescription, values: any[], displayValues: Array<string | undefined>): ArrayValue => {
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

const createStructValue = (description: content.StructTypeDescription, valueObj: { [key: string]: any }, displayValueObj: { [key: string]: string | undefined }): StructValue => {
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

const createPrimitiveValue = (value: any, displayValue: string | undefined): PrimitiveValue => {
  return {
    valueFormat: PropertyValueFormat.Primitive,
    value,
    displayValue,
  } as PrimitiveValue;
};

const createValue = (propertyDescription: PropertyDescription, typeDescription: content.TypeDescription, isMerged: boolean, value: any, displayValue: any): PropertyValue | undefined => {
  if (!isMerged) {
    if (typeDescription.valueFormat === content.PropertyValueFormat.Array)
      return createArrayValue(propertyDescription, typeDescription, value, displayValue);
    if (typeDescription.valueFormat === content.PropertyValueFormat.Struct)
      return createStructValue(typeDescription, value, displayValue);
  }
  return createPrimitiveValue(value, displayValue);
};

const createRecordDescription = (typeDescription: content.TypeDescription, displayValue: any): string | undefined => {
  if (content.PropertyValueFormat.Array === typeDescription.valueFormat || content.PropertyValueFormat.Struct === typeDescription.valueFormat)
    return undefined;
  assert(content.PropertyValueFormat.Primitive === typeDescription.valueFormat);
  return displayValue;
};

const createRecord = (propertyDescription: PropertyDescription, typeDescription: content.TypeDescription,
  value: any, displayValue: any, isReadOnly: boolean, isMerged: boolean): PropertyRecord => {
  const valueObj = createValue(propertyDescription, typeDescription, isMerged, value, displayValue);
  const record = new PropertyRecord(valueObj, propertyDescription);
  record.description = createRecordDescription(typeDescription, displayValue);
  record.isMerged = isMerged;
  record.isReadonly = isReadOnly;
  return record;
};

const createNestedStructRecord = (field: content.NestedContentField, nestedContent: content.NestedContent, path?: content.Field[]): PropertyRecord => {
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
    // if the value is merged, just take the display value
    value = {
      valueFormat: PropertyValueFormat.Primitive,
      value: undefined,
      displayValue: item.displayValues[field.name],
    };
  } else {
    // nested content value is in NestedContent[] format
    const nestedContentArray: content.NestedContent[] = item.values[field.name];
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

export default class ContentBuilder {

  public static createPropertyRecord(field: content.Field, item: content.Item, path?: content.Field[]): PropertyRecord {
    if (field.isNestedContentField())
      return createNestedContentRecord(field, item, path);

    const isValueReadOnly = field.isReadonly || item.isFieldMerged(field.name);
    return createRecord(ContentBuilder.createPropertyDescription(field), field.type,
      item.values[field.name], item.displayValues[field.name],
      isValueReadOnly, item.isFieldMerged(field.name));
  }

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
