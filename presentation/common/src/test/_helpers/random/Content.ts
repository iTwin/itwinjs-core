/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { CategoryDescription, TypeDescription, EditorDescription, Field, PrimitiveTypeDescription, Descriptor, Content, PropertyValueFormat } from "../../../presentation-common";
import { SelectClassInfoJSON } from "../../../content/Descriptor";
import { createRandomRelationshipPathJSON, createRandomECClassInfoJSON } from "./EC";
import { nullable } from "./Misc";

const createRandomSelectClassInfoJSON = (): SelectClassInfoJSON => {
  return {
    selectClassInfo: createRandomECClassInfoJSON(),
    isSelectPolymorphic: faker.random.boolean(),
    pathToPrimaryClass: createRandomRelationshipPathJSON(),
    relatedPropertyPaths: [createRandomRelationshipPathJSON(1), createRandomRelationshipPathJSON(1)],
  };
};

export const createRandomCategory = (): CategoryDescription => {
  return {
    name: faker.random.word(),
    label: faker.random.words(),
    description: faker.lorem.sentence(),
    priority: faker.random.number(),
    expand: faker.random.boolean(),
  } as CategoryDescription;
};

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

const createRandomPrimitiveFieldJSON = () => {
  return {
    category: createRandomCategory(),
    name: faker.random.word(),
    label: faker.random.words(),
    type: createRandomPrimitiveTypeDescription(),
    isReadonly: faker.random.boolean(),
    priority: faker.random.number(),
    editor: nullable(createRandomEditorDescription),
  };
};

export const createRandomPrimitiveField = (): Field => {
  return Field.fromJSON(createRandomPrimitiveFieldJSON())!;
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
