/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as faker from "faker";
import type * as ec from "../../../presentation-common/EC";
import { createRandomId, nullable } from "./Misc";

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
export const createRandomECInstanceKeyJSON = (): ec.InstanceKeyJSON => {
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
export const createRandomECClassInfoJSON = (): ec.ClassInfoJSON => {
  return {
    id: createRandomId(),
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
export const createRandomRelatedClassInfoJSON = (): ec.RelatedClassInfoJSON => {
  return {
    sourceClassInfo: createRandomECClassInfoJSON(),
    targetClassInfo: createRandomECClassInfoJSON(),
    isPolymorphicTargetClass: nullable(() => faker.random.boolean()),
    relationshipInfo: createRandomECClassInfoJSON(),
    isForwardRelationship: faker.random.boolean(),
    isPolymorphicRelationship: nullable(() => faker.random.boolean()),
  };
};

/**
 * @internal Used for testing only.
 */
export const createRandomRelationshipPath = (length: number = 2): ec.RelationshipPath => {
  const path = new Array<ec.RelatedClassInfo>();
  while (length--)
    path.push(createRandomRelatedClassInfo());
  return path;
};

/**
 * @internal Used for testing only.
 */
export const createRandomRelationshipPathJSON = (length: number = 2): ec.RelationshipPathJSON => {
  const path = new Array<ec.RelatedClassInfoJSON>();
  while (length--)
    path.push(createRandomRelatedClassInfoJSON());
  return path;
};

/**
 * @internal Used for testing only.
 */
export const createRandomPropertyInfoJSON = (): ec.PropertyInfoJSON => ({
  classInfo: createRandomECClassInfoJSON(),
  name: faker.random.word(),
  type: "string",
});
