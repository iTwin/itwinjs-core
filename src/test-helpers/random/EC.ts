/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as ec from "../../common/EC";

export const createRandomECInstanceKey = (): ec.InstanceKey => {
  return {
    classId: faker.random.number().toString(),
    instanceId: faker.random.number().toString(),
  };
};

export const createRandomECClassInfo = (): ec.ClassInfo => {
  return {
    id: faker.random.number().toString(),
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
    });
  }
  return path;
};
