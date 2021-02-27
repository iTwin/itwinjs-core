/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */
import { assert } from "@bentley/bentleyjs-core";
import {
  ArrayTypeDescription, DisplayValue, Field, Item, NestedContentField, NestedContentValue, PresentationError, PresentationStatus, PropertyValueFormat,
  StructTypeDescription, TypeDescription, Value, ValuesDictionary,
} from "@bentley/presentation-common";
import {
  ArrayValue, EnumerationChoicesInfo, PrimitiveValue, PropertyDescription, PropertyEditorInfo, PropertyRecord, PropertyValue,
  StructValue, PropertyValueFormat as UiPropertyValueFormat,
} from "@bentley/ui-abstract";
import { Omit } from "@bentley/ui-core";

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
  value: Value, displayValue: DisplayValue, isReadOnly: boolean, isMerged: boolean, extendedData?: { [key: string]: any }): PropertyRecord => {
  const valueObj = createValue(propertyDescription, typeDescription, isMerged, value, displayValue);
  const record = new PropertyRecord(valueObj, propertyDescription);
  if (displayValue)
    record.description = createRecordDescription(typeDescription, displayValue);
  if (isMerged)
    record.isMerged = true;
  if (isReadOnly)
    record.isReadonly = true;
  if (extendedData)
    record.extendedData = extendedData;
  return record;
};

const createNestedStructRecord = (field: NestedContentField, nestedContent: NestedContentValue, props: NestedContentCreationProps & PropertyDescriptionCreationProps): PropertyRecord | undefined => {
  const exclusiveIncludePath = props.exclusiveIncludePath ? [...props.exclusiveIncludePath] : undefined;
  let exclusiveIncludePathField: Field | undefined;
  if (exclusiveIncludePath && 0 !== exclusiveIncludePath.length) {
    exclusiveIncludePathField = exclusiveIncludePath.shift();
  }

  const item = new Item(nestedContent.primaryKeys, "", "",
    field.contentClassInfo, nestedContent.values, nestedContent.displayValues, nestedContent.mergedFieldNames);

  const namePrefix = applyOptionalPrefix(field.name, props.namePrefix);
  const members: { [name: string]: PropertyRecord } = {};
  let hasMembers = false;
  for (const nestedField of field.nestedFields) {
    if (exclusiveIncludePathField && exclusiveIncludePathField !== nestedField) {
      // we know specific field that we want - skip if the current field doesn't match
      continue;
    }
    let hiddenFieldPaths = props.hiddenFieldPaths;
    if (hiddenFieldPaths) {
      if (hiddenFieldPaths.some((path) => path.length === 1 && path[0] === nestedField)) {
        // we know paths of fields that we want hidden - skip if the current field matches any of those paths
        continue;
      }
      // pick all paths that start with current field
      hiddenFieldPaths = filterMatchingFieldPaths(hiddenFieldPaths, nestedField);
    }
    const memberRecord = ContentBuilder.createPropertyRecord(nestedField, item, { ...props, exclusiveIncludePath, hiddenFieldPaths, namePrefix });
    if (memberRecord) {
      members[nestedField.name] = memberRecord;
      hasMembers = true;
    }
  }

  if (props.skipChildlessRecords && !hasMembers)
    return undefined;

  const value: StructValue = {
    valueFormat: UiPropertyValueFormat.Struct,
    members,
  };
  const record = new PropertyRecord(value, ContentBuilder.createPropertyDescription(field, props));
  record.isReadonly = field.isReadonly;
  record.isMerged = false;
  return record;
};

const createNestedContentRecord = (field: NestedContentField, item: Item, props: NestedContentCreationProps & PropertyDescriptionCreationProps): PropertyRecord | undefined => {
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
      items: nestedContentArray.map((r) => createNestedStructRecord(field, r, props)).filter((r): r is PropertyRecord => !!r),
      itemsTypeName: field.type.typeName,
    };
    // if array contains no values, return `undefined`
    if (props.skipChildlessRecords && 0 === value.items.length)
      return undefined;
    // if array contains just one value, replace it with the value
    if (1 === value.items.length)
      value = value.items[0].value;
  }

  const record = new PropertyRecord(value, ContentBuilder.createPropertyDescription(field, props));
  if (isMerged)
    record.isMerged = true;
  if (field.isReadonly || isMerged)
    record.isReadonly = true;
  if (field.autoExpand)
    record.autoExpand = true;
  if (item.extendedData)
    record.extendedData = item.extendedData;
  return record;
};

/** @internal */
export interface NestedContentCreationProps {
  /**
   * A path of fields to be exclusively included in the record. Should not include the
   * field the record is being created for.
   */
  exclusiveIncludePath?: Field[];

  /**
   * Paths of fields which should be omitted from the nested content
   */
  hiddenFieldPaths?: Field[][];

  /**
   * Should a struct or array record be skipped if it has no members / items.
   */
  skipChildlessRecords?: boolean;
}

/** @internal */
export interface PropertyDescriptionCreationProps {
  /** Name prefix for the created property record. */
  namePrefix?: string;
}

/**
 * A helper class which creates `ui-components` objects from `presentation` objects.
 * @internal
 */
export class ContentBuilder {
  /**
   * Create a property record for specified field and item
   * @param field Content field to create the record for
   * @param item Content item containing the values for `field`
   * @param props Parameters for creating the record
   */
  public static createPropertyRecord(field: Field, item: Item, props?: NestedContentCreationProps & PropertyDescriptionCreationProps): PropertyRecord | undefined {
    if (field.isNestedContentField())
      return createNestedContentRecord(field, item, props ? props : {});

    const isValueReadOnly = field.isReadonly || item.isFieldMerged(field.name);
    return createRecord(ContentBuilder.createPropertyDescription(field, props), field.type,
      item.values[field.name], item.displayValues[field.name],
      isValueReadOnly, item.isFieldMerged(field.name), item.extendedData);
  }

  /**
   * Create a property description for the specified field
   * @param field Content field to create description for
   * @param props Parameters for creating the description
   */
  public static createPropertyDescription(field: Field, props?: PropertyDescriptionCreationProps): PropertyDescription {
    const descr: PropertyDescription = {
      name: applyOptionalPrefix(field.name, props ? props.namePrefix : undefined),
      displayLabel: field.label,
      typename: field.type.typeName,
    };

    if (field.renderer) {
      descr.renderer = { name: field.renderer.name };
    }

    if (field.editor) {
      descr.editor = { name: field.editor.name, params: [] } as PropertyEditorInfo;
    }

    if (field.type.valueFormat === PropertyValueFormat.Primitive && "enum" === field.type.typeName && field.isPropertiesField() && field.properties[0].property.enumerationInfo) {
      const enumInfo = field.properties[0].property.enumerationInfo;
      descr.enum = {
        choices: enumInfo.choices,
        isStrict: enumInfo.isStrict,
      } as EnumerationChoicesInfo;
    }
    return descr;
  }
}

/** @internal */
export const filterMatchingFieldPaths = (paths: Field[][], start: Field) => paths
  .filter((path) => path.length > 1 && path[0] === start)
  .map((path) => path.slice(1));

/** @internal */
export const FIELD_NAMES_SEPARATOR = "$";

/** @internal */
export const applyOptionalPrefix = (str: string, prefix?: string) => (prefix ? `${prefix}${FIELD_NAMES_SEPARATOR}${str}` : str);
