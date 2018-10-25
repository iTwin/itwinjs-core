/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as ec from "../../../lib/EC";
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

export const createRandomRelationshipPath = (length: number = 2): ec.RelationshipPathInfo => {
  const path = new Array<ec.RelatedClassInfo>();
  while (length--) {
    path.push({
      sourceClassInfo: createRandomECClassInfo(),
      targetClassInfo: createRandomECClassInfo(),
      relationshipInfo: createRandomECClassInfo(),
      isForwardRelationship: faker.random.boolean(),
      isPolymorphicRelationship: faker.random.boolean(),
    });
  }
  return path;
};

export const createRandomRelationshipPathJSON = (length: number = 2): ec.RelationshipPathInfoJSON => {
  const path = new Array<ec.RelatedClassInfoJSON>();
  while (length--) {
    path.push({
      sourceClassInfo: createRandomECClassInfoJSON(),
      targetClassInfo: createRandomECClassInfoJSON(),
      relationshipInfo: createRandomECClassInfoJSON(),
      isForwardRelationship: faker.random.boolean(),
      isPolymorphicRelationship: faker.random.boolean(),
    });
  }
  return path;
};
