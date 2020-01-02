/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import {
  CategoryDescription, TypeDescription, EditorDescription, Field,
  PrimitiveTypeDescription, Descriptor, Content, PropertyValueFormat, StructTypeDescription,
} from "../../../presentation-common";
import { PropertyJSON } from "../../../content/Property";
import {
  NestedContentFieldJSON, BaseFieldJSON, PropertiesFieldJSON,
  NestedContentField, PropertiesField,
} from "../../../content/Fields";
import { SelectClassInfoJSON } from "../../../content/Descriptor";
import { createRandomRelationshipPathJSON, createRandomECClassInfoJSON, createRandomRelatedClassInfoJSON, createRandomPropertyInfoJSON } from "./EC";
import { nullable } from "./Misc";

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

export const createRandomCategory = (): CategoryDescription => ({
  name: faker.random.word(),
  label: faker.random.words(),
  description: faker.lorem.sentence(),
  priority: faker.random.number(),
  expand: faker.random.boolean(),
});

const createInvalidCategory = (): CategoryDescription => ({
  name: "",
  label: "",
  description: "",
  priority: 0,
  expand: false,
});

export const createRandomPrimitiveTypeDescription = (): TypeDescription => {
  return {
    valueFormat: PropertyValueFormat.Primitive,
    typeName: faker.database.type(),
  } as PrimitiveTypeDescription;
};

export const createRandomEditorDescription = (): EditorDescription => {
  return {
    name: faker.random.word(),
  } as EditorDescription;
};

export const createRandomPrimitiveFieldJSON = (category: CategoryDescription | boolean = true): BaseFieldJSON => ({
  category: (typeof category === "object") ? category : (category ? createRandomCategory() : createInvalidCategory()),
  name: faker.random.word(),
  label: faker.random.words(),
  type: createRandomPrimitiveTypeDescription(),
  isReadonly: faker.random.boolean(),
  priority: faker.random.number(),
  editor: nullable(createRandomEditorDescription),
});

export const createRandomPrimitiveField = (category: CategoryDescription | boolean = true): Field => {
  return Field.fromJSON(createRandomPrimitiveFieldJSON(category))!;
};

export const createRandomPropertyJSON = (): PropertyJSON => ({
  property: createRandomPropertyInfoJSON(),
  relatedClassPath: createRandomRelationshipPathJSON(1),
});

export const createRandomPropertiesFieldJSON = (category: CategoryDescription | boolean = true): PropertiesFieldJSON => ({
  ...createRandomPrimitiveFieldJSON(category),
  properties: [createRandomPropertyJSON()],
});

export const createRandomPropertiesField = (category: CategoryDescription | boolean = true): PropertiesField => {
  return PropertiesField.fromJSON(createRandomPropertiesFieldJSON(category))!;
};

export const createRandomNestedFieldJSON = (category: CategoryDescription | boolean = true): NestedContentFieldJSON => ({
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
  nestedFields: [createRandomPrimitiveFieldJSON()],
  autoExpand: faker.random.boolean(),
});

export const createRandomNestedContentField = (nestedFields?: Field[], category: CategoryDescription | boolean = true): NestedContentField => {
  const nestedContentField = NestedContentField.fromJSON(createRandomNestedFieldJSON(category))!;
  if (nestedFields)
    nestedContentField.nestedFields = nestedFields;
  nestedContentField.nestedFields.forEach((field) => field.rebuildParentship(nestedContentField));
  return nestedContentField;
};

export const createRandomDescriptorJSON = (displayType?: string) => {
  const selectClasses = [createRandomSelectClassInfoJSON(), createRandomSelectClassInfoJSON()];
  const fields = [createRandomPrimitiveFieldJSON(), createRandomPrimitiveFieldJSON(), createRandomPrimitiveFieldJSON()];
  return {
    connectionId: faker.random.uuid(),
    inputKeysHash: faker.random.uuid(),
    contentOptions: faker.random.objectElement(),
    displayType: displayType || faker.lorem.words(),
    selectClasses,
    fields,
    contentFlags: 0,
  };
};

export const createRandomDescriptor = (displayType?: string): Descriptor => {
  return Descriptor.fromJSON(createRandomDescriptorJSON(displayType))!;
};

export const createRandomContentJSON = () => {
  return {
    descriptor: createRandomDescriptorJSON(),
    contentSet: [],
  };
};

export const createRandomContent = (): Content => {
  return Content.fromJSON(createRandomContentJSON())!;
};
