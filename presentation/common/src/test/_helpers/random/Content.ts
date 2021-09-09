/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as faker from "faker";
import {
  CategoryDescription, CategoryDescriptionJSON, Content, Descriptor, EditorDescription, Field, NestedContentField, PrimitiveTypeDescription,
  PropertiesField, PropertyValueFormat, StructTypeDescription, TypeDescription
} from "../../../presentation-common";
import { SelectClassInfoJSON } from "../../../presentation-common/content/Descriptor";
import { BaseFieldJSON, FieldJSON, NestedContentFieldJSON, PropertiesFieldJSON } from "../../../presentation-common/content/Fields";
import { PropertyJSON } from "../../../presentation-common/content/Property";
import { createRandomECClassInfoJSON, createRandomPropertyInfoJSON, createRandomRelatedClassInfoJSON, createRandomRelationshipPathJSON } from "./EC";
import { nullable } from "./Misc";

/**
 * @internal Used for testing only.
 */
const createRandomSelectClassInfoJSON = (): SelectClassInfoJSON => {
  return {
    selectClassInfo: createRandomECClassInfoJSON(),
    isSelectPolymorphic: faker.random.boolean(),
    pathToPrimaryClass: createRandomRelationshipPathJSON(),
    relatedPropertyPaths: [createRandomRelationshipPathJSON(1), createRandomRelationshipPathJSON(1)],
    navigationPropertyClasses: [createRandomRelatedClassInfoJSON()],
    relatedInstanceClasses: [createRandomRelatedClassInfoJSON()],
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomCategory = (id?: string): CategoryDescription => ({
  name: id ?? faker.random.word(),
  label: id ?? faker.random.words(),
  description: faker.lorem.sentence(),
  priority: faker.random.number(),
  expand: faker.random.boolean(),
});

/**
 * @internal Used for testing only.
 */
export const createRandomCategoryJSON = (): CategoryDescriptionJSON => {
  return CategoryDescription.toJSON(createRandomCategory());
};

/**
 * @internal Used for testing only.
 */
export const createRandomPrimitiveTypeDescription = (): TypeDescription => {
  return {
    valueFormat: PropertyValueFormat.Primitive,
    typeName: faker.database.type(),
  } as PrimitiveTypeDescription;
};

/**
 * @internal Used for testing only.
 */
export const createRandomEditorDescription = (): EditorDescription => {
  return {
    name: faker.random.word(),
  } as EditorDescription;
};

/**
 * @internal Used for testing only.
 */
export const createRandomPrimitiveFieldJSON = (category?: CategoryDescriptionJSON | string, id?: string): BaseFieldJSON => ({
  category: category ?? createRandomCategoryJSON(),
  name: id ?? faker.random.word(),
  label: id ?? faker.random.words(),
  type: createRandomPrimitiveTypeDescription(),
  isReadonly: faker.random.boolean(),
  priority: faker.random.number(),
  renderer: { name: "custom_renderer" },
  editor: nullable(createRandomEditorDescription),
});

/**
 * @internal Used for testing only.
 */
export const createRandomPrimitiveField = (category?: CategoryDescription, id?: string): Field => {
  const field = Field.fromJSON(createRandomPrimitiveFieldJSON(undefined, id))!;
  if (category)
    field.category = category;
  return field;
};

/**
 * @internal Used for testing only.
 */
export const createRandomPropertyJSON = (): PropertyJSON => ({
  property: createRandomPropertyInfoJSON(),
  relatedClassPath: createRandomRelationshipPathJSON(1),
});

/**
 * @internal Used for testing only.
 */
export const createRandomPropertiesFieldJSON = (category: CategoryDescriptionJSON | string | undefined, propertiesCount: number = 1): PropertiesFieldJSON => ({
  ...createRandomPrimitiveFieldJSON(category),
  properties: [...Array(propertiesCount).keys()].map(() => createRandomPropertyJSON()),
});

/**
 * @internal Used for testing only.
 */
export const createRandomPropertiesField = (category?: CategoryDescription, propertiesCount: number = 1): PropertiesField => {
  const field = PropertiesField.fromJSON(createRandomPropertiesFieldJSON(undefined, propertiesCount))!;
  if (category)
    field.category = category;
  return field;
};

/**
 * @internal Used for testing only.
 */
export const createRandomNestedFieldJSON = (category?: CategoryDescriptionJSON | string): NestedContentFieldJSON => ({
  ...createRandomPrimitiveFieldJSON(category),
  type: {
    valueFormat: PropertyValueFormat.Struct,
    typeName: faker.random.word(),
    members: [{
      type: createRandomPrimitiveTypeDescription(),
      name: faker.random.word(),
      label: faker.random.word(),
    }],
  } as StructTypeDescription,
  contentClassInfo: createRandomECClassInfoJSON(),
  pathToPrimaryClass: createRandomRelationshipPathJSON(),
  actualPrimaryClassIds: faker.random.boolean() ? undefined : [],
  nestedFields: [createRandomPrimitiveFieldJSON(category)],
  autoExpand: faker.random.boolean(),
});

/**
 * @internal Used for testing only.
 */
const deepAssignCategory = (field: Field, category: CategoryDescription) => {
  field.category = category;
  if (field.isNestedContentField())
    field.nestedFields.forEach((f) => deepAssignCategory(f, category));
};

/**
 * @internal Used for testing only.
 */
export const createRandomNestedContentField = (nestedFields?: Field[], category?: CategoryDescription): NestedContentField => {
  const nestedContentField = NestedContentField.fromJSON(createRandomNestedFieldJSON(undefined))!;
  if (category)
    deepAssignCategory(nestedContentField, category);
  if (nestedFields)
    nestedContentField.nestedFields = nestedFields;
  nestedContentField.nestedFields.forEach((field) => field.rebuildParentship(nestedContentField));
  return nestedContentField;
};

/**
 * @internal Used for testing only.
 */
export const createRandomDescriptorJSON = (displayType?: string, fields?: FieldJSON[], categories?: CategoryDescriptionJSON[]) => {
  categories = categories ?? (fields ? undefined : [createRandomCategoryJSON()]);
  fields = fields ?? [createRandomPrimitiveFieldJSON(categories![0]), createRandomPrimitiveFieldJSON(categories![0]), createRandomPrimitiveFieldJSON(categories![0])];
  return {
    connectionId: faker.random.uuid(),
    inputKeysHash: faker.random.uuid(),
    contentOptions: faker.random.objectElement(),
    displayType: displayType ?? faker.lorem.words(),
    selectClasses: [createRandomSelectClassInfoJSON(), createRandomSelectClassInfoJSON()],
    categories,
    fields,
    contentFlags: 0,
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomDescriptor = (displayType?: string, fields?: Field[], categories?: CategoryDescription[]): Descriptor => {
  return Descriptor.fromJSON(createRandomDescriptorJSON(
    displayType,
    fields ? fields.map((f) => f.toJSON()) : undefined,
    categories ? categories.map(CategoryDescription.toJSON) : undefined,
  ))!;
};

/**
 * @internal Used for testing only.
 */
export const createRandomContentJSON = () => {
  return {
    descriptor: createRandomDescriptorJSON(),
    contentSet: [],
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomContent = (): Content => {
  return Content.fromJSON(createRandomContentJSON())!;
};
