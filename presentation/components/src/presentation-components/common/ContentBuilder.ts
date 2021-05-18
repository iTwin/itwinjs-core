/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */
import { assert } from "@bentley/bentleyjs-core";
import {
  ArrayTypeDescription, DisplayValue, DisplayValuesArray, DisplayValuesMap, EditorDescription, EnumerationInfo, Field, Item, NestedContentField,
  NestedContentValue, PropertyValueFormat as PresentationPropertyValueFormat, RendererDescription, StructTypeDescription, TypeDescription, Value,
  ValuesArray, ValuesDictionary, ValuesMap,
} from "@bentley/presentation-common";
import {
  ArrayValue, PrimitiveValue, PropertyDescription, PropertyEditorInfo, PropertyRecord, PropertyValue, StructValue, PropertyValueFormat as UiPropertyValueFormat,
} from "@bentley/ui-abstract";
import { Omit } from "@bentley/ui-core";

const createArrayValue = (arrayDescription: ArrayTypeDescription, itemProps: CreatePropertyRecordProps, values: Value[], displayValues: DisplayValue[]): ArrayValue => {
  const records = new Array<PropertyRecord>();
  assert(values.length === displayValues.length);
  for (let i = 0; i < values.length; ++i) {
    records.push(createRecord(itemProps, arrayDescription.memberType, values[i], displayValues[i]));
  }
  return {
    valueFormat: UiPropertyValueFormat.Array,
    items: records,
    itemsTypeName: arrayDescription.memberType.typeName,
  };
};

const createStructValue = (description: StructTypeDescription, memberProps: { [memberName: string]: CreatePropertyRecordProps}, valueObj: ValuesDictionary<Value>, displayValueObj: ValuesDictionary<DisplayValue>): StructValue => {
  const members: { [name: string]: PropertyRecord } = {};
  for (const memberTypeDescription of description.members) {
    const thisMemberProps = memberProps[memberTypeDescription.name];
    members[memberTypeDescription.name] = createRecord(thisMemberProps, memberTypeDescription.type, valueObj[memberTypeDescription.name], displayValueObj[memberTypeDescription.name]);
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
    displayValue: displayValue ?? "",
  } as PrimitiveValue;
};

const createValue = (props: CreatePropertyRecordProps, typeDescription: TypeDescription, value: Value, displayValue: DisplayValue): PropertyValue => {
  if (value !== undefined && !props.isMerged) {
    if (typeDescription.valueFormat === PresentationPropertyValueFormat.Array) {
      assert(Value.isArray(value));
      assert(DisplayValue.isArray(displayValue));
      assert(props.items !== undefined);
      return createArrayValue(typeDescription, props.items, value, displayValue);
    }
    if (typeDescription.valueFormat === PresentationPropertyValueFormat.Struct) {
      assert(Value.isMap(value));
      assert(DisplayValue.isMap(displayValue));
      assert(props.members !== undefined);
      return createStructValue(typeDescription, props.members, value, displayValue);
    }
  }
  return createPrimitiveValue(value, displayValue);
};

const createRecordDescription = (typeDescription: TypeDescription, displayValue: Omit<DisplayValue, "undefined">): string | undefined => {
  assert(PresentationPropertyValueFormat.Primitive === typeDescription.valueFormat);
  assert(DisplayValue.isPrimitive(displayValue));
  return displayValue.toString();
};

const createRecord = (props: CreatePropertyRecordProps, typeDescription: TypeDescription, value: Value, displayValue: DisplayValue): PropertyRecord => {
  const valueObj = createValue(props, typeDescription, value, displayValue);
  const record = new PropertyRecord(valueObj, props.description);
  if (displayValue && typeDescription.valueFormat === PresentationPropertyValueFormat.Primitive)
    record.description = createRecordDescription(typeDescription, displayValue);
  if (props.isMerged)
    record.isMerged = true;
  if (props.isReadonly)
    record.isReadonly = true;
  if (props.autoExpand)
    record.autoExpand = true;
  if (props.extendedData)
    record.extendedData = props.extendedData;
  return record;
};

