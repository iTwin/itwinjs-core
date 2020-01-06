/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as ec from "../../../EC";
import { createRandomId } from "./Misc";

export const createRandomECInstanceId = (): ec.InstanceId => {
  return createRandomId();
};

export const createRandomECInstanceKey = (): ec.InstanceKey => {
  return {
    className: faker.random.word(),
    id: createRandomECInstanceId(),
  };
};

export const createRandomECInstanceKeyJSON = (): ec.InstanceKeyJSON => {
  return {
    className: faker.random.word(),
    id: createRandomECInstanceId(),
  };
};

export const createRandomECClassInfo = (): ec.ClassInfo => {
  return {
    id: createRandomECInstanceId(),
    name: faker.random.word(),
    label: faker.random.words(),
  };
};

export const createRandomECClassInfoJSON = (): ec.ClassInfoJSON => {
  return {
    id: createRandomId(),
    name: faker.random.word(),
    label: faker.random.words(),
  };
};

export const createRandomRelatedClassInfo = (): ec.RelatedClassInfo => {
  return {
    sourceClassInfo: createRandomECClassInfo(),
    targetClassInfo: createRandomECClassInfo(),
    relationshipInfo: createRandomECClassInfo(),
    isForwardRelationship: faker.random.boolean(),
    isPolymorphicRelationship: faker.random.boolean(),
  };
};

export const createRandomRelatedClassInfoJSON = (): ec.RelatedClassInfoJSON => {
  return {
    sourceClassInfo: createRandomECClassInfoJSON(),
    targetClassInfo: createRandomECClassInfoJSON(),
    relationshipInfo: createRandomECClassInfoJSON(),
    isForwardRelationship: faker.random.boolean(),
    isPolymorphicRelationship: faker.random.boolean(),
  };
};

export const createRandomRelationshipPath = (length: number = 2): ec.RelationshipPath => {
  const path = new Array<ec.RelatedClassInfo>();
  while (length--)
    path.push(createRandomRelatedClassInfo());
  return path;
};

export const createRandomRelationshipPathJSON = (length: number = 2): ec.RelationshipPathJSON => {
  const path = new Array<ec.RelatedClassInfoJSON>();
  while (length--)
    path.push(createRandomRelatedClassInfoJSON());
  return path;
};

export const createRandomPropertyInfoJSON = (): ec.PropertyInfoJSON => ({
  classInfo: createRandomECClassInfoJSON(),
  name: faker.random.word(),
  type: "string",
});
