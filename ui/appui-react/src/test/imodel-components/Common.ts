/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Id64String } from "@itwin/core-bentley";
import { Id64 } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey, ECInstancesNodeKey, InstanceKey} from "@itwin/presentation-common";
import { StandardNodeTypes } from "@itwin/presentation-common";
import { createRandomPropertyRecord, createRandomTreeNodeItem } from "@itwin/presentation-components/lib/cjs/test";
import { PropertyRecord } from "@itwin/appui-abstract";
import type { TreeModelNode } from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";

/** @internal */
export const createSimpleTreeModelNode = (id?: string): TreeModelNode => {
  return {
    id: id || "testId",
    parentId: undefined,
    depth: 1,

    isLoading: undefined,
    numChildren: undefined,

    description: undefined,
    isExpanded: true,
    label: createRandomPropertyRecord(),
    isSelected: true,

    checkbox: {
      state: CheckBoxState.On,
      isDisabled: false,
      isVisible: true,
    },

    item: createRandomTreeNodeItem(),
  };
};

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
  for (const id of Id64.iterable(ids))
    instanceKeys.push({ className, id });

  return {
    type: StandardNodeTypes.ECInstancesNode,
    version: 0,
    instanceKeys,
    pathFromRoot: [],
  };
};

/** @internal */
export const createClassGroupingKey = (ids: Id64String[]): ECClassGroupingNodeKey => {
  return {
    type: StandardNodeTypes.ECClassGroupingNode,
    version: 0,
    className: "MyDomain:SomeElementType",
    groupedInstancesCount: Array.isArray(ids) ? ids.length : 1,
    pathFromRoot: [],
  };
};
