/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import { Id64 } from "@bentley/bentleyjs-core";
import * as ec from "../../common/src/EC";
import { createRandomId } from "./Misc";

export const createRandomECInstanceId = (): ec.InstanceId => {
  return createRandomId() as Id64;
};

export const createRandomECInstanceKey = (): ec.InstanceKey => {
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