/** @internal */
export interface CreatePropertyRecordProps {
  description: PropertyDescription;
  isReadonly?: boolean;
  isMerged?: boolean;
  autoExpand?: boolean;
  extendedData?: { [key: string]: any };
  items?: CreatePropertyRecordProps;
  members?: {
    [name: string]: CreatePropertyRecordProps;
  };
}

/** @internal */
export interface FieldHierarchy {
  field: Field;
  childFields?: FieldHierarchy[];
}

/** @internal */
export interface FieldRecord {
  record: PropertyRecord;
  field: Field;
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
   * @param fieldHierarchy Content fields hierarchy to create the record for
   * @param item Content item containing the values
   *
   * @note The resulting [[PropertyRecord]] may be associated with `fieldHierarchy.field` or one its
   * ancestors, in case one of them are merged.
   */
  public static createPropertyRecord(fieldHierarchy: FieldHierarchy, item: Item): FieldRecord {
    const rootToThisField = createFieldPath(fieldHierarchy.field);

    let namePrefix: string | undefined;
    const pathUpToField = rootToThisField.slice(undefined, -1); // need to remove the last element because the Field information is in `field`
    for (let i = 0; i < pathUpToField.length; ++i) {
      const parentField = pathUpToField[i] as NestedContentField;
      const nextField = rootToThisField[i + 1];

      if (item.isFieldMerged(parentField.name))
        return createMergedFieldRecord(parentField, item.values[parentField.name], item.displayValues[parentField.name], namePrefix);

      item = convertNestedContentItemToStructArrayItem(item, parentField, nextField);
      namePrefix = applyOptionalPrefix(parentField.name, namePrefix);
    }

    if (item.isFieldMerged(fieldHierarchy.field.name))
      return createMergedFieldRecord(fieldHierarchy.field, item.values[fieldHierarchy.field.name], item.displayValues[fieldHierarchy.field.name], namePrefix);

    if (fieldHierarchy.field.isNestedContentField()) {
      fieldHierarchy = convertNestedContentFieldHierarchyToStructArrayHierarchy(fieldHierarchy, namePrefix);
      item = convertNestedContentFieldHierarchyItemToStructArrayItem(item, fieldHierarchy);
    } else if (pathUpToField.length > 0) {
      fieldHierarchy = {
        ...fieldHierarchy,
        field: Object.assign(fieldHierarchy.field.clone(), {
          type: {
            valueFormat: PresentationPropertyValueFormat.Array,
            typeName: `${fieldHierarchy.field.type.typeName}[]`,
            memberType: fieldHierarchy.field.type,
          },
        }),
      };
    }

    const recordProps = createPropertyRecordPropsFromFieldHierarchy(fieldHierarchy, item.isFieldMerged(fieldHierarchy.field.name), namePrefix);
    recordProps.extendedData = item.extendedData;

    return {
      record: createRecord(recordProps, fieldHierarchy.field.type, item.values[fieldHierarchy.field.name], item.displayValues[fieldHierarchy.field.name]),
      field: fieldHierarchy.field,
    };
  }

  /**
   * Create a property description for the specified field
   * @param field Content field to create description for
   * @param props Parameters for creating the description
   */
  public static createPropertyDescription(field: Field, props?: PropertyDescriptionCreationProps): PropertyDescription {
    return createPropertyDescriptionFromFieldInfo({
      type: field.isNestedContentField() ? field.type : { ...field.type, typeName: field.type.typeName.toLowerCase() },
      name: applyOptionalPrefix(field.name, props ? props.namePrefix : undefined),
      label: field.label,
      editor: field.editor,
      renderer: field.renderer,
      enum: getFieldEnumInfo(field),
    });
  }
}

/** @internal */
export const FIELD_NAMES_SEPARATOR = "$";

/** @internal */
export const applyOptionalPrefix = (str: string, prefix?: string) => (prefix ? `${prefix}${FIELD_NAMES_SEPARATOR}${str}` : str);

function createMergedFieldRecord(field: Field, value: Value, displayValue: DisplayValue, namePrefix: string | undefined) {
  return {
    record: createRecord({
      description: ContentBuilder.createPropertyDescription(field, { namePrefix }),
      isMerged: true,
      isReadonly: true,
      autoExpand: field.isNestedContentField() && field.autoExpand,
    }, field.type, value, displayValue),
    field,
  };
}

