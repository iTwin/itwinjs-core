/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import { assert } from "@bentley/bentleyjs-core";
import * as content from "@bentley/ecpresentation-common/lib/content";

export interface PropertyDescription {
  name: string;
  displayLabel: string;
  typename: string;
  editor: string;
}

export interface EnumerationChoice {
  label: string;
  value: string | number;
}
export interface EnumerationInfo {
  choices: EnumerationChoice[];
  isStrict: boolean;
}
export interface ChoicesPropertyDescription extends PropertyDescription {
  enumerationInfo: EnumerationInfo;
  maxDisplayedRows?: number;
}

export interface PropertyValue {
  valueFormat: content.PropertyValueFormat;
}
export interface PrimitiveValue extends PropertyValue {
  value: any;
  displayValue: string;
}
export interface StructValue extends PropertyValue {
  members: { [name: string]: PropertyRecord };
}
export interface ArrayValue extends PropertyValue {
  items: PropertyRecord[];
}
export const isPrimitiveValue = (v: PropertyValue): v is PrimitiveValue => (content.PropertyValueFormat.Primitive === v.valueFormat);
export const isStructValue = (v: PropertyValue): v is StructValue => (content.PropertyValueFormat.Struct === v.valueFormat);
export const isArrayValue = (v: PropertyValue): v is ArrayValue => (content.PropertyValueFormat.Array === v.valueFormat);
export const isValueEmpty = (v: PropertyValue): boolean => {
  if (isPrimitiveValue(v))
    return (null === v.value || undefined === v.value || "" === v.value);
  if (isStructValue(v))
    return !v.members;
  if (isArrayValue(v))
    return !v.items || 0 === v.items.length;
  return false;
};

export interface PropertyRecord {
  property: PropertyDescription;
  value: PropertyValue;
  description: string;
  unit?: string;
  isReadonly: boolean;
  isMerged: boolean;
}

class NestedContentRecord implements PropertyRecord {
  private _field: content.NestedContentField;
  private _path?: content.Field[];
  public value: PropertyValue;
  public description: string;
  public unit: string;
  public isReadonly: boolean;
  public property: PropertyDescription;
  public isMerged: boolean;

  constructor(field: content.NestedContentField, item: content.Item, path?: content.Field[]) {
    this._field = field;
    this._path = path ? path.slice() : undefined;

    this.description = "";
    this.unit = "";
    this.property = ContentBuilder.createPropertyDescription(field);
    this.isMerged = item.isFieldMerged(field.name);
    this.isReadonly = field.isReadonly || this.isMerged;

    if (this.isMerged) {
      // if the value is merged, just take the '*** Varies ***' stored in display values map
      // wip: probably want to take a localized Varies string instead of pulling it from
      // the native library
      this.value = {
        valueFormat: content.PropertyValueFormat.Primitive,
        value: item.displayValues[field.name],
        displayValue: item.displayValues[field.name],
      } as PrimitiveValue;
    } else {
      // nested content value is in Array<NestedContent> format
      const nestedContentArray: content.NestedContent[] = item.values[field.name];
      const items = new Array<PropertyRecord>();
      for (const nestedContent of nestedContentArray)
        items.push(this.createNestedStructRecord(nestedContent, path));
      const value = {
        valueFormat: content.PropertyValueFormat.Array,
        items,
      } as ArrayValue;
      if (1 === nestedContentArray.length)
        this.value = value.items[0].value;
      else
        this.value = value;
    }

    if (this._path) {
      // iterate to the last record
      let record: PropertyRecord = this;
      let merged = this.isMerged;
      let readonly = this.isReadonly;
      path = this._path.slice();
      while (0 !== path.length) {
        const nestedField = path.shift()!;
        if (merged) {
          record.property = ContentBuilder.createPropertyDescription(path.pop() || nestedField);
          break;
        }
        if (isArrayValue(record.value) && 0 === record.value.items.length) {
          // found empty array which means no value
          record.property = ContentBuilder.createPropertyDescription(path.pop() || nestedField);
          record.value = {
            valueFormat: content.PropertyValueFormat.Primitive,
            value: undefined,
          } as PrimitiveValue;
          break;
        }
        if (isArrayValue(record.value) && 1 === record.value.items.length) {
          const members: { [name: string]: PropertyRecord } = {};
          members[nestedField.name] = record.value.items[0];
          record.value = {
            valueFormat: content.PropertyValueFormat.Struct,
            members,
          } as StructValue;
        }
        if (isStructValue(record.value)) {
          record = record.value.members[nestedField.name];
          readonly = (readonly || record.isReadonly);
          merged = (merged || record.isMerged);
        } else {
          assert(false, "Can only nest into nested struct records");
          return;
        }
      }
      this.property = record.property;
      this.value = record.value;
      this.isMerged = merged;
      this.isReadonly = readonly || merged;
    }
  }

  private createNestedStructRecord(nestedContent: content.NestedContent, path?: content.Field[]): PropertyRecord {
    const item = new content.Item(nestedContent.primaryKeys, "", "",
      this._field.contentClassInfo, nestedContent.values, nestedContent.displayValues, []);

    let pathField: content.Field | undefined;
    if (path) {
      if (0 !== path.length)
        pathField = path.shift();
      else
        path = undefined;
    }

    const members: {[name: string]: PropertyRecord} = {};
    for (const nestedField of this._field.nestedFields) {
      if (pathField && pathField !== nestedField)
        continue;
      members[nestedField.name] = ContentBuilder.createPropertyRecord(nestedField, item, path);
    }

    return {
      property: ContentBuilder.createPropertyDescription(this._field),
      value: {
        valueFormat: content.PropertyValueFormat.Struct,
        members,
      } as StructValue,
      description: "",
      unit: "",
      isReadonly: this._field.isReadonly,
      isMerged: false,
    } as PropertyRecord;
  }
}

