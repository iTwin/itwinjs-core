/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { ECClassGroupingNodeKey, ECInstancesNodeKey, InstanceKey, StandardNodeTypes } from "@bentley/presentation-common";
import { PropertyRecord } from "@bentley/ui-abstract";

/** @internal */
export const createSubjectNode = (ids?: Id64String | Id64String[]) => ({
  __key: createKey("subject", ids ? ids : "subject_id"),
  id: "subject",
  label: PropertyRecord.fromString("subject"),
  extendedData: {
    isSubject: true,
  },
});

/** @internal */
export const createModelNode = () => ({
  __key: createKey("model", "model_id"),
  id: "model",
  label: PropertyRecord.fromString("model"),
  extendedData: {
    isModel: true,
  },
});

/** @internal */
export const createCategoryNode = (parentModelKey?: InstanceKey) => ({
  __key: createKey("category", "category_id"),
  id: "category",
  parentId: "model",
  label: PropertyRecord.fromString("category"),
  extendedData: {
    isCategory: true,
    modelId: parentModelKey ? parentModelKey.id : undefined,
  },
});

/** @internal */
export const createElementClassGroupingNode = (elementIds: Id64String[]) => ({
  __key: createClassGroupingKey(elementIds),
  id: "element_class_grouping",
  label: PropertyRecord.fromString("grouping"),
});

/** @internal */
export const createElementNode = (modelId?: Id64String, categoryId?: Id64String) => ({
  __key: createKey("element", "element_id"),
  id: "element",
  label: PropertyRecord.fromString("element"),
  extendedData: {
    modelId,
    categoryId,
  },
});

/** @internal */
export const createKey = (type: "subject" | "model" | "category" | "element", ids: Id64String | Id64String[]): ECInstancesNodeKey => {
  let className: string;
  switch (type) {
    case "subject": className = "MyDomain:Subject"; break;
    case "model": className = "MyDomain:PhysicalModel"; break;
    case "category": className = "MyDomain:SpatialCategory"; break;
    default: className = "MyDomain:SomeElementType";
  }
  const instanceKeys = new Array<InstanceKey>();
  Id64.forEach(ids, (id) => instanceKeys.push({ className, id }));
  return {
    type: StandardNodeTypes.ECInstancesNode,
    instanceKeys,
    pathFromRoot: [],
  };
};

/** @internal */
export const createClassGroupingKey = (ids: Id64String[]): ECClassGroupingNodeKey => {
  return {
    type: StandardNodeTypes.ECClassGroupingNode,
    className: "MyDomain:SomeElementType",
    groupedInstancesCount: Array.isArray(ids) ? ids.length : 1,
    pathFromRoot: [],
  };
};
