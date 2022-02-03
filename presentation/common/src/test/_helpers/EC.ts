/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type * as ec from "../../presentation-common/EC";

/**
 * @internal Used for testing only.
 */
export const createTestECInstanceKey = (props?: Partial<ec.InstanceKey>) => ({
  className: "SchemaName:ClassName",
  id: "0x1",
  ...props,
});

/**
 * @internal Used for testing only.
 */
export const createTestECClassInfo = (props?: Partial<ec.ClassInfo>) => ({
  id: "0x1",
  name: "SchemaName:ClassName",
  label: "Class Label",
  ...props,
});

/**
 * @internal Used for testing only.
 */
export const createTestRelatedClassInfo = (props?: Partial<ec.RelatedClassInfo>) => ({
  sourceClassInfo: createTestECClassInfo({ id: "0x1", name: "source:class", label: "Source" }),
  targetClassInfo: createTestECClassInfo({ id: "0x2", name: "target:class", label: "Target" }),
  isPolymorphicTargetClass: false,
  relationshipInfo: createTestECClassInfo({ id: "0x3", name: "relationship:class", label: "Relationship" }),
  isForwardRelationship: false,
  isPolymorphicRelationship: false,
  ...props,
});

/**
 * @internal Used for testing only.
 */
export const createTestRelatedClassInfoWithOptionalRelationship = (props?: Partial<ec.RelatedClassInfoWithOptionalRelationship>) => ({
  sourceClassInfo: createTestECClassInfo({ id: "0x1", name: "source:class", label: "Source" }),
  targetClassInfo: createTestECClassInfo({ id: "0x2", name: "target:class", label: "Target" }),
  isPolymorphicTargetClass: false,
  ...props,
});

/**
 * @internal Used for testing only.
 */
export const createTestRelationshipPath = (length: number = 2) => {
  const path = new Array<ec.RelatedClassInfo>();
  while (length--)
    path.push(createTestRelatedClassInfo());
  return path;
};

/**
 * @internal Used for testing only.
 */
export const createTestPropertyInfo = (props?: Partial<ec.PropertyInfo>) => ({
  classInfo: createTestECClassInfo(),
  name: "PropertyName",
  type: "string",
  ...props,
});