function convertNestedContentItemToStructArrayItem(item: Readonly<Item>, field: Field, nextField: Field) {
  const value = item.values[field.name] ?? [];
  assert(Value.isNestedContent(value));
  const nextFieldValues: { raw: ValuesArray, display: DisplayValuesArray } = { raw: [], display: [] };
  value.forEach((ncv) => {
    const nextRawValue = ncv.values[nextField.name];
    const nextDisplayValue = ncv.displayValues[nextField.name];
    if (nextField.isNestedContentField()) {
      if (nextRawValue) {
        assert(Value.isNestedContent(nextRawValue));
        nextFieldValues.raw.push(...nextRawValue);
      }
    } else {
      nextFieldValues.raw.push(nextRawValue);
      nextFieldValues.display.push(nextDisplayValue);
    }
  });
  return new Item(item.primaryKeys, item.label, item.imageId, item.classInfo, { [nextField.name]: nextFieldValues.raw }, { [nextField.name]: nextFieldValues.display }, item.mergedFieldNames, item.extendedData);
}

function convertNestedContentValuesToStructArrayValuesRecursive(fieldHierarchy: FieldHierarchy, ncvs: ReadonlyArray<NestedContentValue>) {
  const result: { raw: ValuesArray, display: DisplayValuesArray } = { raw: [], display: [] };
  ncvs.forEach((ncv) => {
    const values: ValuesMap = { ...ncv.values };
    const displayValues: DisplayValuesMap = { ...ncv.displayValues };
    fieldHierarchy.childFields?.forEach((childFieldHierarchy) => {
      const childFieldName = childFieldHierarchy.field.name;
      if (childFieldHierarchy.field.isNestedContentField()) {
        const value = values[childFieldName];
        assert(Value.isNestedContent(value));
        const convertedValues = convertNestedContentValuesToStructArrayValuesRecursive(childFieldHierarchy, value);
        values[childFieldName] = convertedValues.raw;
        displayValues[childFieldName] = convertedValues.display;
      }
    });
    result.raw.push(values);
    result.display.push(displayValues);
  });
  return result;
}

function convertNestedContentFieldHierarchyItemToStructArrayItem(item: Readonly<Item>, fieldHierarchy: FieldHierarchy): Item {
  const fieldName = fieldHierarchy.field.name;
  const rawValue = item.values[fieldName];
  assert(Value.isNestedContent(rawValue));
  const converted = convertNestedContentValuesToStructArrayValuesRecursive(fieldHierarchy, rawValue);
  return new Item(item.primaryKeys, item.label, item.imageId, item.classInfo, { [fieldName]: converted.raw }, { [fieldName]: converted.display }, item.mergedFieldNames, item.extendedData);
}

function convertNestedContentFieldHierarchyToStructArrayHierarchy(fieldHierarchy: FieldHierarchy, namePrefix: string | undefined) {
  const fieldName = fieldHierarchy.field.name;
  const convertedChildFieldHierarchies = fieldHierarchy.childFields?.map((child) => {
    if (child.field.isNestedContentField())
      return convertNestedContentFieldHierarchyToStructArrayHierarchy(child, applyOptionalPrefix(fieldName, namePrefix));
    return child;
  });
  const convertedFieldHierarchy: FieldHierarchy = {
    field: Object.assign(fieldHierarchy.field.clone(), {
      type: {
        valueFormat: PresentationPropertyValueFormat.Array,
        typeName: `${fieldHierarchy.field.type.typeName}[]`,
        memberType: {
          valueFormat: PresentationPropertyValueFormat.Struct,
          typeName: fieldHierarchy.field.type.typeName,
          members: convertedChildFieldHierarchies?.map((member) => ({
            name: member.field.name,
            label: member.field.label,
            type: member.field.type,
          })) ?? [],
        },
      } as TypeDescription,
    }),
    childFields: convertedChildFieldHierarchies,
  };
  return convertedFieldHierarchy;
}

