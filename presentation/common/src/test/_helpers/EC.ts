/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as ec from "../../presentation-common/EC";

export const createTestECInstanceKey = (props?: Partial<ec.InstanceKey>) => ({
  className: "SchemaName:ClassName",
  id: "0x1",
  ...props,
});

export const createTestECClassInfo = (props?: Partial<ec.ClassInfo>) => ({
  id: "0x1",
  name: "SchemaName:ClassName",
  label: "Class Label",
  ...props,
});

export const createTestRelatedClassInfo = (props?: Partial<ec.RelatedClassInfo>) => ({
  sourceClassInfo: createTestECClassInfo({ name: "source:class", label: "Source" }),
  targetClassInfo: createTestECClassInfo({ name: "target:class", label: "Target" }),
  isPolymorphicTargetClass: false,
  relationshipInfo: createTestECClassInfo({ name: "relationship:class", label: "Relationship" }),
  isForwardRelationship: false,
  isPolymorphicRelationship: false,
  ...props,
});

export const createTestRelationshipPath = (length: number = 2) => {
  const path = new Array<ec.RelatedClassInfo>();
  while (length--)
    path.push(createTestRelatedClassInfo());
  return path;
};

export const createTestPropertyInfo = (props?: Partial<ec.PropertyInfo>) => ({
  classInfo: createTestECClassInfo(),
  name: "PropertyName",
  type: "string",
  ...props,
});
