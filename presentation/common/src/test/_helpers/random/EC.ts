/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import * as ec from "../../../presentation-common/EC";
import { createRandomId } from "./Misc";

/**
 * @internal Used for testing only.
 */
export const createRandomECInstanceId = (): ec.InstanceId => {
  return createRandomId();
};

/**
 * @internal Used for testing only.
 */
export const createRandomECInstanceKey = (): ec.InstanceKey => {
  return {
    className: faker.random.word(),
    id: createRandomECInstanceId(),
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomECClassInfo = (): ec.ClassInfo => {
  return {
    id: createRandomECInstanceId(),
    name: faker.random.word(),
    label: faker.random.words(),
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomRelatedClassInfo = (): ec.RelatedClassInfo => {
  return {
    sourceClassInfo: createRandomECClassInfo(),
    targetClassInfo: createRandomECClassInfo(),
    isPolymorphicTargetClass: faker.random.boolean(),
    relationshipInfo: createRandomECClassInfo(),
    isForwardRelationship: faker.random.boolean(),
    isPolymorphicRelationship: faker.random.boolean(),
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomRelationshipPath = (length: number = 2): ec.RelationshipPath => {
  const path = new Array<ec.RelatedClassInfo>();
  while (length--) {
    path.push(createRandomRelatedClassInfo());
  }
  return path;
};

/**
 * @internal Used for testing only.
 */
export const createRandomPropertyInfo = (): ec.PropertyInfo => ({
  classInfo: createRandomECClassInfo(),
  name: faker.random.word(),
  type: "string",
});
