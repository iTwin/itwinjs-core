/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as c from "@bentley/ecpresentation-backend/lib/common/Content";
import { createRandomECClassInfo, createRandomRelationshipPath } from "./EC";
import { nullable } from "./Misc";

const createRandomSelectClassInfo = (): c.SelectClassInfo => {
  return new c.SelectClassInfo(createRandomECClassInfo(), faker.random.boolean(), createRandomRelationshipPath());
};

const createRandomCategory = (): c.CategoryDescription => {
  return new c.CategoryDescription(faker.random.word(), faker.random.words(), faker.lorem.sentence(),
    faker.random.number(), faker.random.boolean());
};

const createRandomTypeDescription = (): c.TypeDescription => {
  return new c.PrimitiveTypeDescription(faker.database.type());
};

const createRandomEditorDescription = (): c.EditorDescription => {
  return new c.EditorDescription(faker.random.word());
};

export const createRandomField = (): c.Field => {
  return new c.Field(createRandomCategory(), faker.random.word(), faker.random.words(), createRandomTypeDescription(),
    faker.random.boolean(), faker.random.number(), nullable(createRandomEditorDescription), null);
};

export const createRandomDescriptor = (): c.Descriptor => {
  const selectClasses = [createRandomSelectClassInfo(), createRandomSelectClassInfo()];
  const fields = [createRandomField(), createRandomField(), createRandomField()];
  return new c.Descriptor(faker.lorem.words(), selectClasses, fields, 0);
};
