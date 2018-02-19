/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as content from "../../common/content";
import { isPropertiesField } from "../../common/content/Fields";
import { isFieldMerged, getFieldPropertyValueKeys } from "../../common/content/Item";
import { isPrimitiveDescription, isArrayDescription, isStructDescription } from "../../common/content/TypeDescription";
import * as ec from "../../common/EC";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";

export interface PropertyDescription {
  name: string;
  displayLabel: string;
  typename: string;
  editor: string;
}

export interface EnumerationChoice {
  label: string;
  value: any;
}
export interface EnumerationInfo {
  choices: EnumerationChoice[];
  isStrict: boolean;
}
export interface ChoicesPropertyDescription extends PropertyDescription {
  enumerationInfo: EnumerationInfo;
  maxDisplayedRows: number | null;
}

export interface PropertyValue {
  value: any;
  displayValue: string | null;
}
export interface PropertyRecord extends PropertyValue {
  description: string;
  unit: string;
  isReadonly: boolean;
  property: PropertyDescription;
  isMerged: boolean;
}

export default class ContentBuilder {
  private static createRecord(propertyDescription: PropertyDescription, typeDescription: content.TypeDescription,
    value: any, displayValue: any, isReadOnly: boolean, isMerged: boolean): PropertyRecord {
    const createArrayValue = (arrayDescription: content.ArrayTypeDescription, values: any[], displayValues: Array<string | null>): PropertyRecord[] => {
      const records = new Array<PropertyRecord>();
      if (null != values && null != displayValues) {
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
          records.push(record);
        }
      }
      return records;
    };
    const createStructValue = (description: content.StructTypeDescription, valueObj: { [key: string]: any }, displayValueObj: { [key: string]: string | null }): PropertyRecord => {
      let struct: any = null;
      if (null != valueObj && null != displayValueObj) {
        struct = {};
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
          struct[memberTypeDescription.name] = record;
        }
      }
      return struct;
    };
    const createValue = (): any => {
      if (isMerged)
        return null;
      if (isArrayDescription(typeDescription))
        return createArrayValue(typeDescription, value, displayValue);
      if (isStructDescription(typeDescription))
        return createStructValue(typeDescription, value, displayValue);
      assert(content.PropertyValueFormat.Primitive === typeDescription.valueFormat);
      return value;
    };
    const createDisplayValue = (): string | null => {
      if (isMerged || content.PropertyValueFormat.Primitive === typeDescription.valueFormat)
        return displayValue;
      return null;
    };
    const createRecordDescription = (): string | null => {
      if (content.PropertyValueFormat.Array === typeDescription.valueFormat || content.PropertyValueFormat.Struct === typeDescription.valueFormat)
        return null;
      assert(content.PropertyValueFormat.Primitive === typeDescription.valueFormat);
      return displayValue;
    };

    return {
      value: createValue(),
      displayValue: createDisplayValue(),
      description: createRecordDescription(),
      valueFormat: typeDescription.valueFormat,
      property: propertyDescription,
      unit: "",
      isReadonly: isReadOnly,
      isMerged,
    } as PropertyRecord;
  }

  public static createPropertyRecord(field: content.Field, item: content.Item): PropertyRecord {
    const isValueReadOnly = field.isReadOnly || isFieldMerged(item, field.name) || !getFieldPropertyValueKeys(item, field.name).every((keys: content.PropertyValueKeys): boolean => {
      // note: fields can have multiple properties and each field value can belong to zero or more ECInstances -
      // we consider field value read-only if there's at least one ECInstanceKey which doesn't have an ECInstanceId.
      return keys.keys.every((key: ec.InstanceKey): boolean => (key.instanceId !== "0"));
    });

    return ContentBuilder.createRecord(ContentBuilder.createPropertyDescription(field), field.description,
      item.values[field.name], item.displayValues[field.name],
      isValueReadOnly, isFieldMerged(item, field.name));
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
    if (isPrimitiveDescription(field.description) && "enum" === field.description.typeName) {
      if (isPropertiesField(field)) {
        return {
          name: field.name,
          displayLabel: field.label,
          typename: field.description.typeName,
          editor: field.editor ? field.editor.name : null,
          enumerationInfo: field.properties[0].property.enumerationInfo!,
          maxDisplayedRows: null,
        } as ChoicesPropertyDescription;
      }
      assert(false, "Only properties' fields can have an 'enum' type");
    }

    return {
      name: field.name,
      displayLabel: field.label,
      typename: field.description.typeName,
      editor: field.editor ? field.editor.name : null,
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
