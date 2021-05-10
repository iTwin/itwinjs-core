/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  CategoryDescription, ClassInfo, Descriptor, DescriptorSource, DisplayValuesMap, EditorDescription, Field, InstanceKey, Item, LabelDefinition,
  NestedContentField, PropertiesField, Property, PropertyValueFormat, RelationshipPath, RendererDescription, SelectClassInfo, StructTypeDescription,
  TypeDescription, ValuesMap,
} from "../../presentation-common";
import { RelationshipMeaning } from "../../presentation-common/rules/content/modifiers/RelatedPropertiesSpecification";
import { createTestECClassInfo, createTestECInstanceKey, createTestRelationshipPath } from "./EC";

export const createTestCategoryDescription = (props?: Partial<CategoryDescription>) => ({
  name: "test-category",
  label: "Test Category",
  description: "Test category description",
  priority: 0,
  expand: false,
  ...props,
});

export const createTestSelectClassInfo = (props?: Partial<SelectClassInfo>) => ({
  selectClassInfo: createTestECClassInfo(),
  isSelectPolymorphic: false,
  pathToPrimaryClass: [],
  relatedPropertyPaths: [],
  navigationPropertyClasses: [],
  relatedInstanceClasses: [],
  ...props,
});

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
    props?.renderer
  );
}

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
    props.name ?? "SimpleField",
    props.label ?? "Simple Field",
    props.type ?? { valueFormat: PropertyValueFormat.Primitive, typeName: "string" },
    props.isReadonly ?? false,
    props.priority ?? 0,
    props.properties,
    props.editor,
    props.renderer
  );
}

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
  if (props.relationshipMeaning)
    field.relationshipMeaning = props.relationshipMeaning;
  field.rebuildParentship();
  return field;
}

export function createTestContentDescriptor(props: Partial<DescriptorSource> & { fields: Field[] }) {
  return new Descriptor({
    displayType: "DisplayType",
    contentFlags: 0,
    selectClasses: [createTestSelectClassInfo()],
    categories: [createTestCategoryDescription()],
    ...props,
  });
}

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
