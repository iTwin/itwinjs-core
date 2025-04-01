/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import {
  ArrayPropertiesField,
  CategoryDescription,
  ClassInfo,
  Descriptor,
  DescriptorSource,
  DisplayValuesMap,
  EditorDescription,
  Field,
  InstanceKey,
  Item,
  LabelDefinition,
  NestedContentField,
  PropertiesField,
  Property,
  PropertyValueFormat,
  RelationshipPath,
  RendererDescription,
  SelectClassInfo,
  StructPropertiesField,
  StructTypeDescription,
  TypeDescription,
  ValuesMap,
} from "../../presentation-common.js";
import { RelationshipMeaning } from "../../presentation-common/rules/content/modifiers/RelatedPropertiesSpecification.js";
import { createTestECClassInfo, createTestECInstanceKey, createTestPropertyInfo, createTestRelationshipPath } from "./EC.js";

/**
 * @internal Used for testing only.
 */
export const createTestCategoryDescription = (props?: Partial<CategoryDescription>) => ({
  name: "test-category",
  label: "Test Category",
  description: "Test category description",
  priority: 0,
  expand: false,
  ...props,
});

/**
 * @internal Used for testing only.
 */
export const createTestSelectClassInfo = (props?: Partial<SelectClassInfo>) => ({
  selectClassInfo: createTestECClassInfo(),
  isSelectPolymorphic: false,
  ...props,
});

/** @internal Used for testing only. */
export function createTestLabelDefinition(props?: Partial<LabelDefinition>): LabelDefinition {
  return {
    typeName: "string",
    rawValue: "test raw value",
    displayValue: "test display value",
    ...props,
  };
}

/**
 * @internal Used for testing only.
 */
export function createTestSimpleContentField(props?: {
  category?: CategoryDescription;
  type?: TypeDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) {
  return new Field({
    category: createTestCategoryDescription(),
    name: "SimpleField",
    label: "Simple Field",
    type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
    isReadonly: false,
    priority: 0,
    ...props,
  });
}

/**
 * @internal Used for testing only.
 */
export function createTestPropertiesContentField(props: {
  properties: Property[];
  category?: CategoryDescription;
  type?: TypeDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) {
  return new PropertiesField({
    category: createTestCategoryDescription(),
    name: "PropertiesField",
    label: "Properties Field",
    type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
    isReadonly: false,
    priority: 0,
    ...props,
  });
}

/**
 * @internal Used for testing only.
 */
export function createTestArrayPropertiesContentField(props: {
  properties: Property[];
  category?: CategoryDescription;
  type?: TypeDescription;
  itemsField?: PropertiesField;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) {
  return new ArrayPropertiesField({
    category: createTestCategoryDescription(),
    name: "ArrayPropertiesField",
    label: "Array Properties Field",
    type: {
      valueFormat: PropertyValueFormat.Array,
      typeName: "string[]",
      memberType: {
        valueFormat: PropertyValueFormat.Primitive,
        typeName: "string",
      },
    },
    itemsField: createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] }),
    isReadonly: false,
    priority: 0,
    ...props,
  });
}

/**
 * @internal Used for testing only.
 */
export function createTestStructPropertiesContentField(props: {
  properties: Property[];
  category?: CategoryDescription;
  type?: TypeDescription;
  memberFields?: PropertiesField[];
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  editor?: EditorDescription;
  renderer?: RendererDescription;
}) {
  return new StructPropertiesField({
    category: createTestCategoryDescription(),
    name: "StructPropertiesField",
    label: "Struct Properties Field",
    type: {
      valueFormat: PropertyValueFormat.Struct,
      typeName: "TestStruct",
      members: [
        {
          name: "member1",
          label: "Member 1",
          type: { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
        },
      ],
    },
    memberFields: [createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "member1", type: "string" }) }] })],
    isReadonly: false,
    priority: 0,
    ...props,
  });
}

/**
 * @internal Used for testing only.
 */
export function createTestNestedContentField(props: {
  nestedFields: Field[];
  category?: CategoryDescription;
  name?: string;
  label?: string;
  isReadonly?: boolean;
  priority?: number;
  contentClassInfo?: ClassInfo;
  pathToPrimaryClass?: RelationshipPath;
  autoExpand?: boolean;
  editor?: EditorDescription;
  renderer?: RendererDescription;
  relationshipMeaning?: RelationshipMeaning;
}) {
  const nestedContentFieldType: StructTypeDescription = {
    valueFormat: PropertyValueFormat.Struct,
    typeName: "NestedContentFieldType",
    members: props.nestedFields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
    })),
  };
  const field = new NestedContentField({
    category: createTestCategoryDescription(),
    name: "NestedContentField",
    label: "Nested Content",
    type: nestedContentFieldType,
    isReadonly: false,
    priority: 0,
    contentClassInfo: createTestECClassInfo(),
    pathToPrimaryClass: createTestRelationshipPath(1),
    ...props,
  });
  field.rebuildParentship();
  return field;
}

/**
 * @internal Used for testing only.
 */
export function createTestContentDescriptor(props: Partial<DescriptorSource> & { fields: Field[] }) {
  return new Descriptor({
    displayType: "",
    contentFlags: 0,
    selectClasses: [createTestSelectClassInfo()],
    categories: [createTestCategoryDescription()],
    ...props,
  });
}

/**
 * @internal Used for testing only.
 */
export function createTestContentItem(props: {
  inputKeys?: InstanceKey[];
  primaryKeys?: InstanceKey[];
  label?: LabelDefinition | string;
  imageId?: string;
  classInfo?: ClassInfo;
  values: ValuesMap;
  displayValues: DisplayValuesMap;
  mergedFieldNames?: string[];
  extendedData?: { [key: string]: any };
}) {
  const item = new Item({
    ...props,
    primaryKeys: props.primaryKeys ?? [createTestECInstanceKey()],
    label: props.label
      ? typeof props.label === "string"
        ? createTestLabelDefinition({ displayValue: props.label })
        : props.label
      : createTestLabelDefinition(),
    mergedFieldNames: props.mergedFieldNames ?? [],
  });
  return item;
}
