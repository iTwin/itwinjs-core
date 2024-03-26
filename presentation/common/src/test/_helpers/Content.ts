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
} from "../../presentation-common";
import { RelationshipMeaning } from "../../presentation-common/rules/content/modifiers/RelatedPropertiesSpecification";
import { createTestECClassInfo, createTestECInstanceKey, createTestPropertyInfo, createTestRelationshipPath } from "./EC";

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
  return new Field(
    props?.category ?? createTestCategoryDescription(),
    props?.name ?? "SimpleField",
    props?.label ?? "Simple Field",
    props?.type ?? { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
    props?.isReadonly ?? false,
    props?.priority ?? 0,
    props?.editor,
    props?.renderer,
  );
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
  return new PropertiesField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "PropertiesField",
    props.label ?? "Properties Field",
    props.type ?? { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.properties,
    props.editor,
    props.renderer,
  );
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
  return new ArrayPropertiesField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "ArrayPropertiesField",
    props.label ?? "Array Properties Field",
    props.type ?? {
      valueFormat: PropertyValueFormat.Array,
      typeName: "string[]",
      memberType: {
        valueFormat: PropertyValueFormat.Primitive,
        typeName: "string",
      },
    },
    props.itemsField ?? createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] }),
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.properties,
    props.editor,
    props.renderer,
  );
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
  return new StructPropertiesField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "StructPropertiesField",
    props.label ?? "Struct Properties Field",
    props.type ?? {
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
    props.memberFields ?? [createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo({ name: "member1", type: "string" }) }] })],
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.properties,
    props.editor,
    props.renderer,
  );
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
  const field = new NestedContentField(
    props.category ?? createTestCategoryDescription(),
    props.name ?? "NestedContentField",
    props.label ?? "Nested Content",
    nestedContentFieldType,
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.contentClassInfo ?? createTestECClassInfo(),
    props.pathToPrimaryClass ?? createTestRelationshipPath(1),
    props.nestedFields,
    props.editor,
    !!props.autoExpand,
    props.renderer,
  );
  if (props.relationshipMeaning) {
    field.relationshipMeaning = props.relationshipMeaning;
  }
  field.rebuildParentship();
  return field;
}

/**
 * @internal Used for testing only.
 */
export function createTestContentDescriptor(props: Partial<DescriptorSource> & { fields: Field[] }) {
  return new Descriptor({
    connectionId: "",
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
  primaryKeys?: InstanceKey[];
  label?: LabelDefinition | string;
  imageId?: string;
  classInfo?: ClassInfo;
  values: ValuesMap;
  displayValues: DisplayValuesMap;
  mergedFieldNames?: string[];
  extendedData?: { [key: string]: any };
}) {
  return new Item(
    props.primaryKeys ?? [createTestECInstanceKey()],
    props.label ?? "",
    props.imageId ?? "",
    props.classInfo,
    props.values,
    props.displayValues,
    props.mergedFieldNames ?? [],
    props.extendedData,
  );
}
