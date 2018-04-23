/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as c from "../../common/content";
import { createRandomECClassInfo, createRandomRelationshipPath } from "./EC";
import { nullable } from "./Misc";

const createRandomSelectClassInfo = (): c.SelectClassInfo => {
  return {
    selectClassInfo: createRandomECClassInfo(),
    isSelectPolymorphic: faker.random.boolean(),
    pathToPrimaryClass: createRandomRelationshipPath(),
    relatedPropertyPaths: [createRandomRelationshipPath(1), createRandomRelationshipPath(1)],
  } as c.SelectClassInfo;
};

const createRandomCategory = (): c.CategoryDescription => {
  return {
    name: faker.random.word(),
    label: faker.random.words(),
    description: faker.lorem.sentence(),
    priority: faker.random.number(),
    expand: faker.random.boolean(),
  } as c.CategoryDescription;
};

const createRandomTypeDescription = (): c.TypeDescription => {
  return {
    valueFormat: c.PropertyValueFormat.Primitive,
    typeName: faker.database.type(),
  } as c.PrimitiveTypeDescription;
};

const createRandomEditorDescription = (): c.EditorDescription => {
  return {
    name: faker.random.word(),
  } as c.EditorDescription;
};

export const createRandomField = (): c.Field => {
  return {
    category: createRandomCategory(),
    name: faker.random.word(),
    label: faker.random.words(),
    description: createRandomTypeDescription(),
    isReadOnly: faker.random.boolean(),
    priority: faker.random.number(),
    editor: nullable(createRandomEditorDescription),
  } as c.Field;
};

export const createRandomDescriptor = (): c.Descriptor => {
  const selectClasses = [createRandomSelectClassInfo(), createRandomSelectClassInfo()];
  const fields = [createRandomField(), createRandomField(), createRandomField()];
  return {
    displayType: faker.lorem.words(),
    selectClasses,
    fields,
    contentFlags: 0,
  } as c.Descriptor;
};