function getFieldEnumInfo(field: Field): EnumerationInfo | undefined {
  if (field.isPropertiesField())
    return field.properties[0].property.enumerationInfo;
  return undefined;
}

interface FieldInfo {
  type: TypeDescription;
  name: string;
  label: string;
  renderer?: RendererDescription;
  editor?: EditorDescription;
  enum?: EnumerationInfo;
  isReadonly?: boolean;
}
function createPropertyDescriptionFromFieldInfo(info: FieldInfo) {
  const descr: PropertyDescription = {
    typename: info.type.typeName,
    name: info.name,
    displayLabel: info.label,
  };

  if (info.renderer) {
    descr.renderer = { name: info.renderer.name };
  }

  if (info.editor) {
    descr.editor = { name: info.editor.name, params: [] } as PropertyEditorInfo;
  }

  if (info.type.valueFormat === PresentationPropertyValueFormat.Primitive && info.enum) {
    descr.enum = {
      choices: info.enum.choices,
      isStrict: info.enum.isStrict,
    };
  }
  return descr;
}

function createPropertyRecordPropsFromFieldInfo(fieldInfo: FieldInfo): CreatePropertyRecordProps {
  const props: CreatePropertyRecordProps = {
    description: createPropertyDescriptionFromFieldInfo(fieldInfo),
  };
  if (fieldInfo.type.valueFormat === PresentationPropertyValueFormat.Array) {
    props.items = createPropertyRecordPropsFromFieldInfo({ ...fieldInfo, type: fieldInfo.type.memberType });
  } else if (fieldInfo.type.valueFormat === PresentationPropertyValueFormat.Struct) {
    props.members = fieldInfo.type.members.reduce((map, memberDescription) => {
      map[memberDescription.name] = createPropertyRecordPropsFromFieldInfo({ type: memberDescription.type, name: memberDescription.name, label: memberDescription.label, isReadonly: fieldInfo.isReadonly });
      return map;
    }, {} as { [memberName: string]: CreatePropertyRecordProps });
  }
  if (fieldInfo.isReadonly)
    props.isReadonly = true;
  return props;
}

function createPropertyRecordPropsFromFieldHierarchy(fieldHierarchy: FieldHierarchy, isFieldMerged: boolean, namePrefix: string | undefined): CreatePropertyRecordProps {
  const props: CreatePropertyRecordProps = {
    ...createPropertyRecordPropsFromFieldInfo({
      type: fieldHierarchy.field.type,
      name: applyOptionalPrefix(fieldHierarchy.field.name, namePrefix),
      label: fieldHierarchy.field.label,
      renderer: fieldHierarchy.field.renderer,
      editor: fieldHierarchy.field.editor,
      enum: getFieldEnumInfo(fieldHierarchy.field),
      isReadonly: fieldHierarchy.field.isReadonly || isFieldMerged,
    }),
    isMerged: isFieldMerged,
    autoExpand: fieldHierarchy.field.parent?.autoExpand,
  };

  if (fieldHierarchy.field.isNestedContentField()) {
    assert(fieldHierarchy.field.type.valueFormat === PresentationPropertyValueFormat.Array);
    return {
      description: {
        typename: props.description.typename,
        displayLabel: props.description.displayLabel,
        name: props.description.name,
      },
      isReadonly: true,
      autoExpand: fieldHierarchy.field.autoExpand,
      items: {
        ...props,
        description: {
          ...props.description,
          typename: fieldHierarchy.field.type.memberType.typeName,
        },
        members: fieldHierarchy.childFields?.reduce((members, childFieldHierarchy) => {
          members[childFieldHierarchy.field.name] = createPropertyRecordPropsFromFieldHierarchy(childFieldHierarchy, false, applyOptionalPrefix(fieldHierarchy.field.name, namePrefix));
          return members;
        }, {} as { [fieldName: string]: CreatePropertyRecordProps }) ?? {},
        autoExpand: fieldHierarchy.field.autoExpand,
      },
    };
  }

  return props;
}

const createFieldPath = (field: Field): Field[] => {
  const path = [field];
  let currField = field;
  while (currField.parent) {
    currField = currField.parent;
    path.push(currField);
  }
  path.reverse();
  return path;
};