export default class ContentBuilder {
  private static createRecord(propertyDescription: PropertyDescription, typeDescription: content.TypeDescription,
    value: any, displayValue: any, isReadOnly: boolean, isMerged: boolean): PropertyRecord {
    const createRecordDescription = (): string | undefined => {
      if (content.PropertyValueFormat.Array === typeDescription.valueFormat || content.PropertyValueFormat.Struct === typeDescription.valueFormat)
        return undefined;
      assert(content.PropertyValueFormat.Primitive === typeDescription.valueFormat);
      return displayValue;
    };
    const createDisplayValue = (): string | undefined => {
      if (isMerged || content.PropertyValueFormat.Primitive === typeDescription.valueFormat)
        return displayValue;
      return undefined;
    };
    const createArrayValue = (arrayDescription: content.ArrayTypeDescription, values: any[], displayValues: Array<string | undefined>): ArrayValue => {
      const items = new Array<PropertyRecord>();
      if (values && displayValues) {
        assert(values.length === displayValues.length);
        for (let i = 0; i < values.length; ++i) {
          const memberDescription = {
            name: propertyDescription.name,
            displayLabel: propertyDescription.displayLabel,
            typename: arrayDescription.memberType.typeName,
            editor: "",
          } as PropertyDescription;
          const record = ContentBuilder.createRecord(memberDescription, arrayDescription.memberType,
            values[i], displayValues[i], true, false);
          items.push(record);
        }
      }
      return {
        valueFormat: content.PropertyValueFormat.Array,
        items,
      } as ArrayValue;
    };
    const createStructValue = (description: content.StructTypeDescription,
      valueObj: { [key: string]: any },
      displayValueObj: { [key: string]: string | undefined }): StructValue => {
      const members: { [name: string]: PropertyRecord } = {};
      if (valueObj && displayValueObj) {
        for (const memberTypeDescription of description.members) {
          if (undefined === valueObj[memberTypeDescription.name]) {
            assert(false);
            continue;
          }
          const memberPropertyDescription = {
            name: memberTypeDescription.name,
            displayLabel: memberTypeDescription.label,
            typename: memberTypeDescription.type.typeName,
            editor: "",
          } as PropertyDescription;
          const record = ContentBuilder.createRecord(memberPropertyDescription, memberTypeDescription.type,
            valueObj[memberTypeDescription.name], displayValueObj[memberTypeDescription.name], true, false);
          members[memberTypeDescription.name] = record;
        }
      }
      return {
        valueFormat: content.PropertyValueFormat.Struct,
        members,
      } as StructValue;
    };
    const createValue = (): PropertyValue | undefined => {
      if (!isMerged) {
        if (typeDescription.valueFormat === content.PropertyValueFormat.Array)
          return createArrayValue(typeDescription, value, displayValue);
        if (typeDescription.valueFormat === content.PropertyValueFormat.Struct)
          return createStructValue(typeDescription, value, displayValue);
      }
      return {
        valueFormat: content.PropertyValueFormat.Primitive,
        value,
        displayValue: createDisplayValue(),
      } as PrimitiveValue;
    };

    return {
      property: propertyDescription,
      value: createValue(),
      description: createRecordDescription(),
      unit: "",
      isReadonly: isReadOnly,
      isMerged,
    } as PropertyRecord;
  }

  public static createPropertyRecord(field: content.Field, item: content.Item, path?: content.Field[]): PropertyRecord {
    if (field.isNestedContentField())
      return new NestedContentRecord(field, item, path);

    const isValueReadOnly = field.isReadonly || item.isFieldMerged(field.name);
    return ContentBuilder.createRecord(ContentBuilder.createPropertyDescription(field), field.type,
      item.values[field.name], item.displayValues[field.name],
      isValueReadOnly, item.isFieldMerged(field.name));
  }

  public static createInvalidPropertyRecord(): PropertyRecord {
    return {
      description: "",
      unit: "",
      isReadonly: true,
      property: ContentBuilder.createInvalidPropertyDescription(),
      isMerged: false,
    } as PropertyRecord;
  }

  public static createPropertyDescription(field: content.Field): PropertyDescription {
    if (field.type.valueFormat === content.PropertyValueFormat.Primitive && "enum" === field.type.typeName) {
      if (field.isPropertiesField()) {
        return {
          name: field.name,
          displayLabel: field.label,
          typename: field.type.typeName,
          editor: field.editor ? field.editor.name : undefined,
          enumerationInfo: field.properties[0].property.enumerationInfo!,
          maxDisplayedRows: undefined,
        } as ChoicesPropertyDescription;
      }
      assert(false, "Only properties' fields can have an 'enum' type");
    }

    return {
      name: field.name,
      displayLabel: field.label,
      typename: field.type.typeName,
      editor: field.editor ? field.editor.name : undefined,
    } as PropertyDescription;
  }

  public static createInvalidPropertyDescription(): PropertyDescription {
    return {
      name: "",
      displayLabel: "",
      typename: "",
      editor: "",
    } as PropertyDescription;
  }
}
